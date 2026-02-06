#!/usr/bin/env python3
"""
Migration script to convert 'type-IV' inspection_category values to 'Special'.
Run this script to update existing database records.
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from app.database import DATABASE_URL

def migrate_inspection_category_special():
    """Convert 'type-IV' values to 'Special' in all relevant tables."""
    
    print("Starting migration to convert 'type-IV' to 'Special'...")
    
    # Create engine and session
    engine = create_engine(DATABASE_URL)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    
    try:
        with engine.connect() as connection:
            # Start transaction
            with connection.begin():
                print("1. Updating master_joint_list...")
                connection.execute(text("""
                    UPDATE master_joint_list 
                    SET inspection_category = 'Special'
                    WHERE inspection_category = 'type-IV'
                """))
                
                print("2. Updating fitup_inspection...")
                connection.execute(text("""
                    UPDATE fitup_inspection 
                    SET inspection_category = 'Special'
                    WHERE inspection_category = 'type-IV'
                """))
                
                print("3. Updating final_inspection...")
                connection.execute(text("""
                    UPDATE final_inspection 
                    SET inspection_category = 'Special'
                    WHERE inspection_category = 'type-IV'
                """))
                
                print("4. Updating ndt_requests...")
                connection.execute(text("""
                    UPDATE ndt_requests 
                    SET inspection_category = 'Special'
                    WHERE inspection_category = 'type-IV'
                """))
                
                print("5. Updating ndt_status_records...")
                connection.execute(text("""
                    UPDATE ndt_status_records 
                    SET inspection_category = 'Special'
                    WHERE inspection_category = 'type-IV'
                """))
                
                print("Migration completed successfully!")
                print("All 'type-IV' values have been converted to 'Special'.")
                
    except Exception as e:
        print(f"Error during migration: {e}")
        raise
    finally:
        engine.dispose()

if __name__ == "__main__":
    migrate_inspection_category_special()
