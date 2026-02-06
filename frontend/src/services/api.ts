import axios from 'axios';
import {
  User,
  Project,
  ProjectSummary,
  FitUpInspection,
  FinalInspection,
  MaterialRegister,
  NDTRequest,
  MaterialInspection,
  AISummaryResponse,
  LoginRequest,
  PasswordChange,
  MasterJointList,
  NDTTest,
  NDTJointStatus,
  NDTRequirement,
  NDTStatusRecord,
  WeeklyNDTSummary
} from '../types';

// Configure axios defaults
axios.defaults.baseURL = process.env.REACT_APP_API_URL || '/api/v1';
axios.defaults.headers.common['Content-Type'] = 'application/json';

// Request interceptor to add auth token
axios.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.code === 'ERR_CANCELED') {
      return Promise.reject(error);
    }
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export class ApiService {
  // Authentication
  static async login(credentials: LoginRequest): Promise<{ access_token: string; user: User }> {
    const response = await axios.post('/login', credentials);
    return response.data;
  }

  static async logout(): Promise<void> {
    await axios.post('/logout');
  }

  static async verifyToken(): Promise<{ valid: boolean; user: User }> {
    const response = await axios.get('/verify-token');
    return response.data;
  }

  // User Management
  static async getCurrentUser(): Promise<User> {
    const response = await axios.get('/users/me');
    return response.data;
  }

  static async getUsers(): Promise<User[]> {
    const response = await axios.get('/users');
    return response.data;
  }

  static async createUser(userData: {
    email: string;
    password: string;
    full_name?: string;
    role?: string;
  }): Promise<User> {
    const response = await axios.post('/users', userData);
    return response.data;
  }

  static async updateUser(userId: number, userData: Partial<User>): Promise<User> {
    const response = await axios.put(`/users/${userId}`, userData);
    return response.data;
  }

  static async deleteUser(userId: number): Promise<void> {
    await axios.delete(`/users/${userId}`);
  }

  static async changePassword(userId: number, passwordData: PasswordChange): Promise<void> {
    await axios.post(`/users/${userId}/change-password`, passwordData);
  }

  static async resetPassword(userId: number, newPassword: string): Promise<void> {
    await axios.post(`/users/${userId}/reset-password`, { new_password: newPassword });
  }

  static async assignProjectsToUser(userId: number, projectIds: number[]): Promise<void> {
    await axios.post(`/users/${userId}/assign-projects`, { project_ids: projectIds });
  }

  // Project Management
  static async getProjects(): Promise<Project[]> {
    const response = await axios.get('/projects');
    return response.data;
  }

  static async getMyProjects(): Promise<Project[]> {
    const response = await axios.get('/projects/my-projects');
    return response.data;
  }

  static async getProject(projectId: number): Promise<Project> {
    const response = await axios.get(`/projects/${projectId}`);
    return response.data;
  }

  static async createProject(projectData: {
    name: string;
    code: string;
    description?: string;
    project_type?: 'pipe' | 'structure';
  }): Promise<Project> {
    const response = await axios.post('/projects', { ...projectData, project_type: projectData.project_type || 'structure' });
    return response.data;
  }

  static async updateProject(projectId: number, projectData: Partial<Project>): Promise<Project> {
    const response = await axios.put(`/projects/${projectId}`, projectData);
    return response.data;
  }

  static async deleteProject(projectId: number): Promise<void> {
    await axios.delete(`/projects/${projectId}`);
  }

  static async getProjectSummary(projectId: number): Promise<ProjectSummary> {
    const response = await axios.get(`/projects/${projectId}/summary`);
    return response.data;
  }

  // Weekly NDT Summary
  static async getWeeklyNDTSummary(projectId: number, weeks: number = 12): Promise<WeeklyNDTSummary[]> {
    const response = await axios.get(`/projects/${projectId}/weekly-ndt-summary`, {
      params: { weeks }
    });
    return response.data;
  }

  // Master Joint List
  static async getMasterJointList(projectId?: number, systemNo?: string, lineNo?: string): Promise<MasterJointList[]> {
    const params = { 
      ...(projectId && { project_id: projectId }),
      ...(systemNo && { structure_category: systemNo }), // Map systemNo to structure_category
      ...(lineNo && { page_no: lineNo }) // Map lineNo to page_no
    };
    const response = await axios.get('/structure/master-joint-list', { params });
    return response.data;
  }

  static async createMasterJointList(masterJointData: Omit<MasterJointList, 'id' | 'created_at'>): Promise<MasterJointList> {
    const response = await axios.post('/structure/master-joint-list', masterJointData);
    return response.data;
  }

  static async updateMasterJointList(masterJointId: number, masterJointData: Partial<MasterJointList>): Promise<MasterJointList> {
    const response = await axios.put(`/structure/master-joint-list/${masterJointId}`, masterJointData);
    return response.data;
  }

  static async deleteMasterJointList(masterJointId: number): Promise<void> {
    await axios.delete(`/structure/master-joint-list/${masterJointId}`);
  }

  static async uploadMasterJointList(projectId: number, file: File): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);
    const response = await axios.post(`/structure/master-joint-list/upload?project_id=${projectId}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }

  // Material Register
  static async getMaterialRegister(projectId?: number): Promise<MaterialRegister[]> {
    const params = projectId ? { project_id: projectId } : {};
    const response = await axios.get('/structure/material-register', { params });
    return response.data;
  }

  static async createMaterialRegister(materialData: Omit<MaterialRegister, 'id' | 'created_at'>): Promise<MaterialRegister> {
    const response = await axios.post('/structure/material-register', materialData);
    return response.data;
  }

  static async updateMaterialRegister(materialId: number, materialData: Partial<MaterialRegister>): Promise<MaterialRegister> {
    const response = await axios.put(`/structure/material-register/${materialId}`, materialData);
    return response.data;
  }

  static async deleteMaterialRegister(materialId: number): Promise<void> {
    await axios.delete(`/structure/material-register/${materialId}`);
  }

  static async uploadMaterialRegister(projectId: number, file: File): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);
    const response = await axios.post(`/structure/material-register/upload?project_id=${projectId}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  }

  static async lookupMaterialByPieceMark(pieceMarkNo: string, projectId?: number): Promise<any> {
    const params = projectId ? { project_id: projectId } : {};
    const response = await axios.get(`/structure/material-register/${pieceMarkNo}/lookup`, { params });
    return response.data;
  }

  // Material Inspection
  static async getMaterialInspections(projectId?: number): Promise<MaterialInspection[]> {
    const params = projectId ? { project_id: projectId } : {};
    const response = await axios.get('/material-inspection', { params });
    return response.data;
  }

  static async createMaterialInspection(inspectionData: Omit<MaterialInspection, 'id' | 'created_at'>): Promise<MaterialInspection> {
    const response = await axios.post('/material-inspection', inspectionData);
    return response.data;
  }

  // Fit-up Inspection
  static async getFitUpInspections(projectId?: number): Promise<FitUpInspection[]> {
    const params = projectId ? { project_id: projectId } : {};
    const response = await axios.get('/structure/fitup-inspection', { params });
    return response.data;
  }

  static async getFitUpFilters(projectId?: number): Promise<{ system_no: string[]; spool_no: string[]; joint_no: string[]; fit_up_report_no: string[]; fit_up_result: string[] }> {
    const params = projectId ? { project_id: projectId } : {};
    const response = await axios.get('/structure/fitup-inspection/filters', { params });
    return response.data;
  }

  static async createFitUpInspection(fitupData: Omit<FitUpInspection, 'id' | 'created_at' | 'updated_at'>): Promise<FitUpInspection> {
    const response = await axios.post('/structure/fitup-inspection', fitupData);
    return response.data;
  }

  static async updateFitUpInspection(fitupId: number, fitupData: Partial<FitUpInspection>): Promise<FitUpInspection> {
    const response = await axios.put(`/structure/fitup-inspection/${fitupId}`, fitupData);
    return response.data;
  }

  static async deleteFitUpInspection(fitupId: number): Promise<void> {
    await axios.delete(`/structure/fitup-inspection/${fitupId}`);
  }

  // Final Inspection
  static async getFinalInspections(projectId?: number): Promise<FinalInspection[]> {
    const params = projectId ? { project_id: projectId } : {};
    const response = await axios.get('/structure/final-inspection', { params });
    return response.data;
  }

  static async getFinalFilters(projectId?: number): Promise<{ system_no: string[]; spool_no: string[]; joint_no: string[]; final_report_no: string[]; final_result: string[] }> {
    const params = projectId ? { project_id: projectId } : {};
    const response = await axios.get('/structure/final-inspection/filters', { params });
    return response.data;
  }

  static async createFinalInspection(finalData: Omit<FinalInspection, 'id' | 'created_at'>): Promise<FinalInspection> {
    const response = await axios.post('/structure/final-inspection', finalData);
    return response.data;
  }

  static async updateFinalInspection(finalId: number, finalData: Partial<FinalInspection>): Promise<FinalInspection> {
    const response = await axios.put(`/structure/final-inspection/${finalId}`, finalData);
    return response.data;
  }

  static async deleteFinalInspection(finalId: number): Promise<void> {
    await axios.delete(`/structure/final-inspection/${finalId}`);
  }

  // NDT Requests
  static async getNDTRequests(projectId?: number, status?: string): Promise<NDTRequest[]> {
    const params = { ...(projectId && { project_id: projectId }), ...(status && { status }) };
    const response = await axios.get('/structure/ndt-requests', { params });
    return response.data;
  }

  static async getNDTTests(projectId?: number, finalId?: number): Promise<NDTTest[]> {
    const params = { ...(projectId && { project_id: projectId }), ...(finalId && { final_id: finalId }) };
    const response = await axios.get('/structure/ndt-tests', { params });
    return response.data;
  }

  static async createNDTTest(payload: Omit<NDTTest, 'id' | 'created_at'>): Promise<NDTTest> {
    const response = await axios.post('/structure/ndt-tests', payload);
    return response.data;
  }

  static async updateNDTTest(id: number, payload: Partial<NDTTest>): Promise<NDTTest> {
    const response = await axios.put(`/structure/ndt-tests/${id}`, payload);
    return response.data;
  }

  static async deleteNDTTest(id: number): Promise<void> {
    await axios.delete(`/structure/ndt-tests/${id}`);
  }

  static async getNDTStatus(projectId: number): Promise<NDTStatusRecord[]> {
    const response = await axios.get('/structure/ndt-status', { params: { project_id: projectId } });
    return response.data;
  }

  static async getNDTStatusRecords(projectId: number): Promise<NDTStatusRecord[]> {
    const response = await axios.get('/structure/ndt-status-records', { params: { project_id: projectId } });
    return response.data;
  }

  static async updateNDTStatusRecord(id: number, payload: Partial<{ welder_no: string; weld_size: number; weld_site: string; ndt_type: string; ndt_report_no: string; ndt_result: string; rejected_length: number; test_length: number }>): Promise<any> {
    const response = await axios.put(`/structure/ndt-status-records/${id}`, payload);
    return response.data;
  }

  static async ensureNDTStatusRecord(finalId: number): Promise<any> {
    const response = await axios.post('/structure/ndt-status-records/ensure', undefined, { params: { final_id: finalId } });
    return response.data;
  }

  static async deleteNDTStatusRecord(id: number): Promise<void> {
    await axios.delete(`/structure/ndt-status-records/${id}`);
  }

  static async cleanupOrphanedNDTStatusRecords(projectId: number, dryRun: boolean = true): Promise<{dry_run: boolean, total_records: number, orphaned_count: number, records: any[]}> {
    const response = await axios.post(`/structure/ndt-status-records/cleanup-orphaned?project_id=${projectId}&dry_run=${dryRun}`);
    return response.data;
  }

  static async backfillNDTStatusRecords(projectId: number): Promise<{ created: number }> {
    const response = await axios.post(`/structure/ndt-status-records/backfill?project_id=${projectId}`);
    return response.data;
  }

  static async getNDTRequirements(projectId: number): Promise<NDTRequirement[]> {
    const response = await axios.get('/structure/ndt-requirements', { params: { project_id: projectId } });
    return response.data;
  }

  static async createNDTRequirement(payload: Omit<NDTRequirement, 'id' | 'created_at'>): Promise<NDTRequirement> {
    const response = await axios.post('/structure/ndt-requirements', payload);
    return response.data;
  }

  static async deleteNDTRequirement(reqId: number): Promise<void> {
    await axios.delete(`/structure/ndt-requirements/${reqId}`);
  }

  // Audit Logs (Admin-only endpoints)
  static async getAuditLogDates(): Promise<string[]> {
    const response = await axios.get('/audit-logs/dates');
    return response.data;
  }

  static async getAuditLogByDate(date: string): Promise<string> {
    const response = await axios.get(`/audit-logs/${date}`, { responseType: 'text' });
    return response.data;
  }

  // WPS Register
  static async getWPSRegister(projectId?: number): Promise<any[]> {
    const params = projectId ? { project_id: projectId } : {};
    const response = await axios.get('/wps-register', { params });
    return response.data;
  }

  static async createWPSRegister(payload: any): Promise<any> {
    const response = await axios.post('/wps-register', payload);
    return response.data;
  }

  static async updateWPSRegister(id: number, payload: any): Promise<any> {
    const response = await axios.put(`/wps-register/${id}`, payload);
    return response.data;
  }

  static async deleteWPSRegister(id: number): Promise<void> {
    await axios.delete(`/wps-register/${id}`);
  }

  // Welder Register
  static async getWelderRegister(projectId?: number): Promise<any[]> {
    const params = projectId ? { project_id: projectId } : {};
    const response = await axios.get('/welder-register', { params });
    return response.data;
  }

  static async createWelderRegister(payload: any): Promise<any> {
    const response = await axios.post('/welder-register', payload);
    return response.data;
  }

  static async updateWelderRegister(id: number, payload: any): Promise<any> {
    const response = await axios.put(`/welder-register/${id}`, payload);
    return response.data;
  }

  static async deleteWelderRegister(id: number): Promise<void> {
    await axios.delete(`/welder-register/${id}`);
  }

  static async createNDTRequest(ndtData: Omit<NDTRequest, 'id' | 'created_at'>): Promise<NDTRequest> {
    const response = await axios.post('/ndt-requests', ndtData);
    return response.data;
  }

  static async updateNDTRequest(ndtId: number, payload: Partial<NDTRequest>): Promise<NDTRequest> {
    const response = await axios.put(`/ndt-requests/${ndtId}`, payload);
    return response.data;
  }

  static async updateNDTStatus(ndtId: number, status: string): Promise<void> {
    await axios.put(`/ndt-requests/${ndtId}/status`, { status });
  }

  static async deleteNDTRequest(ndtId: number): Promise<void> {
    await axios.delete(`/ndt-requests/${ndtId}`);
  }

  // Structure Master Joint List
  static async getStructureMasterJointList(projectId?: number, structureCategory?: string, pageNo?: string, excludeWithFitup?: boolean, blockNo?: string, jointNo?: string): Promise<any[]> {
    const params = { 
      ...(projectId && { project_id: projectId }),
      ...(structureCategory && { structure_category: structureCategory }),
      ...(pageNo && { page_no: pageNo }),
      ...(excludeWithFitup && { exclude_with_fitup: excludeWithFitup }),
      ...(blockNo && { block_no: blockNo }),
      ...(jointNo && { joint_no: jointNo })
    };
    const response = await axios.get('/structure/master-joint-list', { params });
    return response.data;
  }

  static async createStructureMasterJointList(masterJointData: any): Promise<any> {
    const response = await axios.post('/structure/master-joint-list', masterJointData);
    return response.data;
  }

  static async updateStructureMasterJointList(masterJointId: number, masterJointData: any): Promise<any> {
    const response = await axios.put(`/structure/master-joint-list/${masterJointId}`, masterJointData);
    return response.data;
  }

  static async deleteStructureMasterJointList(masterJointId: number): Promise<void> {
    await axios.delete(`/structure/master-joint-list/${masterJointId}`);
  }

  static async uploadStructureMasterJointList(projectId: number, file: File): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);
    const response = await axios.post(`/structure/master-joint-list/upload?project_id=${projectId}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }

  // Structure Material Inspection
  static async getStructureMaterialInspections(projectId?: number): Promise<any[]> {
    const params = projectId ? { project_id: projectId } : {};
    const response = await axios.get('/structure/material-inspection', { params });
    return response.data;
  }

  static async createStructureMaterialInspection(inspectionData: any): Promise<any> {
    const response = await axios.post('/structure/material-inspection', inspectionData);
    return response.data;
  }

  // Structure Fit-up Inspection
  static async getStructureFitUpInspections(projectId?: number): Promise<any[]> {
    const params = projectId ? { project_id: projectId } : {};
    const response = await axios.get('/structure/fitup-inspection', { params });
    return response.data;
  }

  static async getStructureFitUpFilters(projectId?: number): Promise<{ structure_category: string[]; drawing_rev: string[]; joint_no: string[]; fit_up_report_no: string[]; fit_up_result: string[] }> {
    const params = projectId ? { project_id: projectId } : {};
    const response = await axios.get('/structure/fitup-inspection/filters', { params });
    return response.data;
  }

  static async getStructureFitUpPendingFinal(projectId: number): Promise<any[]> {
    const params = { project_id: projectId };
    const response = await axios.get('/structure/fitup-inspection/pending-final', { params });
    return response.data;
  }

  static async createStructureFitUpInspection(fitupData: any): Promise<any> {
    const response = await axios.post('/structure/fitup-inspection', fitupData);
    return response.data;
  }

  static async updateStructureFitUpInspection(fitupId: number, fitupData: any): Promise<any> {
    const response = await axios.put(`/structure/fitup-inspection/${fitupId}`, fitupData);
    return response.data;
  }

  static async syncStructureFitUpMaterials(projectId: number, fitupIds?: number[]): Promise<{ message: string, updated_count: number }> {
    const params = { project_id: projectId };
    const response = await axios.post('/structure/fitup-inspection/sync-materials', fitupIds || [], { params });
    return response.data;
  }

  static async deleteStructureFitUpInspection(fitupId: number): Promise<void> {
    await axios.delete(`/structure/fitup-inspection/${fitupId}`);
  }

  // Structure Final Inspection
  static async getStructureFinalInspections(projectId?: number): Promise<any[]> {
    const params = projectId ? { project_id: projectId } : {};
    const response = await axios.get('/structure/final-inspection', { params });
    return response.data;
  }

  static async getStructureFinalFilters(projectId?: number): Promise<{ structure_category: string[]; draw_no: string[]; drawing_rev: string[]; joint_no: string[]; final_report_no: string[]; final_result: string[] }> {
    const params = projectId ? { project_id: projectId } : {};
    const response = await axios.get('/structure/final-inspection/filters', { params });
    return response.data;
  }

  static async createStructureFinalInspection(finalData: any): Promise<any> {
    const response = await axios.post('/structure/final-inspection', finalData);
    return response.data;
  }

  static async updateStructureFinalInspection(finalId: number, finalData: any): Promise<any> {
    const response = await axios.put(`/structure/final-inspection/${finalId}`, finalData);
    return response.data;
  }

  static async deleteStructureFinalInspection(finalId: number): Promise<void> {
    await axios.delete(`/structure/final-inspection/${finalId}`);
  }

  // Bulk Final Inspection Operations
  static async bulkCreateFinalInspectionsFromFitup(fitupIds: number[]): Promise<{
    message: string;
    created_count: number;
    skipped_count: number;
    created_finals: any[];
    errors?: string[];
  }> {
    const response = await axios.post('/structure/final-inspection/bulk-from-fitup', fitupIds);
    return response.data;
  }

  static async bulkUpdateFinalInspections(finalIds: number[], updateData: {
    welder_no?: string;
    wps_no?: string;
    final_report_no?: string;
    final_date?: string;
    ndt_type?: string;
    final_result?: string;
  }): Promise<{
    message: string;
    updated_count: number;
    errors?: string[];
  }> {
    const response = await axios.put('/structure/final-inspection/bulk-update', {
      final_ids: finalIds,
      update_data: updateData
    });
    return response.data;
  }

  // Structure NDT Status
  static async getStructureNDTStatus(projectId: number): Promise<any[]> {
    const response = await axios.get('/structure/ndt-status', { params: { project_id: projectId } });
    return response.data;
  }

  static async getStructureNDTStatusRecords(projectId: number): Promise<any[]> {
    const response = await axios.get('/structure/ndt-status-records', { params: { project_id: projectId } });
    return response.data;
  }

  static async updateStructureNDTStatusRecord(id: number, payload: any): Promise<any> {
    const response = await axios.put(`/structure/ndt-status-records/${id}`, payload);
    return response.data;
  }

  static async ensureStructureNDTStatusRecord(finalId: number): Promise<any> {
    const response = await axios.post('/structure/ndt-status-records/ensure', undefined, { params: { final_id: finalId } });
    return response.data;
  }

  static async deleteStructureNDTStatusRecord(id: number): Promise<void> {
    await axios.delete(`/structure/ndt-status-records/${id}`);
  }

  // Structure NDT Requests
  static async getStructureNDTRequests(projectId?: number, status?: string): Promise<any[]> {
    const params = { ...(projectId && { project_id: projectId }), ...(status && { status }) };
    const response = await axios.get('/structure/ndt-requests', { params });
    return response.data;
  }

  static async createStructureNDTRequest(ndtData: any): Promise<any> {
    const response = await axios.post('/structure/ndt-requests', ndtData);
    return response.data;
  }

  static async updateStructureNDTRequest(ndtId: number, payload: any): Promise<any> {
    const response = await axios.put(`/structure/ndt-requests/${ndtId}`, payload);
    return response.data;
  }

  static async updateStructureNDTStatus(ndtId: number, status: string): Promise<void> {
    await axios.put(`/structure/ndt-requests/${ndtId}/status`, { status });
  }

  static async deleteStructureNDTRequest(ndtId: number): Promise<void> {
    await axios.delete(`/structure/ndt-requests/${ndtId}`);
  }

  // Structure NDT Tests
  static async getStructureNDTTests(projectId?: number, finalId?: number): Promise<any[]> {
    const params = { ...(projectId && { project_id: projectId }), ...(finalId && { final_id: finalId }) };
    const response = await axios.get('/structure/ndt-tests', { params });
    return response.data;
  }

  static async createStructureNDTTest(payload: any): Promise<any> {
    const response = await axios.post('/structure/ndt-tests', payload);
    return response.data;
  }

  static async updateStructureNDTTest(id: number, payload: any): Promise<any> {
    const response = await axios.put(`/structure/ndt-tests/${id}`, payload);
    return response.data;
  }

  static async deleteStructureNDTTest(id: number): Promise<void> {
    await axios.delete(`/structure/ndt-tests/${id}`);
  }

  // Structure NDT Requirements
  static async getStructureNDTRequirements(projectId: number): Promise<any[]> {
    const response = await axios.get('/structure/ndt-requirements', { params: { project_id: projectId } });
    return response.data;
  }

  static async createStructureNDTRequirement(payload: any): Promise<any> {
    const response = await axios.post('/structure/ndt-requirements', payload);
    return response.data;
  }

  // AI Services
  static async generateAISummary(prompt: string, contextData: any): Promise<AISummaryResponse> {
    const response = await axios.post('/ai/summary', {
      prompt,
      context_data: contextData
    });
    return response.data;
  }

  static async getAIProjectSummary(projectId: number): Promise<AISummaryResponse> {
    const response = await axios.get(`/ai/project-summary/${projectId}`);
    return response.data;
  }

  static async getAIInspectionSummary(inspectionId: number, inspectionType: string): Promise<AISummaryResponse> {
    const response = await axios.get(`/ai/inspection-summary/${inspectionId}`, {
      params: { inspection_type: inspectionType }
    });
    return response.data;
  }
}

export default ApiService;
