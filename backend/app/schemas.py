from pydantic import BaseModel, EmailStr, ConfigDict
from typing import Optional, List, TYPE_CHECKING
from datetime import datetime

if TYPE_CHECKING:
    from app.models import Project

# User Schemas
class UserBase(BaseModel):
    email: str
    full_name: Optional[str] = None
    role: Optional[str] = "inspector"

class UserCreate(UserBase):
    password: str

class UserUpdate(BaseModel):
    email: Optional[str] = None
    full_name: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None

class User(UserBase):
    id: int
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

# Define basic project schema for forward references
class _ProjectBasic(BaseModel):
    id: int
    name: str
    code: str
    description: Optional[str] = None

class UserWithProjects(User):
    assigned_projects: List['_ProjectBasic'] = []
    owned_projects: List['_ProjectBasic'] = []

# Project Schemas
class ProjectBase(BaseModel):
    name: str
    code: str
    description: Optional[str] = None

class ProjectCreate(ProjectBase):
    pass

class Project(ProjectBase):
    id: int
    owner_id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

class ProjectWithUsers(Project):
    assigned_users: List[User] = []
    owner: Optional[User] = None

# Project Assignment
class ProjectAssignment(BaseModel):
    user_id: int
    project_id: int

class UserProjectAssignment(BaseModel):
    project_ids: List[int]

# Enhanced Summary Schema
class ProjectSummary(BaseModel):
    project_id: int
    project_name: str
    total_joints: int
    fitup_done: int
    final_done: int
    material_used: int
    material_missing_from_fitup: int
    material_pending_inspection: int
    material_inspected: int
    material_rejected: int
    ndt_requests_total: int
    ndt_requests_pending: int
    ndt_requests_approved: int
    weld_accept_length_total: float
    weld_reject_length_total: float
    ndt_success_rates: dict
    ndt_weld_lengths_by_method: dict
    ndt_joint_counts_by_method: dict
    welder_performance_top10: list
    fitup_outstanding: int
    final_outstanding: int
    ndt_done: int
    ndt_outstanding: int
    wps_total: int
    wps_active: int
    welder_total: int
    welder_active: int

# Password Change
class PasswordChange(BaseModel):
    current_password: str
    new_password: str

# Auth Schemas
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None
    role: Optional[str] = None

class LoginRequest(BaseModel):
    username: str
    password: str

# Master Joint List Schemas
class MasterJointListBase(BaseModel):
    draw_no: str
    system_no: str
    line_no: str
    spool_no: str
    joint_no: str
    pipe_dia: Optional[str] = None
    weld_type: Optional[str] = None
    part1_piece_mark_no: Optional[str] = None
    part2_piece_mark_no: Optional[str] = None
    fit_up_report_no: Optional[str] = None
    fitup_status: Optional[str] = "pending"
    final_status: Optional[str] = "pending"

class MasterJointListCreate(MasterJointListBase):
    project_id: int

class MasterJointList(MasterJointListBase):
    id: int
    project_id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

# Material Register Schemas
class MaterialRegisterBase(BaseModel):
    piece_mark_no: str
    material_type: Optional[str] = None
    grade: Optional[str] = None
    thickness: Optional[str] = None
    heat_no: Optional[str] = None
    spec: Optional[str] = None
    category: Optional[str] = None
    pipe_dia: Optional[str] = None
    inspection_status: Optional[str] = "pending"

class MaterialRegisterCreate(MaterialRegisterBase):
    project_id: int

class MaterialRegister(MaterialRegisterBase):
    id: int
    project_id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

# Material Inspection Schemas
class MaterialInspectionBase(BaseModel):
    piece_mark_no: str
    material_type: Optional[str] = None
    grade: Optional[str] = None
    thickness: Optional[str] = None
    heat_no: Optional[str] = None
    inspection_date: Optional[datetime] = None
    report_no: Optional[str] = None
    result: Optional[str] = None
    remarks: Optional[str] = None
    inspector_name: Optional[str] = None

class MaterialInspectionCreate(MaterialInspectionBase):
    project_id: int

class MaterialInspection(MaterialInspectionBase):
    id: int
    project_id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

# Fit-up Inspection Schemas
class FitUpInspectionBase(BaseModel):
    system_no: Optional[str] = None
    line_no: Optional[str] = None
    spool_no: Optional[str] = None
    joint_no: Optional[str] = None
    weld_type: Optional[str] = None
    part1_piece_mark_no: Optional[str] = None
    part2_piece_mark_no: Optional[str] = None
    weld_site: Optional[str] = None
    weld_length: Optional[float] = None
    dia: Optional[str] = None
    fit_up_date: Optional[datetime] = None
    fit_up_report_no: Optional[str] = None
    fit_up_result: Optional[str] = None
    remarks: Optional[str] = None
    master_joint_id: Optional[int] = None

class FitUpInspectionCreate(FitUpInspectionBase):
    project_id: int

class FitUpInspection(FitUpInspectionBase):
    id: int
    project_id: int
    part1_material_type: Optional[str] = None
    part1_grade: Optional[str] = None
    part1_thickness: Optional[str] = None
    part1_heat_no: Optional[str] = None
    part2_material_type: Optional[str] = None
    part2_grade: Optional[str] = None
    part2_thickness: Optional[str] = None
    part2_heat_no: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    updated_by: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

# Final Inspection Schemas
class FinalInspectionBase(BaseModel):
    system_no: Optional[str] = None
    line_no: Optional[str] = None
    spool_no: Optional[str] = None
    joint_no: Optional[str] = None
    weld_type: Optional[str] = None
    wps_no: Optional[str] = None
    welder_no: Optional[str] = None
    welder_validity: Optional[str] = None
    weld_site: Optional[str] = None
    final_date: Optional[datetime] = None
    final_report_no: Optional[str] = None
    final_result: Optional[str] = None
    ndt_type: Optional[str] = None
    weld_length: Optional[float] = None
    pipe_dia: Optional[str] = None
    remarks: Optional[str] = None

class FinalInspectionCreate(FinalInspectionBase):
    fitup_id: Optional[int] = None
    project_id: int

class FinalInspection(FinalInspectionBase):
    id: int
    fitup_id: Optional[int] = None
    project_id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

# NDT Request Schemas
class NDTRequestBase(BaseModel):
    project_name: Optional[str] = None
    project_code: Optional[str] = None
    department: Optional[str] = None
    incharge_person: Optional[str] = None
    contact: Optional[str] = None
    request_time: Optional[datetime] = None
    contractor: Optional[str] = None
    job_code: Optional[str] = None
    job_location: Optional[str] = None
    test_time: Optional[datetime] = None
    requirement: Optional[str] = None
    detail_description: Optional[str] = None
    status: Optional[str] = "pending"
    ndt_type: Optional[str] = None
    ndt_report_no: Optional[str] = None
    ndt_result: Optional[str] = None
    # Joint details inherited from final inspection
    system_no: Optional[str] = None
    line_no: Optional[str] = None
    spool_no: Optional[str] = None
    joint_no: Optional[str] = None
    weld_type: Optional[str] = None
    welder_no: Optional[str] = None
    weld_size: Optional[float] = None
    weld_process: Optional[str] = None
    pipe_dia: Optional[str] = None

class NDTRequestCreate(NDTRequestBase):
    project_id: int
    final_id: int  # Required to link to accepted final inspection

class NDTRequest(NDTRequestBase):
    id: int
    project_id: int
    final_id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

# AI Summary Schema
class AISummaryRequest(BaseModel):
    prompt: str
    context_data: dict

class AISummaryResponse(BaseModel):
    summary: str
    insights: List[str]
    recommendations: List[str]
class NDTTestBase(BaseModel):
    final_id: int
    project_id: int
    method: str
    result: Optional[str] = None
    report_no: Optional[str] = None
    tested_by: Optional[str] = None
    test_date: Optional[datetime] = None
    test_length: Optional[float] = None

class NDTTestCreate(NDTTestBase):
    pass

class NDTTest(NDTTestBase):
    id: int
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

class NDTTestItem(BaseModel):
    method: str
    result: Optional[str] = None
    report_no: Optional[str] = None
    tested_by: Optional[str] = None
    test_date: Optional[datetime] = None
    test_length: Optional[float] = None

class NDTJointStatus(BaseModel):
    final_id: int
    project_id: int
    system_no: Optional[str] = None
    line_no: Optional[str] = None
    spool_no: Optional[str] = None
    joint_no: Optional[str] = None
    weld_type: Optional[str] = None
    weld_site: Optional[str] = None
    # pipe_dia intentionally not included here unless needed in UI summary
    test_length: Optional[float] = None
    required_methods: List[str]
    tests: List[NDTTestItem]
    inspected_by: Optional[str] = None
    final_status: str

class NDTRequirementBase(BaseModel):
    project_id: int
    method: str
    required: bool = True

class NDTRequirementCreate(NDTRequirementBase):
    pass

class NDTRequirement(NDTRequirementBase):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class NDTStatusRecordBase(BaseModel):
    project_id: int
    final_id: int
    system_no: Optional[str] = None
    line_no: Optional[str] = None
    spool_no: Optional[str] = None
    joint_no: Optional[str] = None
    weld_type: Optional[str] = None
    welder_no: Optional[str] = None
    weld_size: Optional[float] = None
    rejected_length: Optional[float] = None
    weld_site: Optional[str] = None
    pipe_dia: Optional[str] = None
    ndt_type: Optional[str] = None
    ndt_report_no: Optional[str] = None
    ndt_result: Optional[str] = None

class NDTStatusRecord(NDTStatusRecordBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)
