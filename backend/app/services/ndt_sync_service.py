"""
NDT Sync Service
Automatically updates NDT testing report numbers and results from NDT status table
to master joints list when joints have completed fit-up, final, and NDT tests.
"""

import logging
from datetime import datetime
from typing import Dict, List, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func

from ..models import (
    StructureMasterJointList,
    StructureFitUpInspection,
    StructureFinalInspection,
    StructureNDTStatusRecord,
    NDTTest,
    Project
)

logger = logging.getLogger(__name__)

class NDTSyncService:
    """Service for synchronizing NDT data between NDT status records and master joints list"""
    
    def __init__(self, db: Session):
        self.db = db
    
    def get_ndt_method_mapping(self) -> Dict[str, Tuple[str, str]]:
        """Map NDT method abbreviations to column names"""
        return {
            'RT': ('ndt_rt_report_no', 'ndt_rt_result'),
            'UT': ('ndt_ut_report_no', 'ndt_ut_result'),
            'MPI': ('ndt_mpi_report_no', 'ndt_mpi_result'),
            'PT': ('ndt_pt_report_no', 'ndt_pt_result'),
            'PMI': ('ndt_pmi_report_no', 'ndt_pmi_result'),
            'FT': ('ndt_ft_report_no', 'ndt_ft_result'),
            'MT': ('ndt_mpi_report_no', 'ndt_mpi_result'),  # MT maps to MPI
            'PAUT': ('ndt_paut_report_no', 'ndt_paut_result'),  # PAUT maps to PAUT columns
        }
    
    def get_joint_key(self, project_id: int, draw_no: str, structure_category: str, 
                     page_no: str, drawing_rev: str, joint_no: str) -> str:
        """Create a unique key for joint identification"""
        return f"{project_id}_{draw_no}_{structure_category}_{page_no}_{drawing_rev}_{joint_no}"
    
    def get_completed_joints(self, project_id: Optional[int] = None) -> List[Dict]:
        """
        Get joints that have completed fit-up, final, and have NDT tests
        """
        query = self.db.query(
            StructureMasterJointList.id,
            StructureMasterJointList.project_id,
            StructureMasterJointList.draw_no,
            StructureMasterJointList.structure_category,
            StructureMasterJointList.page_no,
            StructureMasterJointList.drawing_rev,
            StructureMasterJointList.joint_no,
            StructureMasterJointList.fitup_status,
            StructureMasterJointList.final_status,
            StructureMasterJointList.ndt_comprehensive_status
        )
        
        # Filter by project if specified
        if project_id:
            query = query.filter(StructureMasterJointList.project_id == project_id)
        
        # Get all joints for the project, regardless of status
        # User requirement: Sync NDT for all joints, not just completed ones
        # query = query.filter(
        #     and_(
        #         StructureMasterJointList.fitup_status.in_(['completed', 'accepted']),
        #         StructureMasterJointList.final_status.in_(['completed', 'accepted'])
        #     )
        # )
        
        joints = []
        for joint in query.all():
            joint_dict = {
                'id': joint.id,
                'project_id': joint.project_id,
                'draw_no': joint.draw_no,
                'structure_category': joint.structure_category,
                'page_no': joint.page_no,
                'drawing_rev': joint.drawing_rev,
                'joint_no': joint.joint_no,
                'fitup_status': joint.fitup_status,
                'final_status': joint.final_status,
                'ndt_comprehensive_status': joint.ndt_comprehensive_status,
                'key': self.get_joint_key(
                    joint.project_id, joint.draw_no, joint.structure_category,
                    joint.page_no, joint.drawing_rev, joint.joint_no
                )
            }
            joints.append(joint_dict)
        
        return joints
    
    def get_ndt_status_for_joint(self, project_id: int, draw_no: str, structure_category: str,
                                page_no: str, drawing_rev: str, joint_no: str) -> List[Dict]:
        """
        Get all NDT status records for a specific joint
        Matching logic: Project ID + Drawing No + Joint No
        Also includes records with empty/null drawing number if joint number matches
        
        Priority: Check StructureNDTStatusRecord table first, then fall back to NDTTest table
        """
        logger.info(f"DEBUG: get_ndt_status_for_joint called for Project: {project_id}, Joint: {joint_no}, Draw: {draw_no}")
        target_joint = (joint_no or "").strip()
        if not target_joint:
            logger.info("DEBUG: Joint No is empty, returning empty list")
            return []
        
        # FIRST: Check NDTTest table (primary source for individual NDT results)
        logger.info(f"DEBUG: Checking NDTTest table for joint '{target_joint}'")
        
        # Check if joint_no is unique in the project
        # If unique, we can be more lenient with drawing number matching
        joint_count = self.db.query(func.count(StructureMasterJointList.id)).filter(
            StructureMasterJointList.project_id == project_id,
            func.lower(StructureMasterJointList.joint_no) == target_joint.lower()
        ).scalar()
        
        is_unique_joint = (joint_count == 1)
        logger.info(f"DEBUG: Joint '{target_joint}' unique? {is_unique_joint} (Count: {joint_count})")
        
        # Query NDTTest joined with StructureFinalInspection to get comprehensive test history
        candidates = self.db.query(NDTTest, StructureFinalInspection).join(
            StructureFinalInspection, NDTTest.final_id == StructureFinalInspection.id
        ).filter(
            NDTTest.project_id == project_id,
            func.lower(StructureFinalInspection.joint_no) == target_joint.lower()
        ).all()
        
        logger.info(f"DEBUG: NDTTest Query - Project: {project_id}, Joint: {target_joint}")
        logger.info(f"DEBUG: Found {len(candidates)} candidate NDTTest records")
        for idx, (t, f) in enumerate(candidates):
            logger.info(f"  [{idx}] ID: {t.id}, Method: {t.method}, Report: {t.report_no}, Result: {t.result}, Final Joint: {f.joint_no}")

        records = []
        target_draw = (draw_no or "").strip().lower()
        
        if candidates:
            logger.info(f"DEBUG: Found {len(candidates)} candidate NDTTest records for joint '{target_joint}'")
            for test, final in candidates:
                rec_draw = (final.draw_no or "").strip().lower()
                
                # Match logic...
                match = False
                if not rec_draw:
                    match = True
                elif target_draw and rec_draw == target_draw:
                    match = True
                elif is_unique_joint:
                    match = True
                
                if match:
                    records.append({
                        'id': test.id,
                        'ndt_type': test.method,
                        'ndt_report_no': test.report_no,
                        'ndt_result': test.result,
                        'test_length': test.test_length,
                        'weld_length': getattr(final, 'weld_length', None),
                        'rejected_length': 0.0,
                        'created_at': test.test_date or datetime.now()
                    })
        
        if records:
            logger.info(f"DEBUG: Returning {len(records)} matched records from NDTTest table")
            return records

        # SECOND: Fall back to StructureNDTStatusRecord table if no NDTTest records found
        logger.info(f"DEBUG: No NDTTest records found, checking StructureNDTStatusRecord table")
        ndt_status_records = self.db.query(StructureNDTStatusRecord).filter(
            StructureNDTStatusRecord.project_id == project_id,
            func.lower(StructureNDTStatusRecord.joint_no) == target_joint.lower()
        ).all()
        
        if ndt_status_records:
            logger.info(f"DEBUG: Found {len(ndt_status_records)} NDT status records in StructureNDTStatusRecord table")
            for status in ndt_status_records:
                # Parse comma-separated NDT types (e.g., "FT, PMI, RT, UT")
                ndt_types = [t.strip() for t in status.ndt_type.split(',')] if status.ndt_type else []
                logger.info(f"DEBUG: Parsed NDT types: {ndt_types} from '{status.ndt_type}'")
                
                for ndt_type in ndt_types:
                    records.append({
                        'ndt_type': ndt_type,
                        'ndt_report_no': status.ndt_report_no,
                        'ndt_result': status.ndt_result,
                        'test_length': 0.0,
                        'weld_length': 0.0,
                        'rejected_length': 0.0,
                        'created_at': status.created_at or datetime.now()
                    })
            
            logger.info(f"DEBUG: Returning {len(records)} records from StructureNDTStatusRecord table")
            return records
            
        return []
    
    def calculate_comprehensive_status(self, ndt_results: List[Dict]) -> str:
        """
        Calculate comprehensive NDT status based on individual test results
        """
        if not ndt_results:
            return "No NDT Required"
        
        # Check if all tests are passed
        all_passed = all(r['ndt_result'] in ['accepted', 'passed', 'PASS'] for r in ndt_results)
        any_rejected = any(r['ndt_result'] in ['rejected', 'failed', 'FAIL'] for r in ndt_results)
        any_pending = any(r['ndt_result'] in ['pending', None, ''] for r in ndt_results)
        
        if any_rejected:
            return "NDT Rejected"
        elif any_pending:
            return "NDT Pending"
        elif all_passed:
            return "NDT Accepted"
        else:
            return "NDT In Progress"

    def _normalize_result_for_master_joint(self, result: Optional[str]) -> Optional[str]:
        if result is None:
            return None
        val = result.strip()
        if not val:
            return None
        lv = val.lower()
        if lv == "accepted":
            return "Accepted"
        if lv == "rejected":
            return "Rejected"
        return val
    
    def sync_joint_ndt_data(self, joint_id: int) -> Dict:
        """
        Sync NDT data for a single joint
        Returns: Dict with sync results
        """
        print(f"DEBUG: sync_joint_ndt_data (ID) called for Joint ID: {joint_id}")
        joint = self.db.query(StructureMasterJointList).filter(
            StructureMasterJointList.id == joint_id
        ).first()
        
        if not joint:
            print(f"DEBUG: Joint ID {joint_id} not found in Master Joint List")
            return {'success': False, 'error': 'Joint not found'}
        
        # Get NDT status records for this joint
        print(f"DEBUG: Fetching NDT records for joint {joint.joint_no}")
        ndt_records = self.get_ndt_status_for_joint(
            joint.project_id, joint.draw_no, joint.structure_category,
            joint.page_no, joint.drawing_rev, joint.joint_no
        )
        
        # Get method mapping
        method_mapping = self.get_ndt_method_mapping()
        
        logger.info(f"Syncing joint {joint.joint_no} (ID: {joint.id}). Found {len(ndt_records)} NDT records.")
        print(f"DEBUG: Syncing joint {joint.joint_no} (ID: {joint.id}). Found {len(ndt_records)} NDT records.")

        # Update individual NDT method columns
        updates_made = False
        updated_ndt_types = []
        updated_ndt_report_nos = []
        updated_ndt_results = []
        
        for record in ndt_records:
            ndt_type = record['ndt_type']
            
            # Handle comma-separated NDT types (e.g., "FT, MPI, PMI, RT")
            ndt_types = []
            if ndt_type:
                # Split by comma and clean up whitespace
                ndt_types = [t.strip() for t in ndt_type.split(',')]
            
            for single_type in ndt_types:
                # Case-insensitive matching and common cleanup
                single_type_clean = single_type.upper().replace('.', '')
                
                if single_type_clean in method_mapping:
                    report_col, result_col = method_mapping[single_type_clean]
                    
                    logger.info(f"Checking {single_type_clean} for joint {joint.joint_no}. Current: {getattr(joint, report_col)}/{getattr(joint, result_col)}. New: {record['ndt_report_no']}/{record['ndt_result']}")
                    print(f"DEBUG: Checking {single_type_clean} ({report_col}/{result_col}). New: {record['ndt_report_no']}/{record['ndt_result']}")

                    # Only sync if we have actual data (not None/pending)
                    # User requirement: Don't sync "pending" results to master joint list
                    # Only sync when we have actual report numbers and non-pending results
                    ndt_report_no = record['ndt_report_no']
                    ndt_result = self._normalize_result_for_master_joint(record.get('ndt_result'))
                    
                    # Check if this is actual data worth syncing
                    has_actual_report = ndt_report_no and ndt_report_no.strip() and ndt_report_no.lower() not in ['none', 'pending', '']
                    has_actual_result = ndt_result and ndt_result.strip() and ndt_result.lower() not in ['none', 'pending', '']
                    
                    print(f"DEBUG: has_actual_report={has_actual_report}, has_actual_result={has_actual_result}")

                    # Update report number if we have actual data
                    current_report = getattr(joint, report_col)
                    if has_actual_report and current_report != ndt_report_no:
                        print(f"DEBUG: Updating Report No from '{current_report}' to '{ndt_report_no}'")
                        setattr(joint, report_col, ndt_report_no)
                        updates_made = True
                        updated_ndt_types.append(single_type)
                        updated_ndt_report_nos.append(ndt_report_no)
                    
                    # Update result if we have actual data
                    current_result = getattr(joint, result_col)
                    if has_actual_result and current_result != ndt_result:
                        print(f"DEBUG: Updating Result from '{current_result}' to '{ndt_result}'")
                        setattr(joint, result_col, ndt_result)
                        updates_made = True
                        updated_ndt_results.append(ndt_result)
                    
                    # If we have pending data, clear the columns (don't show "pending")
                    if not has_actual_report and current_report and current_report.strip():
                        # Clear report number if it exists but NDT status has no actual report
                        print(f"DEBUG: Clearing Report No '{current_report}' because new data is pending/empty")
                        setattr(joint, report_col, None)
                        updates_made = True
                    
                    if not has_actual_result and current_result and current_result.strip() and current_result.lower() not in ['', 'none']:
                        # Clear result if it exists but NDT status has no actual result
                        print(f"DEBUG: Clearing Result '{current_result}' because new data is pending/empty")
                        setattr(joint, result_col, None)
                        updates_made = True
                else:
                    logger.warning(f"NDT Type '{single_type}' (cleaned: '{single_type_clean}') not found in mapping for joint {joint.joint_no}")
                    print(f"DEBUG: NDT Type '{single_type}' not found in mapping")
        
        # Clear NDT columns for types not present in NDT status records
        # Get all mapped columns
        all_mapped_cols = set()
        for report_col, result_col in method_mapping.values():
            all_mapped_cols.add(report_col)
            all_mapped_cols.add(result_col)
        
        # Get updated columns based on found records
        updated_cols = set()
        for record in ndt_records:
            ndt_type = record['ndt_type']
            if ndt_type:
                types = [t.strip() for t in ndt_type.split(',')]
                for t in types:
                    clean_t = t.upper().replace('.', '')
                    if clean_t in method_mapping:
                        r_col, res_col = method_mapping[clean_t]
                        updated_cols.add(r_col)
                        updated_cols.add(res_col)
        
        # Reset columns that were not updated
        for col in all_mapped_cols:
            if col not in updated_cols:
                current_val = getattr(joint, col)
                if current_val is not None and current_val != "":
                    logger.info(f"Clearing NDT column {col} for joint {joint.joint_no} as no corresponding NDT record exists.")
                    print(f"DEBUG: Clearing NDT column {col} (was '{current_val}') as no corresponding NDT record exists.")
                    setattr(joint, col, None)
                    updates_made = True

        # Calculate and update comprehensive status
        comprehensive_status = self.calculate_comprehensive_status(ndt_records)
        if joint.ndt_comprehensive_status != comprehensive_status:
            print(f"DEBUG: Updating Comprehensive Status to '{comprehensive_status}'")
            joint.ndt_comprehensive_status = comprehensive_status
            updates_made = True
        
        # Update sync timestamp and status
        joint.ndt_last_sync = datetime.now()
        joint.ndt_sync_status = 'synced' if updates_made else 'no_changes'
        
        if updates_made:
            self.db.commit()
            logger.info(f"Synced NDT data for joint {joint.joint_no} in project {joint.project_id}")
            print(f"DEBUG: Sync completed successfully. Updates made.")
            
            # Prepare detail object for frontend
            detail = {
                'joint_id': joint.id,
                'draw_no': joint.draw_no,
                'joint_no': joint.joint_no,
                'ndt_type': ', '.join(updated_ndt_types) if updated_ndt_types else '',
                'ndt_report_no': ', '.join(updated_ndt_report_nos) if updated_ndt_report_nos else '',
                'ndt_result': ', '.join(updated_ndt_results) if updated_ndt_results else '',
                'status': 'updated'
            }
            
            return {
                'success': True,
                'joint_id': joint.id,
                'joint_no': joint.joint_no,
                'updates_made': True,
                'comprehensive_status': comprehensive_status,
                'ndt_records_count': len(ndt_records),
                'detail': detail
            }
        else:
            print(f"DEBUG: Sync completed. No updates needed.")
            # Prepare detail object for frontend (no changes)
            detail = {
                'joint_id': joint.id,
                'draw_no': joint.draw_no,
                'joint_no': joint.joint_no,
                'ndt_type': '',
                'ndt_report_no': '',
                'ndt_result': '',
                'status': 'no_changes'
            }
            
            return {
                'success': True,
                'joint_id': joint.id,
                'joint_no': joint.joint_no,
                'updates_made': False,
                'message': 'No changes needed',
                'detail': detail
            }
    
    def sync_project_ndt_data(self, project_id: int) -> Dict:
        """
        Sync NDT data for all joints in a project
        """
        project = self.db.query(Project).filter(Project.id == project_id).first()
        if not project:
            return {'success': False, 'error': 'Project not found'}
        
        # Get completed joints in this project
        completed_joints = self.get_completed_joints(project_id)
        
        results = {
            'success': True,
            'project_id': project_id,
            'project_name': project.name,
            'total_joints': len(completed_joints),
            'synced_joints': 0,
            'failed_joints': 0,
            'details': []
        }
        
        for joint in completed_joints:
            try:
                sync_result = self.sync_joint_ndt_data(joint['id'])
                if sync_result['success']:
                    if sync_result.get('updates_made', False):
                        results['synced_joints'] += 1
                else:
                    results['failed_joints'] += 1
                
                # Extract detail object for frontend
                if 'detail' in sync_result:
                    results['details'].append(sync_result['detail'])
                else:
                    # Create a detail object from sync_result
                    detail = {
                        'joint_id': sync_result.get('joint_id', joint['id']),
                        'draw_no': joint.get('draw_no', ''),
                        'joint_no': sync_result.get('joint_no', joint['joint_no']),
                        'ndt_type': '',
                        'ndt_report_no': '',
                        'ndt_result': '',
                        'status': 'failed' if not sync_result['success'] else ('updated' if sync_result.get('updates_made', False) else 'no_changes')
                    }
                    results['details'].append(detail)
                    
            except Exception as e:
                logger.error(f"Error syncing joint {joint['joint_no']}: {e}")
                results['failed_joints'] += 1
                # Create error detail object
                error_detail = {
                    'joint_id': joint['id'],
                    'draw_no': joint.get('draw_no', ''),
                    'joint_no': joint['joint_no'],
                    'ndt_type': '',
                    'ndt_report_no': '',
                    'ndt_result': '',
                    'status': 'error',
                    'error': str(e)
                }
                results['details'].append(error_detail)
        
        # Calculate skipped joints (joints that didn't need updates)
        results['skipped_joints'] = results['total_joints'] - results['synced_joints'] - results['failed_joints']
        
        # Add frontend-compatible properties
        results['synced_count'] = results['synced_joints']
        results['skipped_count'] = results['skipped_joints']
        
        return results
    
    def sync_all_projects(self) -> Dict:
        """
        Sync NDT data for all projects
        """
        projects = self.db.query(Project.id, Project.name).all()
        
        results = {
            'total_projects': len(projects),
            'synced_projects': 0,
            'failed_projects': 0,
            'project_results': []
        }
        
        for project in projects:
            try:
                project_result = self.sync_project_ndt_data(project.id)
                if project_result['success']:
                    results['synced_projects'] += 1
                else:
                    results['failed_projects'] += 1
                
                results['project_results'].append(project_result)
            except Exception as e:
                logger.error(f"Error syncing project {project.name}: {e}")
                results['failed_projects'] += 1
                results['project_results'].append({
                    'success': False,
                    'project_id': project.id,
                    'project_name': project.name,
                    'error': str(e)
                })
        
        return results
    
    def get_sync_status_report(self, project_id: Optional[int] = None) -> Dict:
        """
        Generate a report on NDT sync status
        """
        if project_id:
            joints = self.get_completed_joints(project_id)
            project = self.db.query(Project).filter(Project.id == project_id).first()
            project_name = project.name if project else f"Project {project_id}"
        else:
            joints = self.get_completed_joints()
            project_name = "All Projects"
        
        status_counts = {}
        for joint in joints:
            status = joint.get('ndt_comprehensive_status', 'Not Synced')
            status_counts[status] = status_counts.get(status, 0) + 1
        
        return {
            'project_id': project_id,
            'project_name': project_name,
            'total_completed_joints': len(joints),
            'status_counts': status_counts,
            'last_sync_time': datetime.now().isoformat()
        }
