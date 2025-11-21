from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, case
from app.database import get_db
from app.models import Project as ProjectModel, User as UserModel, FitUpInspection, FinalInspection, MaterialRegister, MasterJointList, NDTRequest, NDTStatusRecord, NDTTest
from app.schemas import Project as ProjectSchema, ProjectCreate, ProjectSummary, ProjectWithUsers, _ProjectBasic
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
        # Admins see all projects
        projects = db.query(ProjectModel).all()
    else:
        # Other users see only assigned projects
        projects = current_user.assigned_projects
    
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
    return project

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

    total_joints_count = db.query(MasterJointList).filter(MasterJointList.project_id == project_id).count()
    fitup_done_count = db.query(FitUpInspection).filter(FitUpInspection.project_id == project_id).count()
    final_done_count = db.query(FinalInspection).filter(FinalInspection.project_id == project_id).count()

    # Material counts
    used_piece_marks = db.query(FitUpInspection.part1_piece_mark_no).filter(
        FitUpInspection.project_id == project_id, FitUpInspection.part1_piece_mark_no.isnot(None)
    ).union(
        db.query(FitUpInspection.part2_piece_mark_no).filter(
            FitUpInspection.project_id == project_id, FitUpInspection.part2_piece_mark_no.isnot(None)
        )
    ).subquery()
    material_used_count = db.query(used_piece_marks).distinct().count()

    material_pending_count = db.query(MaterialRegister).filter(
        MaterialRegister.project_id == project_id,
        MaterialRegister.inspection_status == "pending"
    ).count()
    material_inspected_count = db.query(MaterialRegister).filter(
        MaterialRegister.project_id == project_id,
        MaterialRegister.inspection_status == "inspected"
    ).count()
    material_rejected_count = db.query(MaterialRegister).filter(
        MaterialRegister.project_id == project_id,
        MaterialRegister.inspection_status == "rejected"
    ).count()

    # NDT Request counts
    ndt_requests_total = db.query(NDTRequest).filter(NDTRequest.project_id == project_id).count()
    ndt_requests_pending = db.query(NDTRequest).filter(
        NDTRequest.project_id == project_id,
        NDTRequest.status == "pending"
    ).count()
    ndt_requests_approved = db.query(NDTRequest).filter(
        NDTRequest.project_id == project_id,
        NDTRequest.status == "approved"
    ).count()

    test_length_total = db.query(func.sum(NDTStatusRecord.weld_size))\
        .join(FinalInspection, FinalInspection.id == NDTStatusRecord.final_id)\
        .filter(NDTStatusRecord.project_id == project_id)\
        .filter(FinalInspection.final_result.ilike('accepted'))\
        .scalar() or 0.0

    weld_reject_length = db.query(func.sum(NDTStatusRecord.rejected_length))\
        .join(FinalInspection, FinalInspection.id == NDTStatusRecord.final_id)\
        .filter(NDTStatusRecord.project_id == project_id)\
        .filter(FinalInspection.final_result.ilike('accepted'))\
        .scalar() or 0.0
    weld_accept_length = max((test_length_total - weld_reject_length), 0.0)

    ndt_types = ['MPI', 'PT', 'RT', 'UT', 'PAUT', 'FT', 'PMI']
    ndt_success_rates = {}
    ndt_weld_lengths_by_method = {}
    ndt_joint_counts_by_method = {}

    for ndt_type in ndt_types:
        agg = db.query(
            func.sum(NDTStatusRecord.weld_size).label('tested'),
            func.sum(NDTStatusRecord.rejected_length).label('rejected'),
            func.count(func.distinct(case(((NDTStatusRecord.ndt_result == 'accepted'), NDTStatusRecord.final_id)))).label('acc_joints'),
            func.count(func.distinct(case(((NDTStatusRecord.ndt_result == 'rejected'), NDTStatusRecord.final_id)))).label('rej_joints'),
        ).join(FinalInspection, FinalInspection.id == NDTStatusRecord.final_id)\
         .filter(NDTStatusRecord.project_id == project_id)\
         .filter(NDTStatusRecord.ndt_type == ndt_type)\
         .filter(FinalInspection.final_result.ilike('accepted'))\
         .one()
        tested_len = float(agg.tested or 0.0)
        rejected_len = float(agg.rejected or 0.0)
        accepted_len = max(tested_len - rejected_len, 0.0)
        total_len = accepted_len + rejected_len
        success_rate = (accepted_len / total_len * 100) if total_len > 0 else 0.0
        ndt_success_rates[ndt_type] = round(success_rate, 2)
        if tested_len > 0:
            ndt_weld_lengths_by_method[ndt_type] = {
                "accepted_mm": round(accepted_len, 3),
                "rejected_mm": round(rejected_len, 3),
                "tested_mm": round(tested_len, 3)
            }
        ndt_joint_counts_by_method[ndt_type] = {
            "accepted_joints": int(agg.acc_joints or 0),
            "rejected_joints": int(agg.rej_joints or 0)
        }

    welder_rows = db.query(
        NDTStatusRecord.welder_no.label('welder_no'),
        func.sum(NDTStatusRecord.weld_size).label('tested'),
        func.sum(NDTStatusRecord.rejected_length).label('rejected')
    ).join(FinalInspection, FinalInspection.id == NDTStatusRecord.final_id)\
     .filter(NDTStatusRecord.project_id == project_id)\
     .filter(FinalInspection.final_result.ilike('accepted'))\
     .filter(NDTStatusRecord.ndt_type.in_(['RT','UT']))\
     .filter(NDTStatusRecord.welder_no.isnot(None))\
     .group_by(NDTStatusRecord.welder_no).all()
    welder_performance = []
    for wr in welder_rows:
        test_len = float(wr.tested or 0.0)
        rejected_len_w = float(wr.rejected or 0.0)
        rate_w = (rejected_len_w / test_len * 100) if test_len > 0 else 0.0
        retrain = (test_len >= 100000.0) and (rate_w > 2.0)
        welder_performance.append({
            "welder_no": wr.welder_no,
            "total_mm": round(test_len, 3),
            "rejected_mm": round(rejected_len_w, 3),
            "reject_rate": round(rate_w, 2),
            "retrain": retrain
        })
    welder_performance.sort(key=lambda x: x["reject_rate"], reverse=True)
    welder_performance_top10 = welder_performance[:10]

    # Outstanding calculations
    material_missing_from_fitup = max(total_joints_count - fitup_done_count, 0)
    fitup_outstanding = max(total_joints_count - fitup_done_count, 0)
    final_outstanding = max(fitup_done_count - final_done_count, 0)
    accepted_finals_count = db.query(FinalInspection).filter(
        FinalInspection.project_id == project_id,
        FinalInspection.final_result.ilike("accepted")
    ).count()
    ndt_done_count = db.query(func.count(func.distinct(NDTStatusRecord.final_id)))\
        .join(FinalInspection, FinalInspection.id == NDTStatusRecord.final_id)\
        .filter(NDTStatusRecord.project_id == project_id)\
        .filter(FinalInspection.final_result.ilike('accepted'))\
        .filter(NDTStatusRecord.ndt_result == 'accepted')\
        .scalar() or 0
    from app.models import WPSRegister, WelderRegister
    wps_total = db.query(WPSRegister).filter(WPSRegister.project_id == project_id).count()
    wps_active = db.query(WPSRegister).filter(WPSRegister.project_id == project_id, WPSRegister.status == "active").count()
    welder_total = db.query(WelderRegister).filter(WelderRegister.project_id == project_id).count()
    welder_active = db.query(WelderRegister).filter(WelderRegister.project_id == project_id, WelderRegister.status == "active").count()
    summary = ProjectSummary(
        project_id=project_id,
        project_name=project.name,
        total_joints=total_joints_count,
        fitup_done=fitup_done_count,
        final_done=final_done_count,
        material_used=material_used_count,
        material_missing_from_fitup=material_missing_from_fitup,
        material_pending_inspection=material_pending_count,
        material_inspected=material_inspected_count,
        material_rejected=material_rejected_count,
        ndt_requests_total=ndt_requests_total,
        ndt_requests_pending=ndt_requests_pending,
        ndt_requests_approved=ndt_requests_approved,
        weld_accept_length_total=weld_accept_length,
        weld_reject_length_total=weld_reject_length,
        ndt_success_rates=ndt_success_rates,
        ndt_weld_lengths_by_method=ndt_weld_lengths_by_method,
        ndt_joint_counts_by_method=ndt_joint_counts_by_method,
        welder_performance_top10=welder_performance_top10,
        fitup_outstanding=fitup_outstanding,
        final_outstanding=final_outstanding,
        ndt_done=ndt_done_count,
        ndt_outstanding=max(accepted_finals_count - ndt_done_count, 0),
        wps_total=wps_total,
        wps_active=wps_active,
        welder_total=welder_total,
        welder_active=welder_active
    )
    return summary
