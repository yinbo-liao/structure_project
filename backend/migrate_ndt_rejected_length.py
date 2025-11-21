#!/usr/bin/env python3
"""
Migration script to add rejected_length column to ndt_status_records table
"""

import sqlite3
import sys
import os

def migrate_database():
    # Get the database path
    db_path = os.path.join(os.path.dirname(__file__), 'project_management.db')
    
    if not os.path.exists(db_path):
        print(f"Database file not found: {db_path}")
        return False
    
    try:
        # Connect to the database
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Check if rejected_length column already exists
        cursor.execute("PRAGMA table_info(ndt_status_records)")
        columns = [column[1] for column in cursor.fetchall()]
        
        if 'rejected_length' in columns:
            print("rejected_length column already exists in ndt_status_records table")
            return True
        
        # Add the rejected_length column
        print("Adding rejected_length column to ndt_status_records table...")
        cursor.execute("ALTER TABLE ndt_status_records ADD COLUMN rejected_length FLOAT DEFAULT 0.0")
        
        # Commit changes
        conn.commit()
        print("Successfully added rejected_length column to ndt_status_records table")
        
        # Verify the column was added
        cursor.execute("PRAGMA table_info(ndt_status_records)")
        columns = [column[1] for column in cursor.fetchall()]
        if 'rejected_length' in columns:
            print("Verified: rejected_length column successfully added")
            return True
        else:
            print("Error: rejected_length column was not added")
            return False
            
    except sqlite3.Error as e:
        print(f"Database error: {e}")
        return False
    except Exception as e:
        print(f"Unexpected error: {e}")
        return False
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    print("Starting NDT Status rejected_length migration...")
    if migrate_database():
        print("Migration completed successfully!")
        sys.exit(0)
    else:
        print("Migration failed!")
        sys.exit(1)
