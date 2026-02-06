import sys
import os
sys.path.insert(0, 'backend')

from app.database import engine

# Check what columns exist
if engine.dialect.name == 'sqlite':
    with engine.connect() as conn:
        # Check if table exists
        tables = conn.exec_driver_sql("SELECT name FROM sqlite_master WHERE type='table' AND name='ndt_status_records'").fetchall()
        if not tables:
            print("Table doesn't exist!")
        else:
            print("Table exists, checking columns...")
            rows = conn.exec_driver_sql("PRAGMA table_info(ndt_status_records)").fetchall()
            print("Existing columns:")
            for row in rows:
                print(f"  - {row[1]} ({row[2]})")
            
            # Check which columns from the model are missing
            model_columns = [
                'id', 'project_id', 'final_id', 'project_type', 'system_no', 'line_no', 'spool_no',
                'draw_no', 'structure_category', 'page_no', 'drawing_rev', 'block_no', 'joint_no',
                'weld_type', 'welder_no', 'weld_size', 'weld_site', 'dia', 'ndt_type', 'ndt_report_no',
                'ndt_result', 'rejected_length', 'inspection_category', 'updated_at', 'created_at'
            ]
            
            existing = [row[1] for row in rows]
            missing = [col for col in model_columns if col not in existing]
            
            print(f"\nMissing columns: {missing}")
            
            # Add missing columns
            for col in missing:
                print(f"Adding column {col}...")
                try:
                    # Determine column type
                    if col in ['id', 'project_id', 'final_id']:
                        col_type = 'INTEGER'
                    elif col in ['weld_size', 'rejected_length']:
                        col_type = 'FLOAT'
                    elif col in ['updated_at', 'created_at']:
                        col_type = 'DATETIME'
                    else:
                        col_type = 'TEXT'
                    
                    conn.exec_driver_sql(f"ALTER TABLE ndt_status_records ADD COLUMN {col} {col_type}")
                    print(f"  Added {col} as {col_type}")
                except Exception as e:
                    print(f"  Error adding {col}: {e}")
else:
    print(f"Not using SQLite (using {engine.dialect.name})")
