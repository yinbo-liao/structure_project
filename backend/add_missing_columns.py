#!/usr/bin/env python3
"""
Add missing columns to the users table
"""
import sqlite3
from pathlib import Path

db_path = Path("project_management.db")
if not db_path.exists():
    print(f"Database file not found: {db_path}")
    exit(1)

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Check what columns exist
cursor.execute('PRAGMA table_info(users)')
existing_columns = [col[1] for col in cursor.fetchall()]
print(f"Existing columns: {existing_columns}")

# Add missing columns
missing_columns = [
    ("last_login", "DATETIME"),
    ("updated_at", "DATETIME"),
]

for column_name, column_type in missing_columns:
    if column_name not in existing_columns:
        try:
            sql = f"ALTER TABLE users ADD COLUMN {column_name} {column_type}"
            cursor.execute(sql)
            print(f"Added column: {column_name} ({column_type})")
        except Exception as e:
            print(f"Failed to add column {column_name}: {e}")

# Commit changes
conn.commit()

# Verify the columns were added
cursor.execute('PRAGMA table_info(users)')
updated_columns = [col[1] for col in cursor.fetchall()]
print(f"\nUpdated columns: {updated_columns}")

conn.close()
print("\nDatabase schema updated successfully!")
