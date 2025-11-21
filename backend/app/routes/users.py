from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User as UserModel, Project
from app.schemas import User as UserSchema, UserCreate, UserUpdate, UserWithProjects, PasswordChange
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
        role=user.role
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
    db.commit()
    return {"message": "Password updated successfully"}

@router.post("/users/{user_id}/assign-projects")
def assign_projects_to_user(user_id: int, assignment: dict, db: Session = Depends(get_db), current_user: UserModel = Depends(require_admin)):
    user = db.query(UserModel).filter(UserModel.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Clear existing assignments
    user.assigned_projects = []
    
    # Add new assignments
    project_ids = assignment.get("project_ids", [])
    for project_id in project_ids:
        project = db.query(Project).filter(Project.id == project_id).first()
        if project:
            user.assigned_projects.append(project)
    
    db.commit()
    return {"message": f"Assigned {len(project_ids)} projects to user"}

@router.get("/users/{user_id}/projects")
def get_user_projects(user_id: int, db: Session = Depends(get_db), current_user: UserModel = Depends(get_current_user)):
    # Users can view their own projects, admins can view any user's projects
    if current_user.id != user_id and current_user.role != 'admin':
        raise HTTPException(status_code=403, detail="Not authorized to view this user's projects")
    
    user = db.query(UserModel).filter(UserModel.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return user.assigned_projects