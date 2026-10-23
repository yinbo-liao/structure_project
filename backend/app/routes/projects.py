from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, case, extract, and_
from datetime import datetime, date, timedelta
from typing import List

from app.database import get_db
from app.models import (
    Project as ProjectModel,
    User as UserModel,
    StructureFitUpInspection,
    StructureFinalInspection,
    StructureMaterialRegister,
    StructureMasterJointList,
    StructureNDTRequest,
    StructureNDTStatusRecord,
    NDTTest,
    WPSRegister,
    WelderRegister
)
from app.schemas import Project as ProjectSchema, ProjectCreate, ProjectSummary, ProjectWithUsers, _ProjectBasic, WeeklyNDTSummary
from app.auth import get_current_user, require_admin

router = APIRouter()

@router.post("/projects", response_model=ProjectSchema)
def create_project(project: ProjectCreate, db: Session = Depends(get_db), current_user: UserModel = Depends(get_current_user)):
    # Only admins can create projects
    if current_user.role != 'admin':
        raise HTTPException(status_code=403, detail="Only admins can create projects")
    
    existing_project = db.query(ProjectModel).filter(ProjectModel.code == project.code).first()
    if existing_project:
        raise HTTPException(status_code=400, detail="Project code already exists")
    
    db_project = ProjectModel(**project.model_dump(), owner_id=current_user.id)
    db.add(db_project)
    db.commit()
    db.refresh(db_project)
    project_loaded = db.query(ProjectModel).filter(ProjectModel.id == db_project.id).first()
    serialized = ProjectSchema.model_validate(project_loaded).model_dump()
    return serialized

@router.get("/projects", response_model=list[_ProjectBasic])
def read_projects(db: Session = Depends(get_db), current_user: UserModel = Depends(get_current_user)):
    if current_user.role == 'admin':
        projects = db.query(ProjectModel).all()
    else:
        projects = current_user.assigned_projects

    for p in projects:
        val = getattr(p, "project_type", None)
        if not val or str(val).strip() == "":
            setattr(p, "project_type", "structure")

    return projects

@router.get("/projects/my-projects", response_model=list[ProjectWithUsers])
def read_my_projects(db: Session = Depends(get_db), current_user: UserModel = Depends(get_current_user)):
    return current_user.assigned_projects

@router.get("/projects/{project_id}", response_model=ProjectSchema)
def read_project(project_id: int, db: Session = Depends(get_db), current_user: UserModel = Depends(get_current_user)):
    project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Check access permissions
    if current_user.role != 'admin' and project not in current_user.assigned_projects:
        raise HTTPException(status_code=403, detail="Not authorized to access this project")
    
    if not getattr(project, "project_type", None) or str(getattr(project, "project_type", "")).strip() == "":
        setattr(project, "project_type", "structure")
    return ProjectSchema.model_validate(project).model_dump()

@router.put("/projects/{project_id}", response_model=ProjectSchema)
def update_project(project_id: int, project_update: dict, db: Session = Depends(get_db), current_user: UserModel = Depends(get_current_user)):
    project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Only admins can update projects
    if current_user.role != 'admin':
        raise HTTPException(status_code=403, detail="Only admins can update projects")
    
    update_data = project_update if isinstance(project_update, dict) else project_update.model_dump(exclude_unset=True)
    allowed_fields = {"name", "code", "description"}
    update_data = {k: v for k, v in update_data.items() if k in allowed_fields}
    for field, value in update_data.items():
        setattr(project, field, value)
    
    db.commit()
    db.refresh(project)
    return ProjectSchema.model_validate(project).model_dump()

@router.delete("/projects/{project_id}")
def delete_project(project_id: int, db: Session = Depends(get_db), current_user: UserModel = Depends(get_current_user)):
    # Only admins can delete projects
    if current_user.role != 'admin':
        raise HTTPException(status_code=403, detail="Only admins can delete projects")
    
    project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    db.delete(project)
    db.commit()
    return {"message": "Project deleted successfully"}

@router.get("/projects/{project_id}/summary", response_model=ProjectSummary)
def get_project_summary(project_id: int, db: Session = Depends(get_db), current_user: UserModel = Depends(get_current_user)):
    # Check if user has access to this project
    project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    if current_user.role != 'admin' and project not in current_user.assigned_projects:
        raise HTTPException(status_code=403, detail="Not authorized to access this project")

    from app.services.project_summary_service import build_project_summary

    return build_project_summary(db, project_id)

@router.get("/projects/{project_id}/weekly-ndt-summary", response_model=List[WeeklyNDTSummary])
def get_weekly_ndt_summary(
    project_id: int, 
    weeks: int = 12,  # Default to last 12 weeks
    db: Session = Depends(get_db), 
    current_user: UserModel = Depends(get_current_user)
):
    # Check if user has access to this project
    project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    if current_user.role != 'admin' and project not in current_user.assigned_projects:
        raise HTTPException(status_code=403, detail="Not authorized to access this project")

    # Get the most recent NDT request date to determine date range
    # Structure only - no pipe models exist
    latest_request = db.query(func.max(StructureNDTRequest.request_time))\
        .filter(StructureNDTRequest.project_id == project_id)\
        .scalar()
    
    if not latest_request:
        return []  # No NDT requests yet
    
    # Calculate date range (last 'weeks' weeks)
    end_date = latest_request.date() if isinstance(latest_request, datetime) else latest_request
    start_date = end_date - timedelta(weeks=weeks)
    
    weekly_summaries = []
    
    # Generate weekly summaries
    current_week_start = start_date
    while current_week_start <= end_date:
        # Calculate week range (Sunday to Saturday)
        week_end = current_week_start + timedelta(days=6)
        
        # Get NDT requests for this week
        week_requests = db.query(StructureNDTRequest)\
            .filter(StructureNDTRequest.project_id == project_id)\
            .filter(StructureNDTRequest.request_time >= current_week_start)\
            .filter(StructureNDTRequest.request_time <= week_end + timedelta(days=1))  # Include entire end day
            
        # Get NDT tests linked to these requests for RT and UT methods
        rt_data = []
        ut_data = []
        
        for request in week_requests:
            # Get NDT tests for this request's final inspection
            tests = db.query(NDTTest)\
                .filter(NDTTest.final_id == request.final_id)\
                .filter(NDTTest.method.in_(['RT', 'UT']))\
                .all()
            
            for test in tests:
                if test.method == 'RT':
                    rt_data.append(test)
                elif test.method == 'UT':
                    ut_data.append(test)
        
        # Calculate RT statistics
        rt_tested_length = sum(t.test_length or 0 for t in rt_data)
        rt_rejected_length = sum(t.test_length or 0 for t in rt_data if t.result == 'rejected')
        rt_accepted_length = rt_tested_length - rt_rejected_length
        rt_success_rate = (rt_accepted_length / rt_tested_length * 100) if rt_tested_length > 0 else 0
        
        # Calculate UT statistics
        ut_tested_length = sum(t.test_length or 0 for t in ut_data)
        ut_rejected_length = sum(t.test_length or 0 for t in ut_data if t.result == 'rejected')
        ut_accepted_length = ut_tested_length - ut_rejected_length
        ut_success_rate = (ut_accepted_length / ut_tested_length * 100) if ut_tested_length > 0 else 0
        
        # Count joints
        rt_joints = len(set(t.final_id for t in rt_data))
        ut_joints = len(set(t.final_id for t in ut_data))
        
        rt_joints_accepted = len(set(t.final_id for t in rt_data if t.result == 'accepted'))
        ut_joints_accepted = len(set(t.final_id for t in ut_data if t.result == 'accepted'))
        
        rt_joints_rejected = len(set(t.final_id for t in rt_data if t.result == 'rejected'))
        ut_joints_rejected = len(set(t.final_id for t in ut_data if t.result == 'rejected'))
        
        weekly_summary = WeeklyNDTSummary(
            week_start=current_week_start,
            week_end=week_end,
            week_label=f"Week {current_week_start.strftime('%Y-%m-%d')} to {week_end.strftime('%Y-%m-%d')}",
            rt_success_rate=round(rt_success_rate, 2),
            ut_success_rate=round(ut_success_rate, 2),
            rt_tested_length=round(rt_tested_length, 3),
            ut_tested_length=round(ut_tested_length, 3),
            rt_rejected_length=round(rt_rejected_length, 3),
            ut_rejected_length=round(ut_rejected_length, 3),
            rt_accepted_length=round(rt_accepted_length, 3),
            ut_accepted_length=round(ut_accepted_length, 3),
            rt_joints_tested=rt_joints,
            ut_joints_tested=ut_joints,
            rt_joints_accepted=rt_joints_accepted,
            ut_joints_accepted=ut_joints_accepted,
            rt_joints_rejected=rt_joints_rejected,
            ut_joints_rejected=ut_joints_rejected
        )
        
        weekly_summaries.append(weekly_summary)
        
        # Move to next week
        current_week_start = week_end + timedelta(days=1)
    
    return weekly_summaries
