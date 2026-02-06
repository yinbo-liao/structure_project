#!/usr/bin/env python3
"""
Migration script to add password_change_required column to users table.
Run this script to update existing database.
"""
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from app.database import DATABASE_URL

def migrate():
    """Add password_change_required column to users table."""
    engine = create_engine(DATABASE_URL)
    
    # Check if column exists
    with engine.connect() as conn:
        # For SQLite
        if DATABASE_URL.startswith('sqlite'):
            result = conn.execute(text("""
                SELECT COUNT(*) FROM pragma_table_info('users') WHERE name='password_change_required'
            """))
            column_exists = result.scalar() > 0
            
            if not column_exists:
                print("Adding password_change_required column to users table...")
                conn.execute(text("""
                    ALTER TABLE users ADD COLUMN password_change_required BOOLEAN DEFAULT TRUE
                """))
                conn.commit()
                print("Column added successfully.")
                
                # Update existing users: set password_change_required = TRUE for all users
                conn.execute(text("""
                    UPDATE users SET password_change_required = TRUE
                """))
                conn.commit()
                print("Updated existing users with password_change_required = TRUE.")
            else:
                print("Column password_change_required already exists.")
        
        # For PostgreSQL
        elif DATABASE_URL.startswith('postgresql'):
            result = conn.execute(text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name='users' AND column_name='password_change_required'
            """))
            column_exists = result.fetchone() is not None
            
            if not column_exists:
                print("Adding password_change_required column to users table...")
                conn.execute(text("""
                    ALTER TABLE users ADD COLUMN password_change_required BOOLEAN DEFAULT TRUE
                """))
                conn.commit()
                print("Column added successfully.")
                
                # Update existing users: set password_change_required = TRUE for all users
                conn.execute(text("""
                    UPDATE users SET password_change_required = TRUE
                """))
                conn.commit()
                print("Updated existing users with password_change_required = TRUE.")
            else:
                print("Column password_change_required already exists.")
        
        else:
            print(f"Unsupported database: {DATABASE_URL}")
            return False
    
    print("Migration completed successfully.")
    return True

if __name__ == "__main__":
    try:
        migrate()
    except Exception as e:
        print(f"Migration failed: {e}")
        sys.exit(1)
