"""
Debug NDT sync logic
"""
import sys
sys.path.append('.')
from app.database import SessionLocal
from app.services.ndt_sync_service import NDTSyncService
from app.models import StructureMasterJointList, StructureNDTStatusRecord

def debug_ndt_sync():
    db = SessionLocal()
    try:
        sync_service = NDTSyncService(db)
        
        # Get all joints for project 1
        joints = db.query(StructureMasterJointList).filter(
            StructureMasterJointList.project_id == 1
        ).all()
        
        print(f"Found {len(joints)} joints in project 1")
        
        # Get all NDT status records for project 1
        ndt_records = db.query(StructureNDTStatusRecord).filter(
            StructureNDTStatusRecord.project_id == 1
        ).all()
        
        print(f"Found {len(ndt_records)} NDT status records in project 1")
        
        # Check first joint
        if joints:
            joint = joints[0]
            print(f"\nFirst joint: {joint.joint_no} (ID: {joint.id})")
            print(f"  draw_no: {joint.draw_no}")
            print(f"  structure_category: {joint.structure_category}")
            print(f"  page_no: {joint.page_no}")
            print(f"  drawing_rev: {joint.drawing_rev}")
            print(f"  joint_no: {joint.joint_no}")
            
            # Get NDT records for this joint
            joint_ndt_records = sync_service.get_ndt_status_for_joint(
                joint.project_id, joint.draw_no, joint.structure_category,
                joint.page_no, joint.drawing_rev, joint.joint_no
            )
            
            print(f"  Found {len(joint_ndt_records)} NDT records for this joint")
            
            if joint_ndt_records:
                print(f"  First NDT record:")
                print(f"    ndt_type: {joint_ndt_records[0]['ndt_type']}")
                print(f"    ndt_report_no: {joint_ndt_records[0]['ndt_report_no']}")
                print(f"    ndt_result: {joint_ndt_records[0]['ndt_result']}")
        
        # Check first NDT record
        if ndt_records:
            ndt_record = ndt_records[0]
            print(f"\nFirst NDT status record:")
            print(f"  draw_no: {ndt_record.draw_no}")
            print(f"  joint_no: {ndt_record.joint_no}")
            print(f"  ndt_type: {ndt_record.ndt_type}")
            print(f"  ndt_report_no: {ndt_record.ndt_report_no}")
            print(f"  ndt_result: {ndt_record.ndt_result}")
        
        # Test sync for first joint
        if joints:
            joint = joints[0]
            print(f"\nTesting sync for joint {joint.joint_no} (ID: {joint.id})...")
            result = sync_service.sync_joint_ndt_data(joint.id)
            print(f"  Result: {result}")
            
            # Check what columns would be updated
            print(f"\nChecking NDT method mapping...")
            method_mapping = sync_service.get_ndt_method_mapping()
            print(f"  Method mapping: {method_mapping}")
            
            # Check if RT is in method mapping
            if 'RT' in method_mapping:
                report_col, result_col = method_mapping['RT']
                print(f"  RT maps to: report_col={report_col}, result_col={result_col}")
                
                # Check current values
                current_report = getattr(joint, report_col, None)
                current_result = getattr(joint, result_col, None)
                print(f"  Current values: {report_col}={current_report}, {result_col}={current_result}")
        
        # Test sync for project
        print(f"\nTesting sync for project 1...")
        result = sync_service.sync_project_ndt_data(1)
        print(f"  synced_count: {result.get('synced_count')}")
        print(f"  skipped_count: {result.get('skipped_count')}")
        print(f"  total_joints: {result.get('total_joints')}")
        print(f"  synced_joints: {result.get('synced_joints')}")
        print(f"  skipped_joints: {result.get('skipped_joints')}")
        
    finally:
        db.close()

if __name__ == "__main__":
    debug_ndt_sync()