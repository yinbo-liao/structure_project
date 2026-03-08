from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, case, extract, and_
from datetime import datetime, date, timedelta
from typing import List

from app.database import get_db
from app.models_fixed import (
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
    try:
        with open("debug_log.txt", "a") as f:
            f.write(f"DEBUG: Entered read_projects at {datetime.now()}\n")
            f.write(f"DEBUG: ProjectModel module: {ProjectModel.__module__}\n")
            f.write(f"DEBUG: ProjectModel.project_type type: {ProjectModel.project_type.type}\n")

        if current_user.role == 'admin':
            projects = db.query(ProjectModel).all()
        else:
            projects = current_user.assigned_projects
        
        with open("debug_log.txt", "a") as f:
            f.write(f"DEBUG: Fetched {len(projects)} projects\n")
            for p in projects:
                val = getattr(p, "project_type", None)
                f.write(f"DEBUG: Project {p.id} type raw: '{val}' (type: {type(val)})\n")
                if not val or str(val).strip() == "":
                    setattr(p, "project_type", "structure")

        return projects
    except Exception as e:
        with open("debug_log.txt", "a") as f:
            f.write(f"DEBUG ERROR in read_projects: {e}\n")
            import traceback
            traceback.print_exc(file=f)
        raise e

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

    # Structure-only summary
    total_joints_count = db.query(StructureMasterJointList).filter(StructureMasterJointList.project_id == project_id).count()
    fitup_done_count = db.query(StructureFitUpInspection).filter(StructureFitUpInspection.project_id == project_id).count()
    final_done_count = db.query(StructureFinalInspection).filter(StructureFinalInspection.project_id == project_id).count()

    # Material counts (structure)
    used_piece_marks = db.query(StructureFitUpInspection.part1_piece_mark_no).filter(
        StructureFitUpInspection.project_id == project_id, StructureFitUpInspection.part1_piece_mark_no.isnot(None)
    ).union(
        db.query(StructureFitUpInspection.part2_piece_mark_no).filter(
            StructureFitUpInspection.project_id == project_id, StructureFitUpInspection.part2_piece_mark_no.isnot(None)
        )
    ).subquery()
    material_used_count = db.query(used_piece_marks).distinct().count()

    material_pending_count = db.query(StructureMaterialRegister).filter(
        StructureMaterialRegister.project_id == project_id,
        StructureMaterialRegister.inspection_status == "pending"
    ).count()
    material_inspected_count = db.query(StructureMaterialRegister).filter(
        StructureMaterialRegister.project_id == project_id,
        StructureMaterialRegister.inspection_status == "inspected"
    ).count()
    material_rejected_count = db.query(StructureMaterialRegister).filter(
        StructureMaterialRegister.project_id == project_id,
        StructureMaterialRegister.inspection_status == "rejected"
    ).count()

    # NDT Request counts (structure)
    ndt_requests_total = db.query(StructureNDTRequest).filter(StructureNDTRequest.project_id == project_id).count()
    ndt_requests_pending = db.query(StructureNDTRequest).filter(
        StructureNDTRequest.project_id == project_id,
        StructureNDTRequest.status == "pending"
    ).count()
    ndt_requests_approved = db.query(StructureNDTRequest).filter(
        StructureNDTRequest.project_id == project_id,
        StructureNDTRequest.status == "approved"
    ).count()

    test_length_total = db.query(func.sum(NDTTest.test_length))\
        .filter(NDTTest.project_id == project_id)\
        .scalar() or 0.0

    weld_reject_length = db.query(func.sum(NDTTest.test_length))\
        .filter(NDTTest.project_id == project_id)\
        .filter(NDTTest.result == 'rejected')\
        .scalar() or 0.0

    if test_length_total <= 0.0:
        test_length_total = db.query(func.sum(StructureNDTStatusRecord.weld_length))\
            .join(StructureFinalInspection, StructureFinalInspection.id == StructureNDTStatusRecord.final_id)\
            .filter(StructureNDTStatusRecord.project_id == project_id)\
            .filter(StructureFinalInspection.final_result.ilike('accepted'))\
            .scalar() or 0.0

        weld_reject_length = db.query(func.sum(StructureNDTStatusRecord.rejected_length))\
            .join(StructureFinalInspection, StructureFinalInspection.id == StructureNDTStatusRecord.final_id)\
            .filter(StructureNDTStatusRecord.project_id == project_id)\
            .filter(StructureFinalInspection.final_result.ilike('accepted'))\
            .scalar() or 0.0

    weld_accept_length = max((test_length_total - weld_reject_length), 0.0)

    # Calculate NDT statistics for all methods
    # Length-based methods: RT, UT, MPI, PT (measured in mm)
    # Joint-based methods: PMI, FT (measured in joint count)
    length_based_methods = ['RT', 'UT', 'MPI', 'PT']
    joint_based_methods = ['PMI', 'FT']
    all_ndt_methods = length_based_methods + joint_based_methods
    
    ndt_success_rates = {}
    ndt_weld_lengths_by_method = {}
    ndt_joint_counts_by_method = {}

    for ndt_type in all_ndt_methods:
        if ndt_type in length_based_methods:
            # Length-based calculation for RT, UT, MPI, PT
            # First try to get data from NDTTest table with proper validation
            agg = db.query(
                func.sum(NDTTest.test_length).label('tested'),
                func.sum(case((NDTTest.result == 'rejected', NDTTest.test_length), else_=0)).label('rejected'),
                func.count(func.distinct(case((NDTTest.result == 'accepted', NDTTest.final_id), else_=None))).label('acc_joints'),
                func.count(func.distinct(case((NDTTest.result == 'rejected', NDTTest.final_id), else_=None))).label('rej_joints'),
            ).filter(NDTTest.project_id == project_id)\
             .filter(NDTTest.method == ndt_type)\
             .filter(NDTTest.result.in_(['accepted', 'rejected', 'pending']))\
             .one()
            
            tested_len = float(agg.tested or 0.0)
            rejected_len = float(agg.rejected or 0.0)
            acc_joints = int(agg.acc_joints or 0)
            rej_joints = int(agg.rej_joints or 0)

            # If no valid test data found in NDTTest, try NDTStatusRecord
            if tested_len <= 0.0 and acc_joints == 0 and rej_joints == 0:
                agg_status = db.query(
                    func.sum(StructureNDTStatusRecord.weld_length).label('tested'),
                    func.sum(StructureNDTStatusRecord.rejected_length).label('rejected'),
                    func.count(func.distinct(case((StructureNDTStatusRecord.ndt_result == 'accepted', StructureNDTStatusRecord.final_id), else_=None))).label('acc_joints'),
                    func.count(func.distinct(case((StructureNDTStatusRecord.ndt_result == 'rejected', StructureNDTStatusRecord.final_id), else_=None))).label('rej_joints'),
                ).join(StructureFinalInspection, StructureFinalInspection.id == StructureNDTStatusRecord.final_id)\
                    .filter(StructureNDTStatusRecord.project_id == project_id)\
                    .filter(StructureNDTStatusRecord.ndt_type == ndt_type)\
                    .filter(StructureFinalInspection.final_result.ilike('accepted'))\
                    .filter(StructureNDTStatusRecord.ndt_result.in_(['accepted', 'rejected', 'pending']))\
                    .one()

                tested_len = float(agg_status.tested or 0.0)
                rejected_len = float(agg_status.rejected or 0.0)
                acc_joints = int(agg_status.acc_joints or 0)
                rej_joints = int(agg_status.rej_joints or 0)

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
                "accepted_joints": acc_joints,
                "rejected_joints": rej_joints
            }
        else:
            # Joint-based calculation for PMI, FT
            agg = db.query(
                func.count(func.distinct(case((NDTTest.result == 'accepted', NDTTest.final_id), else_=None))).label('acc_joints'),
                func.count(func.distinct(case((NDTTest.result == 'rejected', NDTTest.final_id), else_=None))).label('rej_joints'),
            ).filter(NDTTest.project_id == project_id)\
             .filter(NDTTest.method == ndt_type)\
             .one()
            
            acc_joints = int(agg.acc_joints or 0)
            rej_joints = int(agg.rej_joints or 0)
            
            if acc_joints == 0 and rej_joints == 0:
                # Try NDTStatusRecord table
                agg_status = db.query(
                    func.count(func.distinct(case((StructureNDTStatusRecord.ndt_result == 'accepted', StructureNDTStatusRecord.final_id), else_=None))).label('acc_joints'),
                    func.count(func.distinct(case((StructureNDTStatusRecord.ndt_result == 'rejected', StructureNDTStatusRecord.final_id), else_=None))).label('rej_joints'),
                ).join(StructureFinalInspection, StructureFinalInspection.id == StructureNDTStatusRecord.final_id)\
                    .filter(StructureNDTStatusRecord.project_id == project_id)\
                    .filter(StructureNDTStatusRecord.ndt_type == ndt_type)\
                    .filter(StructureFinalInspection.final_result.ilike('accepted'))\
                    .one()
                
                acc_joints = int(agg_status.acc_joints or 0)
                rej_joints = int(agg_status.rej_joints or 0)
            
            total_joints = acc_joints + rej_joints
            success_rate = (acc_joints / total_joints * 100) if total_joints > 0 else 0.0
            
            ndt_success_rates[ndt_type] = round(success_rate, 2)
            
            ndt_joint_counts_by_method[ndt_type] = {
                "accepted_joints": acc_joints,
                "rejected_joints": rej_joints
            }
            
            # For joint-based methods, we still store in weld_lengths structure for consistency
            # but with joint counts instead of lengths
            if total_joints > 0:
                ndt_weld_lengths_by_method[ndt_type] = {
                    "accepted_mm": acc_joints,  # Storing joint count in accepted_mm field
                    "rejected_mm": rej_joints,   # Storing joint count in rejected_mm field
                    "tested_mm": total_joints    # Storing total joints in tested_mm field
                }

    welder_rows = []
    welder_rows = db.query(
        StructureFinalInspection.welder_no.label('welder_no'),
        func.sum(NDTTest.test_length).label('tested'),
        func.sum(case((NDTTest.result == 'rejected', NDTTest.test_length), else_=0)).label('rejected')
    ).join(NDTTest, NDTTest.final_id == StructureFinalInspection.id)\
        .filter(NDTTest.project_id == project_id)\
        .filter(NDTTest.method.in_(['RT','UT']))\
        .filter(StructureFinalInspection.welder_no.isnot(None))\
        .group_by(StructureFinalInspection.welder_no).all()
    
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
    
    # Structure only - no pipe models exist
    accepted_finals_count = db.query(StructureFinalInspection).filter(
        StructureFinalInspection.project_id == project_id,
        StructureFinalInspection.final_result.ilike("accepted")
    ).count()
    ndt_done_count = db.query(func.count(func.distinct(NDTTest.final_id)))\
        .filter(NDTTest.project_id == project_id)\
        .filter(NDTTest.result == 'accepted')\
        .scalar() or 0
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
