import sqlite3
import os

db_path = "project_management.db"
if not os.path.exists(db_path):
    print(f"Database {db_path} not found.")
    exit()

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

tables = [
    "structure_final_inspection",
    "structure_fitup_inspection",
    "structure_ndt_requests",
    "structure_ndt_status_records"
]

print(f"Inspecting tables in {db_path}...")

for table in tables:
    print(f"\nTable: {table}")
    try:
        cursor.execute(f"PRAGMA table_info({table})")
        columns = cursor.fetchall()
        if not columns:
            print("  (Table does not exist)")
        else:
            for col in columns:
                # cid, name, type, notnull, dflt_value, pk
                print(f"  - {col[1]} ({col[2]})")
    except Exception as e:
        print(f"  Error: {e}")

conn.close()
