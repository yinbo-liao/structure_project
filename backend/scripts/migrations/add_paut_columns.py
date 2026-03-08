
import sys
import os
from sqlalchemy import create_engine, text

# Add backend directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

# Use SQLite database URL explicitly for this script as we forced it in database.py
database_url = "sqlite:///./project_management.db"

def add_paut_columns():
    print("Adding PAUT columns to structure_master_joint_list...")
    
    engine = create_engine(database_url)
    
    with engine.connect() as connection:
        # Check if columns exist
        try:
            result = connection.execute(text("PRAGMA table_info(structure_master_joint_list)"))
            columns = [row[1] for row in result.fetchall()]
            
            if 'ndt_paut_report_no' not in columns:
                print("Adding ndt_paut_report_no column...")
                connection.execute(text("ALTER TABLE structure_master_joint_list ADD COLUMN ndt_paut_report_no VARCHAR(100)"))
            else:
                print("ndt_paut_report_no column already exists.")
                
            if 'ndt_paut_result' not in columns:
                print("Adding ndt_paut_result column...")
                connection.execute(text("ALTER TABLE structure_master_joint_list ADD COLUMN ndt_paut_result VARCHAR(20)"))
            else:
                print("ndt_paut_result column already exists.")
                
            print("Migration completed successfully.")
            
        except Exception as e:
            print(f"Error during migration: {e}")

if __name__ == "__main__":
    add_paut_columns()
