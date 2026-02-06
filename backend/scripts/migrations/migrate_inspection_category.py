#!/usr/bin/env python3
"""
Migration script to add inspection_category column to relevant tables.
Run this script to update existing database records.
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from app.database import DATABASE_URL

def migrate_inspection_category():
    """Add inspection_category column to all relevant tables."""
    
    print("Starting migration for inspection_category column...")
    
    # Create engine and session
    engine = create_engine(DATABASE_URL)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    
    try:
        with engine.connect() as connection:
            # Start transaction
            with connection.begin():
                # Check if SQLite (doesn't support IF NOT EXISTS for ADD COLUMN)
                is_sqlite = "sqlite" in DATABASE_URL
                
                print("1. Adding inspection_category to master_joint_list...")
                if is_sqlite:
                    # For SQLite, we need to check if column exists first
                    result = connection.execute(text("""
                        PRAGMA table_info(master_joint_list)
                    """)).fetchall()
                    columns = [row[1] for row in result]
                    if 'inspection_category' not in columns:
                        connection.execute(text("""
                            ALTER TABLE master_joint_list 
                            ADD COLUMN inspection_category VARCHAR(20) DEFAULT 'type-I'
                        """))
                else:
                    connection.execute(text("""
                        ALTER TABLE master_joint_list 
                        ADD COLUMN IF NOT EXISTS inspection_category VARCHAR(20) DEFAULT 'type-I'
                    """))
                
                print("2. Adding inspection_category to fitup_inspection...")
                if is_sqlite:
                    result = connection.execute(text("""
                        PRAGMA table_info(fitup_inspection)
                    """)).fetchall()
                    columns = [row[1] for row in result]
                    if 'inspection_category' not in columns:
                        connection.execute(text("""
                            ALTER TABLE fitup_inspection 
                            ADD COLUMN inspection_category VARCHAR(20) DEFAULT 'type-I'
                        """))
                else:
                    connection.execute(text("""
                        ALTER TABLE fitup_inspection 
                        ADD COLUMN IF NOT EXISTS inspection_category VARCHAR(20) DEFAULT 'type-I'
                    """))
                
                print("3. Adding inspection_category to final_inspection...")
                if is_sqlite:
                    result = connection.execute(text("""
                        PRAGMA table_info(final_inspection)
                    """)).fetchall()
                    columns = [row[1] for row in result]
                    if 'inspection_category' not in columns:
                        connection.execute(text("""
                            ALTER TABLE final_inspection 
                            ADD COLUMN inspection_category VARCHAR(20) DEFAULT 'type-I'
                        """))
                else:
                    connection.execute(text("""
                        ALTER TABLE final_inspection 
                        ADD COLUMN IF NOT EXISTS inspection_category VARCHAR(20) DEFAULT 'type-I'
                    """))
                
                print("4. Adding inspection_category to ndt_requests...")
                if is_sqlite:
                    result = connection.execute(text("""
                        PRAGMA table_info(ndt_requests)
                    """)).fetchall()
                    columns = [row[1] for row in result]
                    if 'inspection_category' not in columns:
                        connection.execute(text("""
                            ALTER TABLE ndt_requests 
                            ADD COLUMN inspection_category VARCHAR(20) DEFAULT 'type-I'
                        """))
                else:
                    connection.execute(text("""
                        ALTER TABLE ndt_requests 
                        ADD COLUMN IF NOT EXISTS inspection_category VARCHAR(20) DEFAULT 'type-I'
                    """))
                
                print("5. Adding inspection_category to ndt_status_records...")
                if is_sqlite:
                    result = connection.execute(text("""
                        PRAGMA table_info(ndt_status_records)
                    """)).fetchall()
                    columns = [row[1] for row in result]
                    if 'inspection_category' not in columns:
                        connection.execute(text("""
                            ALTER TABLE ndt_status_records 
                            ADD COLUMN inspection_category VARCHAR(20) DEFAULT 'type-I'
                        """))
                else:
                    connection.execute(text("""
                        ALTER TABLE ndt_status_records 
                        ADD COLUMN IF NOT EXISTS inspection_category VARCHAR(20) DEFAULT 'type-I'
                    """))
                
                print("6. Creating indexes for inspection_category...")
                connection.execute(text("""
                    CREATE INDEX IF NOT EXISTS ix_master_joint_category 
                    ON master_joint_list (inspection_category)
                """))
                
                connection.execute(text("""
                    CREATE INDEX IF NOT EXISTS ix_fitup_category 
                    ON fitup_inspection (inspection_category)
                """))
                
                connection.execute(text("""
                    CREATE INDEX IF NOT EXISTS ix_final_category 
                    ON final_inspection (inspection_category)
                """))
                
                connection.execute(text("""
                    CREATE INDEX IF NOT EXISTS ix_ndt_req_category 
                    ON ndt_requests (inspection_category)
                """))
                
                connection.execute(text("""
                    CREATE INDEX IF NOT EXISTS ix_ndt_status_category 
                    ON ndt_status_records (inspection_category)
                """))
                
                print("7. Updating existing records to inherit inspection_category...")
                if is_sqlite:
                    # SQLite doesn't support FROM clause in UPDATE, use subquery
                    connection.execute(text("""
                        UPDATE fitup_inspection
                        SET inspection_category = (
                            SELECT inspection_category 
                            FROM master_joint_list 
                            WHERE id = fitup_inspection.master_joint_id
                        )
                        WHERE inspection_category IS NULL
                        AND master_joint_id IS NOT NULL
                    """))
                else:
                    # Update fitup_inspection records to inherit from master_joint_list
                    connection.execute(text("""
                        UPDATE fitup_inspection fi
                        SET inspection_category = mjl.inspection_category
                        FROM master_joint_list mjl
                        WHERE fi.master_joint_id = mjl.id
                        AND fi.inspection_category IS NULL
                    """))
                
                if is_sqlite:
                    # SQLite doesn't support table aliases in UPDATE
                    connection.execute(text("""
                        UPDATE final_inspection
                        SET inspection_category = (
                            SELECT inspection_category 
                            FROM fitup_inspection 
                            WHERE id = final_inspection.fitup_id
                        )
                        WHERE inspection_category IS NULL
                        AND fitup_id IS NOT NULL
                    """))
                    
                    connection.execute(text("""
                        UPDATE ndt_requests
                        SET inspection_category = (
                            SELECT inspection_category 
                            FROM final_inspection 
                            WHERE id = ndt_requests.final_id
                        )
                        WHERE inspection_category IS NULL
                        AND final_id IS NOT NULL
                    """))
                    
                    connection.execute(text("""
                        UPDATE ndt_status_records
                        SET inspection_category = (
                            SELECT inspection_category 
                            FROM final_inspection 
                            WHERE id = ndt_status_records.final_id
                        )
                        WHERE inspection_category IS NULL
                        AND final_id IS NOT NULL
                    """))
                else:
                    # Update final_inspection records to inherit from fitup_inspection
                    connection.execute(text("""
                        UPDATE final_inspection fi
                        SET inspection_category = (
                            SELECT inspection_category 
                            FROM fitup_inspection 
                            WHERE id = fi.fitup_id
                        )
                        WHERE fi.inspection_category IS NULL
                        AND fi.fitup_id IS NOT NULL
                    """))
                    
                    # Update ndt_requests records to inherit from final_inspection
                    connection.execute(text("""
                        UPDATE ndt_requests nr
                        SET inspection_category = (
                            SELECT inspection_category 
                            FROM final_inspection 
                            WHERE id = nr.final_id
                        )
                        WHERE nr.inspection_category IS NULL
                        AND nr.final_id IS NOT NULL
                    """))
                    
                    # Update ndt_status_records records to inherit from final_inspection
                    connection.execute(text("""
                        UPDATE ndt_status_records nsr
                        SET inspection_category = (
                            SELECT inspection_category 
                            FROM final_inspection 
                            WHERE id = nsr.final_id
                        )
                        WHERE nsr.inspection_category IS NULL
                        AND nsr.final_id IS NOT NULL
                    """))
                
                print("Migration completed successfully!")
                
    except Exception as e:
        print(f"Error during migration: {e}")
        raise
    finally:
        engine.dispose()

if __name__ == "__main__":
    migrate_inspection_category()
