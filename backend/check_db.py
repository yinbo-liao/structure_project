import sqlite3

def check_database():
    conn = sqlite3.connect('project_management.db')
    cursor = conn.cursor()
    
    # Check existing tables and data
    cursor.execute('SELECT name FROM sqlite_master WHERE type="table"')
    tables = cursor.fetchall()
    print('Tables in database:', tables)
    
    # Check fitup_inspection table
    try:
        cursor.execute('SELECT COUNT(*) FROM fitup_inspection')
        fitup_count = cursor.fetchone()[0]
        print(f'Fit-up inspection records: {fitup_count}')
        
        if fitup_count > 0:
            cursor.execute('SELECT * FROM fitup_inspection LIMIT 5')
            records = cursor.fetchall()
            print('Sample fit-up records:', records)
    except Exception as e:
        print(f'Error checking fitup_inspection: {e}')
    
    # Check projects
    cursor.execute('SELECT id, name FROM projects')
    projects = cursor.fetchall()
    print('Projects:', projects)
    
    conn.close()

if __name__ == '__main__':
    check_database()
