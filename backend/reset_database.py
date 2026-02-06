#!/usr/bin/env python3
"""
Reset the database to match the current models
"""
import os
import sqlite3
from pathlib import Path

# Delete the database file
db_path = Path("project_management.db")
if db_path.exists():
    print(f"Deleting database file: {db_path}")
    db_path.unlink()
    print("Database deleted successfully")
else:
    print(f"Database file not found: {db_path}")

# Also delete any backup files
backup_files = [
    Path("project_management.db.backup"),
    Path("project_management.db.bak"),
    Path("project_management.db.old"),
]

for backup in backup_files:
    if backup.exists():
        print(f"Deleting backup file: {backup}")
        backup.unlink()

print("\nDatabase reset complete. The next time you start the backend,")
print("it will create a fresh database with the correct schema.")
