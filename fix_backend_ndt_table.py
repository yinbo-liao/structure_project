import os
import sys

# Change to backend directory
os.chdir('backend')
sys.path.insert(0, '.')

from app.database import engine

if engine.dialect.name == 'sqlite':
    with engine.connect() as conn:
        # Check what columns exist
        rows = conn.exec_driver_sql("PRAGMA table_info(ndt_status_records)").fetchall()
        existing = [row[1] for row in rows]
        print(f"Existing columns: {existing}")
        
        # Columns that should be in the model
        missing_columns = [
            ('project_type', 'TEXT'),
            ('draw_no', 'TEXT'),
            ('structure_category', 'TEXT'),
            ('page_no', 'TEXT'),
            ('drawing_rev', 'TEXT'),
            ('dia', 'TEXT'),  # Note: model has 'dia', table has 'pipe_dia'
        ]
        
        # Rename pipe_dia to dia if it exists
        if 'pipe_dia' in existing and 'dia' not in existing:
            print("Renaming pipe_dia to dia...")
            try:
                # SQLite doesn't support RENAME COLUMN directly, need to recreate table
                # Instead, we'll add dia column and copy data
                conn.exec_driver_sql("ALTER TABLE ndt_status_records ADD COLUMN dia TEXT")
                conn.exec_driver_sql("UPDATE ndt_status_records SET dia = pipe_dia WHERE pipe_dia IS NOT NULL")
                print("  Added dia column and copied data from pipe_dia")
            except Exception as e:
                print(f"  Error: {e}")
        
        # Add missing columns
        for col_name, col_type in missing_columns:
            if col_name not in existing:
                print(f"Adding column {col_name}...")
                try:
                    conn.exec_driver_sql(f"ALTER TABLE ndt_status_records ADD COLUMN {col_name} {col_type}")
                    print(f"  Added {col_name} as {col_type}")
                except Exception as e:
                    print(f"  Error adding {col_name}: {e}")
            else:
                print(f"Column {col_name} already exists")
else:
    print(f"Not using SQLite (using {engine.dialect.name})")
