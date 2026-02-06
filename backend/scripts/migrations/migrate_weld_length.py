#!/usr/bin/env python3
"""
Migration script to add weld_length column to master_joint_list table.
Run with: python migrate_weld_length.py
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal, engine
from app.models import Base
from sqlalchemy import text

def migrate_weld_length():
    """Add weld_length column to master_joint_list table if it doesn't exist."""
    print("Checking if weld_length column exists in master_joint_list table...")
    
    db = SessionLocal()
    try:
        # For SQLite, we need to check differently
        # Try to query the table structure
        result = db.execute(text("PRAGMA table_info(master_joint_list)"))
        columns = result.fetchall()
        
        column_exists = any(col[1] == 'weld_length' for col in columns)
        
        if not column_exists:
            print("Adding weld_length column to master_joint_list table...")
            db.execute(text("""
                ALTER TABLE master_joint_list 
                ADD COLUMN weld_length FLOAT
            """))
            db.commit()
            print("Successfully added weld_length column.")
        else:
            print("weld_length column already exists.")
            
    except Exception as e:
        db.rollback()
        print(f"Error during migration: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    migrate_weld_length()
