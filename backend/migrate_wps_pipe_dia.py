#!/usr/bin/env python3
"""
Migration script to add pipe_dia column to wps_register table
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
        
        # Check if pipe_dia column already exists
        cursor.execute("PRAGMA table_info(wps_register)")
        columns = [column[1] for column in cursor.fetchall()]
        
        if 'pipe_dia' in columns:
            print("pipe_dia column already exists in wps_register table")
            return True
        
        # Add the pipe_dia column
        print("Adding pipe_dia column to wps_register table...")
        cursor.execute("ALTER TABLE wps_register ADD COLUMN pipe_dia VARCHAR(20)")
        
        # Commit changes
        conn.commit()
        print("Successfully added pipe_dia column to wps_register table")
        
        # Verify the column was added
        cursor.execute("PRAGMA table_info(wps_register)")
        columns = [column[1] for column in cursor.fetchall()]
        if 'pipe_dia' in columns:
            print("Verified: pipe_dia column successfully added")
            return True
        else:
            print("Error: pipe_dia column was not added")
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
    print("Starting WPS Register migration...")
    if migrate_database():
        print("Migration completed successfully!")
        sys.exit(0)
    else:
        print("Migration failed!")
        sys.exit(1)
