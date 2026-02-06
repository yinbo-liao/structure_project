#!/usr/bin/env python3
"""
Migration script to create separate tables for pipe and structure projects.
This script creates all new prefixed tables and optionally migrates existing data.
Run this script to update the database schema.
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, text, inspect
from sqlalchemy.orm import sessionmaker
import os

# Get database URL from environment or use default SQLite
database_url = os.getenv(
    "DATABASE_URL", 
    "sqlite:///./project_management.db"
)

# Check if we should use SQLite for testing
if "sqlite" in database_url or os.getenv("USE_SQLITE", "true").lower() == "true":
    DATABASE_URL = "sqlite:///./project_management.db"
else:
    DATABASE_URL = database_url

def create_new_tables():
    """Create all new prefixed tables for pipe and structure projects."""
    print("Starting migration to create separate pipe and structure tables...")
    
    # Create engine and session
    engine = create_engine(DATABASE_URL)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    
    try:
        with engine.connect() as connection:
            # Start transaction
            trans = connection.begin()
            
            try:
                print("=" * 60)
                print("Creating PIPE PROJECT TABLES")
                print("=" * 60)
                
                # 1. Pipe Master Joint List
                print("1. Creating pipe_master_joint_list table...")
                connection.execute(text("""
                    CREATE TABLE IF NOT EXISTS pipe_master_joint_list (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        project_id INTEGER NOT NULL,
                        system_no VARCHAR(50) NOT NULL,
                        line_no VARCHAR(50) NOT NULL,
                        spool_no VARCHAR(50) NOT NULL,
                        joint_no VARCHAR(50) NOT NULL,
                        pipe_dia VARCHAR(20),
                        weld_type VARCHAR(50),
                        weld_length FLOAT,
                        fit_up_report_no VARCHAR(50),
                        fitup_status VARCHAR(20) DEFAULT 'pending',
                        final_status VARCHAR(20) DEFAULT 'pending',
                        inspection_category VARCHAR(20) DEFAULT 'type-I',
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (project_id) REFERENCES projects(id),
                        UNIQUE(project_id, system_no, line_no, spool_no, joint_no)
                    )
                """))
                
                # 2. Pipe Material Register
                print("2. Creating pipe_material_register table...")
                connection.execute(text("""
                    CREATE TABLE IF NOT EXISTS pipe_material_register (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        project_id INTEGER NOT NULL,
                        piece_mark_no VARCHAR(100) NOT NULL,
                        material_type VARCHAR(50),
                        grade VARCHAR(50),
                        thickness VARCHAR(20),
                        heat_no VARCHAR(50),
                        spec VARCHAR(50),
                        category VARCHAR(50),
                        pipe_dia VARCHAR(20),
                        material_report_no VARCHAR(50),
                        inspection_status VARCHAR(20) DEFAULT 'pending',
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (project_id) REFERENCES projects(id),
                        UNIQUE(project_id, piece_mark_no)
                    )
                """))
                
                # 3. Pipe Material Inspection
                print("3. Creating pipe_material_inspection table...")
                connection.execute(text("""
                    CREATE TABLE IF NOT EXISTS pipe_material_inspection (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        project_id INTEGER NOT NULL,
                        material_type VARCHAR(50) NOT NULL,
                        grade VARCHAR(50) NOT NULL,
                        size VARCHAR(50),
                        schedule VARCHAR(20),
                        thickness VARCHAR(20),
                        material_spec VARCHAR(100),
                        report_no VARCHAR(50),
                        inspection_status VARCHAR(20) DEFAULT 'pending',
                        heat_no VARCHAR(50),
                        quantity INTEGER DEFAULT 1,
                        inspection_date DATETIME,
                        remarks TEXT,
                        inspector_name VARCHAR(100),
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (project_id) REFERENCES projects(id),
                        UNIQUE(project_id, material_type, grade, size, heat_no)
                    )
                """))
                
                # 4. Pipe Fit-up Inspection
                print("4. Creating pipe_fitup_inspection table...")
                connection.execute(text("""
                    CREATE TABLE IF NOT EXISTS pipe_fitup_inspection (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        project_id INTEGER NOT NULL,
                        system_no VARCHAR(50),
                        line_no VARCHAR(50),
                        spool_no VARCHAR(50),
                        joint_no VARCHAR(50),
                        weld_type VARCHAR(50),
                        part1_piece_mark_no VARCHAR(100),
                        part2_piece_mark_no VARCHAR(100),
                        part1_material_type VARCHAR(50),
                        part1_grade VARCHAR(50),
                        part1_thickness VARCHAR(20),
                        part1_heat_no VARCHAR(50),
                        part2_material_type VARCHAR(50),
                        part2_grade VARCHAR(50),
                        part2_thickness VARCHAR(20),
                        part2_heat_no VARCHAR(50),
                        weld_site VARCHAR(20),
                        weld_length FLOAT,
                        fit_up_date DATETIME,
                        fit_up_report_no VARCHAR(50),
                        fit_up_result VARCHAR(50),
                        remarks TEXT,
                        updated_by VARCHAR(255),
                        master_joint_id INTEGER,
                        inspection_category VARCHAR(20) DEFAULT 'type-I',
                        FOREIGN KEY (project_id) REFERENCES projects(id),
                        FOREIGN KEY (master_joint_id) REFERENCES pipe_master_joint_list(id)
                    )
                """))
                
                # 5. Pipe Final Inspection
                print("5. Creating pipe_final_inspection table...")
                connection.execute(text("""
                    CREATE TABLE IF NOT EXISTS pipe_final_inspection (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        fitup_id INTEGER,
                        project_id INTEGER NOT NULL,
                        system_no VARCHAR(50),
                        line_no VARCHAR(50),
                        spool_no VARCHAR(50),
                        joint_no VARCHAR(50),
                        weld_type VARCHAR(50),
                        wps_no VARCHAR(50),
                        welder_no VARCHAR(50),
                        welder_validity VARCHAR(20),
                        weld_site VARCHAR(20),
                        final_date DATETIME,
                        final_report_no VARCHAR(50),
                        final_result VARCHAR(50),
                        ndt_type VARCHAR(20),
                        weld_length FLOAT,
                        pipe_dia VARCHAR(20),
                        remarks TEXT,
                        inspection_category VARCHAR(20) DEFAULT 'type-I',
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (project_id) REFERENCES projects(id),
                        FOREIGN KEY (fitup_id) REFERENCES pipe_fitup_inspection(id)
                    )
                """))
                
                # 6. Pipe NDT Requests
                print("6. Creating pipe_ndt_requests table...")
                connection.execute(text("""
                    CREATE TABLE IF NOT EXISTS pipe_ndt_requests (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        project_id INTEGER NOT NULL,
                        final_id INTEGER NOT NULL,
                        project_name VARCHAR(100),
                        project_code VARCHAR(20),
                        department VARCHAR(20),
                        incharge_person VARCHAR(100),
                        contact VARCHAR(50),
                        request_time DATETIME,
                        contractor VARCHAR(20),
                        job_code VARCHAR(50),
                        job_location VARCHAR(100),
                        test_time DATETIME,
                        requirement TEXT,
                        detail_description TEXT,
                        status VARCHAR(20) DEFAULT 'pending',
                        ndt_type VARCHAR(20),
                        ndt_report_no VARCHAR(100),
                        ndt_result VARCHAR(20),
                        system_no VARCHAR(50),
                        line_no VARCHAR(50),
                        spool_no VARCHAR(50),
                        joint_no VARCHAR(50),
                        weld_type VARCHAR(50),
                        welder_no VARCHAR(50),
                        weld_size FLOAT,
                        weld_process VARCHAR(50),
                        pipe_dia VARCHAR(20),
                        inspection_category VARCHAR(20) DEFAULT 'type-I',
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (project_id) REFERENCES projects(id),
                        FOREIGN KEY (final_id) REFERENCES pipe_final_inspection(id),
                        UNIQUE(project_id, system_no, line_no, spool_no, joint_no, ndt_type)
                    )
                """))
                
                print("\n" + "=" * 60)
                print("Creating STRUCTURE PROJECT TABLES")
                print("=" * 60)
                
                # 7. Structure Master Joint List
                print("7. Creating structure_master_joint_list table...")
                connection.execute(text("""
                    CREATE TABLE IF NOT EXISTS structure_master_joint_list (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        project_id INTEGER NOT NULL,
                        draw_no VARCHAR(50) NOT NULL,
                        structure_category VARCHAR(50) NOT NULL,
                        page_no VARCHAR(50) NOT NULL,
                        drawing_rev VARCHAR(20) NOT NULL,
                        joint_no VARCHAR(50) NOT NULL,
                        block_no VARCHAR(50),
                        weld_type VARCHAR(50),
                        weld_length FLOAT,
                        part1_piece_mark_no VARCHAR(100),
                        part2_piece_mark_no VARCHAR(100),
                        fit_up_report_no VARCHAR(50),
                        fitup_status VARCHAR(20) DEFAULT 'pending',
                        final_status VARCHAR(20) DEFAULT 'pending',
                        inspection_category VARCHAR(20) DEFAULT 'type-I',
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (project_id) REFERENCES projects(id),
                        UNIQUE(project_id, draw_no, structure_category, page_no, drawing_rev, joint_no)
                    )
                """))
                
                # 8. Structure Material Register
                print("8. Creating structure_material_register table...")
                connection.execute(text("""
                    CREATE TABLE IF NOT EXISTS structure_material_register (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        project_id INTEGER NOT NULL,
                        piece_mark_no VARCHAR(100) NOT NULL,
                        material_type VARCHAR(50),
                        grade VARCHAR(50),
                        thickness VARCHAR(20),
                        heat_no VARCHAR(50),
                        spec VARCHAR(50),
                        category VARCHAR(50),
                        drawing_no VARCHAR(50),
                        structure_category VARCHAR(50),
                        drawing_rev VARCHAR(20),
                        material_report_no VARCHAR(50),
                        inspection_status VARCHAR(20) DEFAULT 'pending',
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (project_id) REFERENCES projects(id),
                        UNIQUE(project_id, piece_mark_no)
                    )
                """))
                
                # 9. Structure Material Inspection
                print("9. Creating structure_material_inspection table...")
                connection.execute(text("""
                    CREATE TABLE IF NOT EXISTS structure_material_inspection (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        project_id INTEGER NOT NULL,
                        material_type VARCHAR(50) NOT NULL,
                        grade VARCHAR(50) NOT NULL,
                        size VARCHAR(50),
                        width VARCHAR(20),
                        length VARCHAR(20),
                        thickness VARCHAR(20),
                        material_spec VARCHAR(100),
                        report_no VARCHAR(50),
                        inspection_status VARCHAR(20) DEFAULT 'pending',
                        heat_no VARCHAR(50),
                        quantity INTEGER DEFAULT 1,
                        inspection_date DATETIME,
                        remarks TEXT,
                        inspector_name VARCHAR(100),
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (project_id) REFERENCES projects(id),
                        UNIQUE(project_id, material_type, grade, size, heat_no)
                    )
                """))
                
                # 10. Structure Fit-up Inspection
                print("10. Creating structure_fitup_inspection table...")
                connection.execute(text("""
                    CREATE TABLE IF NOT EXISTS structure_fitup_inspection (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        project_id INTEGER NOT NULL,
                        draw_no VARCHAR(50),
                        structure_category VARCHAR(50),
                        page_no VARCHAR(50),
                        drawing_rev VARCHAR(20),
                        joint_no VARCHAR(50),
                        block_no VARCHAR(50),
                        weld_type VARCHAR(50),
                        part1_piece_mark_no VARCHAR(100),
                        part2_piece_mark_no VARCHAR(100),
                        part1_material_type VARCHAR(50),
                        part1_grade VARCHAR(50),
                        part1_thickness VARCHAR(20),
                        part1_heat_no VARCHAR(50),
                        part2_material_type VARCHAR(50),
                        part2_grade VARCHAR(50),
                        part2_thickness VARCHAR(20),
                        part2_heat_no VARCHAR(50),
                        weld_site VARCHAR(20),
                        weld_length FLOAT,
                        dia VARCHAR(20),
                        fit_up_date DATETIME,
                        fit_up_report_no VARCHAR(50),
                        fit_up_result VARCHAR(50),
                        remarks TEXT,
                        updated_by VARCHAR(255),
                        master_joint_id INTEGER,
                        inspection_category VARCHAR(20) DEFAULT 'type-I',
                        FOREIGN KEY (project_id) REFERENCES projects(id),
                        FOREIGN KEY (master_joint_id) REFERENCES structure_master_joint_list(id)
                    )
                """))
                
                # 11. Structure Final Inspection
                print("11. Creating structure_final_inspection table...")
                connection.execute(text("""
                    CREATE TABLE IF NOT EXISTS structure_final_inspection (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        fitup_id INTEGER,
                        project_id INTEGER NOT NULL,
                        draw_no VARCHAR(50),
                        structure_category VARCHAR(50),
                        page_no VARCHAR(50),
                        drawing_rev VARCHAR(20),
                        joint_no VARCHAR(50),
                        block_no VARCHAR(50),
                        weld_type VARCHAR(50),
                        wps_no VARCHAR(50),
                        welder_no VARCHAR(50),
                        welder_validity VARCHAR(20),
                        weld_site VARCHAR(20),
                        final_date DATETIME,
                        final_report_no VARCHAR(50),
                        final_result VARCHAR(50),
                        ndt_type VARCHAR(20),
                        weld_length FLOAT,
                        remarks TEXT,
                        inspection_category VARCHAR(20) DEFAULT 'type-I',
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (project_id) REFERENCES projects(id),
                        FOREIGN KEY (fitup_id) REFERENCES structure_fitup_inspection(id)
                    )
                """))
                
                # 12. Structure NDT Requests
                print("12. Creating structure_ndt_requests table...")
                connection.execute(text("""
                    CREATE TABLE IF NOT EXISTS structure_ndt_requests (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        project_id INTEGER NOT NULL,
                        final_id INTEGER NOT NULL,
                        project_name VARCHAR(100),
                        project_code VARCHAR(20),
                        department VARCHAR(20),
                        incharge_person VARCHAR(100),
                        contact VARCHAR(50),
                        request_time DATETIME,
                        contractor VARCHAR(20),
                        job_code VARCHAR(50),
                        job_location VARCHAR(100),
                        test_time DATETIME,
                        requirement TEXT,
                        detail_description TEXT,
                        status VARCHAR(20) DEFAULT 'pending',
                        ndt_type VARCHAR(20),
                        ndt_report_no VARCHAR(100),
                        ndt_result VARCHAR(20),
                        draw_no VARCHAR(50),
                        structure_category VARCHAR(50),
                        page_no VARCHAR(50),
                        drawing_rev VARCHAR(20),
                        joint_no VARCHAR(50),
                        block_no VARCHAR(50),
                        weld_type VARCHAR(50),
                        welder_no VARCHAR(50),
                        weld_size FLOAT,
                        weld_process VARCHAR(50),
                        thickness VARCHAR(20),
                        inspection_category VARCHAR(20) DEFAULT 'type-I',
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (project_id) REFERENCES projects(id),
                        FOREIGN KEY (final_id) REFERENCES structure_final_inspection(id),
                        UNIQUE(project_id, draw_no, structure_category, page_no, drawing_rev, joint_no, ndt_type)
                    )
                """))
                
                print("\n" + "=" * 60)
                print("Creating INDEXES for better performance")
                print("=" * 60)
                
                # Create indexes for pipe tables
                print("Creating indexes for pipe tables...")
                connection.execute(text("CREATE INDEX IF NOT EXISTS ix_pipe_master_joint_project ON pipe_master_joint_list(project_id)"))
                connection.execute(text("CREATE INDEX IF NOT EXISTS ix_pipe_master_joint_category ON pipe_master_joint_list(inspection_category)"))
                
                connection.execute(text("CREATE INDEX IF NOT EXISTS ix_pipe_material_piece_mark ON pipe_material_register(piece_mark_no)"))
                connection.execute(text("CREATE INDEX IF NOT EXISTS ix_pipe_material_project ON pipe_material_register(project_id)"))
                connection.execute(text("CREATE INDEX IF NOT EXISTS ix_pipe_material_report_no ON pipe_material_register(material_report_no)"))
                
                connection.execute(text("CREATE INDEX IF NOT EXISTS ix_pipe_material_inspection_project ON pipe_material_inspection(project_id)"))
                connection.execute(text("CREATE INDEX IF NOT EXISTS ix_pipe_material_inspection_status ON pipe_material_inspection(inspection_status)"))
                connection.execute(text("CREATE INDEX IF NOT EXISTS ix_pipe_material_inspection_date ON pipe_material_inspection(inspection_date)"))
                
                connection.execute(text("CREATE INDEX IF NOT EXISTS ix_pipe_fitup_project ON pipe_fitup_inspection(project_id)"))
                connection.execute(text("CREATE INDEX IF NOT EXISTS ix_pipe_fitup_master_joint ON pipe_fitup_inspection(master_joint_id)"))
                connection.execute(text("CREATE INDEX IF NOT EXISTS ix_pipe_fitup_category ON pipe_fitup_inspection(inspection_category)"))
                
                connection.execute(text("CREATE INDEX IF NOT EXISTS ix_pipe_final_project ON pipe_final_inspection(project_id)"))
                connection.execute(text("CREATE INDEX IF NOT EXISTS ix_pipe_final_fitup ON pipe_final_inspection(fitup_id)"))
                connection.execute(text("CREATE INDEX IF NOT EXISTS ix_pipe_final_category ON pipe_final_inspection(inspection_category)"))
                
                connection.execute(text("CREATE INDEX IF NOT EXISTS ix_pipe_ndt_req_project ON pipe_ndt_requests(project_id)"))
                connection.execute(text("CREATE INDEX IF NOT EXISTS ix_pipe_ndt_req_joint ON pipe_ndt_requests(system_no, line_no, spool_no, joint_no)"))
                connection.execute(text("CREATE INDEX IF NOT EXISTS ix_pipe_ndt_req_method ON pipe_ndt_requests(ndt_type)"))
                connection.execute(text("CREATE INDEX IF NOT EXISTS ix_pipe_ndt_status ON pipe_ndt_requests(status)"))
                connection.execute(text("CREATE INDEX IF NOT EXISTS ix_pipe_ndt_final ON pipe_ndt_requests(final_id)"))
                connection.execute(text("CREATE INDEX IF NOT EXISTS ix_pipe_ndt_req_category ON pipe_ndt_requests(inspection_category)"))
                
                # Create indexes for structure tables
                print("Creating indexes for structure tables...")
                connection.execute(text("CREATE INDEX IF NOT EXISTS ix_structure_master_joint_project ON structure_master_joint_list(project_id)"))
                connection.execute(text("CREATE INDEX IF NOT EXISTS ix_structure_master_joint_category ON structure_master_joint_list(inspection_category)"))
                connection.execute(text("CREATE INDEX IF NOT EXISTS ix_structure_master_joint_block_no ON structure_master_joint_list(block_no)"))
                
                connection.execute(text("CREATE INDEX IF NOT EXISTS ix_structure_material_piece_mark ON structure_material_register(piece_mark_no)"))
                connection.execute(text("CREATE INDEX IF NOT EXISTS ix_structure_material_project ON structure_material_register(project_id)"))
                connection.execute(text("CREATE INDEX IF NOT EXISTS ix_structure_material_drawing_no ON structure_material_register(drawing_no)"))
                connection.execute(text("CREATE INDEX IF NOT EXISTS ix_structure_material_structure_category ON structure_material_register(structure_category)"))
                connection.execute(text("CREATE INDEX IF NOT EXISTS ix_structure_material_report_no ON structure_material_register(material_report_no)"))
                
                connection.execute(text("CREATE INDEX IF NOT EXISTS ix_structure_material_inspection_project ON structure_material_inspection(project_id)"))
                connection.execute(text("CREATE INDEX IF NOT EXISTS ix_structure_material_inspection_status ON structure_material_inspection(inspection_status)"))
                connection.execute(text("CREATE INDEX IF NOT EXISTS ix_structure_material_inspection_date ON structure_material_inspection(inspection_date)"))
                
                connection.execute(text("CREATE INDEX IF NOT EXISTS ix_structure_fitup_project ON structure_fitup_inspection(project_id)"))
                connection.execute(text("CREATE INDEX IF NOT EXISTS ix_structure_fitup_master_joint ON structure_fitup_inspection(master_joint_id)"))
                connection.execute(text("CREATE INDEX IF NOT EXISTS ix_structure_fitup_category ON structure_fitup_inspection(inspection_category)"))
                connection.execute(text("CREATE INDEX IF NOT EXISTS ix_structure_fitup_block_no ON structure_fitup_inspection(block_no)"))
                
                connection.execute(text("CREATE INDEX IF NOT EXISTS ix_structure_final_project ON structure_final_inspection(project_id)"))
                connection.execute(text("CREATE INDEX IF NOT EXISTS ix_structure_final_fitup ON structure_final_inspection(fitup_id)"))
                connection.execute(text("CREATE INDEX IF NOT EXISTS ix_structure_final_category ON structure_final_inspection(inspection_category)"))
                connection.execute(text("CREATE INDEX IF NOT EXISTS ix_structure_final_block_no ON structure_final_inspection(block_no)"))
                
                connection.execute(text("CREATE INDEX IF NOT EXISTS ix_structure_ndt_req_project ON structure_ndt_requests(project_id)"))
                connection.execute(text("CREATE INDEX IF NOT EXISTS ix_structure_ndt_req_joint ON structure_ndt_requests(draw_no, structure_category, page_no, drawing_rev, joint_no)"))
                connection.execute(text("CREATE INDEX IF NOT EXISTS ix_structure_ndt_req_method ON structure_ndt_requests(ndt_type)"))
                connection.execute(text("CREATE INDEX IF NOT EXISTS ix_structure_ndt_status ON structure_ndt_requests(status)"))
                connection.execute(text("CREATE INDEX IF NOT EXISTS ix_structure_ndt_final ON structure_ndt_requests(final_id)"))
                connection.execute(text("CREATE INDEX IF NOT EXISTS ix_structure_ndt_req_category ON structure_ndt_requests(inspection_category)"))
                connection.execute(text("CREATE INDEX IF NOT EXISTS ix_structure_ndt_req_block_no ON structure_ndt_requests(block_no)"))
                
                # Commit transaction
                trans.commit()
                print("\n" + "=" * 60)
                print("✅ Migration completed successfully!")
                print("=" * 60)
                print("\nCreated the following tables:")
                print("PIPE PROJECT TABLES:")
                print("  - pipe_master_joint_list")
                print("  - pipe_material_register")
                print("  - pipe_material_inspection")
                print("  - pipe_fitup_inspection")
                print("  - pipe_final_inspection")
                print("  - pipe_ndt_requests")
                print("\nSTRUCTURE PROJECT TABLES:")
                print("  - structure_master_joint_list")
                print("  - structure_material_register")
                print("  - structure_material_inspection")
                print("  - structure_fitup_inspection")
                print("  - structure_final_inspection")
                print("  - structure_ndt_requests")
                print("\nAll indexes have been created for optimal performance.")
                
            except Exception as e:
                trans.rollback()
                print(f"❌ Migration failed: {e}")
                raise
                
    except Exception as e:
        print(f"❌ Database connection error: {e}")
        sys.exit(1)

def check_existing_tables():
    """Check which tables already exist."""
    print("Checking existing database schema...")
    
    engine = create_engine(DATABASE_URL)
    inspector = inspect(engine)
    
    existing_tables = inspector.get_table_names()
    
    pipe_tables = [
        'pipe_master_joint_list',
        'pipe_material_register',
        'pipe_material_inspection',
        'pipe_fitup_inspection',
        'pipe_final_inspection',
        'pipe_ndt_requests'
    ]
    
    structure_tables = [
        'structure_master_joint_list',
        'structure_material_register',
        'structure_material_inspection',
        'structure_fitup_inspection',
        'structure_final_inspection',
        'structure_ndt_requests'
    ]
    
    print("\nExisting pipe tables:")
    for table in pipe_tables:
        if table in existing_tables:
            print(f"  ✓ {table}")
        else:
            print(f"  ✗ {table} (missing)")
    
    print("\nExisting structure tables:")
    for table in structure_tables:
        if table in existing_tables:
            print(f"  ✓ {table}")
        else:
            print(f"  ✗ {table} (missing)")
    
    return all(table in existing_tables for table in pipe_tables + structure_tables)

if __name__ == "__main__":
    print("=" * 60)
    print("Separate Tables Migration Script")
    print("=" * 60)
    
    # Check if tables already exist
    if check_existing_tables():
        print("\nAll separate tables already exist.")
        print("No migration needed.")
    else:
        print("\nSome tables are missing.")
        print("Do you want to create the missing tables? (y/n)")
        response = input().strip().lower()
        
        if response == 'y':
            create_new_tables()
        else:
            print("Migration cancelled.")
