
import sqlite3

conn = sqlite3.connect('project_management.db')
cursor = conn.cursor()
cursor.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='projects'")
print(cursor.fetchone()[0])
conn.close()
