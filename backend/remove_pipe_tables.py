#!/usr/bin/env python3
"""
Migration script to remove all pipe fabrication tables and data.
This script safely drops all pipe-related tables from the database.
"""

import os
import sys
import logging
from sqlalchemy import text, inspect

# Add the parent directory to the path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import engine

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def get_pipe_tables():
    """Get all pipe-related tables from the database"""
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    pipe_tables = [t for t in tables if t.startswith('pipe_')]
    return sorted(pipe_tables)

def check_pipe_data():
    """Check for data in pipe tables"""
    pipe_tables = get_pipe_tables()
    
    print("=== PIPE TABLES FOUND ===")
    for table in pipe_tables:
        print(f"  - {table}")
    
    print("\n=== DATA IN PIPE TABLES ===")
    with engine.connect() as conn:
        for table in pipe_tables:
            try:
                result = conn.execute(text(f'SELECT COUNT(*) FROM {table}'))
                count = result.scalar()
                print(f"{table}: {count} records")
            except Exception as e:
                print(f"{table}: Error - {e}")
    
    return pipe_tables

def backup_pipe_data():
    """Create a backup of pipe data before deletion"""
    import sqlite3
    import datetime
    
    if "sqlite" in str(engine.url):
        db_path = "project_management.db"
        backup_path = f"project_management_backup_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}.db"
        
        print(f"\n=== CREATING DATABASE BACKUP ===")
        print(f"Backing up {db_path} to {backup_path}")
        
        try:
            # Copy the SQLite database file
            import shutil
            shutil.copy2(db_path, backup_path)
            print(f"✓ Backup created: {backup_path}")
            return backup_path
        except Exception as e:
            print(f"✗ Backup failed: {e}")
            return None
    else:
        print("\n=== DATABASE BACKUP ===")
        print("For PostgreSQL databases, please ensure you have a backup before proceeding.")
        print("You can use: pg_dump project_management > backup.sql")
        return None

def drop_pipe_tables():
    """Drop all pipe-related tables"""
    pipe_tables = get_pipe_tables()
    
    if not pipe_tables:
        print("No pipe tables found to drop.")
        return
    
    print("\n=== DROPPING PIPE TABLES ===")
    print("WARNING: This will permanently delete all pipe fabrication data!")
    print(f"Tables to be dropped: {len(pipe_tables)}")
    
    # Drop tables in reverse order to handle foreign key constraints
    # NDT tables first (depend on final inspection)
    # Final inspection (depends on fitup)
    # Fitup inspection (depends on master joint)
    # Master joint and material tables last
    
    drop_order = [
        'pipe_ndt_status_records',
        'pipe_ndt_requests',
        'pipe_final_inspection',
        'pipe_fitup_inspection',
        'pipe_material_inspection',
        'pipe_material_register',
        'pipe_master_joint_list'
    ]
    
    # Filter to only include tables that exist
    drop_order = [table for table in drop_order if table in pipe_tables]
    
    with engine.connect() as conn:
        # Disable foreign key constraints for SQLite
        if "sqlite" in str(engine.url):
            conn.execute(text("PRAGMA foreign_keys = OFF"))
        
        for table in drop_order:
            try:
                print(f"Dropping table: {table}")
                conn.execute(text(f'DROP TABLE IF EXISTS {table}'))
                conn.commit()
                print(f"✓ Dropped: {table}")
            except Exception as e:
                print(f"✗ Failed to drop {table}: {e}")
                conn.rollback()
        
        # Re-enable foreign key constraints for SQLite
        if "sqlite" in str(engine.url):
            conn.execute(text("PRAGMA foreign_keys = ON"))
    
    print("\n=== VERIFICATION ===")
    remaining_pipe_tables = get_pipe_tables()
    if remaining_pipe_tables:
        print(f"WARNING: {len(remaining_pipe_tables)} pipe tables still exist:")
        for table in remaining_pipe_tables:
            print(f"  - {table}")
    else:
        print("✓ All pipe tables have been successfully removed.")

def cleanup_old_tables():
    """Clean up old non-prefixed tables that might contain pipe data"""
    old_tables = [
        'final_inspection',
        'fitup_inspection',
        'master_joint_list',
        'material_inspection',
        'material_register',
        'ndt_requests',
        'ndt_status_records'
    ]
    
    print("\n=== CHECKING OLD TABLES ===")
    inspector = inspect(engine)
    existing_tables = inspector.get_table_names()
    
    old_tables_to_check = [t for t in old_tables if t in existing_tables]
    
    if not old_tables_to_check:
        print("No old tables found to check.")
        return
    
    print("Checking old tables for pipe data...")
    with engine.connect() as conn:
        for table in old_tables_to_check:
            try:
                # Check if table has any data
                result = conn.execute(text(f'SELECT COUNT(*) FROM {table}'))
                count = result.scalar()
                print(f"{table}: {count} records")
                
                # Check if table has pipe-specific columns
                result = conn.execute(text(f'PRAGMA table_info({table})'))
                columns = [row[1] for row in result.fetchall()]
                
                has_pipe_columns = any(col in ['system_no', 'line_no', 'spool_no', 'pipe_dia'] for col in columns)
                if has_pipe_columns and count > 0:
                    print(f"  WARNING: {table} appears to contain pipe data!")
            except Exception as e:
                print(f"{table}: Error - {e}")

def update_project_types():
    """Update projects table to remove 'pipe' project type"""
    print("\n=== UPDATING PROJECT TYPES ===")
    
    with engine.connect() as conn:
        try:
            # Check current project types
            result = conn.execute(text("SELECT id, name, project_type FROM projects"))
            projects = result.fetchall()
            
            print("Current projects:")
            for project in projects:
                print(f"  ID: {project[0]}, Name: {project[1]}, Type: {project[2]}")
            
            # Update any 'pipe' projects to 'structure'
            result = conn.execute(text("""
                UPDATE projects 
                SET project_type = 'structure' 
                WHERE project_type = 'pipe'
            """))
            updated_count = result.rowcount
            conn.commit()
            
            print(f"\nUpdated {updated_count} projects from 'pipe' to 'structure'")
            
            # Verify update
            result = conn.execute(text("SELECT COUNT(*) FROM projects WHERE project_type = 'pipe'"))
            remaining_pipe_projects = result.scalar()
            
            if remaining_pipe_projects == 0:
                print("✓ No 'pipe' project types remaining")
            else:
                print(f"✗ WARNING: {remaining_pipe_projects} projects still have 'pipe' type")
                
        except Exception as e:
            print(f"Error updating project types: {e}")
            conn.rollback()

def main():
    """Main migration function"""
    print("=" * 60)
    print("PIPE FABRICATION TABLES REMOVAL MIGRATION")
    print("=" * 60)
    
    # Step 1: Check current state
    pipe_tables = check_pipe_data()
    
    if not pipe_tables:
        print("\nNo pipe tables found. Nothing to do.")
        return
    
    # Step 2: Backup data
    backup_file = backup_pipe_data()
    
    # Step 3: Ask for confirmation
    print("\n" + "=" * 60)
    print("CONFIRMATION REQUIRED")
    print("=" * 60)
    print(f"This will delete {len(pipe_tables)} pipe tables and all their data.")
    print(f"Backup created: {backup_file if backup_file else 'No backup available'}")
    
    response = input("\nDo you want to proceed? (yes/no): ").strip().lower()
    if response != 'yes':
        print("Migration cancelled.")
        return
    
    # Step 4: Drop pipe tables
    drop_pipe_tables()
    
    # Step 5: Check old tables
    cleanup_old_tables()
    
    # Step 6: Update project types
    update_project_types()
    
    print("\n" + "=" * 60)
    print("MIGRATION COMPLETE")
    print("=" * 60)
    print("Please update your code to remove all pipe-related references:")
    print("1. Update models.py - Remove pipe model imports")
    print("2. Update main.py - Remove pipe table references")
    print("3. Update schemas.py - Remove pipe schemas")
    print("4. Update frontend components - Remove pipe logic")
    print("5. Update API routes - Remove pipe endpoints")

if __name__ == "__main__":
    main()