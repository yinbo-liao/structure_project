#!/usr/bin/env python3
"""
Migration script to add material_report_no column to material_register table.
Run with: python migrate_material_report_no.py
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

def migrate_material_report_no():
    """Add material_report_no column to material_register table."""
    
    # Create engine
    engine = create_engine(DATABASE_URL)
    
    # First, check if table exists
    with engine.connect() as conn:
        # For SQLite
        if DATABASE_URL.startswith('sqlite'):
            result = conn.execute(text("""
                SELECT name FROM sqlite_master 
                WHERE type='table' AND name='material_register';
            """))
            table_exists = result.fetchone() is not None
            
            if not table_exists:
                print("Table 'material_register' does not exist. Creating tables first...")
                # Instead of calling create_tables which fails due to existing indexes,
                # we'll just create the table directly
                from app.models import Base
                Base.metadata.create_all(bind=engine, tables=[Base.metadata.tables['material_register']])
                print("Table created successfully.")
            
            # Now check if column already exists
            result = conn.execute(text("""
                PRAGMA table_info(material_register);
            """))
            columns = [row[1] for row in result]
            
            if 'material_report_no' in columns:
                print("Column 'material_report_no' already exists in material_register table.")
                return
            
            # Add column for SQLite
            try:
                conn.execute(text("""
                    ALTER TABLE material_register 
                    ADD COLUMN material_report_no VARCHAR(50);
                """))
                conn.commit()
            except Exception as e:
                print(f"Error adding column: {e}")
                return
            
        # For PostgreSQL
        elif DATABASE_URL.startswith('postgresql'):
            # Check if table exists
            result = conn.execute(text("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_name = 'material_register';
            """))
            table_exists = result.fetchone() is not None
            
            if not table_exists:
                print("Table 'material_register' does not exist. Creating tables first...")
                from app.models import Base
                Base.metadata.create_all(bind=engine, tables=[Base.metadata.tables['material_register']])
                print("Table created successfully.")
            
            # Check if column exists
            result = conn.execute(text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'material_register' 
                AND column_name = 'material_report_no';
            """))
            
            if result.fetchone():
                print("Column 'material_report_no' already exists in material_register table.")
                return
            
            # Add column for PostgreSQL
            try:
                conn.execute(text("""
                    ALTER TABLE material_register 
                    ADD COLUMN material_report_no VARCHAR(50);
                """))
                conn.commit()
            except Exception as e:
                print(f"Error adding column: {e}")
                return
            
        else:
            print(f"Unsupported database: {DATABASE_URL}")
            return
    
    print("Successfully added 'material_report_no' column to material_register table.")
    
    # Create index
    with engine.connect() as conn:
        if DATABASE_URL.startswith('sqlite'):
            try:
                conn.execute(text("""
                    CREATE INDEX IF NOT EXISTS ix_material_report_no 
                    ON material_register (material_report_no);
                """))
                conn.commit()
                print("Successfully created index 'ix_material_report_no' on material_register table.")
            except Exception as e:
                print(f"Note: Could not create index (may already exist): {e}")
        elif DATABASE_URL.startswith('postgresql'):
            try:
                conn.execute(text("""
                    CREATE INDEX IF NOT EXISTS ix_material_report_no 
                    ON material_register (material_report_no);
                """))
                conn.commit()
                print("Successfully created index 'ix_material_report_no' on material_register table.")
            except Exception as e:
                print(f"Note: Could not create index (may already exist): {e}")

if __name__ == "__main__":
    migrate_material_report_no()
