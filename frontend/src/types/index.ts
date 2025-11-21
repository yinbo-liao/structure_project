export interface User {
  id: number;
  email: string;
  full_name: string;
  role: 'admin' | 'inspector' | 'visitor';
  is_active: boolean;
  created_at: string;
  assigned_projects: Project[];
  owned_projects: Project[];
}

export interface Project {
  id: number;
  name: string;
  code: string;
  description: string;
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
  draw_no: string;
  system_no: string;
  line_no: string;
  spool_no: string;
  joint_no: string;
  pipe_dia?: string;
  weld_type?: string;
  part1_piece_mark_no?: string;
  part2_piece_mark_no?: string;
  fit_up_report_no?: string;
  fitup_status: 'pending' | 'done';
  final_status: 'pending' | 'done';
  created_at: string;
}

export interface MaterialRegister {
  id: number;
  project_id: number;
  piece_mark_no: string;
  material_type?: string;
  grade?: string;
  thickness?: string;
  heat_no?: string;
  spec?: string;
  category?: string;
  pipe_dia?: string;
  inspection_status: 'pending' | 'inspected' | 'rejected';
  created_at: string;
}

export interface FitUpInspection {
  id: number;
  project_id: number;
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
  created_at: string;
  updated_at?: string;
  updated_by?: string;
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
  final_date?: string;
  final_report_no?: string;
  final_result?: string;
  ndt_type?: string;
  weld_length?: number;
  pipe_dia?: string;
  remarks?: string;
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
  system_no?: string;
  line_no?: string;
  spool_no?: string;
  joint_no?: string;
  weld_type?: string;
  welder_no?: string;
  weld_size?: number;
  weld_site?: string;
  pipe_dia?: string;
  ndt_type?: string;
  ndt_report_no?: string;
  ndt_result?: string;
  rejected_length?: number;
  created_at: string;
  updated_at?: string;
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
