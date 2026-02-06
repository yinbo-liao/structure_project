#!/usr/bin/env python3
"""Simplified models for login testing"""

from sqlalchemy import (
    Column, Integer, String, DateTime, Text, Boolean, 
    ForeignKey, Float, Table, UniqueConstraint, Index, Enum
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

# ============ ASSOCIATION TABLES ============
user_projects = Table(
    'user_projects',
    Base.metadata,
    Column('user_id', Integer, ForeignKey('users.id', ondelete='CASCADE'), primary_key=True),
    Column('project_id', Integer, ForeignKey('projects.id', ondelete='CASCADE'), primary_key=True)
)

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
    
    # Relationships
    assigned_projects = relationship(
        "Project", 
        secondary=user_projects, 
        back_populates="assigned_users",
        lazy="dynamic"
    )
    owned_projects = relationship(
        "Project", 
        back_populates="owner",
        foreign_keys="Project.owner_id",
        lazy="dynamic"
    )
    
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


class Project(Base):
    """Project container for pipe/structure projects"""
    __tablename__ = "projects"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    code = Column(String(50), unique=True, nullable=False)
    description = Column(Text)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    owner = relationship(
        "User", 
        back_populates="owned_projects", 
        foreign_keys=[owner_id]
    )
    assigned_users = relationship(
        "User", 
        secondary=user_projects, 
        back_populates="assigned_projects",
        lazy="dynamic"
    )
    
    __table_args__ = (
        Index('idx_projects_code', 'code'),
        Index('idx_projects_owner_id', 'owner_id'),
        Index('idx_projects_is_active', 'is_active'),
    )
