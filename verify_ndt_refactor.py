
import sys
import os
from datetime import datetime

# Add parent directory to path to import app
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy.orm import Session
from app.database import SessionLocal, engine, Base
from app.models import (
    Project, User, PipeFinalInspection, PipeNDTStatusRecord, PipeNDTRequest,
    StructureFinalInspection, StructureNDTStatusRecord, StructureNDTRequest,
    PipeFitUpInspection, StructureFitUpInspection
)
from app.routes.inspections import (
    ensure_ndt_status_record,
    update_ndt_status_record,
    delete_ndt_status_record,
    cleanup_orphaned_ndt_status_records,
    update_ndt_request,
    update_ndt_status
)
from fastapi import HTTPException

# Mock user and dependencies
class MockUser:
    def __init__(self, id, role, assigned_projects):
        self.id = id
        self.role = role
        self.assigned_projects = assigned_projects
        self.email = "test@example.com"

def get_test_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def setup_test_data(db: Session):
    # Create test user
    user = db.query(User).filter_by(email="test_admin@example.com").first()
    if not user:
        user = User(email="test_admin@example.com", hashed_password="hashed", role="admin", full_name="Test Admin")
        db.add(user)
        db.commit()
    
    # Create pipe project
    pipe_proj = db.query(Project).filter_by(name="Test Pipe Project").first()
    if not pipe_proj:
        pipe_proj = Project(name="Test Pipe Project", project_type="pipe", description="Test Pipe")
        db.add(pipe_proj)
        db.commit()
        
    # Create structure project
    struct_proj = db.query(Project).filter_by(name="Test Structure Project").first()
    if not struct_proj:
        struct_proj = Project(name="Test Structure Project", project_type="structure", description="Test Structure")
        db.add(struct_proj)
        db.commit()
    
    return user, pipe_proj, struct_proj

def test_pipe_flow(db: Session, user, project):
    print("\nTesting Pipe Flow...")
    
    # 1. Create Pipe FitUp
    fitup = PipeFitUpInspection(
        project_id=project.id,
        system_no="SYS-01",
        line_no="L-01",
        spool_no="SP-01",
        joint_no="J-01",
        weld_type="BW",
        fit_up_result="accepted"
    )
    db.add(fitup)
    db.commit()
    
    # 2. Create Pipe Final
    final = PipeFinalInspection(
        project_id=project.id,
        fitup_id=fitup.id,
        final_result="accepted",
        welder_no="W-01",
        weld_length=10.5,
        ndt_type="RT"
    )
    db.add(final)
    db.commit()
    
    # 3. Ensure NDT Status Record
    print(f"Calling ensure_ndt_status_record for final_id={final.id}...")
    try:
        rec = ensure_ndt_status_record(final_id=final.id, db=db, current_user=user)
        print(f"Created PipeNDTStatusRecord: id={rec.id}, type={type(rec)}")
        assert isinstance(rec, PipeNDTStatusRecord)
        assert rec.system_no == "SYS-01"
    except Exception as e:
        print(f"FAILED ensure_ndt_status_record: {e}")
        return

    # 4. Update NDT Status Record
    print(f"Calling update_ndt_status_record for id={rec.id}...")
    try:
        updated = update_ndt_status_record(
            record_id=rec.id, 
            payload={"ndt_report_no": "RT-001", "ndt_result": "accepted"}, 
            db=db, 
            current_user=user
        )
        print(f"Updated record: report={updated.ndt_report_no}, result={updated.ndt_result}")
        assert updated.ndt_report_no == "RT-001"
    except Exception as e:
        print(f"FAILED update_ndt_status_record: {e}")

    # 5. Cleanup Orphaned (Should not delete valid record)
    print("Calling cleanup_orphaned_ndt_status_records...")
    try:
        # We need an NDT request for it to NOT be orphaned
        req = PipeNDTRequest(
            project_id=project.id,
            final_id=final.id,
            system_no="SYS-01",
            line_no="L-01",
            spool_no="SP-01",
            joint_no="J-01",
            ndt_type="RT",
            request_date=datetime.now()
        )
        db.add(req)
        db.commit()
        
        result = cleanup_orphaned_ndt_status_records(project_id=project.id, dry_run=True, db=db, current_user=user)
        print(f"Cleanup result: {result}")
        # Valid record with final accepted and request should not be orphaned
        # Wait, the logic in cleanup checks:
        # 1. Final exists? Yes.
        # 2. Final accepted? Yes.
        # 3. NDT Request exists? Yes (just created).
        # 4. Identifiers exist? Yes.
        # So it should NOT be deleted.
        
    except Exception as e:
        print(f"FAILED cleanup_orphaned_ndt_status_records: {e}")

    # 6. Delete NDT Status Record
    print(f"Calling delete_ndt_status_record for id={rec.id}...")
    try:
        delete_ndt_status_record(record_id=rec.id, db=db, current_user=user)
        check = db.query(PipeNDTStatusRecord).filter_by(id=rec.id).first()
        print(f"Record after delete: {check}")
        assert check is None
    except Exception as e:
        print(f"FAILED delete_ndt_status_record: {e}")

def test_structure_flow(db: Session, user, project):
    print("\nTesting Structure Flow...")
    
    # 1. Create Structure FitUp
    fitup = StructureFitUpInspection(
        project_id=project.id,
        structure_category="Beam",
        page_no="P-01",
        drawing_rev="R0",
        joint_no="J-S1",
        weld_type="Fillet",
        fit_up_result="accepted"
    )
    db.add(fitup)
    db.commit()
    
    # 2. Create Structure Final
    final = StructureFinalInspection(
        project_id=project.id,
        fitup_id=fitup.id,
        final_result="accepted",
        welder_no="W-02",
        weld_length=20.0,
        ndt_type="MPI"
    )
    db.add(final)
    db.commit()
    
    # 3. Ensure NDT Status Record
    print(f"Calling ensure_ndt_status_record for final_id={final.id}...")
    try:
        rec = ensure_ndt_status_record(final_id=final.id, db=db, current_user=user)
        print(f"Created StructureNDTStatusRecord: id={rec.id}, type={type(rec)}")
        assert isinstance(rec, StructureNDTStatusRecord)
        assert rec.structure_category == "Beam"
    except Exception as e:
        print(f"FAILED ensure_ndt_status_record: {e}")
        return

    # 4. Update NDT Status Record
    print(f"Calling update_ndt_status_record for id={rec.id}...")
    try:
        updated = update_ndt_status_record(
            record_id=rec.id, 
            payload={"ndt_report_no": "MPI-001", "ndt_result": "accepted"}, 
            db=db, 
            current_user=user
        )
        print(f"Updated record: report={updated.ndt_report_no}, result={updated.ndt_result}")
        assert updated.ndt_report_no == "MPI-001"
    except Exception as e:
        print(f"FAILED update_ndt_status_record: {e}")

    # 5. Cleanup Orphaned
    print("Calling cleanup_orphaned_ndt_status_records...")
    try:
         # We need an NDT request for it to NOT be orphaned
        req = StructureNDTRequest(
            project_id=project.id,
            final_id=final.id,
            structure_category="Beam",
            page_no="P-01",
            drawing_rev="R0",
            joint_no="J-S1",
            ndt_type="MPI",
            request_date=datetime.now()
        )
        db.add(req)
        db.commit()
        
        result = cleanup_orphaned_ndt_status_records(project_id=project.id, dry_run=True, db=db, current_user=user)
        print(f"Cleanup result: {result}")
        
    except Exception as e:
        print(f"FAILED cleanup_orphaned_ndt_status_records: {e}")

    # 6. Delete NDT Status Record
    print(f"Calling delete_ndt_status_record for id={rec.id}...")
    try:
        delete_ndt_status_record(record_id=rec.id, db=db, current_user=user)
        check = db.query(StructureNDTStatusRecord).filter_by(id=rec.id).first()
        print(f"Record after delete: {check}")
        assert check is None
    except Exception as e:
        print(f"FAILED delete_ndt_status_record: {e}")

def main():
    print("Starting NDT Status Verification...")
    db = SessionLocal()
    try:
        user, pipe_proj, struct_proj = setup_test_data(db)
        
        # Test Pipe
        test_pipe_flow(db, user, pipe_proj)
        
        # Test Structure
        test_structure_flow(db, user, struct_proj)
        
        print("\nVerification Completed!")
    except Exception as e:
        print(f"\nVerification FAILED with error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    main()
