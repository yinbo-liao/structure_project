"""
Migrate data from old ndt_requests table to new pipe_ndt_requests and structure_ndt_requests tables.
"""

import sqlite3
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.database import get_db
from app.models import Base, PipeNDTRequest, StructureNDTRequest, Project
from datetime import datetime
import os

def migrate_ndt_requests():
    # Connect to SQLite database directly
    conn = sqlite3.connect('project_management.db')
    cursor = conn.cursor()
    
    # Get all records from old ndt_requests table
    cursor.execute("SELECT * FROM ndt_requests")
    old_records = cursor.fetchall()
    
    # Get column names
    cursor.execute("PRAGMA table_info(ndt_requests)")
    columns = [col[1] for col in cursor.fetchall()]
    
    print(f"Found {len(old_records)} records in old ndt_requests table")
    
    # Create SQLAlchemy engine
    engine = create_engine("sqlite:///./project_management.db")
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    
    migrated_count = 0
    skipped_count = 0
    
    for record in old_records:
        record_dict = dict(zip(columns, record))
        
        # Get project to determine project type
        project_id = record_dict.get('project_id')
        if not project_id:
            print(f"Skipping record {record_dict.get('id')}: No project_id")
            skipped_count += 1
            continue
            
        project = db.query(Project).filter(Project.id == project_id).first()
        if not project:
            print(f"Skipping record {record_dict.get('id')}: Project {project_id} not found")
            skipped_count += 1
            continue
        
        # Helper function to convert string to datetime
        def parse_datetime(dt_str):
            if not dt_str:
                return None
            try:
                # Try to parse the datetime string
                return datetime.fromisoformat(dt_str.replace('Z', '+00:00'))
            except (ValueError, AttributeError):
                try:
                    # Try other common formats
                    for fmt in ['%Y-%m-%d %H:%M:%S.%f', '%Y-%m-%d %H:%M:%S', '%Y-%m-%d']:
                        try:
                            return datetime.strptime(dt_str, fmt)
                        except ValueError:
                            continue
                except Exception:
                    pass
                return None
        
        # Check if record already exists in new tables
        if project.project_type == "pipe":
            # Check if exists in pipe_ndt_requests
            existing = db.query(PipeNDTRequest).filter(
                PipeNDTRequest.project_id == project_id,
                PipeNDTRequest.system_no == record_dict.get('system_no'),
                PipeNDTRequest.line_no == record_dict.get('line_no'),
                PipeNDTRequest.spool_no == record_dict.get('spool_no'),
                PipeNDTRequest.joint_no == record_dict.get('joint_no'),
                PipeNDTRequest.ndt_type == record_dict.get('ndt_type')
            ).first()
            
            if not existing:
                # Create new PipeNDTRequest
                new_record = PipeNDTRequest(
                    project_id=project_id,
                    final_id=record_dict.get('final_id'),
                    project_name=record_dict.get('project_name'),
                    project_code=record_dict.get('project_code'),
                    department=record_dict.get('department'),
                    incharge_person=record_dict.get('incharge_person'),
                    contact=record_dict.get('contact'),
                    request_time=parse_datetime(record_dict.get('request_time')),
                    contractor=record_dict.get('contractor'),
                    job_code=record_dict.get('job_code'),
                    job_location=record_dict.get('job_location'),
                    test_time=parse_datetime(record_dict.get('test_time')),
                    requirement=record_dict.get('requirement'),
                    detail_description=record_dict.get('detail_description'),
                    status=record_dict.get('status'),
                    ndt_type=record_dict.get('ndt_type'),
                    ndt_report_no=record_dict.get('ndt_report_no'),
                    ndt_result=record_dict.get('ndt_result'),
                    system_no=record_dict.get('system_no'),
                    line_no=record_dict.get('line_no'),
                    spool_no=record_dict.get('spool_no'),
                    joint_no=record_dict.get('joint_no'),
                    weld_type=record_dict.get('weld_type'),
                    welder_no=record_dict.get('welder_no'),
                    weld_size=record_dict.get('weld_size'),
                    weld_process=record_dict.get('weld_process'),
                    pipe_dia=record_dict.get('pipe_dia'),
                    inspection_category=record_dict.get('inspection_category') or 'type-I'
                )
                db.add(new_record)
                migrated_count += 1
            else:
                skipped_count += 1
                
        else:  # structure project
            # Check if exists in structure_ndt_requests
            existing = db.query(StructureNDTRequest).filter(
                StructureNDTRequest.project_id == project_id,
                StructureNDTRequest.draw_no == record_dict.get('draw_no'),
                StructureNDTRequest.structure_category == record_dict.get('structure_category'),
                StructureNDTRequest.page_no == record_dict.get('page_no'),
                StructureNDTRequest.drawing_rev == record_dict.get('drawing_rev'),
                StructureNDTRequest.joint_no == record_dict.get('joint_no'),
                StructureNDTRequest.ndt_type == record_dict.get('ndt_type')
            ).first()
            
            if not existing:
                # Create new StructureNDTRequest
                new_record = StructureNDTRequest(
                    project_id=project_id,
                    final_id=record_dict.get('final_id'),
                    project_name=record_dict.get('project_name'),
                    project_code=record_dict.get('project_code'),
                    department=record_dict.get('department'),
                    incharge_person=record_dict.get('incharge_person'),
                    contact=record_dict.get('contact'),
                    request_time=parse_datetime(record_dict.get('request_time')),
                    contractor=record_dict.get('contractor'),
                    job_code=record_dict.get('job_code'),
                    job_location=record_dict.get('job_location'),
                    test_time=parse_datetime(record_dict.get('test_time')),
                    requirement=record_dict.get('requirement'),
                    detail_description=record_dict.get('detail_description'),
                    status=record_dict.get('status'),
                    ndt_type=record_dict.get('ndt_type'),
                    ndt_report_no=record_dict.get('ndt_report_no'),
                    ndt_result=record_dict.get('ndt_result'),
                    draw_no=record_dict.get('draw_no'),
                    structure_category=record_dict.get('structure_category'),
                    page_no=record_dict.get('page_no'),
                    drawing_rev=record_dict.get('drawing_rev'),
                    joint_no=record_dict.get('joint_no'),
                    block_no=record_dict.get('block_no'),
                    weld_type=record_dict.get('weld_type'),
                    welder_no=record_dict.get('welder_no'),
                    weld_size=record_dict.get('weld_size'),
                    weld_process=record_dict.get('weld_process'),
                    thickness=record_dict.get('pipe_dia'),
                    inspection_category=record_dict.get('inspection_category') or 'type-I'
                )
                db.add(new_record)
                migrated_count += 1
            else:
                skipped_count += 1
    
    try:
        db.commit()
        print(f"Migration completed: {migrated_count} records migrated, {skipped_count} skipped")
    except Exception as e:
        db.rollback()
        print(f"Error during migration: {e}")
    finally:
        db.close()
        conn.close()

if __name__ == "__main__":
    migrate_ndt_requests()
