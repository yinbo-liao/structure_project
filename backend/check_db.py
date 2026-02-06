import sqlite3
import os

def check_database():
    db_path = 'project_management.db'
    if not os.path.exists(db_path):
        print(f"Database file {db_path} does not exist")
        return
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Get all tables
    cursor.execute('SELECT name FROM sqlite_master WHERE type="table" ORDER BY name')
    tables = cursor.fetchall()
    
    print(f"Found {len(tables)} tables:")
    for table in tables:
        table_name = table[0]
        print(f"\n=== Table: {table_name} ===")
        
        # Get table schema
        cursor.execute(f'PRAGMA table_info("{table_name}")')
        columns = cursor.fetchall()
        print(f"Columns ({len(columns)}):")
        for col in columns:
            col_id, col_name, col_type, not_null, default_val, pk = col
            print(f"  {col_name}: {col_type} {'NOT NULL' if not_null else ''} {'PRIMARY KEY' if pk else ''}")
        
        # Get row count
        cursor.execute(f'SELECT COUNT(*) FROM "{table_name}"')
        row_count = cursor.fetchone()[0]
        print(f"Row count: {row_count}")
        
        # Get foreign keys
        cursor.execute(f'PRAGMA foreign_key_list("{table_name}")')
        fks = cursor.fetchall()
        if fks:
            print("Foreign keys:")
            for fk in fks:
                print(f"  {fk[3]} -> {fk[2]}.{fk[4]}")
    
    conn.close()

if __name__ == "__main__":
    check_database()