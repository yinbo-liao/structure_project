#!/usr/bin/env python3
"""Fix admin password in SQLite database"""

from passlib.context import CryptContext
import sqlite3

def fix_admin_password():
    # Create password hash for "admin"
    pwd_context = CryptContext(schemes=['pbkdf2_sha256', 'bcrypt'], deprecated='auto')
    hashed = pwd_context.hash('admin')
    
    print(f"Hashed password for 'admin': {hashed}")
    print("Updating database...")
    
    # Update database
    conn = sqlite3.connect('project_management.db')
    cursor = conn.cursor()
    
    # Update admin password
    cursor.execute(
        "UPDATE users SET hashed_password=? WHERE email='admin@mpdms.com'",
        (hashed,)
    )
    
    # Also update other test users if they exist
    test_users = [
        ('inspector@mpdms.com', 'inspect'),
        ('visitor@mpdms.com', 'visit')
    ]
    
    for email, password in test_users:
        hashed_pw = pwd_context.hash(password)
        cursor.execute(
            "UPDATE users SET hashed_password=? WHERE email=?",
            (hashed_pw, email)
        )
        print(f"Updated password for {email}")
    
    conn.commit()
    
    # Verify update
    cursor.execute("SELECT email, hashed_password FROM users WHERE email LIKE '%@mpdms.com'")
    results = cursor.fetchall()
    
    print("\nUpdated records:")
    for email, hashed_pw in results:
        print(f"{email}: {hashed_pw[:50]}...")
    
    conn.close()
    print("\nDatabase updated successfully!")
    
    # Test password verification
    print("\nTesting password verification:")
    for email, password in [('admin@mpdms.com', 'admin'), 
                           ('inspector@mpdms.com', 'inspect'),
                           ('visitor@mpdms.com', 'visit')]:
        test_hash = pwd_context.hash(password) if email == 'admin@mpdms.com' else hashed
        is_valid = pwd_context.verify(password, hashed_pw)
        print(f"{email} / {password}: {'VALID' if is_valid else 'INVALID'}")

if __name__ == "__main__":
    fix_admin_password()
