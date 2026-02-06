# models_fixed.py - Simplified version with fixed relationships
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

# class ProjectType(str, enum.Enum):
#     PIPE = "pipe"
#     STRUCTURE = "structure"

class InspectionCategory(str, enum.Enum):
    TYPE_I = "type-I"
    TYPE_II = "type-II"
    TYPE_III = "type-III"
    SPECIAL = "Special"

class InspectionStatus(str, enum.Enum):
    PENDING = "pending"
    IN_PROGRESS = "in-progress"
    COMPLETED = "completed"
    ACCEPTED = "accepted"
    REJECTED = "rejected"

class NDTTypes(str, enum.Enum):
    MP = "MP"
    PT = "PT"
    RT = "RT"
    UT = "UT"
    PAUT = "PAUT"

class WeldSite(str, enum.Enum):
    SHOP = "shop"
    FIELD = "field"

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
    # project_type = Column(Enum(ProjectType), default=ProjectType.PIPE, nullable=False)
    # Use String to avoid Enum validation issues
    project_type = Column(String(50), default="pipe", nullable=False)
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
    
    # Simple relationships - no complex back_populates that cause circular references

   
    structure_master_joint_list = relationship(
        "StructureMasterJointList", 
        backref="project",
        cascade="all, delete-orphan",
        lazy="dynamic"
    )
    
    __table_args__ = (
        Index('idx_projects_code', 'code'),
        Index('idx_projects_project_type', 'project_type'),
        Index('idx_projects_owner_id', 'owner_id'),
        Index('idx_projects_is_active', 'is_active'),
    )


# ============ PIPE PROJECT MODELS ============

class StructureMasterJointList(Base):
    __tablename__ = "structure_master_joint_list"
    
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete='CASCADE'), nullable=False, index=True)
    joint_no = Column(String(50), nullable=False)
    weld_type = Column(String(50))
    weld_length = Column(Float)
    fit_up_report_no = Column(String(50))
    fitup_status = Column(Enum(InspectionStatus), default=InspectionStatus.PENDING, nullable=False)
    final_report_no = Column(String(50))
    final_status = Column(Enum(InspectionStatus), default=InspectionStatus.PENDING, nullable=False)
    inspection_category = Column(Enum(InspectionCategory), default=InspectionCategory.TYPE_I, nullable=False)
    part1_piece_mark_no = Column(String(100))
    part2_piece_mark_no = Column(String(100))
    
    # Structure-specific fields
    block_no = Column(String(50))
    draw_no = Column(String(50), nullable=False)
    structure_category = Column(String(50), nullable=False)
    page_no = Column(String(50), nullable=False)
    drawing_rev = Column(String(20), nullable=False)
    thickness = Column(String(20))
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    __table_args__ = (
        UniqueConstraint(
            'project_id', 'draw_no', 'structure_category', 'page_no', 'drawing_rev', 'joint_no',
            name='uq_structure_master_joint_list_project_draw_category_page_rev_joint'
        ),
        Index('idx_structure_master_joint_list_block_no', 'block_no'),
        Index('idx_structure_master_joint_list_draw_no_page_no', 'draw_no', 'page_no'),
        Index('idx_structure_master_joint_list_structure_category', 'structure_category'),
        Index('idx_structure_master_joint_list_inspection_category', 'inspection_category'),
        Index('idx_structure_master_joint_list_fitup_status', 'fitup_status'),
        Index('idx_structure_master_joint_list_final_status', 'final_status'),
    )
