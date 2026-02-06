import os
import sys

# Change to backend directory
os.chdir('backend')
sys.path.insert(0, '.')

from app.database import engine

if engine.dialect.name == 'sqlite':
    with engine.begin() as conn:  # Use begin() to ensure transaction is committed
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
        ]
        
        # Add missing columns
        for col_name, col_type in missing_columns:
            if col_name not in existing:
                print(f"Adding column {col_name}...")
                try:
                    conn.exec_driver_sql(f"ALTER TABLE ndt_status_records ADD COLUMN {col_name} {col_type}")
                    print(f"  ✓ Added {col_name} as {col_type}")
                except Exception as e:
                    print(f"  ✗ Error adding {col_name}: {e}")
            else:
                print(f"Column {col_name} already exists")
        
        # Verify changes were made
        print("\nVerifying changes...")
        rows = conn.exec_driver_sql("PRAGMA table_info(ndt_status_records)").fetchall()
        new_existing = [row[1] for row in rows]
        for col_name, _ in missing_columns:
            if col_name in new_existing:
                print(f"  ✓ {col_name} is now in the table")
            else:
                print(f"  ✗ {col_name} is STILL MISSING")
else:
    print(f"Not using SQLite (using {engine.dialect.name})")
