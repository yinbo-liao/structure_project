import sys
import os
sys.path.append('backend')

# Set environment variable to use the correct database
os.environ['DATABASE_URL'] = 'sqlite:///./project_management.db'

from sqlalchemy import create_engine, text

# Create engine
engine = create_engine('sqlite:///./project_management.db')

print("Fixing projects table...")
with engine.connect() as connection:
    # Start transaction
    trans = connection.begin()
    
    try:
        # Check if created_at column exists
        result = connection.execute(text("PRAGMA table_info(projects)"))
        columns = [row[1] for row in result]
        
        print("Current columns in projects table:")
        for col in columns:
            print(f"  {col}")
        
        # Add created_at if missing
        if 'created_at' not in columns:
            print("Adding created_at column...")
            connection.execute(text("ALTER TABLE projects ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP"))
        
        # Add updated_at if missing
        if 'updated_at' not in columns:
            print("Adding updated_at column...")
            connection.execute(text("ALTER TABLE projects ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP"))
        
        # Commit transaction
        trans.commit()
        print("✅ Projects table fixed successfully!")
        
    except Exception as e:
        trans.rollback()
        print(f"❌ Error fixing projects table: {e}")
        raise
