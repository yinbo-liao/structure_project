import sys
import os
sys.path.insert(0, 'backend')

from app.database import engine

# Check if we're using SQLite
if engine.dialect.name == 'sqlite':
    with engine.connect() as conn:
        # Check if project_type column exists
        rows = conn.exec_driver_sql("PRAGMA table_info(ndt_status_records)").fetchall()
        existing = [r[1] for r in rows]
        print(f"Existing columns: {existing}")
        
        if 'project_type' not in existing:
            print("Adding project_type column to ndt_status_records table...")
            try:
                conn.exec_driver_sql("ALTER TABLE ndt_status_records ADD COLUMN project_type TEXT")
                print("Column added successfully!")
            except Exception as e:
                print(f"Error adding column: {e}")
        else:
            print("project_type column already exists.")
else:
    print(f"Not using SQLite (using {engine.dialect.name}), manual migration needed.")
