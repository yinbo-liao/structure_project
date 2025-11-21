from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import os
from sqlalchemy.pool import StaticPool
from app.models import Base

# Database URL configuration - Use SQLite for testing if PostgreSQL not available
database_url = os.getenv(
    "DATABASE_URL", 
    "sqlite:///./project_management.db"
)

# Check if we should use SQLite for testing
if "sqlite" in database_url or os.getenv("USE_SQLITE", "true").lower() == "true":
    DATABASE_URL = "sqlite:///./project_management.db"
else:
    DATABASE_URL = database_url

# Create engine with proper connection pooling
if "sqlite" in DATABASE_URL:
    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False},  # Needed for SQLite
        poolclass=StaticPool
    )
else:
    engine = create_engine(
        DATABASE_URL,
        pool_pre_ping=True,
        pool_recycle=300,
        echo=False  # Set to True for SQL query debugging
    )

# Session local for dependency injection
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Dependency to get database session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Create all tables
def create_tables():
    Base.metadata.create_all(bind=engine)