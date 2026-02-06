#!/usr/bin/env python3
"""
Migration script to add block_no column to inspection tables for structure fabrication.
Run this script to update the database schema.
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
import os

# Get database URL from environment or use default SQLite
database_url = os.getenv(
    "DATABASE_URL", 
    "sqlite:///./project_management.db"
)

# Check if we should use SQLite for testing
if "sqlite" in database_url or os.getenv("USE_SQLITE", "true").lower() == "true":
    DATABASE_URL = "sqlite:///./project_management.db"
else:
    DATABASE_URL = database_url

def migrate_block_no():
    """Add block_no column to inspection tables."""
    print("Starting migration to add block_no column...")
    
    # Create engine and session
    engine = create_engine(DATABASE_URL)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    
    try:
        with engine.connect() as connection:
            # Start transaction
            trans = connection.begin()
            
            try:
                print("1. Adding block_no column to fitup_inspection table...")
                connection.execute(text("""
                    ALTER TABLE fitup_inspection 
                    ADD COLUMN block_no VARCHAR(50)
                """))
                
                print("2. Adding block_no column to final_inspection table...")
                connection.execute(text("""
                    ALTER TABLE final_inspection 
                    ADD COLUMN block_no VARCHAR(50)
                """))
                
                print("3. Adding block_no column to ndt_requests table...")
                connection.execute(text("""
                    ALTER TABLE ndt_requests 
                    ADD COLUMN block_no VARCHAR(50)
                """))
                
                print("4. Adding block_no column to ndt_status_records table...")
                connection.execute(text("""
                    ALTER TABLE ndt_status_records 
                    ADD COLUMN block_no VARCHAR(50)
                """))
                
                print("5. Creating indexes for block_no columns...")
                connection.execute(text("""
                    CREATE INDEX IF NOT EXISTS ix_fitup_block_no ON fitup_inspection(block_no)
                """))
                
                connection.execute(text("""
                    CREATE INDEX IF NOT EXISTS ix_final_block_no ON final_inspection(block_no)
                """))
                
                connection.execute(text("""
                    CREATE INDEX IF NOT EXISTS ix_ndt_req_block_no ON ndt_requests(block_no)
                """))
                
                connection.execute(text("""
                    CREATE INDEX IF NOT EXISTS ix_ndt_status_block_no ON ndt_status_records(block_no)
                """))
                
                # Commit transaction
                trans.commit()
                print("✅ Migration completed successfully!")
                print("Added block_no column to:")
                print("  - fitup_inspection")
                print("  - final_inspection")
                print("  - ndt_requests")
                print("  - ndt_status_records")
                print("Created indexes for efficient querying.")
                
            except Exception as e:
                trans.rollback()
                print(f"❌ Migration failed: {e}")
                raise
                
    except Exception as e:
        print(f"❌ Database connection error: {e}")
        sys.exit(1)

def check_existing_columns():
    """Check if block_no columns already exist."""
    print("Checking existing database schema...")
    
    engine = create_engine(DATABASE_URL)
    
    try:
        with engine.connect() as connection:
            # Check each table
            tables = ['fitup_inspection', 'final_inspection', 'ndt_requests', 'ndt_status_records']
            
            for table in tables:
                result = connection.execute(text(f"""
                    SELECT column_name 
                    FROM information_schema.columns 
                    WHERE table_name = '{table}' AND column_name = 'block_no'
                """))
                
                if result.fetchone():
                    print(f"  ✓ {table} already has block_no column")
                else:
                    print(f"  ✗ {table} missing block_no column")
                    
    except Exception as e:
        print(f"❌ Error checking schema: {e}")
        return False
    
    return True

if __name__ == "__main__":
    print("=" * 60)
    print("Block No Column Migration Script")
    print("=" * 60)
    
    # Check if columns already exist
    if check_existing_columns():
        print("\nDo you want to proceed with migration? (y/n)")
        response = input().strip().lower()
        
        if response == 'y':
            migrate_block_no()
        else:
            print("Migration cancelled.")
    else:
        print("\nSome tables are missing block_no column.")
        print("Do you want to add the missing columns? (y/n)")
        response = input().strip().lower()
        
        if response == 'y':
            migrate_block_no()
        else:
            print("Migration cancelled.")
