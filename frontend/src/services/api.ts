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
  AIStrategyCapability,
  AIImplementationStrategyRequest,
  AIImplementationStrategyResponse,
  LoginRequest,
  PasswordChange,
  MasterJointList,
  NDTJointStatus,
  NDTTest,
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
  // =========================================================================
  // Authentication (cross-project — no project_id needed)
  // =========================================================================
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

  // =========================================================================
  // User Management (cross-project — no project_id needed)
  // =========================================================================
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

  // =========================================================================
  // Project Management
  // =========================================================================
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

  static async getWeeklyNDTSummary(projectId: number, weeks: number = 12): Promise<WeeklyNDTSummary[]> {
    const response = await axios.get(`/projects/${projectId}/weekly-ndt-summary`, {
      params: { weeks }
    });
    return response.data;
  }

  // =========================================================================
  // Master Joint List
  // =========================================================================
  static async getMasterJointList(projectId: number, systemNo?: string, lineNo?: string): Promise<MasterJointList[]> {
    const params = {
      project_id: projectId,
      ...(systemNo && { structure_category: systemNo }),
      ...(lineNo && { page_no: lineNo })
    };
    const response = await axios.get('/structure/master-joint-list', { params });
    return response.data;
  }

  static async createMasterJointList(projectId: number, masterJointData: Omit<MasterJointList, 'id' | 'created_at'>): Promise<MasterJointList> {
    const response = await axios.post('/structure/master-joint-list', { ...masterJointData, project_id: projectId });
    return response.data;
  }

  static async updateMasterJointList(projectId: number, masterJointId: number, masterJointData: Partial<MasterJointList>): Promise<MasterJointList> {
    const response = await axios.put(`/structure/master-joint-list/${masterJointId}`, { ...masterJointData, project_id: projectId });
    return response.data;
  }

  static async deleteMasterJointList(projectId: number, masterJointId: number): Promise<void> {
    await axios.delete(`/structure/master-joint-list/${masterJointId}`, { params: { project_id: projectId } });
  }

  static async uploadMasterJointList(projectId: number, file: File): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);
    const response = await axios.post(`/structure/master-joint-list/upload?project_id=${projectId}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  }

  // =========================================================================
  // Material Register
  // =========================================================================
  static async getMaterialRegister(projectId: number): Promise<MaterialRegister[]> {
    const response = await axios.get('/structure/material-register', { params: { project_id: projectId } });
    return response.data;
  }

  static async createMaterialRegister(projectId: number, materialData: Omit<MaterialRegister, 'id' | 'created_at'>): Promise<MaterialRegister> {
    const response = await axios.post('/structure/material-register', { ...materialData, project_id: projectId });
    return response.data;
  }

  static async updateMaterialRegister(projectId: number, materialId: number, materialData: Partial<MaterialRegister>): Promise<MaterialRegister> {
    const response = await axios.put(`/structure/material-register/${materialId}`, { ...materialData, project_id: projectId });
    return response.data;
  }

  static async deleteMaterialRegister(projectId: number, materialId: number): Promise<void> {
    await axios.delete(`/structure/material-register/${materialId}`, { params: { project_id: projectId } });
  }

  static async uploadMaterialRegister(projectId: number, file: File): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);
    const response = await axios.post(`/structure/material-register/upload?project_id=${projectId}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  }

  static async lookupMaterialByPieceMark(projectId: number, pieceMarkNo: string): Promise<any> {
    const response = await axios.get(`/structure/material-register/${pieceMarkNo}/lookup`, { params: { project_id: projectId } });
    return response.data;
  }

  // =========================================================================
  // Material Inspection (legacy)
  // =========================================================================
  static async getMaterialInspections(projectId: number): Promise<MaterialInspection[]> {
    const response = await axios.get('/material-inspection', { params: { project_id: projectId } });
    return response.data;
  }

  static async createMaterialInspection(projectId: number, inspectionData: Omit<MaterialInspection, 'id' | 'created_at'>): Promise<MaterialInspection> {
    const response = await axios.post('/material-inspection', { ...inspectionData, project_id: projectId });
    return response.data;
  }

  // =========================================================================
  // Fit-up Inspection
  // =========================================================================
  static async getFitUpInspections(projectId: number): Promise<FitUpInspection[]> {
    const response = await axios.get('/structure/fitup-inspection', { params: { project_id: projectId } });
    return response.data;
  }

  static async getFitUpFilters(projectId: number): Promise<{ system_no: string[]; spool_no: string[]; joint_no: string[]; fit_up_report_no: string[]; fit_up_result: string[] }> {
    const response = await axios.get('/structure/fitup-inspection/filters', { params: { project_id: projectId } });
    return response.data;
  }

  static async getPendingFinal(projectId: number): Promise<any[]> {
    const response = await axios.get('/structure/fitup-inspection/pending-final', { params: { project_id: projectId } });
    return response.data;
  }

  static async createFitUpInspection(projectId: number, fitupData: Omit<FitUpInspection, 'id' | 'created_at' | 'updated_at'>): Promise<FitUpInspection> {
    const response = await axios.post('/structure/fitup-inspection', { ...fitupData, project_id: projectId });
    return response.data;
  }

  static async updateFitUpInspection(projectId: number, fitupId: number, fitupData: Partial<FitUpInspection>): Promise<FitUpInspection> {
    const response = await axios.put(`/structure/fitup-inspection/${fitupId}`, { ...fitupData, project_id: projectId });
    return response.data;
  }

  static async deleteFitUpInspection(projectId: number, fitupId: number): Promise<void> {
    await axios.delete(`/structure/fitup-inspection/${fitupId}`, { params: { project_id: projectId } });
  }

  static async syncFitUpMaterials(projectId: number, fitupIds?: number[]): Promise<{ message: string; updated_count: number }> {
    const response = await axios.post('/structure/fitup-inspection/sync-materials', fitupIds || [], { params: { project_id: projectId } });
    return response.data;
  }

  static async bulkCreateOrUpdateFitUpFromMasterJoints(projectId: number, masterJointIds: number[]): Promise<{
    message: string;
    created_count: number;
    updated_count: number;
    skipped_count: number;
    fitup_ids: number[];
    errors?: string[];
  }> {
    const response = await axios.post('/structure/fitup-inspection/bulk-from-master-joints', masterJointIds, { params: { project_id: projectId } });
    return response.data;
  }

  // =========================================================================
  // Final Inspection
  // =========================================================================
  static async getFinalInspections(projectId: number): Promise<FinalInspection[]> {
    const response = await axios.get('/structure/final-inspection', { params: { project_id: projectId } });
    return response.data;
  }

  static async getFinalFilters(projectId: number): Promise<{ system_no: string[]; spool_no: string[]; joint_no: string[]; final_report_no: string[]; final_result: string[] }> {
    const response = await axios.get('/structure/final-inspection/filters', { params: { project_id: projectId } });
    return response.data;
  }

  static async createFinalInspection(projectId: number, finalData: Omit<FinalInspection, 'id' | 'created_at'>): Promise<FinalInspection> {
    const response = await axios.post('/structure/final-inspection', { ...finalData, project_id: projectId });
    return response.data;
  }

  static async updateFinalInspection(projectId: number, finalId: number, finalData: Partial<FinalInspection>): Promise<FinalInspection> {
    const response = await axios.put(`/structure/final-inspection/${finalId}`, { ...finalData, project_id: projectId });
    return response.data;
  }

  static async deleteFinalInspection(projectId: number, finalId: number): Promise<void> {
    await axios.delete(`/structure/final-inspection/${finalId}`, { params: { project_id: projectId } });
  }

  static async bulkCreateFinalInspectionsFromFitup(projectId: number, fitupIds: number[]): Promise<{
    message: string;
    created_count: number;
    skipped_count: number;
    created_finals: any[];
    errors?: string[];
  }> {
    const response = await axios.post('/structure/final-inspection/bulk-from-fitup', fitupIds, { params: { project_id: projectId } });
    return response.data;
  }

  static async bulkUpdateFinalInspections(projectId: number, finalIds: number[], updateData: {
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
    }, { params: { project_id: projectId } });
    return response.data;
  }

  // =========================================================================
  // NDT Requests
  // =========================================================================
  static async getNDTRequests(projectId: number, status?: string): Promise<NDTRequest[]> {
    const params = { project_id: projectId, ...(status && { status }) };
    const response = await axios.get('/structure/ndt-requests', { params });
    return response.data;
  }

  static async createNDTRequest(projectId: number, ndtData: Omit<NDTRequest, 'id' | 'created_at'>): Promise<NDTRequest> {
    const response = await axios.post('/structure/ndt-requests', { ...ndtData, project_id: projectId });
    return response.data;
  }

  static async updateNDTRequest(projectId: number, ndtId: number, payload: Partial<NDTRequest>): Promise<NDTRequest> {
    const response = await axios.put(`/structure/ndt-requests/${ndtId}`, { ...payload, project_id: projectId });
    return response.data;
  }

  static async updateNDTRequestStatus(projectId: number, ndtId: number, status: string): Promise<void> {
    await axios.put(`/structure/ndt-requests/${ndtId}/status`, { status, project_id: projectId });
  }

  static async deleteNDTRequest(projectId: number, ndtId: number): Promise<void> {
    await axios.delete(`/structure/ndt-requests/${ndtId}`, { params: { project_id: projectId } });
  }

  // =========================================================================
  // NDT Tests
  // =========================================================================
  static async getNDTTests(projectId: number, finalId?: number): Promise<NDTTest[]> {
    const params = { project_id: projectId, ...(finalId && { final_id: finalId }) };
    const response = await axios.get('/structure/ndt-tests', { params });
    return response.data;
  }

  static async createNDTTest(projectId: number, payload: Omit<NDTTest, 'id' | 'created_at'>): Promise<NDTTest> {
    const response = await axios.post('/structure/ndt-tests', { ...payload, project_id: projectId });
    return response.data;
  }

  static async updateNDTTest(projectId: number, id: number, payload: Partial<NDTTest>): Promise<NDTTest> {
    const response = await axios.put(`/structure/ndt-tests/${id}`, { ...payload, project_id: projectId });
    return response.data;
  }

  static async deleteNDTTest(projectId: number, id: number): Promise<void> {
    await axios.delete(`/structure/ndt-tests/${id}`, { params: { project_id: projectId } });
  }

  // =========================================================================
  // NDT Status Records
  // =========================================================================
  static async getNDTStatus(projectId: number): Promise<NDTStatusRecord[]> {
    const response = await axios.get('/structure/ndt-status', { params: { project_id: projectId } });
    return response.data;
  }

  static async getNDTStatusRecords(projectId: number): Promise<NDTStatusRecord[]> {
    const response = await axios.get('/structure/ndt-status-records', { params: { project_id: projectId } });
    return response.data;
  }

  static async updateNDTStatusRecord(projectId: number, id: number, payload: Partial<{ welder_no: string; weld_size: number; weld_site: string; ndt_type: string; ndt_report_no: string; ndt_result: string; rejected_length: number; test_length: number }>): Promise<any> {
    const response = await axios.put(`/structure/ndt-status-records/${id}`, { ...payload, project_id: projectId });
    return response.data;
  }

  static async ensureNDTStatusRecord(projectId: number, finalId: number): Promise<any> {
    const response = await axios.post('/structure/ndt-status-records/ensure', undefined, { params: { project_id: projectId, final_id: finalId } });
    return response.data;
  }

  static async deleteNDTStatusRecord(projectId: number, id: number): Promise<void> {
    await axios.delete(`/structure/ndt-status-records/${id}`, { params: { project_id: projectId } });
  }

  static async cleanupOrphanedNDTStatusRecords(projectId: number, dryRun: boolean = true): Promise<{ dry_run: boolean; total_records: number; orphaned_count: number; records: any[] }> {
    const response = await axios.post(`/structure/ndt-status-records/cleanup-orphaned?project_id=${projectId}&dry_run=${dryRun}`);
    return response.data;
  }

  static async backfillNDTStatusRecords(projectId: number): Promise<{ created: number }> {
    const response = await axios.post(`/structure/ndt-status-records/backfill?project_id=${projectId}`);
    return response.data;
  }

  // =========================================================================
  // NDT Requirements
  // =========================================================================
  static async getNDTRequirements(projectId: number): Promise<NDTRequirement[]> {
    const response = await axios.get('/structure/ndt-requirements', { params: { project_id: projectId } });
    return response.data;
  }

  static async createNDTRequirement(projectId: number, payload: Omit<NDTRequirement, 'id' | 'created_at'>): Promise<NDTRequirement> {
    const response = await axios.post('/structure/ndt-requirements', { ...payload, project_id: projectId });
    return response.data;
  }

  static async deleteNDTRequirement(projectId: number, reqId: number): Promise<void> {
    await axios.delete(`/structure/ndt-requirements/${reqId}`, { params: { project_id: projectId } });
  }

  // =========================================================================
  // WPS Register
  // =========================================================================
  static async getWPSRegister(projectId: number): Promise<any[]> {
    const response = await axios.get('/wps-register', { params: { project_id: projectId } });
    return response.data;
  }

  static async createWPSRegister(projectId: number, payload: any): Promise<any> {
    const response = await axios.post('/wps-register', { ...payload, project_id: projectId });
    return response.data;
  }

  static async updateWPSRegister(projectId: number, id: number, payload: any): Promise<any> {
    const response = await axios.put(`/wps-register/${id}`, { ...payload, project_id: projectId });
    return response.data;
  }

  static async deleteWPSRegister(projectId: number, id: number): Promise<void> {
    await axios.delete(`/wps-register/${id}`, { params: { project_id: projectId } });
  }

  // =========================================================================
  // Welder Register
  // =========================================================================
  static async getWelderRegister(projectId: number): Promise<any[]> {
    const response = await axios.get('/welder-register', { params: { project_id: projectId } });
    return response.data;
  }

  static async createWelderRegister(projectId: number, payload: any): Promise<any> {
    const response = await axios.post('/welder-register', { ...payload, project_id: projectId });
    return response.data;
  }

  static async updateWelderRegister(projectId: number, id: number, payload: any): Promise<any> {
    const response = await axios.put(`/welder-register/${id}`, { ...payload, project_id: projectId });
    return response.data;
  }

  static async deleteWelderRegister(projectId: number, id: number): Promise<void> {
    await axios.delete(`/welder-register/${id}`, { params: { project_id: projectId } });
  }

  // =========================================================================
  // Audit Logs (Admin-only, cross-project)
  // =========================================================================
  static async getAuditLogDates(): Promise<string[]> {
    const response = await axios.get('/audit-logs/dates');
    return response.data;
  }

  static async getAuditLogByDate(date: string): Promise<string> {
    const response = await axios.get(`/audit-logs/${date}`, { responseType: 'text' });
    return response.data;
  }

  // =========================================================================
  // AI Services
  // =========================================================================
  static async getAIStrategyCapabilities(): Promise<AIStrategyCapability[]> {
    const response = await axios.get('/ai/strategy/capabilities');
    return response.data.capabilities;
  }

  static async getAIImplementationPlan(payload: AIImplementationStrategyRequest): Promise<AIImplementationStrategyResponse> {
    const response = await axios.post('/ai/strategy/implementation-plan', payload);
    return response.data;
  }

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

  static async getAIInspectionSummary(projectId: number, inspectionId: number, inspectionType: string): Promise<AISummaryResponse> {
    const response = await axios.get(`/ai/inspection-summary/${inspectionId}`, {
      params: { project_id: projectId, inspection_type: inspectionType }
    });
    return response.data;
  }

  static async sendChatMessage(projectId: number, message: string, history: any[] = [], contextData: any = null): Promise<any> {
    const response = await axios.post('/ai/chat', {
      project_id: projectId,
      message: message,
      messages: history,
      context_data: contextData
    });
    return response.data;
  }

  // =========================================================================
  // NDT Sync Services
  // =========================================================================
  static async syncNDTStatus(projectId: number): Promise<{
    synced_count: number;
    skipped_count: number;
    details: Array<{
      joint_id: number;
      draw_no: string;
      joint_no: string;
      ndt_type: string;
      ndt_report_no: string;
      ndt_result: string;
      status: string;
    }>;
  }> {
    const response = await axios.post(`/ndt-sync/sync/${projectId}`);
    return response.data;
  }

  static async autoSyncNDTStatus(projectId: number): Promise<{
    success: boolean;
    project_id: number;
    project_name: string;
    total_joints: number;
    synced_joints: number;
    failed_joints: number;
    details: Array<{
      joint_id: number;
      draw_no: string;
      joint_no: string;
      ndt_type: string;
      ndt_report_no: string;
      ndt_result: string;
      status: string;
    }>;
    skipped_joints: number;
    synced_count: number;
    skipped_count: number;
  }> {
    const response = await axios.post(`/ndt-sync/auto-sync/${projectId}`);
    return response.data;
  }

  static async getNDTSyncStatus(projectId: number): Promise<{
    last_sync: string | null;
    total_joints: number;
    synced_joints: number;
    pending_joints: number;
    sync_status: string;
  }> {
    const response = await axios.get(`/ndt-sync/status/${projectId}`);
    return response.data;
  }

  // =========================================================================
  // Structure-prefixed wrappers (backward compatibility)
  // =========================================================================

  // Master Joint List
  static async getStructureMasterJointList(projectId: number, structureCategory?: string, pageNo?: string, excludeWithFitup?: boolean, blockNo?: string, jointNo?: string): Promise<any[]> {
    const params: any = { project_id: projectId };
    if (structureCategory) params.structure_category = structureCategory;
    if (pageNo) params.page_no = pageNo;
    if (excludeWithFitup) params.exclude_with_fitup = excludeWithFitup;
    if (blockNo) params.block_no = blockNo;
    if (jointNo) params.joint_no = jointNo;
    const response = await axios.get('/structure/master-joint-list', { params });
    return response.data;
  }
  static async createStructureMasterJointList(projectId: number, masterJointData: any): Promise<any> {
    return ApiService.createMasterJointList(projectId, masterJointData);
  }
  static async updateStructureMasterJointList(projectId: number, masterJointId: number, masterJointData: any): Promise<any> {
    return ApiService.updateMasterJointList(projectId, masterJointId, masterJointData);
  }
  static async deleteStructureMasterJointList(projectId: number, masterJointId: number): Promise<void> {
    return ApiService.deleteMasterJointList(projectId, masterJointId);
  }
  static async uploadStructureMasterJointList(projectId: number, file: File): Promise<any> {
    return ApiService.uploadMasterJointList(projectId, file);
  }

  // Material Register
  static async getStructureMaterialInspections(projectId: number): Promise<any[]> {
    return ApiService.getMaterialRegister(projectId);
  }
  static async createStructureMaterialInspection(projectId: number, inspectionData: any): Promise<any> {
    return ApiService.createMaterialRegister(projectId, inspectionData);
  }

  // Fit-up Inspection
  static async getStructureFitUpInspections(projectId: number): Promise<any[]> {
    return ApiService.getFitUpInspections(projectId);
  }
  static async getStructureFitUpFilters(projectId: number): Promise<any> {
    return ApiService.getFitUpFilters(projectId);
  }
  static async getStructureFitUpPendingFinal(projectId: number): Promise<any[]> {
    return ApiService.getPendingFinal(projectId);
  }
  static async createStructureFitUpInspection(projectId: number, fitupData: any): Promise<any> {
    return ApiService.createFitUpInspection(projectId, fitupData);
  }
  static async updateStructureFitUpInspection(projectId: number, fitupId: number, fitupData: any): Promise<any> {
    return ApiService.updateFitUpInspection(projectId, fitupId, fitupData);
  }
  static async deleteStructureFitUpInspection(projectId: number, fitupId: number): Promise<void> {
    return ApiService.deleteFitUpInspection(projectId, fitupId);
  }
  static async syncStructureFitUpMaterials(projectId: number, fitupIds?: number[]): Promise<{ message: string; updated_count: number }> {
    return ApiService.syncFitUpMaterials(projectId, fitupIds);
  }
  static async bulkCreateOrUpdateStructureFitUpFromMasterJoints(projectId: number, masterJointIds: number[]): Promise<any> {
    return ApiService.bulkCreateOrUpdateFitUpFromMasterJoints(projectId, masterJointIds);
  }

  // Final Inspection
  static async getStructureFinalInspections(projectId: number): Promise<any[]> {
    return ApiService.getFinalInspections(projectId);
  }
  static async getStructureFinalFilters(projectId: number): Promise<any> {
    return ApiService.getFinalFilters(projectId);
  }
  static async createStructureFinalInspection(projectId: number, finalData: any): Promise<any> {
    return ApiService.createFinalInspection(projectId, finalData);
  }
  static async updateStructureFinalInspection(projectId: number, finalId: number, finalData: any): Promise<any> {
    return ApiService.updateFinalInspection(projectId, finalId, finalData);
  }
  static async deleteStructureFinalInspection(projectId: number, finalId: number): Promise<void> {
    return ApiService.deleteFinalInspection(projectId, finalId);
  }
  static async bulkCreateStructureFinalInspectionsFromFitup(projectId: number, fitupIds: number[]): Promise<any> {
    return ApiService.bulkCreateFinalInspectionsFromFitup(projectId, fitupIds);
  }
  static async bulkUpdateStructureFinalInspections(projectId: number, finalIds: number[], updateData: any): Promise<any> {
    return ApiService.bulkUpdateFinalInspections(projectId, finalIds, updateData);
  }

  // NDT Requests
  static async getStructureNDTRequests(projectId: number, status?: string): Promise<any[]> {
    return ApiService.getNDTRequests(projectId, status);
  }
  static async createStructureNDTRequest(projectId: number, ndtData: any): Promise<any> {
    return ApiService.createNDTRequest(projectId, ndtData);
  }
  static async updateStructureNDTRequest(projectId: number, ndtId: number, payload: any): Promise<any> {
    return ApiService.updateNDTRequest(projectId, ndtId, payload);
  }
  static async updateStructureNDTStatus(projectId: number, ndtId: number, status: string): Promise<void> {
    return ApiService.updateNDTRequestStatus(projectId, ndtId, status);
  }
  static async deleteStructureNDTRequest(projectId: number, ndtId: number): Promise<void> {
    return ApiService.deleteNDTRequest(projectId, ndtId);
  }

  // NDT Tests
  static async getStructureNDTTests(projectId: number, finalId?: number): Promise<any[]> {
    return ApiService.getNDTTests(projectId, finalId);
  }
  static async createStructureNDTTest(projectId: number, payload: any): Promise<any> {
    return ApiService.createNDTTest(projectId, payload);
  }
  static async updateStructureNDTTest(projectId: number, id: number, payload: any): Promise<any> {
    return ApiService.updateNDTTest(projectId, id, payload);
  }
  static async deleteStructureNDTTest(projectId: number, id: number): Promise<void> {
    return ApiService.deleteNDTTest(projectId, id);
  }

  // NDT Status Records
  static async getStructureNDTStatus(projectId: number): Promise<any[]> {
    return ApiService.getNDTStatus(projectId);
  }
  static async getStructureNDTStatusRecords(projectId: number): Promise<any[]> {
    return ApiService.getNDTStatusRecords(projectId);
  }
  static async updateStructureNDTStatusRecord(projectId: number, id: number, payload: any): Promise<any> {
    return ApiService.updateNDTStatusRecord(projectId, id, payload);
  }
  static async ensureStructureNDTStatusRecord(projectId: number, finalId: number): Promise<any> {
    return ApiService.ensureNDTStatusRecord(projectId, finalId);
  }
  static async deleteStructureNDTStatusRecord(projectId: number, id: number): Promise<void> {
    return ApiService.deleteNDTStatusRecord(projectId, id);
  }

  // NDT Requirements
  static async getStructureNDTRequirements(projectId: number): Promise<any[]> {
    return ApiService.getNDTRequirements(projectId);
  }
  static async createStructureNDTRequirement(projectId: number, payload: any): Promise<any> {
    return ApiService.createNDTRequirement(projectId, payload);
  }
}

export default ApiService;
