
import sqlite3
import os

def migrate():
    db_path = 'project_management.db'
    if not os.path.exists(db_path):
        print(f"Database {db_path} not found.")
        return

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Check if thickness column already exists
        cursor.execute("PRAGMA table_info(structure_ndt_status_records)")
        columns = cursor.fetchall()
        has_thickness = any(col[1] == 'thickness' for col in columns)
        
        if not has_thickness:
            print("Adding thickness column to structure_ndt_status_records...")
            cursor.execute("ALTER TABLE structure_ndt_status_records ADD COLUMN thickness VARCHAR(50)")
            conn.commit()
            print("Column added successfully.")
        else:
            print("thickness column already exists.")
            
    except Exception as e:
        print(f"Error: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
