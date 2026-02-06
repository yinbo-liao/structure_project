import sys
import os
sys.path.insert(0, 'backend')

from app.database import engine
from app.models import Base
from app.models import NDTStatusRecord

print("Creating NDTStatusRecord table if it doesn't exist...")
try:
    # Create the table
    NDTStatusRecord.__table__.create(bind=engine, checkfirst=True)
    print("Table created successfully!")
except Exception as e:
    print(f"Error creating table: {e}")
    
    # Try alternative approach
    try:
        print("Trying alternative approach...")
        Base.metadata.create_all(bind=engine, tables=[NDTStatusRecord.__table__])
        print("Table created successfully with alternative approach!")
    except Exception as e2:
        print(f"Alternative approach also failed: {e2}")
