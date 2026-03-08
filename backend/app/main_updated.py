from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
import os
import logging
from datetime import datetime
from sqlalchemy import text, inspect
from sqlalchemy.exc import SQLAlchemyError

from app.database import engine, SessionLocal, check_database_health, get_database_stats
from app.models import Base, User
from app.auth import get_password_hash
from app.routes import auth, users, projects, ai, structure_inspections, templates, ndt_sync

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="Multi-Project Data Management System",
    description="A comprehensive system for managing inspection records across multiple projects",
    version="3.0.0",
    docs_url="/docs" if os.getenv("ENVIRONMENT") != "production" else None,
    redoc_url="/redoc" if os.getenv("ENVIRONMENT") != "production" else None,
)

# Database initialization and schema validation
def initialize_database():
    """Initialize database and validate schema"""
    try:
        # Create all tables
        Base.metadata.create_all(bind=engine)
        logger.info("Database tables initialized successfully")
        
        # Validate critical tables exist
        inspector = inspect(engine)
        required_tables = ['users']  # Only need users table for login
        
        existing_tables = inspector.get_table_names()
        missing_tables = [table for table in required_tables if table not in existing_tables]
        
        if missing_tables:
            logger.warning(f"Missing tables: {missing_tables}")
            # Try to create missing tables
            Base.metadata.create_all(bind=engine)
            logger.info(f"Created missing tables: {missing_tables}")
        
        _ensure_user_columns()
        _ensure_default_users()

        _ensure_structure_master_joint_columns()
   
        _ensure_structure_material_register_columns()
        _ensure_fitup_inspection_columns()
        _ensure_final_inspection_columns()
        _ensure_wps_register_columns()
        _ensure_welder_register_columns()
        _ensure_material_register_columns()
        _ensure_ndt_tables_columns()
        _ensure_unique_joint_indexes()
        _backfill_timestamps()
        
    except Exception as e:
        logger.error(f"Database initialization failed: {e}")
        raise

def create_performance_indexes():
    try:
        with engine.connect() as conn:
            if engine.dialect.name == 'postgresql':
                indexes = [

                    "CREATE INDEX IF NOT EXISTS idx_structure_master_joint_project_draw ON structure_master_joint_list(project_id, draw_no)",
                    "CREATE INDEX IF NOT EXISTS idx_structure_master_joint_category ON structure_master_joint_list(inspection_category)",
                    "CREATE INDEX IF NOT EXISTS idx_structure_final_project_date ON structure_final_inspection(project_id, final_date)",
                    "CREATE INDEX IF NOT EXISTS idx_structure_final_result ON structure_final_inspection(final_result)",
                    "CREATE INDEX IF NOT EXISTS idx_pipe_ndt_status_project_method ON pipe_ndt_status_records(project_id, ndt_type)",
                    "CREATE INDEX IF NOT EXISTS idx_structure_ndt_status_project_method ON structure_ndt_status_records(project_id, ndt_type)",

                    "CREATE INDEX IF NOT EXISTS idx_structure_material_project_piece ON structure_material_register(project_id, piece_mark_no)",
                ]
                for index_sql in indexes:
                    try:
                        conn.execute(text(index_sql))
                        conn.commit()
                    except Exception as e:
                        logger.warning(f"Could not create index: {e}")
                        conn.rollback()
            else:
                logger.info(f"Using {engine.dialect.name} database, skipping PostgreSQL-specific indexes")
    except Exception as e:
        logger.error(f"Failed to create performance indexes: {e}")



def _ensure_structure_master_joint_columns():
    """Ensure required columns exist on structure_master_joint_list for SQLite"""
    try:
        if engine.dialect.name != 'sqlite':
            return
        with engine.connect() as conn:
            cols = conn.exec_driver_sql("PRAGMA table_info(structure_master_joint_list)").fetchall()
            names = [r[1] for r in cols]
            if "created_at" not in names:
                try:
                    conn.exec_driver_sql("ALTER TABLE structure_master_joint_list ADD COLUMN created_at DATETIME")
                    logger.info("Added column created_at to structure_master_joint_list")
                except Exception as e:
                    logger.warning(f"Could not add created_at column: {e}")
            if "updated_at" not in names:
                try:
                    conn.exec_driver_sql("ALTER TABLE structure_master_joint_list ADD COLUMN updated_at DATETIME")
                    logger.info("Added column updated_at to structure_master_joint_list")
                except Exception as e:
                    logger.warning(f"Could not add updated_at column: {e}")
            if "fit_up_report_no" not in names:
                try:
                    conn.exec_driver_sql("ALTER TABLE structure_master_joint_list ADD COLUMN fit_up_report_no VARCHAR(50)")
                    logger.info("Added column fit_up_report_no to structure_master_joint_list")
                except Exception as e:
                    logger.warning(f"Could not add fit_up_report_no column: {e}")
            if "final_report_no" not in names:
                try:
                    conn.exec_driver_sql("ALTER TABLE structure_master_joint_list ADD COLUMN final_report_no VARCHAR(50)")
                    logger.info("Added column final_report_no to structure_master_joint_list")
                except Exception as e:
                    logger.warning(f"Could not add final_report_no column: {e}")
            if "thickness" not in names:
                try:
                    conn.exec_driver_sql("ALTER TABLE structure_master_joint_list ADD COLUMN thickness VARCHAR(20)")
                    logger.info("Added column thickness to structure_master_joint_list")
                except Exception as e:
                    logger.warning(f"Could not add thickness column: {e}")
    except Exception as e:
        logger.error(f"Structure column migration failed: {e}")

def _ensure_structure_material_register_columns():
    """Ensure required columns exist on structure_material_register for SQLite"""
    try:
        if engine.dialect.name != 'sqlite':
            return
        with engine.connect() as conn:
            cols = conn.exec_driver_sql("PRAGMA table_info(structure_material_register)").fetchall()
            names = [r[1] for r in cols]
            if "block_no" not in names:
                try:
                    conn.exec_driver_sql("ALTER TABLE structure_material_register ADD COLUMN block_no VARCHAR(50)")
                    logger.info("Added column block_no to structure_material_register")
                except Exception as e:
                    logger.warning(f"Could not add block_no column: {e}")
            if "structure_spec" not in names:
                try:
                    conn.exec_driver_sql("ALTER TABLE structure_material_register ADD COLUMN structure_spec VARCHAR(50)")
                    logger.info("Added column structure_spec to structure_material_register")
                except Exception as e:
                    logger.warning(f"Could not add structure_spec column: {e}")
            if "structure_category" not in names:
                try:
                    conn.exec_driver_sql("ALTER TABLE structure_material_register ADD COLUMN structure_category VARCHAR(50)")
                    logger.info("Added column structure_category to structure_material_register")
                except Exception as e:
                    logger.warning(f"Could not add structure_category column: {e}")
            if "drawing_no" not in names:
                try:
                    conn.exec_driver_sql("ALTER TABLE structure_material_register ADD COLUMN drawing_no VARCHAR(50)")
                    logger.info("Added column drawing_no to structure_material_register")
                except Exception as e:
                    logger.warning(f"Could not add drawing_no column: {e}")
            if "drawing_rev" not in names:
                try:
                    conn.exec_driver_sql("ALTER TABLE structure_material_register ADD COLUMN drawing_rev VARCHAR(20)")
                    logger.info("Added column drawing_rev to structure_material_register")
                except Exception as e:
                    logger.warning(f"Could not add drawing_rev column: {e}")
            if "width" not in names:
                try:
                    conn.exec_driver_sql("ALTER TABLE structure_material_register ADD COLUMN width VARCHAR(20)")
                    logger.info("Added column width to structure_material_register")
                except Exception as e:
                    logger.warning(f"Could not add width column: {e}")
            if "length" not in names:
                try:
                    conn.exec_driver_sql("ALTER TABLE structure_material_register ADD COLUMN length VARCHAR(20)")
                    logger.info("Added column length to structure_material_register")
                except Exception as e:
                    logger.warning(f"Could not add length column: {e}")
    except Exception as e:
        logger.error(f"Structure material column migration failed: {e}")

def _ensure_default_users():
    """Ensure default users exist so TEST_LOGIN_BYPASS can work and admin can log in"""
    try:
        with SessionLocal() as db:
            users = {
                "admin@mpdms.com": {"role": "admin", "password": "admin"},
                "inspector@mpdms.com": {"role": "inspector", "password": "inspect"},
                "visitor@mpdms.com": {"role": "visitor", "password": "visit"},
            }
            for email, info in users.items():
                u = db.query(User).filter(User.email == email).first()
                if not u:
                    u = User(
                        email=email,
                        full_name=email.split("@")[0].title(),
                        role=info["role"],
                        hashed_password=get_password_hash(info["password"]),
                        is_active=True,
                        password_change_required=False,
                    )
                    db.add(u)
            db.commit()
    except Exception as e:
        logger.warning(f"Could not ensure default users: {e}")

def _ensure_user_columns():
    try:
        if engine.dialect.name != 'sqlite':
            return
        with engine.connect() as conn:
            cols = conn.exec_driver_sql("PRAGMA table_info(users)").fetchall()
            names = [r[1] for r in cols]
            if "last_login" not in names:
                try:
                    conn.exec_driver_sql("ALTER TABLE users ADD COLUMN last_login DATETIME")
                    logger.info("Added column last_login to users")
                except Exception as e:
                    logger.warning(f"Could not add last_login column: {e}")
            if "created_at" not in names:
                try:
                    conn.exec_driver_sql("ALTER TABLE users ADD COLUMN created_at DATETIME")
                    logger.info("Added column created_at to users")
                except Exception as e:
                    logger.warning(f"Could not add created_at column: {e}")
            if "updated_at" not in names:
                try:
                    conn.exec_driver_sql("ALTER TABLE users ADD COLUMN updated_at DATETIME")
                    logger.info("Added column updated_at to users")
                except Exception as e:
                    logger.warning(f"Could not add updated_at column: {e}")
    except Exception as e:
        logger.error(f"User column migration failed: {e}")


def _ensure_fitup_inspection_columns():
    """Ensure required columns exist on fitup inspection tables for SQLite"""
    try:
        if engine.dialect.name != 'sqlite':
            return
        
        tables = [ 'structure_fitup_inspection']
        
        for table_name in tables:
            with engine.connect() as conn:
                cols = conn.exec_driver_sql(f"PRAGMA table_info({table_name})").fetchall()
                names = [r[1] for r in cols]
                
                if "created_at" not in names:
                    try:
                        conn.exec_driver_sql(f"ALTER TABLE {table_name} ADD COLUMN created_at DATETIME")
                        logger.info(f"Added column created_at to {table_name}")
                    except Exception as e:
                        logger.warning(f"Could not add created_at column to {table_name}: {e}")
                
                if "updated_at" not in names:
                    try:
                        conn.exec_driver_sql(f"ALTER TABLE {table_name} ADD COLUMN updated_at DATETIME")
                        logger.info(f"Added column updated_at to {table_name}")
                    except Exception as e:
                        logger.warning(f"Could not add updated_at column to {table_name}: {e}")
                
                if "project_id" not in names:
                    try:
                        conn.exec_driver_sql(f"ALTER TABLE {table_name} ADD COLUMN project_id INTEGER")
                        logger.info(f"Added column project_id to {table_name}")
                    except Exception as e:
                        logger.warning(f"Could not add project_id column to {table_name}: {e}")
                
                if "updated_by" not in names:
                    try:
                        conn.exec_driver_sql(f"ALTER TABLE {table_name} ADD COLUMN updated_by VARCHAR(100)")
                        logger.info(f"Added column updated_by to {table_name}")
                    except Exception as e:
                        logger.warning(f"Could not add updated_by column to {table_name}: {e}")
                        
    except Exception as e:
        logger.error(f"Fitup inspection column migration failed: {e}")

def _ensure_final_inspection_columns():
    """Ensure required columns exist on final inspection tables for SQLite"""
    try:
        if engine.dialect.name != 'sqlite':
            return
        tables = ['pipe_final_inspection', 'structure_final_inspection']
        for table_name in tables:
            with engine.connect() as conn:
                cols = conn.exec_driver_sql(f"PRAGMA table_info({table_name})").fetchall()
                names = [r[1] for r in cols]
                if "created_at" not in names:
                    try:
                        conn.exec_driver_sql(f"ALTER TABLE {table_name} ADD COLUMN created_at DATETIME")
                        logger.info(f"Added column created_at to {table_name}")
                    except Exception as e:
                        logger.warning(f"Could not add created_at column to {table_name}: {e}")
                if "updated_at" not in names:
                    try:
                        conn.exec_driver_sql(f"ALTER TABLE {table_name} ADD COLUMN updated_at DATETIME")
                        logger.info(f"Added column updated_at to {table_name}")
                    except Exception as e:
                        logger.warning(f"Could not add updated_at column to {table_name}: {e}")
                if "project_id" not in names:
                    try:
                        conn.exec_driver_sql(f"ALTER TABLE {table_name} ADD COLUMN project_id INTEGER")
                        logger.info(f"Added column project_id to {table_name}")
                    except Exception as e:
                        logger.warning(f"Could not add project_id column to {table_name}: {e}")
    except Exception as e:
        logger.error(f"Final inspection column migration failed: {e}")

def _ensure_wps_register_columns():
    """Ensure required columns exist on wps_register for SQLite"""
    try:
        if engine.dialect.name != 'sqlite':
            return
        with engine.connect() as conn:
            cols = conn.exec_driver_sql("PRAGMA table_info(wps_register)").fetchall()
            names = [r[1] for r in cols]
            
            if "created_at" not in names:
                try:
                    conn.exec_driver_sql("ALTER TABLE wps_register ADD COLUMN created_at DATETIME")
                    logger.info("Added column created_at to wps_register")
                except Exception as e:
                    logger.warning(f"Could not add created_at column to wps_register: {e}")
            
            if "updated_at" not in names:
                try:
                    conn.exec_driver_sql("ALTER TABLE wps_register ADD COLUMN updated_at DATETIME")
                    logger.info("Added column updated_at to wps_register")
                except Exception as e:
                    logger.warning(f"Could not add updated_at column to wps_register: {e}")
                    
    except Exception as e:
        logger.error(f"WPS register column migration failed: {e}")

def _ensure_welder_register_columns():
    """Ensure required columns exist on welder_register for SQLite"""
    try:
        if engine.dialect.name != 'sqlite':
            return
        with engine.connect() as conn:
            cols = conn.exec_driver_sql("PRAGMA table_info(welder_register)").fetchall()
            names = [r[1] for r in cols]
            if "created_at" not in names:
                try:
                    conn.exec_driver_sql("ALTER TABLE welder_register ADD COLUMN created_at DATETIME")
                    logger.info("Added column created_at to welder_register")
                except Exception as e:
                    logger.warning(f"Could not add created_at column to welder_register: {e}")
            if "updated_at" not in names:
                try:
                    conn.exec_driver_sql("ALTER TABLE welder_register ADD COLUMN updated_at DATETIME")
                    logger.info("Added column updated_at to welder_register")
                except Exception as e:
                    logger.warning(f"Could not add updated_at column to welder_register: {e}")
            if "project_id" not in names:
                try:
                    conn.exec_driver_sql("ALTER TABLE welder_register ADD COLUMN project_id INTEGER")
                    logger.info("Added column project_id to welder_register")
                except Exception as e:
                    logger.warning(f"Could not add project_id column to welder_register: {e}")
    except Exception as e:
        logger.error(f"Welder register column migration failed: {e}")
def _ensure_material_register_columns():
    """Ensure required columns exist on material register tables for SQLite"""
    try:
        if engine.dialect.name != 'sqlite':
            return
        
        tables = ['pipe_material_register', 'structure_m