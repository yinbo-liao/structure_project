from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import timedelta
import time
import logging
from app.database import get_db
from app.auth import (
    ACCESS_TOKEN_EXPIRE_MINUTES,
    MAX_FAILED_LOGIN_ATTEMPTS,
    account_suspension_detail,
    authenticate_user,
    clear_login_failures,
    create_access_token,
    get_current_user,
    is_account_suspended,
    mark_login_success,
    register_failed_login,
)
from app.models import User as UserModel
from app.schemas import Token, LoginRequest, User

logger = logging.getLogger(__name__)

router = APIRouter()

# Simple in-memory rate limiter for login endpoints
_login_attempts: dict[str, list[float]] = {}
_MAX_LOGIN_ATTEMPTS = 5
_LOGIN_WINDOW = 60  # seconds


def _check_rate_limit(client_ip: str) -> bool:
    now = time.time()
    window_start = now - _LOGIN_WINDOW
    attempts = [t for t in _login_attempts.get(client_ip, []) if t > window_start]
    _login_attempts[client_ip] = attempts
    return len(attempts) < _MAX_LOGIN_ATTEMPTS


def _record_login_attempt(client_ip: str):
    _login_attempts.setdefault(client_ip, []).append(time.time())


def _get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "127.0.0.1"


def _login_or_raise(db: Session, username: str, password: str):
    """Authenticate, enforcing the three-strikes / one-day suspension policy."""
    user = db.query(UserModel).filter(UserModel.email == username).first()

    if user is not None:
        if is_account_suspended(user):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=account_suspension_detail(user),
            )
        if user.locked_until is not None:
            # A previous suspension has expired: start a fresh set of attempts.
            clear_login_failures(db, user)

    authenticated = authenticate_user(db, username, password)
    if not authenticated:
        if user is not None:
            if register_failed_login(db, user):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=account_suspension_detail(user),
                )
            remaining = MAX_FAILED_LOGIN_ATTEMPTS - (user.failed_login_attempts or 0)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=(
                    f"Incorrect email or password. {remaining} attempt(s) left "
                    "before the account is suspended for 1 day."
                ),
            )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )

    if not authenticated.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Inactive user",
        )

    mark_login_success(db, authenticated)
    return authenticated


@router.post("/token", response_model=Token)
def login_for_access_token(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    client_ip = _get_client_ip(request)
    if not _check_rate_limit(client_ip):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many login attempts. Please try again later."
        )
    _record_login_attempt(client_ip)

    user = _login_or_raise(db, form_data.username, form_data.password)

    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/login", response_model=dict)
def login(request: Request, login_data: LoginRequest, db: Session = Depends(get_db)):
    client_ip = _get_client_ip(request)
    if not _check_rate_limit(client_ip):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many login attempts. Please try again later."
        )
    _record_login_attempt(client_ip)

    user = _login_or_raise(db, login_data.username, login_data.password)

    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role,
            "password_change_required": user.password_change_required,
            "assigned_projects": []
        }
    }


@router.post("/logout")
async def logout(current_user: User = Depends(get_current_user)):
    return {"message": "Successfully logged out"}


@router.get("/verify-token")
async def verify_token(current_user: User = Depends(get_current_user)):
    return {
        "valid": True,
        "user": {
            "id": current_user.id,
            "email": current_user.email,
            "full_name": current_user.full_name,
            "role": current_user.role
        }
    }
