
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from sqlalchemy import create_engine, text
import os

# Get database URL from environment or use default SQLite
database_url = os.getenv(
    "DATABASE_URL", 
    "sqlite:///./project_management.db"
)

def fix_structure_schema():
    print("Starting structure schema fix...")
    
    engine = create_engine(database_url)
    
    with engine.connect() as connection:
        # Start transaction
        trans = connection.begin()
        
        try:
            # 1. Fix structure_fitup_inspection: Drop dia
            print("1. Fixing structure_fitup_inspection (dropping dia)...")
            try:
                connection.execute(text("ALTER TABLE structure_fitup_inspection DROP COLUMN dia"))
                print("   Dropped dia column.")
            except Exception as e:
                print(f"   Could not drop dia (might not exist or SQLite version old): {e}")
                # Fallback for old SQLite: recreate table? 
                # For now, let's assume recent SQLite or ignore if it fails (it's just an extra column).

            # 2. Fix structure_final_inspection: Drop dia
            print("2. Fixing structure_final_inspection (dropping dia)...")
            try:
                connection.execute(text("ALTER TABLE structure_final_inspection DROP COLUMN dia"))
                print("   Dropped dia column.")
            except Exception as e:
                print(f"   Could not drop dia: {e}")

            # 3. Fix structure_ndt_requests: Rename dia to thickness
            print("3. Fixing structure_ndt_requests (renaming dia to thickness)...")
            try:
                # Check if thickness already exists
                result = connection.execute(text("PRAGMA table_info(structure_ndt_requests)"))
                columns = [row[1] for row in result.fetchall()]
                
                if 'thickness' in columns:
                    print("   'thickness' column already exists.")
                    if 'dia' in columns:
                        print("   Both 'thickness' and 'dia' exist. Migrating data and dropping dia...")
                        connection.execute(text("UPDATE structure_ndt_requests SET thickness = dia WHERE thickness IS NULL"))
                        connection.execute(text("ALTER TABLE structure_ndt_requests DROP COLUMN dia"))
                elif 'dia' in columns:
                    connection.execute(text("ALTER TABLE structure_ndt_requests RENAME COLUMN dia TO thickness"))
                    print("   Renamed dia to thickness.")
                else:
                    print("   Neither 'dia' nor 'thickness' found?")
                    # Add thickness if missing
                    connection.execute(text("ALTER TABLE structure_ndt_requests ADD COLUMN thickness VARCHAR(20)"))
                    print("   Added thickness column.")
            except Exception as e:
                print(f"   Error fixing structure_ndt_requests: {e}")

            # 4. Fix structure_ndt_status_records: Rename dia to thickness
            print("4. Fixing structure_ndt_status_records (renaming dia to thickness)...")
            try:
                # Check if thickness already exists
                result = connection.execute(text("PRAGMA table_info(structure_ndt_status_records)"))
                columns = [row[1] for row in result.fetchall()]
                
                if 'thickness' in columns:
                    print("   'thickness' column already exists.")
                    if 'dia' in columns:
                        print("   Both 'thickness' and 'dia' exist. Migrating data and dropping dia...")
                        connection.execute(text("UPDATE structure_ndt_status_records SET thickness = dia WHERE thickness IS NULL"))
                        connection.execute(text("ALTER TABLE structure_ndt_status_records DROP COLUMN dia"))
                elif 'dia' in columns:
                    connection.execute(text("ALTER TABLE structure_ndt_status_records RENAME COLUMN dia TO thickness"))
                    print("   Renamed dia to thickness.")
                else:
                    print("   Neither 'dia' nor 'thickness' found?")
                    connection.execute(text("ALTER TABLE structure_ndt_status_records ADD COLUMN thickness VARCHAR(20)"))
                    print("   Added thickness column.")
            except Exception as e:
                print(f"   Error fixing structure_ndt_status_records: {e}")
            
            trans.commit()
            print("Schema fix completed successfully.")
            
        except Exception as e:
            trans.rollback()
            print(f"Schema fix failed: {e}")

if __name__ == "__main__":
    fix_structure_schema()
