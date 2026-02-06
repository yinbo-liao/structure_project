import os
import sys
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# Add current directory to path
sys.path.append(os.getcwd())

# Setup DB connection
DATABASE_URL = "sqlite:///./project_management.db"
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def check_projects():
    db = SessionLocal()
    try:
        print("Checking projects table...")
        result = db.execute(text("SELECT * FROM projects"))
        projects = result.fetchall()
        print(f"Found {len(projects)} projects.")
        
        columns = result.keys()
        print(f"Columns: {columns}")
        
        for p in projects:
            print(f"Project ID: {p.id}, Name: {p.name}, Code: {p.code}, Type: {p.project_type}")
            
    except Exception as e:
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    check_projects()
