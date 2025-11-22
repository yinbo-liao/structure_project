from sqlalchemy import Column, Integer, String, DateTime, Text, Boolean, ForeignKey, Float, Table, UniqueConstraint, Index
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

Base = declarative_base()

# Association table for user-project many-to-many relationship
user_projects = Table(
    'user_projects',
    Base.metadata,
    Column('user_id', Integer, ForeignKey('users.id')),
    Column('project_id', Integer, ForeignKey('projects.id'))
)

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255))
    role = Column(String(50), default="inspector")  # admin, inspector, visitor
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Many-to-many relationship with projects
    assigned_projects = relationship("Project", secondary=user_projects, back_populates="assigned_users")
    owned_projects = relationship("Project", back_populates="owner", foreign_keys="Project.owner_id")

class Project(Base):
    __tablename__ = "projects"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    code = Column(String(50), unique=True, nullable=False)
    description = Column(Text)
    owner_id = Column(Integer, ForeignKey("users.id"))
    
    owner = relationship("User", back_populates="owned_projects", foreign_keys=[owner_id])
    assigned_users = relationship("User", secondary=user_projects, back_populates="assigned_projects")
    
    # Relationships with project data
    master_joints = relationship("MasterJointList", back_populates="project")
    material_registers = relationship("MaterialRegister", back_populates="project")
    material_inspections = relationship("MaterialInspection", back_populates="project")
    fitup_inspections = relationship("FitUpInspection", back_populates="project")
    final_inspections = relationship("FinalInspection", back_populates="project")
    ndt_requests = relationship("NDTRequest", back_populates="project")

class MasterJointList(Base):
    __tablename__ = "master_joint_list"
    
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"))
    draw_no = Column(String(50), nullable=False)
    system_no = Column(String(50), nullable=False)
    line_no = Column(String(50), nullable=False)
    spool_no = Column(String(50), nullable=False)
    joint_no = Column(String(50), nullable=False)
    pipe_dia = Column(String(20))
    weld_type = Column(String(50))
    part1_piece_mark_no = Column(String(100))
    part2_piece_mark_no = Column(String(100))
    fit_up_report_no = Column(String(50))
    fitup_status = Column(String(20), default="pending")  # pending, done
    final_status = Column(String(20), default="pending")  # pending, done
    created_at = Column(DateTime, default=datetime.utcnow)
    
    project = relationship("Project", back_populates="master_joints")
    fitup_records = relationship("FitUpInspection", back_populates="master_joint_link")
    __table_args__ = (
        UniqueConstraint(
            'project_id', 'draw_no', 'system_no', 'line_no', 'spool_no', 'joint_no',
            name='uq_master_joint_project_draw_system_line_spool_joint'
        ),
        Index('ix_master_joint_project', 'project_id'),
    )

class MaterialRegister(Base):
    __tablename__ = "material_register"
    
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"))
    piece_mark_no = Column(String(100), nullable=False)
    material_type = Column(String(50))
    grade = Column(String(50))
    thickness = Column(String(20))
    heat_no = Column(String(50))
    spec = Column(String(50))
    category = Column(String(50))
    pipe_dia = Column(String(20))
    inspection_status = Column(String(20), default="pending")  # pending, inspected, rejected
    created_at = Column(DateTime, default=datetime.utcnow)
    
    project = relationship("Project", back_populates="material_registers")
    __table_args__ = (
        UniqueConstraint('project_id', 'piece_mark_no', name='uq_material_project_piece_mark'),
        Index('ix_material_piece_mark', 'piece_mark_no'),
        Index('ix_material_project', 'project_id'),
    )

class MaterialInspection(Base):
    __tablename__ = "material_inspection"
    
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"))
    piece_mark_no = Column(String(100), nullable=False)
    material_type = Column(String(50))
    grade = Column(String(50))
    thickness = Column(String(20))
    heat_no = Column(String(50))
    inspection_date = Column(DateTime)
    report_no = Column(String(50))
    result = Column(String(50))  # accepted, rejected
    remarks = Column(Text)
    inspector_name = Column(String(100))
    created_at = Column(DateTime, default=datetime.utcnow)
    
    project = relationship("Project", back_populates="material_inspections")

class FitUpInspection(Base):
    __tablename__ = "fitup_inspection"
    
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"))
    system_no = Column(String(50))
    line_no = Column(String(50))
    spool_no = Column(String(50))
    joint_no = Column(String(50))
    weld_type = Column(String(50))
    
    # Material piece references
    part1_piece_mark_no = Column(String(100))
    part2_piece_mark_no = Column(String(100))
    
    # Auto-populated material details
    part1_material_type = Column(String(50))
    part1_grade = Column(String(50))
    part1_thickness = Column(String(20))
    part1_heat_no = Column(String(50))
    part2_material_type = Column(String(50))
    part2_grade = Column(String(50))
    part2_thickness = Column(String(20))
    part2_heat_no = Column(String(50))
    
    # Fit-up details
    weld_site = Column(String(20))  # shop/field
    weld_length = Column(Float)  # Changed to Float for calculations
    dia = Column(String(20))
    fit_up_date = Column(DateTime)
    fit_up_report_no = Column(String(50))
    fit_up_result = Column(String(50))
    remarks = Column(Text)
    updated_by = Column(String(255))
    
    # Links
    master_joint_id = Column(Integer, ForeignKey("master_joint_list.id"))
    
    project = relationship("Project", back_populates="fitup_inspections")
    master_joint_link = relationship("MasterJointList", back_populates="fitup_records")
    final = relationship("FinalInspection", back_populates="fitup", uselist=False, cascade="all, delete-orphan")
    __table_args__ = (
        Index('ix_fitup_project', 'project_id'),
        Index('ix_fitup_master_joint', 'master_joint_id'),
    )

class FinalInspection(Base):
    __tablename__ = "final_inspection"
    
    id = Column(Integer, primary_key=True, index=True)
    fitup_id = Column(Integer, ForeignKey("fitup_inspection.id"))
    project_id = Column(Integer, ForeignKey("projects.id"))
    system_no = Column(String(50))
    line_no = Column(String(50))
    spool_no = Column(String(50))
    joint_no = Column(String(50))
    weld_type = Column(String(50))
    wps_no = Column(String(50))
    welder_no = Column(String(50))
    welder_validity = Column(String(20))
    weld_site = Column(String(20))
    final_date = Column(DateTime)
    final_report_no = Column(String(50))
    final_result = Column(String(50))
    ndt_type = Column(String(20))  # MP/PT/RT/UT/PAUT
    weld_length = Column(Float)  # For NDT calculations
    pipe_dia = Column(String(20))
    remarks = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    project = relationship("Project", back_populates="final_inspections")
    fitup = relationship("FitUpInspection", back_populates="final")
    __table_args__ = (
        Index('ix_final_project', 'project_id'),
        Index('ix_final_fitup', 'fitup_id'),
    )

class NDTRequest(Base):
    __tablename__ = "ndt_requests"
    
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"))
    final_id = Column(Integer, ForeignKey("final_inspection.id"), nullable=False)  # Link to accepted final inspection
    project_name = Column(String(100))
    project_code = Column(String(20))
    department = Column(String(20))  # pipe, hull, ele, mech
    incharge_person = Column(String(100))
    contact = Column(String(50))
    request_time = Column(DateTime)
    contractor = Column(String(20))  # GW/TOM
    job_code = Column(String(50))
    job_location = Column(String(100))
    test_time = Column(DateTime)
    requirement = Column(Text)
    detail_description = Column(Text)
    status = Column(String(20), default="pending")  # pending, approved, rejected
    ndt_type = Column(String(20))  # MP/PT/RT/UT/PAUT
    ndt_report_no = Column(String(100))
    ndt_result = Column(String(20))
    # Joint details inherited from final inspection
    system_no = Column(String(50))
    line_no = Column(String(50))
    spool_no = Column(String(50))
    joint_no = Column(String(50))
    weld_type = Column(String(50))
    welder_no = Column(String(50))
    weld_size = Column(Float)
    weld_process = Column(String(50))
    pipe_dia = Column(String(20))
    created_at = Column(DateTime, default=datetime.utcnow)

    project = relationship("Project", back_populates="ndt_requests")
    final = relationship("FinalInspection")
    __table_args__ = (
        # Uniqueness by joint+method per project
        UniqueConstraint('project_id','system_no','line_no','spool_no','joint_no','ndt_type', name='uq_ndt_joint_method'),
        # Helpful indexes for common filters
        Index('ix_ndt_req_project', 'project_id'),
        Index('ix_ndt_req_joint', 'system_no','line_no','spool_no','joint_no'),
        Index('ix_ndt_req_method', 'ndt_type'),
        Index('ix_ndt_status', 'status'),
        Index('ix_ndt_final', 'final_id'),
    )

class NDTTest(Base):
    __tablename__ = "ndt_tests"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"))
    final_id = Column(Integer, ForeignKey("final_inspection.id"))
    method = Column(String(20))
    result = Column(String(20))
    report_no = Column(String(100))
    tested_by = Column(String(100))
    test_date = Column(DateTime)
    test_length = Column(Float)
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint('final_id', 'method', name='uq_ndt_final_method'),
        Index('ix_ndt_test_project', 'project_id'),
        Index('ix_ndt_test_final', 'final_id'),
        Index('ix_ndt_test_method', 'method'),
    )

class NDTRequirement(Base):
    __tablename__ = "ndt_requirements"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"))
    method = Column(String(20), nullable=False)
    required = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint('project_id', 'method', name='uq_ndt_req_project_method'),
        Index('ix_ndt_req_project', 'project_id'),
        Index('ix_ndt_req_method', 'method'),
    )

class NDTStatusRecord(Base):
    __tablename__ = "ndt_status_records"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), index=True)
    final_id = Column(Integer, ForeignKey("final_inspection.id"), unique=True, index=True)
    system_no = Column(String(50))
    line_no = Column(String(50))
    spool_no = Column(String(50))
    joint_no = Column(String(50))
    weld_type = Column(String(50))
    welder_no = Column(String(50))
    weld_size = Column(Float)
    weld_site = Column(String(20))
    pipe_dia = Column(String(20))
    ndt_type = Column(String(20))
    ndt_report_no = Column(String(100))
    ndt_result = Column(String(20))
    rejected_length = Column(Float, default=0.0)  # Length of rejected weld in mm
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index('ix_ndt_status_project', 'project_id'),
        Index('ix_ndt_status_joint', 'system_no', 'line_no', 'spool_no', 'joint_no'),
        Index('ix_ndt_status_method', 'ndt_type'),
        Index('ix_ndt_status_project_method', 'project_id', 'ndt_type'),
        UniqueConstraint('project_id', 'system_no', 'line_no', 'spool_no', 'joint_no', 'ndt_type', name='uq_ndt_status_joint_method'),
    )

class WPSRegister(Base):
    __tablename__ = "wps_register"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"))
    wps_no = Column(String(50), nullable=False)
    job_trade = Column(String(20))
    position = Column(String(20))
    process = Column(String(50))
    material_group = Column(String(50))
    thickness_range = Column(String(50))
    pipe_dia = Column(String(20))  # Added pipe diameter field
    status = Column(String(20), default="active")
    created_at = Column(DateTime, default=datetime.utcnow)

    project = relationship("Project")
    __table_args__ = (
        UniqueConstraint('project_id', 'wps_no', name='uq_wps_project_wpsno'),
        Index('ix_wps_project', 'project_id'),
        Index('ix_wps_no', 'wps_no'),
    )

class WelderRegister(Base):
    __tablename__ = "welder_register"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"))
    welder_no = Column(String(50), nullable=False)
    welder_name = Column(String(100))
    qualification = Column(String(100))
    qualified_material = Column(String(50))
    thickness_range = Column(String(50))
    weld_process = Column(String(50))
    qualified_position = Column(String(20))
    validity = Column(String(100))  # Changed from DateTime to String for qualification validity
    status = Column(String(20), default="active")
    created_at = Column(DateTime, default=datetime.utcnow)

    project = relationship("Project")
    __table_args__ = (
        UniqueConstraint('project_id', 'welder_no', name='uq_welder_project_number'),
        Index('ix_welder_project', 'project_id'),
        Index('ix_welder_no', 'welder_no'),
    )
