#!/usr/bin/env python3
"""
Database seeding script for MPDMS
Creates initial admin and test users
"""

import sys
import os

# Add the current directory to Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database import SessionLocal, create_tables
from app.models import User
from app.auth import get_password_hash

def seed_database():
    """Create initial users in the database"""
    
    # Create tables first
    create_tables()
    
    # Create session
    db = SessionLocal()
    
    try:
        # Check if admin already exists
        admin = db.query(User).filter(User.email == "admin@mpdms.com").first()
        if admin:
            print("Admin user already exists")
            return
        
        # Create admin user
        admin_user = User(
            email="admin@mpdms.com",
            full_name="System Administrator",
            role="admin",
            hashed_password=get_password_hash("admin"),
            is_active=True
        )
        db.add(admin_user)
        
        # Create inspector user
        inspector_user = User(
            email="inspector@mpdms.com",
            full_name="Quality Inspector",
            role="inspector",
            hashed_password=get_password_hash("inspect"),
            is_active=True
        )
        db.add(inspector_user)
        
        # Create visitor user
        visitor_user = User(
            email="visitor@mpdms.com",
            full_name="Project Visitor",
            role="visitor",
            hashed_password=get_password_hash("visit"),
            is_active=True
        )
        db.add(visitor_user)
        
        db.commit()
        print("Database seeded successfully with initial users:")
        print("  - admin@mpdms.com (admin)")
        print("  - inspector@mpdms.com (inspect)")
        print("  - visitor@mpdms.com (visit)")
        
    except Exception as e:
        print(f"Error seeding database: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_database()
