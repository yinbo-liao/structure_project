#!/usr/bin/env python3
"""
Migration script to add NDT columns to structure_master_joint_list table.
This script adds NDT testing report numbers and results for each method,
plus comprehensive NDT status tracking.
"""

import sys
import os
os.environ["USE_SQLITE"] = "true"
sys.path.append('.')

from app.database import engine
from sqlalchemy import text

def add_ndt_columns():
    """Add NDT columns to structure_master_joint_list table"""
    
    # SQL statements to add columns
    sql_statements = [
        # NDT Testing Columns for each method
        "ALTER TABLE structure_master_joint_list ADD COLUMN ndt_rt_report_no VARCHAR(100);",
        "ALTER TABLE structure_master_joint_list ADD COLUMN ndt_rt_result VARCHAR(20);",
        "ALTER TABLE structure_master_joint_list ADD COLUMN ndt_ut_report_no VARCHAR(100);",
        "ALTER TABLE structure_master_joint_list ADD COLUMN ndt_ut_result VARCHAR(20);",
        "ALTER TABLE structure_master_joint_list ADD COLUMN ndt_mpi_report_no VARCHAR(100);",
        "ALTER TABLE structure_master_joint_list ADD COLUMN ndt_mpi_result VARCHAR(20);",
        "ALTER TABLE structure_master_joint_list ADD COLUMN ndt_pt_report_no VARCHAR(100);",
        "ALTER TABLE structure_master_joint_list ADD COLUMN ndt_pt_result VARCHAR(20);",
        "ALTER TABLE structure_master_joint_list ADD COLUMN ndt_pmi_report_no VARCHAR(100);",
        "ALTER TABLE structure_master_joint_list ADD COLUMN ndt_pmi_result VARCHAR(20);",
        "ALTER TABLE structure_master_joint_list ADD COLUMN ndt_ft_report_no VARCHAR(100);",
        "ALTER TABLE structure_master_joint_list ADD COLUMN ndt_ft_result VARCHAR(20);",
        "ALTER TABLE structure_master_joint_list ADD COLUMN ndt_paut_report_no VARCHAR(100);",
        "ALTER TABLE structure_master_joint_list ADD COLUMN ndt_paut_result VARCHAR(20);",
        
        # Comprehensive NDT Status
        "ALTER TABLE structure_master_joint_list ADD COLUMN ndt_comprehensive_status VARCHAR(50);",
        "ALTER TABLE structure_master_joint_list ADD COLUMN ndt_last_sync DATETIME;",
        "ALTER TABLE structure_master_joint_list ADD COLUMN ndt_sync_status VARCHAR(20);",
    ]
    
    # Create indexes for better performance
    index_statements = [
        "CREATE INDEX IF NOT EXISTS idx_structure_master_joint_list_ndt_comprehensive_status ON structure_master_joint_list(ndt_comprehensive_status);",
        "CREATE INDEX IF NOT EXISTS idx_structure_master_joint_list_ndt_last_sync ON structure_master_joint_list(ndt_last_sync);",
        "CREATE INDEX IF NOT EXISTS idx_structure_master_joint_list_ndt_sync_status ON structure_master_joint_list(ndt_sync_status);",
    ]
    
    try:
        with engine.connect() as conn:
            # Start transaction
            trans = conn.begin()
            
            try:
                print("Adding NDT columns to structure_master_joint_list table...")
                
                # Execute column addition statements
                for sql in sql_statements:
                    print(f"Executing: {sql[:60]}...")
                    conn.execute(text(sql))
                
                print("Creating indexes for NDT columns...")
                
                # Execute index creation statements
                for sql in index_statements:
                    print(f"Executing: {sql[:60]}...")
                    conn.execute(text(sql))
                
                # Commit transaction
                trans.commit()
                print("Migration completed successfully!")
                
            except Exception as e:
                trans.rollback()
                print(f"Error during migration: {e}")
                raise
                
    except Exception as e:
        print(f"Database connection error: {e}")
        sys.exit(1)

def verify_migration():
    """Verify that columns were added successfully"""
    try:
        with engine.connect() as conn:
            # Check if columns exist
            result = conn.execute(text("""
                SELECT sql FROM sqlite_master 
                WHERE type='table' AND name='structure_master_joint_list'
            """)).scalar()
            
            if result:
                print("\n=== Current table schema ===")
                print(result)
                
                # Check for specific columns
                columns_to_check = [
                    'ndt_rt_report_no', 'ndt_rt_result',
                    'ndt_ut_report_no', 'ndt_ut_result',
                    'ndt_comprehensive_status', 'ndt_last_sync', 'ndt_sync_status'
                ]
                
                print("\n=== Checking for NDT columns ===")
                for column in columns_to_check:
                    if column in result:
                        print(f"✓ {column} exists")
                    else:
                        print(f"✗ {column} NOT found")
                        
    except Exception as e:
        print(f"Verification error: {e}")

if __name__ == "__main__":
    print("Starting NDT columns migration...")
    add_ndt_columns()
    verify_migration()
    print("\nMigration script completed!")