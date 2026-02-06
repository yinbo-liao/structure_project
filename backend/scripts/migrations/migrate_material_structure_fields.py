#!/usr/bin/env python3
"""
Migration script to add structure-specific fields to material_register table.
Run this script to add drawing_no, structure_category, and drawing_rev columns.
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from app.database import DATABASE_URL

def migrate():
    """Add structure-specific columns to material_register table."""
    engine = create_engine(DATABASE_URL)
    
    # Check if columns already exist (SQLite version)
    with engine.connect() as conn:
        # Get table info for SQLite
        result = conn.execute(text("PRAGMA table_info(material_register)"))
        columns = [row[1] for row in result.fetchall()]
        
        drawing_no_exists = 'drawing_no' in columns
        structure_category_exists = 'structure_category' in columns
        drawing_rev_exists = 'drawing_rev' in columns
        
        print(f"drawing_no column exists: {drawing_no_exists}")
        print(f"structure_category column exists: {structure_category_exists}")
        print(f"drawing_rev column exists: {drawing_rev_exists}")
        
        # Add columns if they don't exist
        if not drawing_no_exists:
            print("Adding drawing_no column...")
            conn.execute(text("ALTER TABLE material_register ADD COLUMN drawing_no VARCHAR(50)"))
            print("✓ Added drawing_no column")
        
        if not structure_category_exists:
            print("Adding structure_category column...")
            conn.execute(text("ALTER TABLE material_register ADD COLUMN structure_category VARCHAR(50)"))
            print("✓ Added structure_category column")
        
        if not drawing_rev_exists:
            print("Adding drawing_rev column...")
            conn.execute(text("ALTER TABLE material_register ADD COLUMN drawing_rev VARCHAR(20)"))
            print("✓ Added drawing_rev column")
        
        # Create indexes if they don't exist (SQLite version)
        print("Creating indexes...")
        
        # Get existing indexes
        result = conn.execute(text("PRAGMA index_list(material_register)"))
        existing_indexes = [row[1] for row in result.fetchall()]
        
        if 'ix_material_drawing_no' not in existing_indexes:
            conn.execute(text("CREATE INDEX ix_material_drawing_no ON material_register(drawing_no)"))
            print("✓ Created ix_material_drawing_no index")
        
        if 'ix_material_structure_category' not in existing_indexes:
            conn.execute(text("CREATE INDEX ix_material_structure_category ON material_register(structure_category)"))
            print("✓ Created ix_material_structure_category index")
        
        conn.commit()
        print("\n✅ Migration completed successfully!")

if __name__ == "__main__":
    migrate()
