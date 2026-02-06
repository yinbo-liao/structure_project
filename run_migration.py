import sys
import os
sys.path.append('backend')

# Set environment variable to use the correct database
os.environ['DATABASE_URL'] = 'sqlite:///./project_management.db'

# Import and run the migration
from migrate_separate_tables import create_new_tables, check_existing_tables

print("Checking existing tables...")
if check_existing_tables():
    print("Tables already exist according to check_existing_tables()")
else:
    print("Tables don't exist, creating them...")
    create_new_tables()
    
# Also run the data migration
print("\n\nRunning data migration...")
from migrate_to_structure_tables import migrate_data, verify_migration
migrate_data()
verify_migration()
