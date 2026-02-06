#!/usr/bin/env python3
"""
Fix role case in database - convert lowercase to uppercase
"""
import sqlite3
from pathlib import Path

db_path = Path("project_management.db")
if not db_path.exists():
    print(f"Database file not found: {db_path}")
    exit(1)

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

print("Current users in database:")
cursor.execute('SELECT email, role FROM users')
users = cursor.fetchall()
for email, role in users:
    print(f"  {email}: {role}")

print("\nUpdating role values to uppercase...")
# Update role values to uppercase
cursor.execute("UPDATE users SET role = 'ADMIN' WHERE role = 'admin'")
cursor.execute("UPDATE users SET role = 'INSPECTOR' WHERE role = 'inspector'")
cursor.execute("UPDATE users SET role = 'VISITOR' WHERE role = 'visitor'")

conn.commit()

print("\nUpdated users in database:")
cursor.execute('SELECT email, role FROM users')
users = cursor.fetchall()
for email, role in users:
    print(f"  {email}: {role}")

conn.close()
print("\nRole values updated to uppercase successfully!")
