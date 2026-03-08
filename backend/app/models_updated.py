# models.py
from sqlalchemy import (
    Column, Integer, String, DateTime, Text, Boolean, 
    ForeignKey, Float, Table, UniqueConstraint, Index, Enum,
    event
)
from sqlalchemy.ext.declarative import declarative_base, declared_attr
from sqlalchemy.orm import relationship, validates
from sqlalchemy.sql import func
from datetime import datetime
import enum

from .utils import weld_length

Base = declarative_base()

# ============ ENUMERATIONS ============
class UserRole(str, enum.Enum):
    ADMIN = "admin"
    INSPECTOR = "inspector"
    VISITOR = "visitor"

class ProjectType(str, enum.Enum):
    STRUCTURE = "structure"
    PIPE = "pipe"

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
    RFI_RAISED = "RFI Raised"
    

class NDTTypes(str, enum.Enum):
    MT = "MT"
    PT = "PT"
    RT = "RT"
    UT = "UT"
    PAUT = "PAUT"
    MPI = "MPI"
    FT = "FT"
    PMI = "PMI"

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

# ============ BASE MIXIN CLASSES ============
class TimestampMixin:
    """Mixin for automatic timestamp management"""
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class AuditMixin:
    """Mixin for audit trail"""
    created_by = Column(Integer, ForeignKey('users.id'), nullable=True)
    updated_by = Column(Integer, ForeignKey('users.id'), nullable=True)
    
    # Relationships for audit trail
    @declared_attr
    def creator(cls):
        return relationship("User", foreign_keys=[cls.created_by])
    
    @declared_attr
    def updater(cls):
        return relationship("User", foreign_keys=[cls.updated_by])

class ProjectRelationMixin:
    """Mixin for project relationships with cascade delete"""
    project_id = Column(Integer, ForeignKey("projects.id", ondelete='CASCADE'), nullable=False, index=True)
    
    @declared_attr
    def project(cls):
        """Relationship to Project - to be set in concrete classes"""
        return relationship("Project", back_populates=None)

# ============ UTILITY FUNCTIONS ============
def create_unique_index_name(table_name: str, *columns: str) -> str:
    """Generate consistent index names"""
    return f"idx_{table_name}_{'_'.join(columns)}"

def create_unique_constraint_name(table_name: str, *columns: str) -> str:
    """Generate consistent constraint names"""
    return f"uq_{table_name}_{'_'.join(columns)}"

# ============ CORE MODELS ============
class User(Base, TimestampMixin):
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
    
    # Audit relationships - Commented out due to SQLAlchemy initialization error
    # created_items = relationship("AuditMixin", foreign_keys="AuditMixin.created_by", viewonly=True)
    # updated_items = relationship("AuditMixin", foreign_keys="AuditMixin.updated_by", viewonly=True)
    
    __table_args__ = (
        Index(create_unique_index_name(__tablename__, 'email'), 'email'),
        Index(create_unique_index_name(__tablename__, 'role'), 'role'),
        Index(create_unique_index_name(__tablename__, 'is_active'), 'is_active'),
    )
    
    @validates('email')
    def validate_email(self, key, email):
        """Email validation"""
        if '@' not in email:
            raise ValueError("Invalid email format")
        return email.lower()


class Project(Base, TimestampMixin):
    """Project container for structure projects"""
    __tablename__ = "projects"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    code = Column(String(50), unique=True, nullable=False)
    description = Column(Text)
    # project_type = Column(Enum(ProjectType), default=ProjectType.STRUCTURE, nullable=False)
    # Use String to avoid Enum validation issues between DB and SQLAlchemy
    project_type = Column(String(50), default="structure", nullable=False)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    
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
    
    # Will be populated after all models are defined
    __table_args__ = (
        Index(create_unique_index_name(__tablename__, 'code'), 'code'),
        Index(create_unique_index_name(__tablename__, 'project_type'), 'project_type'),
        Index(create_unique_index_name(__tablename__, 'owner_id'), 'owner_id'),
        Index(create_unique_index_name(__tablename__, 'is_active'), 'is_active'),
    )


# ============ ABSTRACT BASE MODELS ============
class MasterJointList(Base, TimestampMixin, ProjectRelationMixin):
    """Abstract base for master joint lists"""
    __abstract__ = True
    
    id = Column(Integer, primary_key=True, index=True)
    joint_no = Column(String(50), nullable=False)
    weld_type = Column(String(50))
    weld_length = Column(Float)
    fit_up_report_no = Column(String(50))
    fitup_status = Column(String(20))
    final_report_no = Column(String(50))
    final_status = Column(String(20))
    inspection_category = Column(String(20))
    part1_piece_mark_no = Column(String(100))
    part2_piece_mark_no = Column(String(100))
    
    # Common indexes for abstract class
    __table_args__ = (
        Index(create_unique_index_name('abstract_master_joint', 'project_id'), 'project_id'),
        Index(create_unique_index_name('abstract_master_joint', 'inspection_category'), 'inspection_category'),
        Index(create_unique_index_name('abstract_master_joint', 'fitup_status'), 'fitup_status'),
        Index(create_unique_index_name('abstract_master_joint', 'final_status'), 'final_status'),
    )


class MaterialRegister(Base, TimestampMixin, ProjectRelationMixin):
    """Abstract base for material registers"""
    __abstract__ = True
    
    id = Column(Integer, primary_key=True, index=True)
    piece_mark_no = Column(String(100), nullable=False)
    material_type = Column(String(50))
    grade = Column(String(50))
    thickness = Column(String(20))
    heat_no = Column(String(50))
    material_report_no = Column(String(50))
    inspection_status = Column(String(20))
    
    __table_args__ = (
        Index(create_unique_index_name('abstract_material', 'project_id'), 'project_id'),
        Index(create_unique_index_name('abstract_material', 'piece_mark_no'), 'piece_mark_no'),
        Index(create_unique_index_name('abstract_material', 'inspection_status'), 'inspection_status'),
    )


class FitUpInspection(Base, TimestampMixin, ProjectRelationMixin):
    """Abstract base for fit-up inspections"""
    __abstract__ = True
    
    id = Column(Integer, primary_key=True, index=True)
    joint_no = Column(String(50))
    weld_type = Column(String(50))
    weld_site = Column(String(20))
    weld_length = Column(Float)
    fit_up_date = Column(DateTime(timezone=True))
    fit_up_report_no = Column(String(50))
    fit_up_result = Column(String(20))
    remarks = Column(Text)
    updated_by = Column(String(100))
    inspection_category = Column(String(20))
    
    # Material details
    part1_piece_mark_no = Column(String(100))
    part2_piece_mark_no = Column(String(100))
    part1_material_type = Column(String(50))
    part1_grade = Column(String(50))
    part1_thickness = Column(String(20))
    part1_heat_no = Column(String(50))
    part2_material_type = Column(String(50))
    part2_grade = Column(String(50))
    part2_thickness = Column(String(20))
    part2_heat_no = Column(String(50))
    
    # Foreign key will be defined in concrete classes
    master_joint_id = Column(Integer, nullable=True)


class FinalInspection(Base, TimestampMixin, ProjectRelationMixin):
    """Abstract base for final inspections"""
    __abstract__ = True
    
    id = Column(Integer, primary_key=True, index=True)
    joint_no = Column(String(50))
    weld_type = Column(String(50))
    weld_site = Column(String(20))
    weld_length = Column(Float)
    final_date = Column(DateTime(timezone=True))
    final_report_no = Column(String(50))
    final_result = Column(String(20))
    ndt_type = Column(String(20))
    remarks = Column(Text)
    inspection_category = Column(String(20))
    
    # Welder details
    wps_no = Column(String(50))
    welder_no = Column(String(50))
    welder_validity = Column(String(20))
    
    # Foreign key will be defined in concrete classes
    fitup_id = Column(Integer, nullable=True)


class NDTRequest(Base, TimestampMixin, ProjectRelationMixin):
    """Abstract base for NDT requests"""
    __abstract__ = True
    
    id = Column(Integer, primary_key=True, index=True)
    project_name = Column(String(100))
    project_code = Column(String(20))
    department = Column(String(20))
    incharge_person = Column(String(100))
    contact = Column(String(50))
    request_time = Column(DateTime(timezone=True))
    contractor = Column(String(20))
    job_code = Column(String(50))
    job_location = Column(String(100))
    test_time = Column(DateTime(timezone=True))
    requirement = Column(Text)
    detail_description = Column(Text)
    status = Column(String(20))
    ndt_type = Column(Enum(NDTTypes))
    weld_length = Column(Float)
    ndt_report_no = Column(String(100))
    ndt_result = Column(String(20))
    inspection_category = Column(String(20))
    
    # Weld details
    weld_type = Column(String(50))
    weld_size = Column(Float)
    weld_process = Column(String(50))
    joint_no = Column(String(50))
    welder_no = Column(String(50))
    
    # Foreign key will be defined in concrete classes
    final_id = Column(Integer, nullable=False)


class NDTStatusRecord(Base, TimestampMixin, ProjectRelationMixin):
    """Abstract base for NDT status records"""
    __abstract__ = True
    
    id = Column(Integer, primary_key=True, index=True)
    weld_type = Column(String(50))
    welder_no = Column(String(50))
    test_length = Column(Float)
    weld_site = Column(String(20))
    ndt_type = Column(Enum(NDTTypes))
    joint_no = Column(String(50))
    ndt_report_no = Column(String(100))
    weld_length = Column(Float)
    ndt_result = Column(String(20))
    rejected_length = Column(Float, default=0.0)
    inspection_category = Column(String(20))
    
    # Foreign key will be defined in concrete classes
    final_id = Column(Integer, nullable=False)





# ============ PROJECT MODELS ============
class StructureMasterJointList(MasterJointList):
    __tablename__ = "structure_master_joint_list"
    
    # Structure-specific fields
    block_no = Column(String(50))
    draw_no = Column(String(50), nullable=False)
    structure_category = Column(String(50), nullable=False)
    page_no = Column(String(50), nullable=False)
    drawing_rev = Column(String(20), nullable=False)
    thickness = Column(String(20))
    
    # NDT Testing Columns for each method
    ndt_rt_report_no = Column(String(100))
    ndt_rt_result = Column(String(20))
    ndt_ut_report_no = Column(String(100))
    ndt_ut_result = Column(String(20))
    ndt_mpi_report_no = Column(String(100))
    ndt_mpi_result = Column(String(20))
    ndt_pt_report_no = Column(String(100))
    ndt_pt_result = Column(String(20))
    ndt_pmi_report_no = Column(String(100))
    ndt_pmi_result = Column(String(20))
    ndt_ft_report_no = Column(String(100))
    ndt_ft_result = Column(String(20))
    
    # Comprehensive NDT Status
    ndt_comprehensive_status = Column(String(50))
    ndt_last_sync = Column(DateTime(timezone=True))
    ndt_sync_status = Column(String(20))
    
    __table_args__ = (
        UniqueConstraint(
            'project_id', 'draw_no', 'structure_category', 'page_no', 'drawing_rev', 'joint_no',
            name=create_unique_constraint_name(__tablename__, 'project', 'draw', 'category', 'page', 'rev', 'joint')
        ),
        Index(create_unique_index_name(__tablename__, 'block_no'), 'block_no'),
        Index(create_unique_index_name(__tablename__, 'draw_no', 'page_no'), 'draw_no', 'page_no'),
        Index(create_unique_index_name(__tablename__, 'structure_category'), 'structure_category'),
        Index(create_unique_index_name(__tablename__, 'ndt_comprehensive_status'), 'ndt_comprehensive_status'),
        Index(create_unique_index_name(__tablename__, 'ndt_last_sync'), 'ndt_last_sync'),
        Index(create_unique_index_name(__tablename__, 'ndt_sync_status'), 'ndt_sync_status'),
    )


class StructureMaterialRegister(MaterialRegister):
    __tablename__ = "structure_material_register"
    
    # Structure-specific fields
    block_no = Column(String(50))
    structure_spec = Column(String(50))
    structure_category = Column(String(50))
    drawing_no = Column(String(50))
    drawing_rev = Column(String(20))
    width = Column(String(20))
    length = Column(String(20))
    
    __table_args__ = (
        UniqueConstraint(
            'project_id', 'piece_mark_no',
            name=create_unique_constraint_name(__tablename__, 'project', 'piece_mark')
        ),
        Index(create_unique_index_name(__tablename__, 'block_no'), 'block_no'),
        Index(create_unique_index_name(__tablename__, 'structure_category'), 'structure_category'),
    )


class StructureFitUpInspection(FitUpInspection):
    __tablename__ = "structure_fitup_inspection"
    
    # Structure-specific fields
    block_no = Column(String(50))
    draw_no = Column(String(50))
    structure_category = Column(String(50))
    page_no = Column(String(50))
    drawing_rev = Column(String(20))
    
    # Foreign keys
    master_joint_id = Column(Integer, ForeignKey("structure_master_joint_list.id", ondelete='SET NULL'))
    
    # Relationships
    master_joint = relationship(
        "StructureMasterJointList", 
        backref="structure_fitup_records",
        foreign_keys=[master_joint_id]
    )
    
    __table_args__ = (
        Index(create_unique_index_name(__tablename__, 'master_joint'), 'master_joint_id'),
        Index(create_unique_index_name(__tablename__, 'block_no'), 'block_no'),
        Index(create_unique_index_name(__tablename__, 'draw_no', 'page_no'), 'draw_no', 'page_no'),
    )


class StructureFinalInspection(FinalInspection):
    __tablename__ = "structure_final_inspection"
    
    # Structure-specific fields
    block_no = Column(String(50))
    draw_no = Column(String(50))
    structure_category = Column(String(50))
    page_no = Column(String(50))
    
    # Foreign keys
    fitup_id = Column(Integer, ForeignKey("structure_fitup_inspection.id", ondelete='CASCADE'))
    
    # Relationships
    fitup = relationship(
        "Structure