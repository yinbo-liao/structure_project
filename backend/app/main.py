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
        
        _ensure_all_table_columns()
        _ensure_default_users()
        _ensure_unique_joint_indexes()
        _backfill_timestamps()
        
    except Exception as e:
        logger.error(f"Database initialization failed: {e}")
        raise

def create_performance_indexes():
    """Create performance indexes for both SQLite and PostgreSQL"""
    try:
        with engine.connect() as conn:
            is_pg = engine.dialect.name == 'postgresql'
            if_not_exists = "IF NOT EXISTS" if is_pg else "IF NOT EXISTS"
            indexes = [
                f"CREATE INDEX {if_not_exists} idx_master_joint_project ON structure_master_joint_list(project_id)",
                f"CREATE INDEX {if_not_exists} idx_master_joint_draw ON structure_master_joint_list(draw_no)",
                f"CREATE INDEX {if_not_exists} idx_master_joint_category ON structure_master_joint_list(inspection_category)",
                f"CREATE INDEX {if_not_exists} idx_final_project ON structure_final_inspection(project_id)",
                f"CREATE INDEX {if_not_exists} idx_final_date ON structure_final_inspection(final_date)",
                f"CREATE INDEX {if_not_exists} idx_fitup_project ON structure_fitup_inspection(project_id)",
                f"CREATE INDEX {if_not_exists} idx_material_project ON structure_material_register(project_id)",
                f"CREATE INDEX {if_not_exists} idx_ndt_status_project ON structure_ndt_status_records(project_id)",
                f"CREATE INDEX {if_not_exists} idx_ndt_requests_project ON structure_ndt_requests(project_id)",
            ]
            if is_pg:
                indexes.extend([
                    "CREATE INDEX IF NOT EXISTS idx_structure_master_joint_project_draw ON structure_master_joint_list(project_id, draw_no)",
                    "CREATE INDEX IF NOT EXISTS idx_structure_final_project_date ON structure_final_inspection(project_id, final_date)",
                    "CREATE INDEX IF NOT EXISTS idx_structure_final_result ON structure_final_inspection(final_result)",
                    "CREATE INDEX IF NOT EXISTS idx_structure_ndt_status_project_method ON structure_ndt_status_records(project_id, ndt_type)",
                ])
            for index_sql in indexes:
                try:
                    conn.execute(text(index_sql))
                    conn.commit()
                except Exception as e:
                    logger.warning(f"Could not create index: {e}")
                    if is_pg:
                        conn.rollback()
    except Exception as e:
        logger.error(f"Failed to create performance indexes: {e}")



# Column migration registry: table_name -> [(column_name, column_type), ...]
COLUMN_MIGRATIONS = {
    "users": [
        ("last_login", "DATETIME"),
        ("created_at", "DATETIME"),
        ("updated_at", "DATETIME"),
    ],
    "structure_master_joint_list": [
        ("created_at", "DATETIME"),
        ("updated_at", "DATETIME"),
        ("fit_up_report_no", "VARCHAR(50)"),
        ("final_report_no", "VARCHAR(50)"),
        ("thickness", "VARCHAR(20)"),
    ],
    "structure_material_register": [
        ("created_at", "DATETIME"),
        ("updated_at", "DATETIME"),
        ("project_id", "INTEGER"),
        ("block_no", "VARCHAR(50)"),
        ("structure_spec", "VARCHAR(50)"),
        ("structure_category", "VARCHAR(50)"),
        ("drawing_no", "VARCHAR(50)"),
        ("drawing_rev", "VARCHAR(20)"),
        ("width", "VARCHAR(20)"),
        ("length", "VARCHAR(20)"),
    ],
    "structure_fitup_inspection": [
        ("created_at", "DATETIME"),
        ("updated_at", "DATETIME"),
        ("project_id", "INTEGER"),
        ("updated_by", "VARCHAR(100)"),
    ],
    "pipe_final_inspection": [
        ("created_at", "DATETIME"),
        ("updated_at", "DATETIME"),
        ("project_id", "INTEGER"),
    ],
    "structure_final_inspection": [
        ("created_at", "DATETIME"),
        ("updated_at", "DATETIME"),
        ("project_id", "INTEGER"),
    ],
    "wps_register": [
        ("created_at", "DATETIME"),
        ("updated_at", "DATETIME"),
    ],
    "welder_register": [
        ("created_at", "DATETIME"),
        ("updated_at", "DATETIME"),
        ("project_id", "INTEGER"),
    ],
    "pipe_material_register": [
        ("created_at", "DATETIME"),
        ("updated_at", "DATETIME"),
        ("project_id", "INTEGER"),
    ],
    "pipe_ndt_requests": [
        ("created_at", "DATETIME"),
        ("updated_at", "DATETIME"),
        ("project_id", "INTEGER"),
    ],
    "structure_ndt_requests": [
        ("created_at", "DATETIME"),
        ("updated_at", "DATETIME"),
        ("project_id", "INTEGER"),
    ],
    "pipe_ndt_status_records": [
        ("created_at", "DATETIME"),
        ("updated_at", "DATETIME"),
        ("project_id", "INTEGER"),
        ("joint_no", "VARCHAR(50)"),
    ],
    "structure_ndt_status_records": [
        ("created_at", "DATETIME"),
        ("updated_at", "DATETIME"),
        ("project_id", "INTEGER"),
        ("joint_no", "VARCHAR(50)"),
    ],
    "ndt_requirements": [
        ("created_at", "DATETIME"),
        ("updated_at", "DATETIME"),
        ("project_id", "INTEGER"),
    ],
}

def _ensure_all_table_columns():
    """Ensure required columns exist on all tables for SQLite"""
    if engine.dialect.name != 'sqlite':
        return
    for table_name, columns in COLUMN_MIGRATIONS.items():
        try:
            with engine.connect() as conn:
                existing = {r[1] for r in conn.exec_driver_sql(f"PRAGMA table_info({table_name})").fetchall()}
                for col_name, col_type in columns:
                    if col_name not in existing:
                        try:
                            conn.exec_driver_sql(f"ALTER TABLE {table_name} ADD COLUMN {col_name} {col_type}")
                            logger.info(f"Added column {col_name} to {table_name}")
                        except Exception as e:
                            logger.warning(f"Could not add {col_name} to {table_name}: {e}")
        except Exception as e:
            logger.error(f"Column migration failed for {table_name}: {e}")

def _ensure_default_users():
    """Ensure default users exist for development login"""
    try:
        default_password = os.getenv("DEFAULT_ADMIN_PASSWORD", "")
        if not default_password:
            logger.warning("DEFAULT_ADMIN_PASSWORD not set, skipping default user creation")
            return
        with SessionLocal() as db:
            users = {
                "admin@mpdms.com": {"role": "admin", "password": default_password},
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

def _ensure_unique_joint_indexes():
    """Ensure unique joint composite indexes exist for SQLite"""
    try:
        if engine.dialect.name != 'sqlite':
            return
        with engine.connect() as conn:
            stmts = [
                "CREATE UNIQUE INDEX IF NOT EXISTS ux_pipe_fitup_joint ON pipe_fitup_inspection(project_id, system_no, line_no, spool_no, joint_no)",
                "CREATE UNIQUE INDEX IF NOT EXISTS ux_pipe_final_joint ON pipe_final_inspection(project_id, system_no, line_no, spool_no, joint_no)"
            ]
            for sql in stmts:
                try:
                    conn.exec_driver_sql(sql)
                    conn.commit()
                except Exception as e:
                    logger.warning(f"Could not create unique index: {e}")
    except Exception as e:
        logger.error(f"Unique joint index creation failed: {e}")

def _backfill_timestamps():
    """Backfill missing created_at timestamps where NULL"""
    try:
        if engine.dialect.name != 'sqlite':
            return
        tables = [
            'structure_master_joint_list',
             'structure_material_register',
             'structure_fitup_inspection',
             'structure_final_inspection',
            'structure_ndt_requests',
            'structure_ndt_status_records',
            'wps_register', 'ndt_tests'
        ]
        with engine.connect() as conn:
            for table in tables:
                try:
                    conn.exec_driver_sql(f"UPDATE {table} SET created_at = CURRENT_TIMESTAMP WHERE created_at IS NULL")
                    conn.commit()
                except Exception as e:
                    logger.warning(f"Could not backfill timestamps for {table}: {e}")
    except Exception as e:
        logger.error(f"Timestamp backfill failed: {e}")
# Initialize database on startup
@app.on_event("startup")
async def startup_event():
    """Initialize application on startup"""
    logger.info("Starting Multi-Project Data Management System...")
    initialize_database()
    create_performance_indexes()
    logger.info("Application startup completed successfully")

# CORS middleware - restrict origins in production
origins_env = os.getenv("ALLOW_ORIGINS")
_environment = os.getenv("ENVIRONMENT", "development")
allow_origins = [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
]
if origins_env:
    try:
        allow_origins = [o.strip() for o in origins_env.split(",") if o.strip()]
    except Exception:
        pass

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH"],
    allow_headers=["Authorization", "Content-Type"],
)

# Trusted host middleware for security
hosts_env = os.getenv("ALLOWED_HOSTS")
allowed_hosts = hosts_env.split(",") if hosts_env else ["localhost", "127.0.0.1"]
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=allowed_hosts
)

# Include routers
app.include_router(auth.router, prefix="/api/v1", tags=["Authentication"])
app.include_router(users.router, prefix="/api/v1", tags=["Users"])
app.include_router(projects.router, prefix="/api/v1", tags=["Projects"])
app.include_router(structure_inspections.router, prefix="/api/v1", tags=["Structure Inspections"])
app.include_router(templates.router, prefix="/api/v1/templates", tags=["Templates"])
app.include_router(ai.router, prefix="/api/v1", tags=["AI Services"])
app.include_router(ndt_sync.router, prefix="/api/v1", tags=["NDT Sync"])

# Health check and monitoring endpoints
@app.get("/")
async def root():
    return {
        "message": "Multi-Project Data Management System API",
        "version": "3.0.0",
        "docs": "/docs",
        "database": engine.dialect.name,
        "timestamp": datetime.utcnow().isoformat()
    }

@app.get("/health")
async def health_check():
    """Comprehensive health check endpoint"""
    health_status = {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "services": {}
    }
    
    # Database health check
    try:
        db_healthy = check_database_health()
        health_status["services"]["database"] = {
            "status": "healthy" if db_healthy else "unhealthy",
            "type": engine.dialect.name
        }
        
        if db_healthy:
            # Get database statistics
            db_stats = get_database_stats()
            health_status["services"]["database"]["stats"] = db_stats
    except Exception as e:
        health_status["services"]["database"] = {
            "status": "error",
            "error": str(e)
        }
        health_status["status"] = "degraded"
    
    # Check if all critical services are healthy
    unhealthy_services = [
        service for service, status in health_status["services"].items() 
        if status.get("status") not in ["healthy", "ok"]
    ]
    
    if unhealthy_services:
        health_status["status"] = "degraded"
        health_status["unhealthy_services"] = unhealthy_services
    
    return health_status

@app.get("/metrics")
async def metrics():
    """Application metrics endpoint (for Prometheus monitoring)"""
    try:
        metrics_data = {
            "timestamp": datetime.utcnow().isoformat(),
            "database": {
                "type": engine.dialect.name,
                "pool_stats": get_database_stats()
            }
        }
        
        # Add table counts for monitoring
        if check_database_health():
            with engine.connect() as conn:
                tables = ['users']  # Only users table for now
                for table in tables:
                    try:
                        result = conn.execute(text(f"SELECT COUNT(*) FROM {table}"))
                        count = result.scalar()
                        metrics_data["database"][f"{table}_count"] = count
                    except Exception:
                        metrics_data["database"][f"{table}_count"] = "error"
        
        return JSONResponse(content=metrics_data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Metrics collection failed: {str(e)}")

@app.get("/database/info")
async def database_info():
    """Get database information and schema details"""
    try:
        with engine.connect() as conn:
            # Get database version
            if engine.dialect.name == 'postgresql':
                version_result = conn.execute(text("SELECT version()"))
                version = version_result.scalar()
            else:
                version = f"{engine.dialect.name} (development)"
            
            # Get table information
            inspector = inspect(engine)
            tables = inspector.get_table_names()
            
            table_info = {}
            for table in tables[:10]:  # Limit to first 10 tables for performance
                try:
                    columns = inspector.get_columns(table)
                    table_info[table] = {
                        "columns": len(columns),
                        "sample_columns": [col['name'] for col in columns[:3]]
                    }
                except Exception:
                    table_info[table] = {"error": "Could not inspect table"}
            
            return {
                "database_type": engine.dialect.name,
                "version": version,
                "table_count": len(tables),
                "tables": table_info,
                "connection_pool": get_database_stats()
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database info failed: {str(e)}")

# Error handling middleware
@app.exception_handler(SQLAlchemyError)
async def sqlalchemy_exception_handler(request, exc):
    """Handle SQLAlchemy database errors"""
    logger.error(f"Database error: {exc}")
    
    # Check for specific types of database errors
    error_detail = "Database error occurred"
    status_code = 500
    
    # Import SQLAlchemy error types
    from sqlalchemy.exc import IntegrityError, OperationalError, ProgrammingError
    
    if isinstance(exc, IntegrityError):
        # Constraint violations (unique, foreign key, not null)
        error_detail = "Database constraint violation"
        status_code = 400  # Bad request - client sent invalid data
        
        # Try to extract more specific information
        error_str = str(exc).lower()
        if "unique" in error_str or "duplicate" in error_str:
            error_detail = "Duplicate record violation - a record with these values already exists"
        elif "foreign key" in error_str:
            error_detail = "Foreign key violation - referenced record does not exist"
        elif "not null" in error_str:
            error_detail = "Required field cannot be null"
            
    elif isinstance(exc, OperationalError):
        error_detail = "Database operational error - connection or query execution failed"
    elif isinstance(exc, ProgrammingError):
        error_detail = "Database programming error - SQL syntax or schema issue"
    
    return JSONResponse(
        status_code=status_code,
        content={
            "detail": error_detail,
            "error": str(exc) if os.getenv("ENVIRONMENT") != "production" else "Database error",
            "timestamp": datetime.utcnow().isoformat()
        }
    )

@app.exception_handler(Exception)
async def general_exception_handler(request, exc):
    """Handle general exceptions"""
    logger.error(f"Unhandled error: {exc}")
    return JSONResponse(
        status_code=500,
        content={
            "detail": "Internal server error",
            "error": str(exc) if os.getenv("ENVIRONMENT") != "production" else "Internal error",
            "timestamp": datetime.utcnow().isoformat()
        }
    )

if __name__ == "__main__":
    import uvicorn
    
    # Production configuration
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8000"))
    reload = os.getenv("ENVIRONMENT") == "development"
    
    uvicorn.run(
        app, 
        host=host, 
        port=port, 
        reload=reload,
        log_level="info",
        access_log=True
    )
