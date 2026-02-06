#!/usr/bin/env python3
"""
Migration script to add final_id and joint detail fields to NDTRequest table
"""
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import create_engine, text
from app.database import DATABASE_URL

def migrate_ndt_request():
    """Add final_id and joint detail fields to NDTRequest table"""
    engine = create_engine(DATABASE_URL)
    
    with engine.connect() as conn:
        # Check if final_id column already exists
        result = conn.execute(text("PRAGMA table_info(ndt_requests)"))
        columns = [row[1] for row in result]
        
        if 'final_id' not in columns:
            print("Adding final_id column to ndt_requests table...")
            conn.execute(text("ALTER TABLE ndt_requests ADD COLUMN final_id INTEGER REFERENCES final_inspection(id)"))
        
        if 'system_no' not in columns:
            print("Adding system_no column to ndt_requests table...")
            conn.execute(text("ALTER TABLE ndt_requests ADD COLUMN system_no VARCHAR(50)"))
        
        if 'line_no' not in columns:
            print("Adding line_no column to ndt_requests table...")
            conn.execute(text("ALTER TABLE ndt_requests ADD COLUMN line_no VARCHAR(50)"))
        
        if 'spool_no' not in columns:
            print("Adding spool_no column to ndt_requests table...")
            conn.execute(text("ALTER TABLE ndt_requests ADD COLUMN spool_no VARCHAR(50)"))
        
        if 'joint_no' not in columns:
            print("Adding joint_no column to ndt_requests table...")
            conn.execute(text("ALTER TABLE ndt_requests ADD COLUMN joint_no VARCHAR(50)"))
        
        if 'weld_type' not in columns:
            print("Adding weld_type column to ndt_requests table...")
            conn.execute(text("ALTER TABLE ndt_requests ADD COLUMN weld_type VARCHAR(50)"))
        
        if 'welder_no' not in columns:
            print("Adding welder_no column to ndt_requests table...")
            conn.execute(text("ALTER TABLE ndt_requests ADD COLUMN welder_no VARCHAR(50)"))
        
        if 'weld_size' not in columns:
            print("Adding weld_size column to ndt_requests table...")
            conn.execute(text("ALTER TABLE ndt_requests ADD COLUMN weld_size FLOAT"))
        
        if 'weld_process' not in columns:
            print("Adding weld_process column to ndt_requests table...")
            conn.execute(text("ALTER TABLE ndt_requests ADD COLUMN weld_process VARCHAR(50)"))
        
        conn.commit()
        print("Migration completed successfully!")

if __name__ == "__main__":
    migrate_ndt_request()
