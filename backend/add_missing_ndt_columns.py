import sqlite3
import sys

def add_missing_columns():
    """Add missing columns to ndt_tests table"""
    conn = sqlite3.connect('project_management.db')
    cursor = conn.cursor()
    
    # Check current columns
    cursor.execute('PRAGMA table_info(ndt_tests)')
    current_columns = [col[1] for col in cursor.fetchall()]
    print(f"Current columns in ndt_tests: {current_columns}")
    
    # Columns that should exist according to models.py
    required_columns = {
        'remarks': 'TEXT',
        'updated_at': 'DATETIME'
    }
    
    # Add missing columns
    for column_name, column_type in required_columns.items():
        if column_name not in current_columns:
            print(f"Adding column {column_name} ({column_type}) to ndt_tests table...")
            try:
                cursor.execute(f'ALTER TABLE ndt_tests ADD COLUMN {column_name} {column_type}')
                print(f"  ✓ Added {column_name}")
            except sqlite3.Error as e:
                print(f"  ✗ Error adding {column_name}: {e}")
    
    # Verify the changes
    cursor.execute('PRAGMA table_info(ndt_tests)')
    final_columns = cursor.fetchall()
    print("\nFinal ndt_tests table columns:")
    for col in final_columns:
        print(f"  {col[1]} ({col[2]})")
    
    conn.commit()
    conn.close()
    print("\nMigration completed!")

if __name__ == "__main__":
    add_missing_columns()