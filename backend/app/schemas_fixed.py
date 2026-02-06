# schemas.py
from pydantic import BaseModel, ConfigDict, EmailStr, Field
from typing import Optional, List, Dict, Any, Union
from datetime import datetime, date
from enum import Enum

# ============ Enums ============
class UserRole(str, Enum):
    ADMIN = "admin"
    INSPECTOR = "inspector"
    VISITOR = "visitor"

# class ProjectType(str, Enum):
#     STRUCTURE = "structure"
#     PIPE = "pipe"

class InspectionCategory(str, Enum):
    TYPE_I = "type-I"
    TYPE_II = "type-II"
    TYPE_III = "type-III"
    SPECIAL = "Special"

class InspectionStatus(str, Enum):
    PENDING = "pending"
    IN_PROGRESS = "in-progress"
    COMPLETED = "completed"
    ACCEPTED = "accepted"
    REJECTED = "rejected"
  
class NDTRequestStatus(str, Enum):
    PENDING = "pending"
    RFI_RAISED = "RFI Raised"

class NDTTypes(str, Enum):
  
    MT = "MT" 
    PT = "PT"
    RT = "RT"
    UT = "UT"
    PAUT = "PAUT"
    FT = "FT"
    PMI = "PMI"

# ============ Base Configurations ============
class BaseSchema(BaseModel):
    """Base schema with common configuration"""
    model_config = ConfigDict(from_attributes=True, use_enum_values=True)

class TimestampSchema(BaseSchema):
    """Schema with timestamp fields"""
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

# ============ Field Groups ============
class UserFields(BaseSchema):
    """User-related fields"""
    email: str
    full_name: Optional[str] = None
    role: Optional[UserRole] = UserRole.INSPECTOR

class ProjectFields(BaseSchema):
    """Project-related fields"""
    name: str
    code: str
    description: Optional[str] = None
    project_type: Optional[str] = "structure"

class JointFields(BaseSchema):
    """Joint-related fields"""
    joint_no: Optional[str] = None
    weld_type: Optional[str] = None
    weld_length: Optional[float] = None
    weld_site: Optional[str] = None
    inspection_category: Optional[InspectionCategory] = InspectionCategory.TYPE_I

class MaterialFields(BaseSchema):
    """Material-related fields"""
    piece_mark_no: str
    material_type: Optional[str] = None
    grade: Optional[str] = None
    thickness: Optional[str] = None
    heat_no: Optional[str] = None
    inspection_status: Optional[InspectionStatus] = InspectionStatus.PENDING

# ============ User Schemas ============
class UserCreate(UserFields):
    password: str

class UserUpdate(BaseSchema):
    email: Optional[str] = None
    full_name: Optional[str] = None
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None

class User(UserFields, TimestampSchema):
    id: int
    is_active: bool
    password_change_required: bool

# ============ Project Schemas ============
class ProjectCreate(ProjectFields):
    pass

class Project(ProjectFields, TimestampSchema):
    id: int
    owner_id: int

class _ProjectBasic(Project):
    """Basic project schema for list endpoints"""
    pass

class ProjectWithUsers(Project):
    assigned_users: List[User] = []
    owner: Optional[User] = None

class UserWithProjects(User):
    assigned_projects: List[Project] = []

# ============ Auth Schemas ============
class Token(BaseSchema):
    access_token: str
    token_type: str = "bearer"

class TokenData(BaseSchema):
    email: Optional[str] = None
    role: Optional[UserRole] = None

class LoginRequest(BaseSchema):
    username: str
    password: str

class PasswordChange(BaseSchema):
    current_password: str
    new_password: str

class PasswordReset(BaseSchema):
    new_password: str

# ============ Master Joint Schemas ============
class MasterJointBase(JointFields):
    """Base for master joint schemas"""
    fit_up_report_no: Optional[str] = None
    fitup_status: Optional[str] = None
    final_report_no: Optional[str] = None
    final_status: Optional[str] = None
    part1_piece_mark_no: Optional[str] = None
    part2_piece_mark_no: Optional[str] = None


# Structure Master Joint
class StructureMasterJointBase(MasterJointBase):
    block_no: Optional[str] = None
    draw_no: str
    structure_category: str
    page_no: str
    drawing_rev: str
    thickness: Optional[str] = None

class StructureMasterJoint(StructureMasterJointBase, TimestampSchema):
    id: int
    project_id: int

# ============ Material Register Schemas ============
class MaterialRegisterBase(MaterialFields):
    """Base for material register schemas"""
    material_report_no: Optional[str] = None



# Structure Material
class StructureMaterialRegisterBase(MaterialRegisterBase):
    block_no: Optional[str] = None
    structure_spec: Optional[str] = None
    structure_category: Optional[str] = None
    drawing_no: Optional[str] = None
    drawing_rev: Optional[str] = None

class StructureMaterialRegister(StructureMaterialRegisterBase, TimestampSchema):
    id: int
    project_id: int

# ============ Fit-up Inspection Schemas ============
class FitUpInspectionBase(JointFields):
    """Base for fit-up inspection schemas"""
    fit_up_date: Optional[datetime] = None
    fit_up_report_no: Optional[str] = None
    fit_up_result: Optional[str] = None
    remarks: Optional[str] = None
    updated_by: Optional[str] = None
    master_joint_id: Optional[int] = None
    
    # Material details
    part1_piece_mark_no: Optional[str] = None
    part2_piece_mark_no: Optional[str] = None
    part1_material_type: Optional[str] = None
    part1_grade: Optional[str] = None
    part1_thickness: Optional[str] = None
    part1_heat_no: Optional[str] = None
    part2_material_type: Optional[str] = None
    part2_grade: Optional[str] = None
    part2_thickness: Optional[str] = None
    part2_heat_no: Optional[str] = None



# Structure Fit-up
class StructureFitUpInspectionBase(FitUpInspectionBase):
    block_no: Optional[str] = None
    draw_no: Optional[str] = None
    structure_category: Optional[str] = None
    page_no: Optional[str] = None
    drawing_rev: Optional[str] = None

class StructureFitUpInspection(StructureFitUpInspectionBase, TimestampSchema):
    id: int
    project_id: int
    joint_no: Optional[str] = None  # Ensure joint_no is explicitly included

# ============ Final Inspection Schemas ============
class FinalInspectionBase(JointFields):
    """Base for final inspection schemas"""
    final_date: Optional[datetime] = None
    final_report_no: Optional[str] = None
    final_result: Optional[str] = None
    ndt_type: Optional[str] = None
    remarks: Optional[str] = None
    fitup_id: Optional[int] = None
    
    # Welder details
    wps_no: Optional[str] = None
    welder_no: Optional[str] = None
    welder_validity: Optional[str] = None



# Structure Final
class StructureFinalInspectionBase(FinalInspectionBase):
    joint_no: Optional[str] = None
    block_no: Optional[str] = None
    draw_no: Optional[str] = None
    structure_category: Optional[str] = None
    page_no: Optional[str] = None
    # Note: drawing_rev is NOT in the StructureFinalInspection model
    # drawing_rev: Optional[str] = None

class StructureFinalInspection(StructureFinalInspectionBase, TimestampSchema):
    id: int
    project_id: int
    fitup: Optional[StructureFitUpInspection] = None

# ============ NDT Request Schemas ============
class NDTRequestBase(BaseSchema):
    """Base for NDT request schemas"""
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
    status: Optional[Union[NDTRequestStatus, str]] = NDTRequestStatus.PENDING
    ndt_type: Optional[str] = None  # Changed from NDTTypes to str to handle comma-separated values
    ndt_report_no: Optional[str] = None
    ndt_result: Optional[str] = None
    test_length: Optional[float] = None
    weld_length: Optional[float] =None
    weld_size: Optional[float] = None
    weld_process: Optional[str] = None
    inspection_category: Optional[InspectionCategory] = InspectionCategory.TYPE_I

# Structure NDT Request
class StructureNDTRequestBase(NDTRequestBase):
    draw_no: Optional[str] = None
    structure_category: Optional[str] = None
    page_no: Optional[str] = None
    drawing_rev: Optional[str] = None
    joint_no: Optional[str] = None
    block_no: Optional[str] = None
    welder_no: Optional[str] = None
    weld_type: Optional[str] = None
    thickness: Optional[str] = None


class StructureNDTRequest(StructureNDTRequestBase, TimestampSchema):
    id: int
    project_id: int
    final_id: int

# ============ NDT Status Record Schemas ============
class NDTStatusRecordBase(BaseSchema):
    """Base for NDT status record schemas"""
    weld_type: Optional[str] = None
    welder_no: Optional[str] = None
    test_length: Optional[float]=None
    wele_length: Optional[float] = None
    weld_site: Optional[str] = None
    ndt_type: Optional[str] = None  # Changed from NDTTypes to str to handle comma-separated values
    ndt_report_no: Optional[str] = None
    ndt_result: Optional[str] = None
    rejected_length: Optional[float] = 0.0
    inspection_category: Optional[InspectionCategory] = InspectionCategory.TYPE_I


# Structure NDT Status
class StructureNDTStatusRecordBase(NDTStatusRecordBase):
    draw_no: Optional[str] = None
    structure_category: Optional[str] = None
    page_no: Optional[str] = None
    drawing_rev: Optional[str] = None
    joint_no: Optional[str] = None
    block_no: Optional[str] = None
    thickness: Optional[str] = None

class StructureNDTStatusRecord(StructureNDTStatusRecordBase, TimestampSchema):
    id: int
    project_id: int
    final_id: int

# ============ NDT Test Schemas ============
class NDTTestBase(BaseSchema):
    """Base for NDT test schemas"""
    method: Optional[str] = None
    result: Optional[str] = None
    report_no: Optional[str] = None
    tested_by: Optional[str] = None
    test_date: Optional[datetime] = None
    test_length: Optional[float] = None
    remarks: Optional[str] = None

class NDTTest(NDTTestBase, TimestampSchema):
    id: int
    project_id: int
    final_id: int

class NDTTestCreate(NDTTestBase):
    project_id: int
    final_id: int

# ============ Create Schemas ============
# Manual Create schemas for Pydantic v2 compatibility
class StructureMasterJointCreate(StructureMasterJointBase):
    project_id: int
class StructureMaterialRegisterCreate(StructureMaterialRegisterBase):
    project_id: int

class StructureFitUpInspectionCreate(StructureFitUpInspectionBase):
    project_id: int

class StructureFinalInspectionCreate(StructureFinalInspectionBase):
    project_id: int
    fitup_id: Optional[int] = None


class StructureNDTRequestCreate(StructureNDTRequestBase):
    project_id: int
    final_id: int

# ============ Other Schemas ============
class ProjectAssignment(BaseSchema):
    user_id: int
    project_id: int

class UserProjectAssignment(BaseSchema):
    project_ids: List[int]

class ProjectSummary(BaseSchema):
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
    ndt_success_rates: Dict[str, float]
    ndt_weld_lengths_by_method: Dict[str, Dict[str, float]]
    ndt_joint_counts_by_method: Dict[str, Dict[str, int]]
    welder_performance_top10: List[Dict[str, Any]]
    fitup_outstanding: int
    final_outstanding: int
    ndt_done: int
    ndt_outstanding: int
    wps_total: int
    wps_active: int
    welder_total: int
    welder_active: int

class WeeklyNDTSummary(BaseSchema):
    week_start: date
    week_end: date
    week_label: str
    rt_success_rate: float
    ut_success_rate: float
    rt_tested_length: float
    ut_tested_length: float
    rt_rejected_length: float
    ut_rejected_length: float
    rt_accepted_length: float
    ut_accepted_length: float
    rt_joints_tested: int
    ut_joints_tested: int
    rt_joints_accepted: int
    ut_joints_accepted: int
    rt_joints_rejected: int
    ut_joints_rejected: int

class AISummaryRequest(BaseSchema):
    prompt: str
    context_data: Dict[str, Any]

class AISummaryResponse(BaseSchema):
    summary: str
    insights: List[str]
    recommendations: List[str]