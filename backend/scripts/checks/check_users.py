import sqlite3

def check_users():
    conn = sqlite3.connect('project_management.db')
    cursor = conn.cursor()
    
    # Check users table
    cursor.execute('SELECT * FROM users')
    users = cursor.fetchall()
    print('Users:')
    for user in users:
        print(user)
    
    # Check if there are any NDT requests
    cursor.execute('SELECT * FROM ndt_requests')
    ndt_requests = cursor.fetchall()
    print('\nNDT Requests:')
    for req in ndt_requests:
        print(req)
    
    conn.close()

if __name__ == '__main__':
    check_users()
