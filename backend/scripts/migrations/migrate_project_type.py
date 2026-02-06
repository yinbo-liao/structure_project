#!/usr/bin/env python3
"""
Migration script to add project_type column to projects table.
Run this script to update the database schema.
"""

import sqlite3
import sys
import os

def migrate_database(db_path="project_management.db"):
    """Add project_type column to projects table."""
    
    print(f"Migrating database: {db_path}")
    
    try:
        # Connect to database
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Check if project_type column already exists
        cursor.execute("PRAGMA table_info(projects)")
        columns = [col[1] for col in cursor.fetchall()]
        
        if "project_type" in columns:
            print("✓ project_type column already exists")
        else:
            # Add project_type column with default value 'pipe'
            print("Adding project_type column to projects table...")
            cursor.execute("""
                ALTER TABLE projects 
                ADD COLUMN project_type TEXT DEFAULT 'pipe'
            """)
            print("✓ Added project_type column")
            
            # Update existing projects to have project_type = 'pipe'
            cursor.execute("UPDATE projects SET project_type = 'pipe' WHERE project_type IS NULL")
            print("✓ Updated existing projects with project_type = 'pipe'")
        
        # Commit changes
        conn.commit()
        conn.close()
        
        print("✓ Migration completed successfully")
        return True
        
    except Exception as e:
        print(f"✗ Migration failed: {e}")
        return False

if __name__ == "__main__":
    # Get database path from command line or use default
    db_path = sys.argv[1] if len(sys.argv) > 1 else "project_management.db"
    
    if not os.path.exists(db_path):
        print(f"Database file not found: {db_path}")
        print("Please provide the correct path to the database file.")
        sys.exit(1)
    
    success = migrate_database(db_path)
    sys.exit(0 if success else 1)
