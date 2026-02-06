from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import QueuePool, StaticPool
import os
import logging
# Use the main models file
from app.models import Base

logger = logging.getLogger(__name__)

# Database URL configuration - Use PostgreSQL by default in production
database_url = os.getenv(
    "DATABASE_URL", 
    "postgresql://postgres:postgres@localhost:5432/project_management"
)

# Check environment for database selection
use_sqlite = os.getenv("USE_SQLITE", "false").lower() == "true"
is_testing = os.getenv("TESTING", "false").lower() == "true"

if use_sqlite or is_testing:
    DATABASE_URL = "sqlite:///./project_management.db"
    logger.info("Using SQLite database for development/testing")
else:
    DATABASE_URL = database_url
    logger.info(f"Using PostgreSQL database: {DATABASE_URL.split('@')[-1] if '@' in DATABASE_URL else DATABASE_URL}")

# Create engine with proper connection pooling based on database type
if "sqlite" in DATABASE_URL:
    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False},  # Needed for SQLite
        poolclass=StaticPool,
        echo=os.getenv("SQL_ECHO", "false").lower() == "true"
    )
else:
    # PostgreSQL connection pooling configuration
    pool_size = int(os.getenv("DB_POOL_SIZE", "20"))
    max_overflow = int(os.getenv("DB_MAX_OVERFLOW", "30"))
    pool_recycle = int(os.getenv("DB_POOL_RECYCLE", "3600"))
    pool_timeout = int(os.getenv("DB_POOL_TIMEOUT", "30"))
    
    engine = create_engine(
        DATABASE_URL,
        poolclass=QueuePool,
        pool_size=pool_size,
        max_overflow=max_overflow,
        pool_recycle=pool_recycle,
        pool_timeout=pool_timeout,
        pool_pre_ping=True,
        echo=os.getenv("SQL_ECHO", "false").lower() == "true"
    )
    
    # Add PostgreSQL connection event listeners for better performance
    @event.listens_for(engine, "connect")
    def connect(dbapi_connection, connection_record):
        # Set PostgreSQL connection parameters
        cursor = dbapi_connection.cursor()
        try:
            # Optimize for read-heavy workload
            cursor.execute("SET statement_timeout = 30000")  # 30 second timeout
            cursor.execute("SET idle_in_transaction_session_timeout = 60000")  # 60 seconds
            cursor.execute("SET lock_timeout = 10000")  # 10 second lock timeout
        except Exception as e:
            logger.warning(f"Could not set PostgreSQL connection parameters: {e}")
        finally:
            cursor.close()

# Session local for dependency injection
SessionLocal = sessionmaker(
    autocommit=False, 
    autoflush=False, 
    bind=engine,
    expire_on_commit=False  # Better performance for read-heavy workloads
)

# Dependency to get database session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Create all tables (for development/testing only - use migrations in production)
def create_tables():
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables created successfully")

# Health check function
def check_database_health():
    """Check if database connection is healthy"""
    try:
        with engine.connect() as conn:
            result = conn.execute("SELECT 1")
            return result.scalar() == 1
    except Exception as e:
        logger.error(f"Database health check failed: {e}")
        return False

# Get database statistics
def get_database_stats():
    """Get database connection pool statistics"""
    if hasattr(engine.pool, 'status'):
        return {
            'checked_out': engine.pool.checkedout(),
            'checked_in': engine.pool.checkedin(),
            'overflow': engine.pool.overflow(),
            'size': engine.pool.size()
        }
    return {'status': 'pool_stats_not_available'}
