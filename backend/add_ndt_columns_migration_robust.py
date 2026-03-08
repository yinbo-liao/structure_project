#!/usr/bin/env python3
"""
Robust migration script to add NDT columns to structure_master_joint_list table.
This script checks if columns exist before adding them.
"""

import sys
import os
os.environ["USE_SQLITE"] = "true"
sys.path.append('.')

from app.database import engine
from sqlalchemy import text

def check_column_exists(table_name, column_name):
    """Check if a column exists in a table"""
    try:
        with engine.connect() as conn:
            if engine.dialect.name == 'sqlite':
                result = conn.execute(text(f"PRAGMA table_info({table_name})"))
                columns = [row[1] for row in result.fetchall()]
                return column_name in columns
            else:
                # For PostgreSQL
                result = conn.execute(text(f"""
                    SELECT column_name 
                    FROM information_schema.columns 
                    WHERE table_name = '{table_name}' AND column_name = '{column_name}'
                """))
                return result.fetchone() is not None
    except Exception as e:
        print(f"Error checking column {column_name} in {table_name}: {e}")
        return False

def add_ndt_columns():
    """Add NDT columns to structure_master_joint_list table"""
    
    # NDT Testing Columns for each method
    columns_to_add = [
        ("ndt_rt_report_no", "VARCHAR(100)"),
        ("ndt_rt_result", "VARCHAR(20)"),
        ("ndt_ut_report_no", "VARCHAR(100)"),
        ("ndt_ut_result", "VARCHAR(20)"),
        ("ndt_mpi_report_no", "VARCHAR(100)"),
        ("ndt_mpi_result", "VARCHAR(20)"),
        ("ndt_pt_report_no", "VARCHAR(100)"),
        ("ndt_pt_result", "VARCHAR(20)"),
        ("ndt_pmi_report_no", "VARCHAR(100)"),
        ("ndt_pmi_result", "VARCHAR(20)"),
        ("ndt_ft_report_no", "VARCHAR(100)"),
        ("ndt_ft_result", "VARCHAR(20)"),
        ("ndt_paut_report_no", "VARCHAR(100)"),
        ("ndt_paut_result", "VARCHAR(20)"),
        
        # Comprehensive NDT Status
        ("ndt_comprehensive_status", "VARCHAR(50)"),
        ("ndt_last_sync", "DATETIME"),
        ("ndt_sync_status", "VARCHAR(20)"),
    ]
    
    try:
        with engine.connect() as conn:
            # Start transaction
            trans = conn.begin()
            
            try:
                print("Adding NDT columns to structure_master_joint_list table...")
                
                # Execute column addition statements
                for column_name, column_type in columns_to_add:
                    if not check_column_exists("structure_master_joint_list", column_name):
                        sql = f"ALTER TABLE structure_master_joint_list ADD COLUMN {column_name} {column_type};"
                        print(f"Adding column: {column_name}")
                        conn.execute(text(sql))
                    else:
                        print(f"Column {column_name} already exists, skipping...")
                
                print("Creating indexes for NDT columns...")
                
                # Create indexes for better performance
                index_statements = [
                    "CREATE INDEX IF NOT EXISTS idx_structure_master_joint_list_ndt_comprehensive_status ON structure_master_joint_list(ndt_comprehensive_status);",
                    "CREATE INDEX IF NOT EXISTS idx_structure_master_joint_list_ndt_last_sync ON structure_master_joint_list(ndt_last_sync);",
                    "CREATE INDEX IF NOT EXISTS idx_structure_master_joint_list_ndt_sync_status ON structure_master_joint_list(ndt_sync_status);",
                ]
                
                for sql in index_statements:
                    print(f"Creating index: {sql[:60]}...")
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
                    'ndt_mpi_report_no', 'ndt_mpi_result',
                    'ndt_pt_report_no', 'ndt_pt_result',
                    'ndt_pmi_report_no', 'ndt_pmi_result',
                    'ndt_ft_report_no', 'ndt_ft_result',
                    'ndt_paut_report_no', 'ndt_paut_result',
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
    print("Starting robust NDT columns migration...")
    add_ndt_columns()
    verify_migration()
    print("\nMigration script completed!")