"""Project summary aggregation shared by the dashboard route and AI tools."""
from sqlalchemy import func, case
from sqlalchemy.orm import Session

from app.models import (
    Project as ProjectModel,
    StructureFitUpInspection,
    StructureFinalInspection,
    StructureMaterialRegister,
    StructureMasterJointList,
    StructureNDTRequest,
    StructureNDTStatusRecord,
    NDTTest,
    WPSRegister,
    WelderRegister,
)
from app.schemas import ProjectSummary


def build_project_summary(db: Session, project_id: int) -> ProjectSummary:
    """Compute the project dashboard summary for an existing project."""
    project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
    if project is None:
        raise LookupError(f"Project {project_id} not found")

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
