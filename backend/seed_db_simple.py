#!/usr/bin/env python3
"""
Simple database seeding script for MPDMS
Creates initial admin and test users without bcrypt dependency
"""

import sys
import os

# Add the current directory to Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database import SessionLocal, create_tables
from app.models import User, Project

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
            admin_user = admin
        else:
            admin_user = User(
                email="admin@mpdms.com",
                full_name="System Administrator",
                role="admin",
                hashed_password="bypass",
                is_active=True
            )
            db.add(admin_user)
        
        # Create inspector user
        inspector = db.query(User).filter(User.email == "inspector@mpdms.com").first()
        if inspector:
            inspector_user = inspector
        else:
            inspector_user = User(
                email="inspector@mpdms.com",
                full_name="Quality Inspector",
                role="inspector",
                hashed_password="bypass",
                is_active=True
            )
            db.add(inspector_user)
        
        # Create visitor user
        visitor = db.query(User).filter(User.email == "visitor@mpdms.com").first()
        if visitor:
            visitor_user = visitor
        else:
            visitor_user = User(
                email="visitor@mpdms.com",
                full_name="Project Visitor",
                role="visitor",
                hashed_password="bypass",
                is_active=True
            )
            db.add(visitor_user)
        
        db.commit()

        # Create sample projects
        p1 = db.query(Project).filter(Project.code == "P-001").first()
        if not p1:
            p1 = Project(name="Pipeline Alpha", code="P-001", description="Main pipeline section", owner_id=admin_user.id)
            db.add(p1)

        p2 = db.query(Project).filter(Project.code == "P-002").first()
        if not p2:
            p2 = Project(name="Pipeline Beta", code="P-002", description="Secondary pipeline section", owner_id=admin_user.id)
            db.add(p2)

        db.commit()

        # Assign projects to inspector and visitor
        inspector_user = db.query(User).filter(User.email == "inspector@mpdms.com").first()
        visitor_user = db.query(User).filter(User.email == "visitor@mpdms.com").first()
        projects = [p for p in [p1, p2] if p]
        inspector_user.assigned_projects = projects
        visitor_user.assigned_projects = [p1]
        db.commit()

        print("Database seeded successfully with initial users and projects:")
        print("  - admin@mpdms.com (admin)")
        print("  - inspector@mpdms.com (inspect)")
        print("  - visitor@mpdms.com (visit)")
        print("Projects:")
        for p in projects:
            print(f"  - {p.name} [{p.code}]")
        print("Note: Using TEST_LOGIN_BYPASS mode - passwords are 'admin', 'inspect', 'visit'")
        
    except Exception as e:
        print(f"Error seeding database: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_database()
