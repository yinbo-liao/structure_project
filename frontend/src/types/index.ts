export interface User {
  id: number;
  email: string;
  full_name: string;
  role: 'admin' | 'inspector' | 'visitor';
  is_active: boolean;
  password_change_required: boolean;
  created_at: string;
  assigned_projects: Project[];
  owned_projects: Project[];
}

export interface Project {
  id: number;
  name: string;
  code: string;
  description: string;
  project_type: 'pipe' | 'structure';
  owner_id: number;
  created_at: string;
  updated_at: string;
  assigned_users: User[];
  owner: User;
}

export interface ProjectSummary {
  project_id: number;
  project_name: string;
  total_joints: number;
  fitup_done: number;
  final_done: number;
  material_used: number;
  material_missing_from_fitup: number;
  material_pending_inspection: number;
  material_inspected: number;
  material_rejected: number;
  ndt_requests_total: number;
  ndt_requests_pending: number;
  ndt_requests_approved: number;
  weld_accept_length_total: number;
  weld_reject_length_total: number;
  ndt_success_rates: Record<string, number>;
  ndt_weld_lengths_by_method: Record<string, { accepted_mm: number; rejected_mm: number }>;
  ndt_joint_counts_by_method: Record<string, { accepted_joints: number; rejected_joints: number }>;
  welder_performance_top10: { welder_no: string; total_mm: number; rejected_mm: number; reject_rate: number; retrain: boolean }[];
  fitup_outstanding: number;
  final_outstanding: number;
  ndt_done: number;
  ndt_outstanding: number;
  wps_total: number;
  wps_active: number;
  welder_total: number;
  welder_active: number;
}

export interface MasterJointList {
  id: number;
  project_id: number;
  draw_no?: string;  // Optional: only for structure projects
  system_no: string;
  line_no: string;
  spool_no: string;
  joint_no: string;
  pipe_dia?: string;
  thickness?: string;
  weld_type?: string;
  weld_length?: number;
  part1_piece_mark_no?: string;
  part2_piece_mark_no?: string;
  fit_up_report_no?: string;
  fitup_status: 'pending' | 'done';
  final_status: 'pending' | 'done';
  inspection_category: 'type-I' | 'type-II' | 'type-III' | 'Special';
  block_no?: string;
  created_at: string;
  // Structure-specific fields (optional for backward compatibility)
  structure_category?: string;
  page_no?: string;
  drawing_rev?: string;

  // NDT Fields
  ndt_rt_report_no?: string;
  ndt_rt_result?: 'Accepted' | 'Rejected' | 'Pending';
  ndt_ut_report_no?: string;
  ndt_ut_result?: 'Accepted' | 'Rejected' | 'Pending';
  ndt_mpi_report_no?: string;
  ndt_mpi_result?: 'Accepted' | 'Rejected' | 'Pending';
  ndt_pt_report_no?: string;
  ndt_pt_result?: 'Accepted' | 'Rejected' | 'Pending';
  ndt_pmi_report_no?: string;
  ndt_pmi_result?: 'Accepted' | 'Rejected' | 'Pending';
  ndt_ft_report_no?: string;
  ndt_ft_result?: 'Accepted' | 'Rejected' | 'Pending';
  ndt_paut_report_no?: string;
  ndt_paut_result?: 'Accepted' | 'Rejected' | 'Pending';
  ndt_comprehensive_status?: string;
  ndt_last_sync?: string;
  ndt_sync_status?: string;
}

export interface MaterialRegister {
  id: number;
  project_id: number;
  piece_mark_no: string;
  material_type?: string;
  grade?: string;
  thickness?: string;
  pipe_dia?: string;
  heat_no?: string;
  block_no?: string;
  structure_spec?: string;

  drawing_no?: string;  // Added for structure projects
  structure_category?: string;  // Added for structure projects
  drawing_rev?: string;  // Added for structure projects
  material_report_no?: string;  // Added for material report number
  inspection_status: 'pending' | 'inspected' | 'rejected';
  created_at: string;
}

export interface FitUpInspection {
  id: number;
  project_id: number;
  draw_no?: string;
  system_no?: string;
  line_no?: string;
  spool_no?: string;
  joint_no?: string;
  weld_type?: string;
  part1_piece_mark_no?: string;
  part2_piece_mark_no?: string;
  part1_material_type?: string;
  part1_grade?: string;
  part1_thickness?: string;
  part1_heat_no?: string;
  part2_material_type?: string;
  part2_grade?: string;
  part2_thickness?: string;
  part2_heat_no?: string;
  weld_site?: string;
  weld_length?: number;
  dia?: string;
  fit_up_date?: string;
  fit_up_report_no?: string;
  fit_up_result?: string;
  remarks?: string;
  master_joint_id?: number;
  inspection_category?: 'type-I' | 'type-II' | 'type-III' | 'Special';
  block_no?: string;
  created_at: string;
  updated_at?: string;
  updated_by?: string;
  // Structure-specific fields (optional for backward compatibility)
  structure_category?: string;
  page_no?: string;
  drawing_rev?: string;
}

export interface FinalInspection {
  id: number;
  fitup_id: number;
  project_id: number;
  system_no?: string;
  line_no?: string;
  spool_no?: string;
  joint_no?: string;
  weld_type?: string;
  wps_no?: string;
  welder_no?: string;
  welder_validity?: string;
  weld_site?: string;
  final_date?: string;
  final_report_no?: string;
  final_result?: string;
  ndt_type?: string;
  weld_length?: number;
  pipe_dia?: string;
  remarks?: string;
  inspection_category?: 'type-I' | 'type-II' | 'type-III' | 'Special';
  block_no?: string;
  draw_no?: string;
  structure_category?: string;
  page_no?: string;
  created_at: string;
}

export interface NDTRequest {
  id: number;
  project_id: number;
  final_id?: number;
  project_name?: string;
  project_code?: string;
  department?: string;
  incharge_person?: string;
  contact?: string;
  request_time?: string;
  contractor?: string;
  job_code?: string;
  job_location?: string;
  test_time?: string;
  requirement?: string;
  detail_description?: string;
  status: 'pending' | 'approved' | 'rejected';
  ndt_type?: string;
  ndt_report_no?: string;
  ndt_result?: string;
  system_no?: string;
  line_no?: string;
  spool_no?: string;
  joint_no?: string;
  weld_type?: string;
  welder_no?: string;
  weld_size?: number;
  weld_process?: string;
  pipe_dia?: string;
  inspection_category?: 'type-I' | 'type-II' | 'type-III' | 'Special';
  block_no?: string;
  created_at: string;
}

export interface NDTTest {
  id: number;
  project_id: number;
  final_id: number;
  method: string;
  result?: string;
  report_no?: string;
  tested_by?: string;
  test_date?: string;
  test_length?: number;
  created_at: string;
}

export interface NDTTestItem {
  method: string;
  result?: string;
  report_no?: string;
  tested_by?: string;
  test_date?: string;
  test_length?: number;
}

export interface NDTJointStatus {
  final_id: number;
  project_id: number;
  system_no?: string;
  line_no?: string;
  spool_no?: string;
  joint_no?: string;
  weld_type?: string;
  weld_site?: string;
  test_length?: number;
  required_methods: string[];
  tests: NDTTestItem[];
  inspected_by?: string;
  final_status: string;
}

export interface MaterialInspection {
  id: number;
  project_id: number;
  piece_mark_no: string;
  material_type?: string;
  grade?: string;
  thickness?: string;
  heat_no?: string;
  inspection_date?: string;
  report_no?: string;
  result?: string;
  remarks?: string;
  inspector_name?: string;
  created_at: string;
}

export interface AISummaryResponse {
  summary: string;
  insights: string[];
  recommendations: string[];
}

export interface AIStrategyCapability {
  key: string;
  title: string;
  summary: string;
  backend_support: string;
  suggested_files: string[];
  deliverables: string[];
}

export interface AIStrategyCapabilitiesResponse {
  capabilities: AIStrategyCapability[];
}

export interface AIImplementationFilePlanItem {
  file: string;
  purpose: string;
}

export interface AIImplementationStrategyRequest {
  focus_area: string;
  desired_outputs: string[];
  target_files: string[];
  constraints: string[];
}

export interface AIImplementationStrategyResponse {
  title: string;
  overview: string;
  focus_area: string;
  desired_outputs: string[];
  constraints: string[];
  implementation_steps: string[];
  backend_file_plan: AIImplementationFilePlanItem[];
  target_files: string[];
}

export interface NDTRequirement {
  id: number;
  project_id: number;
  method: string;
  required: boolean;
  created_at: string;
}

export interface NDTStatusRecord {
  id: number;
  project_id: number;
  final_id: number;
  joint_no?: string;
  weld_type?: string;
  welder_no?: string;
  weld_size?: number;
  weld_site?: string;
  ndt_type?: string;
  ndt_report_no?: string;
  ndt_result?: string;
  rejected_length?: number;
  inspection_category?: 'type-I' | 'type-II' | 'type-III' | 'Special';
  block_no?: string;
  draw_no?: string;
  structure_category?: string;
  page_no?: string;
  drawing_rev?: string;
  dia?: string;
  created_at: string;
  updated_at?: string;
  // Additional fields that may exist in the actual data
  test_length?: number;
  system_no?: string;
  line_no?: string;
  spool_no?: string;
}

export interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
  selectedProject: Project | null;
  setSelectedProject: (project: Project | null) => void;
  canEdit: () => boolean;
  canDelete: () => boolean;
  isAdmin: () => boolean;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface PasswordChange {
  current_password: string;
  new_password: string;
}

export interface WeeklyNDTSummary {
  week_start: string;
  week_end: string;
  week_label: string;
  rt_success_rate: number;
  ut_success_rate: number;
  rt_tested_length: number;
  ut_tested_length: number;
  rt_rejected_length: number;
  ut_rejected_length: number;
  rt_accepted_length: number;
  ut_accepted_length: number;
  rt_joints_tested: number;
  ut_joints_tested: number;
  rt_joints_accepted: number;
  ut_joints_accepted: number;
  rt_joints_rejected: number;
  ut_joints_rejected: number;
}
