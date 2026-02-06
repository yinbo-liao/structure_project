# models_minimal.py - Minimal version with only User model
from sqlalchemy import (
    Column, Integer, String, DateTime, Text, Boolean, 
    ForeignKey, Float, Table, UniqueConstraint, Index, Enum,
    event
)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship, validates
from sqlalchemy.sql import func
from datetime import datetime
import enum

Base = declarative_base()

# ============ ENUMERATIONS ============
class UserRole(str, enum.Enum):
    ADMIN = "admin"
    INSPECTOR = "inspector"
    VISITOR = "visitor"

# ============ CORE MODELS ============
class User(Base):
    """User accounts for system access"""
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255))
    role = Column(Enum(UserRole), default=UserRole.INSPECTOR, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    password_change_required = Column(Boolean, default=True, nullable=False)
    last_login = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    __table_args__ = (
        Index('idx_users_email', 'email'),
        Index('idx_users_role', 'role'),
        Index('idx_users_is_active', 'is_active'),
    )
    
    @validates('email')
    def validate_email(self, key, email):
        """Email validation"""
        if '@' not in email:
            raise ValueError("Invalid email format")
        return email.lower()
