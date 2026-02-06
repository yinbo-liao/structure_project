#!/usr/bin/env python3
"""
Migration script for NDT validation and cleanup.

This script validates NDT status records and cleans up invalid records.
It ensures that:
1. All NDT status records have corresponding final inspections that are accepted
2. All NDT status records have corresponding NDT requests
3. Joint identifiers (line_no, spool_no, joint_no) are not empty
4. No duplicate records for same joint and NDT method
5. Weld length matches pipe diameter circumference for pipe projects
"""

import sys
import os
import argparse
from datetime import datetime

# Add the parent directory to the path to import app modules
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
from app.models import NDTStatus, FinalInspection, NDTRequest, Project
from sqlalchemy import and_, or_, func
from sqlalchemy.orm import joinedload

def validate_ndt_status_records(project_id=None, dry_run=True):
    """
    Validate NDT status records and identify invalid records.
    
    Args:
        project_id: Optional project ID to filter by
        dry_run: If True, only report issues without deleting
    
    Returns:
        dict with validation results
    """
    db = SessionLocal()
    try:
        # Build query
        query = db.query(NDTStatus)
        if project_id:
            query = query.filter(NDTStatus.project_id == project_id)
        
        all_records = query.all()
        total_records = len(all_records)
        
        invalid_records = []
        duplicate_records = []
        
        # Track duplicates by composite key
        key_counts = {}
        records_by_key = {}
        
        for record in all_records:
            issues = []
            key = f"{record.project_id}-{record.line_no or ''}-{record.spool_no or ''}-{record.joint_no or ''}-{record.ndt_type or ''}"
            
            # 1. Check for missing joint identifiers
            if not record.line_no or not record.spool_no or not record.joint_no:
                issues.append("Missing joint identifiers (line_no, spool_no, or joint_no)")
            
            # 2. Check for corresponding final inspection
            final = db.query(FinalInspection).filter(
                FinalInspection.id == record.final_id
            ).first()
            
            if not final:
                issues.append("No corresponding final inspection found")
            elif final.final_result != 'accepted':
                issues.append(f"Final inspection not accepted (status: {final.final_result})")
            
            # 3. Check for corresponding NDT request
            ndt_request = db.query(NDTRequest).filter(
                NDTRequest.final_id == record.final_id,
                NDTRequest.ndt_type == record.ndt_type
            ).first()
            
            if not ndt_request:
                issues.append("No corresponding NDT request found")
            
            # 4. For pipe projects, validate weld length against pipe diameter
            if record.pipe_dia and record.weld_size:
                try:
                    # Import the calculation function
                    from app.utils.weld_length import calculate_weld_length_from_diameter
                    calculated = calculate_weld_length_from_diameter(record.pipe_dia)
                    if calculated and abs(record.weld_size - calculated) > 0.1:
                        issues.append(f"Weld length {record.weld_size}mm doesn't match pipe diameter {record.pipe_dia} (expected ~{calculated:.1f}mm)")
                except ImportError:
                    # If the module doesn't exist, skip this check
                    pass
            
            # Track for duplicate detection
            if key in key_counts:
                key_counts[key] += 1
                records_by_key[key].append(record)
            else:
                key_counts[key] = 1
                records_by_key[key] = [record]
            
            if issues:
                invalid_records.append({
                    'id': record.id,
                    'project_id': record.project_id,
                    'key': key,
                    'issues': issues,
                    'record': {
                        'line_no': record.line_no,
                        'spool_no': record.spool_no,
                        'joint_no': record.joint_no,
                        'ndt_type': record.ndt_type,
                        'final_id': record.final_id,
                        'weld_size': record.weld_size,
                        'pipe_dia': record.pipe_dia
                    }
                })
        
        # Identify duplicates (more than 1 record with same key)
        for key, count in key_counts.items():
            if count > 1:
                duplicate_records.append({
                    'key': key,
                    'count': count,
                    'records': [{
                        'id': r.id,
                        'line_no': r.line_no,
                        'spool_no': r.spool_no,
                        'joint_no': r.joint_no,
                        'ndt_type': r.ndt_type,
                        'final_id': r.final_id
                    } for r in records_by_key[key]]
                })
        
        # If not dry run, delete invalid records
        deleted_count = 0
        if not dry_run and invalid_records:
            for invalid in invalid_records:
                record = db.query(NDTStatus).filter(NDTStatus.id == invalid['id']).first()
                if record:
                    db.delete(record)
                    deleted_count += 1
            db.commit()
        
        return {
            'dry_run': dry_run,
            'total_records': total_records,
            'invalid_count': len(invalid_records),
            'duplicate_count': len(duplicate_records),
            'invalid_records': invalid_records[:100],  # Limit output
            'duplicate_records': duplicate_records[:100],  # Limit output
            'deleted_count': deleted_count if not dry_run else 0
        }
        
    finally:
        db.close()

def cleanup_orphaned_ndt_status(project_id=None, dry_run=True):
    """
    Clean up orphaned NDT status records (no final inspection or NDT request).
    
    Args:
        project_id: Optional project ID to filter by
        dry_run: If True, only report issues without deleting
    
    Returns:
        dict with cleanup results
    """
    db = SessionLocal()
    try:
        # Build query for orphaned records
        query = db.query(NDTStatus)
        if project_id:
            query = query.filter(NDTStatus.project_id == project_id)
        
        # Find records without corresponding final inspection
        subquery_final = db.query(FinalInspection.id)
        orphaned_no_final = query.filter(~NDTStatus.final_id.in_(subquery_final)).all()
        
        # Find records without corresponding NDT request
        subquery_request = db.query(NDTRequest.final_id, NDTRequest.ndt_type).distinct()
        orphaned_no_request = []
        for record in query.all():
            has_request = db.query(NDTRequest).filter(
                NDTRequest.final_id == record.final_id,
                NDTRequest.ndt_type == record.ndt_type
            ).first()
            if not has_request:
                orphaned_no_request.append(record)
        
        # Combine and deduplicate
        orphaned_ids = set()
        orphaned_records = []
        
        for record in orphaned_no_final:
            if record.id not in orphaned_ids:
                orphaned_ids.add(record.id)
                orphaned_records.append({
                    'record': record,
                    'reason': 'No corresponding final inspection'
                })
        
        for record in orphaned_no_request:
            if record.id not in orphaned_ids:
                orphaned_ids.add(record.id)
                orphaned_records.append({
                    'record': record,
                    'reason': 'No corresponding NDT request'
                })
        
        # If not dry run, delete orphaned records
        deleted_count = 0
        if not dry_run and orphaned_records:
            for orphaned in orphaned_records:
                record = db.query(NDTStatus).filter(NDTStatus.id == orphaned['record'].id).first()
                if record:
                    db.delete(record)
                    deleted_count += 1
            db.commit()
        
        return {
            'dry_run': dry_run,
            'total_records': query.count(),
            'orphaned_count': len(orphaned_records),
            'orphaned_records': [{
                'id': o['record'].id,
                'project_id': o['record'].project_id,
                'line_no': o['record'].line_no,
                'spool_no': o['record'].spool_no,
                'joint_no': o['record'].joint_no,
                'ndt_type': o['record'].ndt_type,
                'final_id': o['record'].final_id,
                'reason': o['reason']
            } for o in orphaned_records[:100]],  # Limit output
            'deleted_count': deleted_count if not dry_run else 0
        }
        
    finally:
        db.close()

def main():
    parser = argparse.ArgumentParser(description='Validate and cleanup NDT status records')
    parser.add_argument('--project-id', type=int, help='Project ID to filter by')
    parser.add_argument('--execute', action='store_true', help='Execute changes (default is dry run)')
    parser.add_argument('--validate', action='store_true', help='Run validation checks')
    parser.add_argument('--cleanup', action='store_true', help='Clean up orphaned records')
    parser.add_argument('--all', action='store_true', help='Run all checks')
    
    args = parser.parse_args()
    
    if not any([args.validate, args.cleanup, args.all]):
        print("Please specify at least one operation: --validate, --cleanup, or --all")
        parser.print_help()
        return 1
    
    dry_run = not args.execute
    
    print(f"NDT Validation and Cleanup Script")
    print(f"Mode: {'DRY RUN' if dry_run else 'EXECUTE'}")
    print(f"Project ID: {args.project_id or 'All projects'}")
    print("-" * 80)
    
    if args.validate or args.all:
        print("\n1. VALIDATING NDT STATUS RECORDS")
        print("-" * 40)
        result = validate_ndt_status_records(args.project_id, dry_run)
        
        print(f"Total records: {result['total_records']}")
        print(f"Invalid records: {result['invalid_count']}")
        print(f"Duplicate groups: {result['duplicate_count']}")
        
        if result['invalid_count'] > 0:
            print(f"\nInvalid records (first {len(result['invalid_records'])}):")
            for invalid in result['invalid_records']:
                print(f"  ID {invalid['id']}: {invalid['key']}")
                for issue in invalid['issues']:
                    print(f"    - {issue}")
        
        if result['duplicate_count'] > 0:
            print(f"\nDuplicate groups (first {len(result['duplicate_records'])}):")
            for dup in result['duplicate_records']:
                print(f"  Key: {dup['key']} (count: {dup['count']})")
                for rec in dup['records']:
                    print(f"    - ID {rec['id']}: {rec['line_no']}-{rec['spool_no']}-{rec['joint_no']} ({rec['ndt_type']})")
        
        if not dry_run and result.get('deleted_count', 0) > 0:
            print(f"\nDeleted {result['deleted_count']} invalid records")
    
    if args.cleanup or args.all:
        print("\n2. CLEANING UP ORPHANED NDT STATUS RECORDS")
        print("-" * 40)
        result = cleanup_orphaned_ndt_status(args.project_id, dry_run)
        
        print(f"Total records: {result['total_records']}")
        print(f"Orphaned records: {result['orphaned_count']}")
        
        if result['orphaned_count'] > 0:
            print(f"\nOrphaned records (first {len(result['orphaned_records'])}):")
            for orphaned in result['orphaned_records']:
                print(f"  ID {orphaned['id']}: {orphaned['line_no']}-{orphaned['spool_no']}-{orphaned['joint_no']} ({orphaned['ndt_type']})")
                print(f"    - {orphaned['reason']}")
        
        if not dry_run and result.get('deleted_count', 0) > 0:
            print(f"\nDeleted {result['deleted_count']} orphaned records")
    
    print("\n" + "=" * 80)
    print("Operation completed successfully")
    
    return 0

if __name__ == '__main__':
    sys.exit(main())
