from jose import JWTError, jwt
from passlib.context import CryptContext
from datetime import datetime, timedelta
import os
import logging
from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User, UserRole
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).resolve().parent / ".env")

logger = logging.getLogger(__name__)

SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

_ENV = os.getenv("ENVIRONMENT", "development")
_is_dev = _ENV != "production"

if not SECRET_KEY:
    if _is_dev:
        SECRET_KEY = "dev-secret-key-change-in-production"
        logger.warning("SECRET_KEY not set, using insecure dev default")
    else:
        raise RuntimeError("SECRET_KEY environment variable is required in production")

_allow_test_bypass = (
    os.getenv("TEST_LOGIN_BYPASS", "false").lower() == "true"
    and _is_dev
)

pwd_context = CryptContext(schemes=["pbkdf2_sha256", "bcrypt"], deprecated="auto")
security = HTTPBearer(auto_error=False)


def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password):
    return pwd_context.hash(password)


def _get_or_create_bypass_user(db: Session) -> User:
    """Return existing bypass admin user or create one."""
    user = db.query(User).filter(User.email == "admin@mpdms.com").first()
    if user is None:
        user = User(
            email="admin@mpdms.com",
            full_name="Admin",
            role=UserRole.ADMIN,
            hashed_password=get_password_hash("admin"),
            is_active=True,
            password_change_required=False,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    return user


def authenticate_user(db: Session, email: str, password: str):
    user = db.query(User).filter(User.email == email).first()
    if not user:
        if _allow_test_bypass:
            allowed = {
                "admin@mpdms.com": ["admin", "admin123"],
                "inspector@mpdms.com": ["inspect"],
                "visitor@mpdms.com": ["visit"],
            }
            if email in allowed and password in allowed[email]:
                role_enum = {
                    "admin@mpdms.com": UserRole.ADMIN,
                    "inspector@mpdms.com": UserRole.INSPECTOR,
                    "visitor@mpdms.com": UserRole.VISITOR,
                }
                user = User(
                    email=email,
                    full_name=email.split("@")[0].title(),
                    role=role_enum[email],
                    hashed_password=get_password_hash(password),
                    is_active=True,
                    password_change_required=False,
                )
                db.add(user)
                db.commit()
                db.refresh(user)
                return user
        return False
    try:
        if not verify_password(password, user.hashed_password):
            return False
    except Exception:
        return False
    return user


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=15))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
):
    if credentials is None:
        if _allow_test_bypass:
            return _get_or_create_bypass_user(db)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            if _allow_test_bypass:
                return _get_or_create_bypass_user(db)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )
    except JWTError:
        if _allow_test_bypass:
            return _get_or_create_bypass_user(db)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user = db.query(User).filter(User.email == email).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


def require_role(required_role: str):
    def role_checker(current_user: User = Depends(get_current_user)):
        if current_user.role != required_role and current_user.role != 'admin':
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires {required_role} role"
            )
        return current_user
    return role_checker


def require_admin(current_user: User = Depends(get_current_user)):
    if current_user.role != 'admin':
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Requires admin role"
        )
    return current_user


def require_editor(current_user: User = Depends(get_current_user)):
    if current_user.role not in ['admin', 'inspector']:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Requires editor role (admin or inspector)"
        )
    return current_user
