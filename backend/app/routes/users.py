from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models_minimal import User as UserModel
# Temporarily remove Project import to fix login
# from app.models_fixed import Project
from app.schemas import User as UserSchema, UserCreate, UserUpdate, UserWithProjects, PasswordChange, PasswordReset
from app.auth import get_current_user, get_password_hash, verify_password, require_admin

router = APIRouter()

@router.post("/users", response_model=UserSchema)
def create_user(user: UserCreate, db: Session = Depends(get_db), current_user: UserModel = Depends(require_admin)):
    # Check if user already exists
    existing_user = db.query(UserModel).filter(UserModel.email == user.email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed_password = get_password_hash(user.password)
    db_user = UserModel(
        email=user.email,
        hashed_password=hashed_password,
        full_name=user.full_name,
        role=user.role,
        password_change_required=True  # Force password change on first login
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

@router.get("/users", response_model=list[UserWithProjects])
def read_users(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), current_user: UserModel = Depends(require_admin)):
    users = db.query(UserModel).offset(skip).limit(limit).all()
    return users

@router.get("/users/me", response_model=UserWithProjects)
def read_user_me(current_user: UserModel = Depends(get_current_user)):
    return current_user

@router.put("/users/{user_id}", response_model=UserSchema)
def update_user(user_id: int, user_update: UserUpdate, db: Session = Depends(get_db), current_user: UserModel = Depends(require_admin)):
    user = db.query(UserModel).filter(UserModel.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    update_data = user_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(user, field, value)
    
    db.commit()
    db.refresh(user)
    return user

@router.delete("/users/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db), current_user: UserModel = Depends(require_admin)):
    user = db.query(UserModel).filter(UserModel.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Don't allow deleting the current user
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    
    db.delete(user)
    db.commit()
    return {"message": "User deleted successfully"}

@router.post("/users/{user_id}/change-password")
def change_password(user_id: int, password_change: PasswordChange, db: Session = Depends(get_db), current_user: UserModel = Depends(get_current_user)):
    # Users can change their own password, admins can change any password
    if current_user.id != user_id and current_user.role != 'admin':
        raise HTTPException(status_code=403, detail="Not authorized to change this password")
    
    user = db.query(UserModel).filter(UserModel.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Verify current password (only for non-admin changing own password)
    if current_user.id == user_id:
        if not verify_password(password_change.current_password, user.hashed_password):
            raise HTTPException(status_code=400, detail="Current password is incorrect")
    
    user.hashed_password = get_password_hash(password_change.new_password)
    user.password_change_required = False  # Clear the flag after password change
    db.commit()
    return {"message": "Password updated successfully"}

@router.post("/users/{user_id}/reset-password")
def reset_password(user_id: int, password_reset: PasswordReset, db: Session = Depends(get_db), current_user: UserModel = Depends(require_admin)):
    """Admin-only endpoint to reset a user's password without knowing current password"""
    user = db.query(UserModel).filter(UserModel.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user.hashed_password = get_password_hash(password_reset.new_password)
    user.password_change_required = True  # Force password change on next login
    db.commit()
    return {"message": "Password reset successfully. User will be required to change password on next login."}

@router.post("/users/{user_id}/assign-projects")
def assign_projects_to_user(user_id: int, assignment: dict, db: Session = Depends(get_db), current_user: UserModel = Depends(require_admin)):
    # Temporarily disabled to fix login
    raise HTTPException(status_code=503, detail="Project assignment temporarily disabled while fixing login")

@router.get("/users/{user_id}/projects")
def get_user_projects(user_id: int, db: Session = Depends(get_db), current_user: UserModel = Depends(get_current_user)):
    # Temporarily disabled to fix login
    raise HTTPException(status_code=503, detail="Project retrieval temporarily disabled while fixing login")
