"""
NDT Sync API Endpoints
Provides endpoints for synchronizing NDT data between NDT status records and master joints list.
"""

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import Dict, Any

from ..database import get_db
from ..services.ndt_sync_service import NDTSyncService
from ..auth import get_current_user, UserRole

router = APIRouter(prefix="/ndt-sync", tags=["ndt-sync"])

@router.get("/status/{project_id}")
async def get_sync_status(
    project_id: int,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Get NDT sync status for a project
    """
    # Admin, Inspector and Visitor can access
    if current_user.role not in [UserRole.ADMIN, UserRole.INSPECTOR, UserRole.VISITOR]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    sync_service = NDTSyncService(db)
    return sync_service.get_sync_status_report(project_id)

@router.get("/status")
async def get_all_sync_status(
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Get NDT sync status for all projects
    """
    # Admin, Inspector and Visitor can access
    if current_user.role not in [UserRole.ADMIN, UserRole.INSPECTOR, UserRole.VISITOR]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    sync_service = NDTSyncService(db)
    return sync_service.get_sync_status_report()

@router.post("/sync/joint/{joint_id}")
async def sync_joint_ndt(
    joint_id: int,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Sync NDT data for a specific joint
    """
    # Only admin and inspector can access
    if current_user.role not in [UserRole.ADMIN, UserRole.INSPECTOR]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    sync_service = NDTSyncService(db)
    result = sync_service.sync_joint_ndt_data(joint_id)
    
    if not result.get('success', False):
        raise HTTPException(status_code=400, detail=result.get('error', 'Sync failed'))
    
    return result

@router.post("/sync/project/{project_id}")
async def sync_project_ndt(
    project_id: int,
    background_tasks: BackgroundTasks,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Sync NDT data for all joints in a project
    Can run in background for large projects
    """
    # Only admin and inspector can access
    if current_user.role not in [UserRole.ADMIN, UserRole.INSPECTOR]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    sync_service = NDTSyncService(db)
    
    # For small projects, run synchronously
    # For large projects, could run in background
    result = sync_service.sync_project_ndt_data(project_id)
    
    if not result.get('success', False):
        raise HTTPException(status_code=400, detail=result.get('error', 'Sync failed'))
    
    return result

@router.post("/sync/{project_id}")
async def sync_project_ndt_frontend(
    project_id: int,
    background_tasks: BackgroundTasks,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Sync NDT data for all joints in a project (Frontend Alias)
    """
    return await sync_project_ndt(project_id, background_tasks, current_user, db)

@router.post("/auto-sync/{project_id}")
async def auto_sync_project_ndt(
    project_id: int,
    background_tasks: BackgroundTasks,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Auto Sync NDT data for all joints in a project (Frontend Alias)
    """
    return await sync_project_ndt(project_id, background_tasks, current_user, db)

@router.post("/sync/all")
async def sync_all_projects_ndt(
    background_tasks: BackgroundTasks,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Sync NDT data for all projects
    Runs in background due to potentially large volume
    """
    # Only admin can access
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    sync_service = NDTSyncService(db)
    
    # Run synchronously for now, but could be moved to background
    result = sync_service.sync_all_projects()
    
    return result

@router.get("/config")
async def get_sync_config(
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Get NDT sync configuration and mapping
    """
    # Admin, Inspector and Visitor can access
    if current_user.role not in [UserRole.ADMIN, UserRole.INSPECTOR, UserRole.VISITOR]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    sync_service = NDTSyncService(db)
    
    return {
        "method_mapping": sync_service.get_ndt_method_mapping(),
        "completion_statuses": ["completed", "accepted"],
        "sync_conditions": {
            "fitup_status": ["completed", "accepted"],
            "final_status": ["completed", "accepted"]
        }
    }

@router.get("/joints/completed/{project_id}")
async def get_completed_joints(
    project_id: int,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Get list of joints that have completed fit-up and final inspection
    """
    # Admin, Inspector and Visitor can access
    if current_user.role not in [UserRole.ADMIN, UserRole.INSPECTOR, UserRole.VISITOR]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    sync_service = NDTSyncService(db)
    joints = sync_service.get_completed_joints(project_id)
    
    return {
        "project_id": project_id,
        "completed_joints": joints,
        "count": len(joints)
    }

@router.get("/joint/{joint_id}/ndt-records")
async def get_joint_ndt_records(
    joint_id: int,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Get NDT records for a specific joint
    """
    # Admin, Inspector and Visitor can access
    if current_user.role not in [UserRole.ADMIN, UserRole.INSPECTOR, UserRole.VISITOR]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    from ..models import StructureMasterJointList
    
    joint = db.query(StructureMasterJointList).filter(
        StructureMasterJointList.id == joint_id
    ).first()
    
    if not joint:
        raise HTTPException(status_code=404, detail="Joint not found")
    
    sync_service = NDTSyncService(db)
    ndt_records = sync_service.get_ndt_status_for_joint(
        joint.project_id, joint.draw_no, joint.structure_category,
        joint.page_no, joint.drawing_rev, joint.joint_no
    )
    
    return {
        "joint_id": joint_id,
        "joint_no": joint.joint_no,
        "project_id": joint.project_id,
        "ndt_records": ndt_records,
        "count": len(ndt_records)
    }