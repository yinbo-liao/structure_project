import os
import sys

# Ensure we can import from app
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database import SessionLocal, engine
from app.models import StructureNDTStatusRecord
from sqlalchemy import text

def delete_data():
    try:
        db = SessionLocal()
        print(f"Connected to database: {engine.url}")
        
        # 1. Count records
        count = db.query(StructureNDTStatusRecord).count()
        print(f"Current StructureNDTStatusRecord rows: {count}")
        
        if count > 0:
            # 2. Delete records
            print("Deleting all records...")
            db.query(StructureNDTStatusRecord).delete()
            db.commit()
            print("Deletion complete.")
            
            # 3. Verify
            new_count = db.query(StructureNDTStatusRecord).count()
            print(f"New count: {new_count}")
        else:
            print("Table is already empty.")
            
    except Exception as e:
        print(f"Error deleting data: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    delete_data()
