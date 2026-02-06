import os
import sys
from sqlalchemy import text

# Add current directory to path
sys.path.append(os.getcwd())

# Import SessionLocal from app.database
from app.database import SessionLocal

def fix_project_types():
    db = SessionLocal()
    try:
        print("Migrating project types to lowercase...")
        
        # Check current state
        result = db.execute(text("SELECT id, name, project_type FROM projects"))
        projects = result.fetchall()
        print("Before migration:")
        for p in projects:
            print(f"ID: {p.id}, Name: {p.name}, Type: {p.project_type}")
            
        # Update STRUCTURE -> structure
        db.execute(text("UPDATE projects SET project_type = 'structure' WHERE project_type = 'STRUCTURE'"))
        
        # Update PIPE -> pipe
        db.execute(text("UPDATE projects SET project_type = 'pipe' WHERE project_type = 'PIPE'"))
        
        db.commit()
        print("Migration committed.")
        
        # Check new state
        result = db.execute(text("SELECT id, name, project_type FROM projects"))
        projects = result.fetchall()
        print("After migration:")
        for p in projects:
            print(f"ID: {p.id}, Name: {p.name}, Type: {p.project_type}")
            
    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    fix_project_types()
