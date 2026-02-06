import React, { useState, useEffect, useMemo } from 'react';
import {
  Container,
  Typography,
  Box,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  CircularProgress,
  Alert,
  Card,
  CardContent,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Checkbox
} from '@mui/material';
import { Assignment, Refresh, Add, Edit, Delete } from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import ApiService from '../../services/api';
import { FitUpInspection as FitUpInspectionType, MaterialRegister as MaterialRegisterType, MasterJointList as MasterJointListType } from '../../types';

type NewFitUpInspection = Omit<FitUpInspectionType, 'id' | 'project_id' | 'created_at' | 'updated_at'> & {
  inspection_category?: 'type-I' | 'type-II' | 'type-III' | 'Special';
};

const FitUpInspection: React.FC = () => {
  const { selectedProject, user, canEdit, canDelete, isAdmin } = useAuth();
  const [records, setRecords] = useState<FitUpInspectionType[]>([]);
  const [materials, setMaterials] = useState<MaterialRegisterType[]>([]);
  const [masterJoints, setMasterJoints] = useState<MasterJointListType[]>([]);
  const [selectedRows, setSelectedRows] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<FitUpInspectionType | null>(null);
  const [formData, setFormData] = useState<NewFitUpInspection>({
    block_no: '',
    spool_no: '',
    system_no: '', // used for Structure Category
    line_no: '', // used for Page No
    joint_no: '',
    weld_type: '',
    part1_piece_mark_no: '',
    part2_piece_mark_no: '',
    part1_material_type: '',
    part1_grade: '',
    part1_thickness: '',
    part1_heat_no: '',
    part2_material_type: '',
    part2_grade: '',
    part2_thickness: '',
    part2_heat_no: '',
    weld_site: '',
    weld_length: 0,
    fit_up_date: '',
    fit_up_report_no: '',
    fit_up_result: '',
    remarks: '',
    master_joint_id: undefined,
    inspection_category: 'type-I'
  });
  
  const [search, setSearch] = useState({
    system_no: '',
    spool_no: '',
    joint_no: '',
    fit_up_report_no: '',
    fit_up_result: ''
  });
  const [filterOptions, setFilterOptions] = useState<{ system_no: string[]; spool_no: string[]; joint_no: string[]; fit_up_report_no: string[]; fit_up_result: string[] }>({
    system_no: [], spool_no: [], joint_no: [], fit_up_report_no: [], fit_up_result: []
  });
  const [editGroupIds, setEditGroupIds] = useState<number[]>([]);
  const [editGroupIndex, setEditGroupIndex] = useState<number>(0);
  const [editingRows, setEditingRows] = useState<Set<number>>(new Set());
  const [editData, setEditData] = useState<Record<number, Partial<FitUpInspectionType>>>({});
  const [isInlineEditMode, setIsInlineEditMode] = useState(false);
  const [bulkCreateDialogOpen, setBulkCreateDialogOpen] = useState(false);
  const [bulkCreateLoading, setBulkCreateLoading] = useState(false);
  const [bulkCreateResult, setBulkCreateResult] = useState<{
    message: string;
    created_count: number;
    skipped_count: number;
    created_finals: any[];
    errors?: string[];
  } | null>(null);
  
  // Inline edit handlers
  const handleInlineEditChange = (id: number, field: keyof FitUpInspectionType, value: any) => {
    setEditData(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: value
      }
    }));
  };
  
  const handleSaveInlineEdits = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const updates = Object.entries(editData).map(([id, data]) => ({
        id: parseInt(id),
        data
      }));
      
      // Update each record individually
      for (const update of updates) {
        const record = records.find(r => r.id === update.id);
        if (record) {
          const payload = {
            ...record,
            ...update.data
          };
          await ApiService.updateFitUpInspection(update.id, payload);
        }
      }
      
      // Refresh records and exit edit mode
      await fetchFitUpRecords();
      setEditingRows(new Set());
      setEditData({});
      setIsInlineEditMode(false);
    } catch (err: any) {
      setError(getErrorMessage(err, 'Failed to save inline edits'));
      console.error('Error saving inline edits:', err);
    } finally {
      setLoading(false);
    }
  };
  
  const handleCancelInlineEdits = () => {
    setEditingRows(new Set());
    setEditData({});
    setIsInlineEditMode(false);
  };

  const fetchFitUpRecords = async () => {
    if (!selectedProject) {
      setError('No project selected. Please select a project first.');
      return;
    }
    
    setLoading(true);
    setError(null);
    try {
      const data = await ApiService.getFitUpInspections(selectedProject.id);
      setRecords(data);
      try {
        const opts = await ApiService.getFitUpFilters(selectedProject.id);
        setFilterOptions(opts || { system_no: [], spool_no: [], joint_no: [], fit_up_report_no: [], fit_up_result: [] });
      } catch {}
    } catch (err: any) {
      console.error('Error fetching fit-up records:', err);
      
      // More detailed error messages
      if (err.code === 'ERR_NETWORK' || err.message?.includes('Network Error')) {
        setError('Cannot connect to the server. Please check if the backend server is running on port 8000.');
      } else if (err.response?.status === 401) {
        setError('Your session has expired. Please log in again.');
      } else if (err.response?.status === 403) {
        setError('Access denied. You do not have permission to view fit-up records for this project.');
      } else if (err.response?.status === 404) {
        setError('Fit-up records not found for this project.');
      } else if (err.response?.status === 500) {
        setError('Server error. Please try again later or contact support.');
      } else if (err.response?.data?.detail) {
        setError(`Error: ${err.response.data.detail}`);
      } else {
        setError(`Failed to fetch fit-up records. ${err.message || 'Please check your connection and try again.'}`);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFitUpRecords();
    const loadMaterials = async () => {
      if (!selectedProject) return;
      try {
        const data = await ApiService.getMaterialRegister(selectedProject.id);
        setMaterials(data || []);
      } catch {}
    };
    loadMaterials();
    const loadMasterJoints = async () => {
      if (!selectedProject) return;
      try {
        const joints = await ApiService.getMasterJointList(selectedProject.id);
        setMasterJoints(joints || []);
      } catch {}
    };
    loadMasterJoints();
  }, [selectedProject]);

  // Filter master joints to exclude those with "accepted" fit-up results
  const getFilteredMasterJoints = useMemo(() => {
    if (!masterJoints.length || !records.length) return masterJoints;
    
    // Create a set of master joint IDs that already have fit-up inspections with "accepted" result
    const acceptedMasterJointIds = new Set(
      records
        .filter(record => (record.fit_up_result || '').toLowerCase() === 'accepted')
        .map(record => record.master_joint_id)
        .filter(id => id && id > 0)
    );
    
    // Also create a set of joint identifiers that have "accepted" fit-up inspections
    const acceptedJointKeys = new Set(
      records
        .filter(record => (record.fit_up_result || '').toLowerCase() === 'accepted')
        .map(record => 
          `${(record.system_no || '').trim()}-${(record.line_no || '').trim()}-${(record.spool_no || '').trim()}-${(record.joint_no || '').trim()}`
        )
        .filter(key => key !== '---')
    );
    
    // Filter out master joints that already have "accepted" fit-up inspections
    const filtered = masterJoints.filter(master => {
      // Exclude if master joint ID is in accepted set
      if (acceptedMasterJointIds.has(master.id)) return false;
      
      // Also exclude if joint identifiers match and have "accepted" result
      const jointKey = `${(master.structure_category || '').trim()}-${(master.page_no || '').trim()}-${(master.draw_no || '').trim()}-${(master.joint_no || '').trim()}`;
      if (jointKey !== '---' && acceptedJointKeys.has(jointKey)) return false;
      
      return true;
    });
    
    // Sort by joint identifiers for easier finding
    return filtered.sort((a, b) => {
      const keyA = `${(a.structure_category || '').trim()}-${(a.page_no || '').trim()}-${(a.draw_no || '').trim()}-${(a.joint_no || '').trim()}`;
      const keyB = `${(b.structure_category || '').trim()}-${(b.page_no || '').trim()}-${(b.draw_no || '').trim()}-${(b.joint_no || '').trim()}`;
      return keyA.localeCompare(keyB);
    });
  }, [masterJoints, records]);

  // Calculate lower thickness between part1 and part2
  const calculateLowerThickness = (record: FitUpInspectionType): string => {
    const thickness1 = parseFloat(record.part1_thickness || '0');
    const thickness2 = parseFloat(record.part2_thickness || '0');
    
    // Return the lower thickness, or the non-zero one if only one exists
    if (thickness1 > 0 && thickness2 > 0) {
      return Math.min(thickness1, thickness2).toString();
    } else if (thickness1 > 0) {
      return thickness1.toString();
    } else if (thickness2 > 0) {
      return thickness2.toString();
    }
    return '';
  };

  // Handler functions
  const keyFor = (obj: { structure_category?: string; page_no?: string; draw_no?: string; joint_no?: string }) =>
    `${(obj.structure_category||'').trim()}-${(obj.page_no||'').trim()}-${(obj.draw_no||'').trim()}-${(obj.joint_no||'').trim()}`;

  const handleAddClick = () => {
    setFormData({
      block_no: '',
      system_no: '',
      line_no: '',
      spool_no: '',
      joint_no: '',
      weld_type: '',
      part1_piece_mark_no: '',
      part2_piece_mark_no: '',
      part1_material_type: '',
      part1_grade: '',
      part1_thickness: '',
      part1_heat_no: '',
      part2_material_type: '',
      part2_grade: '',
      part2_thickness: '',
      part2_heat_no: '',
      weld_site: '',
      weld_length: 0,
      fit_up_date: '',
      fit_up_report_no: '',
      fit_up_result: '',
      remarks: '',
      master_joint_id: undefined,
      inspection_category: 'type-I'
    });
    setAddDialogOpen(true);
  };

  const handleEditClick = (record: FitUpInspectionType) => {
    // If multiple rows are selected, enter inline edit mode
    if (selectedRows.length > 1 && selectedRows.includes(record.id)) {
      // Enter inline edit mode for all selected rows
      setEditingRows(new Set(selectedRows));
      const initialEditData: Record<number, Partial<FitUpInspectionType>> = {};
      selectedRows.forEach(id => {
        const rowRecord = records.find(r => r.id === id);
        if (rowRecord) {
          initialEditData[id] = {
            fit_up_date: rowRecord.fit_up_date,
            fit_up_report_no: rowRecord.fit_up_report_no,
            fit_up_result: rowRecord.fit_up_result,
            inspection_category: rowRecord.inspection_category
          };
        }
      });
      setEditData(initialEditData);
      setIsInlineEditMode(true);
      return;
    }
    
    // Single row edit - open dialog (existing behavior)
    const groupIds =
      selectedRows.includes(record.id) && selectedRows.length > 0
        ? selectedRows
        : [record.id];
    setEditGroupIds(groupIds);
    const idx = groupIds.indexOf(record.id);
    setEditGroupIndex(idx >= 0 ? idx : 0);
    setSelectedRecord(record);
    setFormData({
      block_no: record.block_no || '',
      system_no: record.system_no || '',
      line_no: record.line_no || '',
      spool_no: record.spool_no || '',
      joint_no: record.joint_no || '',
      weld_type: record.weld_type || '',
      part1_piece_mark_no: record.part1_piece_mark_no || '',
      part2_piece_mark_no: record.part2_piece_mark_no || '',
      part1_material_type: record.part1_material_type || '',
      part1_grade: record.part1_grade || '',
      part1_thickness: record.part1_thickness || '',
      part1_heat_no: record.part1_heat_no || '',
      part2_material_type: record.part2_material_type || '',
      part2_grade: record.part2_grade || '',
      part2_thickness: record.part2_thickness || '',
      part2_heat_no: record.part2_heat_no || '',
      weld_site: record.weld_site || '',
      weld_length: record.weld_length || 0,
      fit_up_date: record.fit_up_date || '',
      fit_up_report_no: record.fit_up_report_no || '',
      fit_up_result: record.fit_up_result || '',
      remarks: record.remarks || '',
      master_joint_id: record.master_joint_id,
      inspection_category: record.inspection_category || 'type-I'
    });
    setEditDialogOpen(true);
  };

  const lookupMaterial = async (piece: string) => {
    if (!selectedProject) return null;
    if (!piece) return null;
    try {
      const res = await ApiService.lookupMaterialByPieceMark(piece, selectedProject.id);
      return res;
    } catch {
      return null;
    }
  };

  const applyMaterial = (which: 1 | 2, piece: string) => {
    const m = materials.find(x => (x.piece_mark_no || '').trim() === piece.trim());
    if (!m) return;
    if (which === 1) {
      setFormData({
        ...formData,
        part1_piece_mark_no: piece,
        part1_material_type: m.material_type || '',
        part1_grade: m.grade || '',
        part1_thickness: m.thickness || '',
        part1_heat_no: m.heat_no || ''
      });
    } else {
      setFormData({
        ...formData,
        part2_piece_mark_no: piece,
        part2_material_type: m.material_type || '',
        part2_grade: m.grade || '',
        part2_thickness: m.thickness || '',
        part2_heat_no: m.heat_no || ''
      });
    }
  };

  const findMasterByForm = () => {
    return masterJoints.find(m =>
      (m.structure_category||'').trim() === (formData.system_no||'').trim() &&
      (m.page_no||'').trim() === (formData.line_no||'').trim() &&
      (m.draw_no||'').trim() === (formData.spool_no||'').trim() &&
      (m.joint_no||'').trim() === (formData.joint_no||'').trim()
    );
  };

  const applyMasterJoint = (jointId: number) => {
    const mj = masterJoints.find(j => j.id === jointId);
    if (!mj) return;
    
    // Create updated form data with master joint information
    const updatedFormData = {
      ...formData,
      block_no: mj.block_no || '',
      system_no: mj.structure_category || '',
      line_no: mj.page_no || '',
      spool_no: mj.draw_no || '',
      joint_no: mj.joint_no || '',
      weld_type: mj.weld_type || '',
      weld_length: mj.weld_length || 0,
      master_joint_id: mj.id,
      part1_piece_mark_no: mj.part1_piece_mark_no || '',
      part2_piece_mark_no: mj.part2_piece_mark_no || '',
      inspection_category: mj.inspection_category || 'type-I'
    };
    
    // Look up material details for piece marks
    if (mj.part1_piece_mark_no) {
      const material1 = materials.find(m => (m.piece_mark_no || '').trim() === (mj.part1_piece_mark_no || '').trim());
      if (material1) {
        updatedFormData.part1_material_type = material1.material_type || '';
        updatedFormData.part1_grade = material1.grade || '';
        updatedFormData.part1_thickness = material1.thickness || '';
        updatedFormData.part1_heat_no = material1.heat_no || '';
      }
    }
    
    if (mj.part2_piece_mark_no) {
      const material2 = materials.find(m => (m.piece_mark_no || '').trim() === (mj.part2_piece_mark_no || '').trim());
      if (material2) {
        updatedFormData.part2_material_type = material2.material_type || '';
        updatedFormData.part2_grade = material2.grade || '';
        updatedFormData.part2_thickness = material2.thickness || '';
        updatedFormData.part2_heat_no = material2.heat_no || '';
      }
    }
    
    setFormData(updatedFormData);
  };

  const handleDeleteClick = (record: FitUpInspectionType) => {
    setSelectedRecord(record);
    setDeleteDialogOpen(true);
  };

  const getErrorMessage = (err: any, fallback: string) => {
    const detail = err?.response?.data?.detail;
    if (typeof detail === 'string') {
      return detail;
    }
    if (Array.isArray(detail)) {
      const parts = detail.map((d: any) => d?.msg || JSON.stringify(d));
      return parts.join('; ');
    }
    if (detail && typeof detail === 'object') {
      if (detail.msg && typeof detail.msg === 'string') {
        return detail.msg;
      }
      try {
        return JSON.stringify(detail);
      } catch {
      }
    }
    if (err?.message && typeof err.message === 'string') {
      return err.message;
    }
    return fallback;
  };

  const handleAddSubmit = async () => {
    try {
      const mj = findMasterByForm();
      const payload: any = {
        ...formData,
        project_id: selectedProject!.id,
        master_joint_id: mj?.id,
        remarks: mj ? formData.remarks : `${formData.remarks ? formData.remarks + ' • ' : ''}Not in master joint list`
      };
      if (!payload.fit_up_date) {
        delete payload.fit_up_date;
      } else {
        try {
          payload.fit_up_date = new Date(payload.fit_up_date).toISOString();
        } catch {
          delete payload.fit_up_date;
        }
      }
      await ApiService.createFitUpInspection(payload);
      setAddDialogOpen(false);
      fetchFitUpRecords();
    } catch (err: any) {
      setError(getErrorMessage(err, 'Failed to create fit-up record'));
      console.error('Error creating fit-up record:', err);
    }
  };

  const handleEditSubmit = async () => {
    if (!selectedRecord) return;
    
    try {
      const mj = findMasterByForm();
      const payload: any = {
        ...formData,
        master_joint_id: mj?.id,
        remarks: mj ? formData.remarks : `${formData.remarks ? formData.remarks + ' • ' : ''}Not in master joint list`
      };
      if (!payload.fit_up_date) {
        delete payload.fit_up_date;
      } else {
        try {
          payload.fit_up_date = new Date(payload.fit_up_date).toISOString();
        } catch {
          delete payload.fit_up_date;
        }
      }
      await ApiService.updateFitUpInspection(selectedRecord.id, payload);
      const groupSize = editGroupIds.length;
      const currentIndex = editGroupIndex;
      const hasNext = groupSize > 0 && currentIndex < groupSize - 1;
      if (hasNext) {
        const nextId = editGroupIds[currentIndex + 1];
        const nextRecord = records.find(r => r.id === nextId);
        if (nextRecord) {
          setSelectedRecord(nextRecord);
          setFormData({
            block_no: nextRecord.block_no || '',
            system_no: nextRecord.system_no || '',
            line_no: nextRecord.line_no || '',
            spool_no: nextRecord.spool_no || '',
            joint_no: nextRecord.joint_no || '',
            weld_type: nextRecord.weld_type || '',
            part1_piece_mark_no: nextRecord.part1_piece_mark_no || '',
            part2_piece_mark_no: nextRecord.part2_piece_mark_no || '',
            part1_material_type: nextRecord.part1_material_type || '',
            part1_grade: nextRecord.part1_grade || '',
            part1_thickness: nextRecord.part1_thickness || '',
            part1_heat_no: nextRecord.part1_heat_no || '',
            part2_material_type: nextRecord.part2_material_type || '',
            part2_grade: nextRecord.part2_grade || '',
            part2_thickness: nextRecord.part2_thickness || '',
            part2_heat_no: nextRecord.part2_heat_no || '',
            weld_site: nextRecord.weld_site || '',
            weld_length: nextRecord.weld_length || 0,
            fit_up_date: nextRecord.fit_up_date || '',
            fit_up_report_no: nextRecord.fit_up_report_no || '',
            fit_up_result: nextRecord.fit_up_result || '',
            remarks: nextRecord.remarks || '',
            master_joint_id: nextRecord.master_joint_id,
            inspection_category: nextRecord.inspection_category || 'type-I'
          });
          setEditGroupIndex(currentIndex + 1);
        } else {
          setEditDialogOpen(false);
          setSelectedRecord(null);
          setEditGroupIds([]);
          setEditGroupIndex(0);
          fetchFitUpRecords();
        }
      } else {
        setEditDialogOpen(false);
        setSelectedRecord(null);
        setEditGroupIds([]);
        setEditGroupIndex(0);
        fetchFitUpRecords();
      }
    } catch (err: any) {
      setError(getErrorMessage(err, 'Failed to update fit-up record'));
      console.error('Error updating fit-up record:', err);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!selectedRecord) return;
    
    try {
      await ApiService.deleteFitUpInspection(selectedRecord.id);
      setDeleteDialogOpen(false);
      setSelectedRecord(null);
      fetchFitUpRecords();
    } catch (err: any) {
      setError(getErrorMessage(err, 'Failed to delete fit-up record'));
      console.error('Error deleting fit-up record:', err);
    }
  };

  // Bulk create final inspections from selected fit-up records
  const handleBulkCreateFinalInspections = async () => {
    if (selectedRows.length === 0) {
      setError('Please select at least one fit-up record to create final inspections.');
      return;
    }

    // Filter only accepted fit-up records
    const acceptedFitupIds = records
      .filter(record => selectedRows.includes(record.id) && 
        (record.fit_up_result || '').toLowerCase() === 'accepted')
      .map(record => record.id);

    if (acceptedFitupIds.length === 0) {
      setError('Only fit-up records with "Accepted" result can be used to create final inspections.');
      return;
    }

    setBulkCreateLoading(true);
    setError(null);
    
    try {
      const result = await ApiService.bulkCreateFinalInspectionsFromFitup(acceptedFitupIds);
      setBulkCreateResult(result);
      setBulkCreateDialogOpen(true);
      
      // Clear selection after successful creation
      setSelectedRows([]);
      
      // Show success message
      if (result.created_count > 0) {
        setError(null);
      }
    } catch (err: any) {
      setError(getErrorMessage(err, 'Failed to create final inspections'));
      console.error('Error creating final inspections:', err);
    } finally {
      setBulkCreateLoading(false);
    }
  };

  const getStatusColor = (result?: string) => {
    switch (result?.toLowerCase()) {
      case 'accepted':
        return 'success';
      case 'rejected':
        return 'error';
      case 'pending':
        return 'warning';
      default:
        return 'default';
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return dateString;
    }
  };

  const filteredRecords = records.filter(r => {
    const sys = (r.system_no || '').trim();
    const spool = (r.spool_no || '').trim();
    const joint = (r.joint_no || '').trim();
    const rep = (r.fit_up_report_no || '').trim();
    const res = (r.fit_up_result || '').trim().toLowerCase();
    const qs = search.system_no.trim();
    const qsp = search.spool_no.trim();
    const qj = search.joint_no.trim();
    const qr = search.fit_up_report_no.trim();
    const qres = search.fit_up_result.trim().toLowerCase();
    return (!qs || sys === qs) && (!qsp || spool === qsp) && (!qj || joint === qj) && (!qr || rep === qr) && (!qres || res === qres);
  });

  const downloadCSV = () => {
    const headers = [
      'Block No',
      'Drawing No',
      'Structure Category',
      'Page No',
      'Joint',
      'Weld Type',
      'Piece Mark 1',
      'Piece Mark 2',
      'Weld Site',
      'Weld Length',
      'Thickness',
      'Fit Up Date',
      'Fit-up Report No',
      'Fit Up Result',
      'Master Link'
    ];
    const rows = filteredRecords.map(record => {
      const inMaster = masterJoints.length > 0 ? (
        masterJoints.some(m =>
          (m.structure_category||'').trim() === (record.system_no||'').trim() &&
          (m.page_no||'').trim() === (record.line_no||'').trim() &&
          (m.draw_no||'').trim() === (record.spool_no||'').trim() &&
          (m.joint_no||'').trim() === (record.joint_no||'').trim()
        )
      ) : false;
      const masterLink = masterJoints.length === 0 ? '-' : (inMaster ? 'In Master' : 'Not in Master');
      const lengthStr = record.weld_length ? `${record.weld_length} mm` : '';
      const dateStr = formatDate(record.fit_up_date);
      const thickness = calculateLowerThickness(record);
      return [
        record.block_no || '',
        record.spool_no || '', // Drawing No
        record.system_no || '', // Structure Category
        record.line_no || '', // Page No
        record.joint_no || '',
        record.weld_type || '',
        record.part1_piece_mark_no || '',
        record.part2_piece_mark_no || '',
        record.weld_site || '',
        lengthStr,
        thickness || '',
        dateStr,
        record.fit_up_report_no || '',
        record.fit_up_result || '',
        masterLink
      ];
    });
    const escape = (v: string) => {
      const s = String(v ?? '');
      return '"' + s.replace(/\"/g, '""') + '"';
    };
    const csv = [headers.map(h => escape(h)).join(','), ...rows.map(r => r.map((c: any) => escape(String(c))).join(','))].join('\r\n');
    const blob = new Blob(["\ufeff" + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fitup_records_${selectedProject?.code || 'project'}_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!selectedProject) {
    return (
      <Container>
        <Alert severity="info">Please select a project first.</Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth={false} sx={{ mt: 4, mb: 4, px: 2 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Assignment sx={{ fontSize: 40, mr: 2, color: 'primary.main' }} />
          <Box>
            <Typography variant="h4" component="h1" gutterBottom>
              Structure Fit-up Inspection
            </Typography>
            <Typography variant="subtitle1" color="textSecondary">
              {selectedProject.name} ({selectedProject.code})
            </Typography>
          </Box>
        </Box>
        <Box>
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={fetchFitUpRecords}
            disabled={loading}
            sx={{ mr: 2 }}
          >
            Refresh
          </Button>
          <Button
            variant="contained"
            color="secondary"
            onClick={handleBulkCreateFinalInspections}
            disabled={selectedRows.length === 0 || bulkCreateLoading || !canEdit()}
            sx={{ mr: 2 }}
          >
            {bulkCreateLoading ? <CircularProgress size={24} /> : `Create Final (${selectedRows.length})`}
          </Button>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={handleAddClick}
            disabled={!canEdit()}
          >
            Add Fit-up
          </Button>
        </Box>
      </Box>

      {/* Statistics Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Total Records
              </Typography>
              <Typography variant="h4" component="div">
                {records.length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Accepted
              </Typography>
              <Typography variant="h4" component="div" color="success.main">
                {records.filter(r => r.fit_up_result?.toLowerCase() === 'accepted').length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Rejected
              </Typography>
              <Typography variant="h4" component="div" color="error.main">
                {records.filter(r => r.fit_up_result?.toLowerCase() === 'rejected').length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Pending
              </Typography>
              <Typography variant="h4" component="div" color="warning.main">
                {records.filter(r => !r.fit_up_result || r.fit_up_result?.toLowerCase() === 'pending').length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Loading State */}
      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
          <CircularProgress />
        </Box>
      )}

      <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={2.4 as any}>
            <FormControl fullWidth>
              <InputLabel>Structure Category</InputLabel>
              <Select
                label="Structure Category"
                value={search.system_no}
                onChange={(e) => setSearch({ ...search, system_no: String(e.target.value) })}
              >
                <MenuItem value="">All</MenuItem>
                {filterOptions.system_no.map(v => (
                  <MenuItem key={v} value={v}>{v}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6} md={2.4 as any}>
            <FormControl fullWidth>
              <InputLabel>Drawing No</InputLabel>
              <Select
                label="Drawing No"
                value={search.spool_no}
                onChange={(e) => setSearch({ ...search, spool_no: String(e.target.value) })}
              >
                <MenuItem value="">All</MenuItem>
                {filterOptions.spool_no.map(v => (
                  <MenuItem key={v} value={v}>{v}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6} md={2.4 as any}>
            <FormControl fullWidth>
              <InputLabel>Joint No</InputLabel>
              <Select
                label="Joint No"
                value={search.joint_no}
                onChange={(e) => setSearch({ ...search, joint_no: String(e.target.value) })}
              >
                <MenuItem value="">All</MenuItem>
                {filterOptions.joint_no.map(v => (
                  <MenuItem key={v} value={v}>{v}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6} md={2.4 as any}>
            <FormControl fullWidth>
              <InputLabel>Report No</InputLabel>
              <Select
                label="Report No"
                value={search.fit_up_report_no}
                onChange={(e) => setSearch({ ...search, fit_up_report_no: String(e.target.value) })}
              >
                <MenuItem value="">All</MenuItem>
                {filterOptions.fit_up_report_no.map(v => (
                  <MenuItem key={v} value={v}>{v}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6} md={2.4 as any}>
            <FormControl fullWidth>
              <InputLabel>Fit Up Result</InputLabel>
              <Select
                label="Fit Up Result"
                value={search.fit_up_result}
                onChange={(e) => setSearch({ ...search, fit_up_result: String(e.target.value) })}
              >
                <MenuItem value="">All</MenuItem>
                <MenuItem value="pending">Pending</MenuItem>
                <MenuItem value="accepted">Accepted</MenuItem>
                <MenuItem value="rejected">Rejected</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Button
                variant="contained"
                onClick={downloadCSV}
                disabled={filteredRecords.length === 0}
              >
                Download CSV
              </Button>
              <Button
                variant="outlined"
                onClick={() => setSearch({ system_no: '', spool_no: '', joint_no: '', fit_up_report_no: '', fit_up_result: '' })}
              >
                Clear Filters
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* Records Table - Optimized for PC */}
      {!loading && (
        <Paper sx={{ p: 3, boxShadow: 2, width: '100%', overflow: 'hidden' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h6" fontWeight="600">
              Fit-up Records
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Total: <Typography component="span" variant="body2" fontWeight="bold" color="primary.main">{filteredRecords.length}</Typography> records
              </Typography>
              {filteredRecords.length !== records.length && (
                <Chip 
                  label={`Filtered from ${records.length}`} 
                  size="small" 
                  color="info" 
                  variant="outlined"
                />
              )}
              <Typography variant="caption" color="text.secondary">
                Scroll horizontally to view all columns →
              </Typography>
            </Box>
          </Box>
          <Box sx={{ width: '100%', overflowX: 'auto' }}>
            <Table sx={{ minWidth: 1400 }} aria-label="fit-up records table" size="medium">
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox" sx={{ 
                    width: 60, 
                    fontWeight: 600,
                    backgroundColor: 'grey.100',
                    fontSize: '0.875rem',
                    padding: '16px 8px',
                    borderBottom: '2px solid',
                    borderBottomColor: 'primary.main'
                  }} />
                  <TableCell sx={{ 
                    width: 120, 
                    minWidth: 120,
                    fontWeight: 600,
                    backgroundColor: 'grey.100',
                    fontSize: '0.875rem',
                    padding: '16px 16px',
                    borderBottom: '2px solid',
                    borderBottomColor: 'primary.main'
                  }}><strong>Block no</strong></TableCell>
                  <TableCell sx={{ 
                    width: 140, 
                    minWidth: 140,
                    fontWeight: 600,
                    backgroundColor: 'grey.100',
                    fontSize: '0.875rem',
                    padding: '16px 16px',
                    borderBottom: '2px solid',
                    borderBottomColor: 'primary.main'
                  }}><strong>Drawing No</strong></TableCell>
                  <TableCell sx={{ 
                    width: 160, 
                    minWidth: 160,
                    fontWeight: 600,
                    backgroundColor: 'grey.100',
                    fontSize: '0.875rem',
                    padding: '16px 16px',
                    borderBottom: '2px solid',
                    borderBottomColor: 'primary.main'
                  }}><strong>Structure Category</strong></TableCell>
                  <TableCell sx={{ 
                    width: 120, 
                    minWidth: 120,
                    fontWeight: 600,
                    backgroundColor: 'grey.100',
                    fontSize: '0.875rem',
                    padding: '16px 16px',
                    borderBottom: '2px solid',
                    borderBottomColor: 'primary.main'
                  }}><strong>Joint No</strong></TableCell>
                  <TableCell sx={{ 
                    width: 120, 
                    minWidth: 120,
                    fontWeight: 600,
                    backgroundColor: 'grey.100',
                    fontSize: '0.875rem',
                    padding: '16px 16px',
                    borderBottom: '2px solid',
                    borderBottomColor: 'primary.main'
                  }}><strong>Weld Type</strong></TableCell>
                  <TableCell sx={{ 
                    width: 140, 
                    minWidth: 140,
                    fontWeight: 600,
                    backgroundColor: 'grey.100',
                    fontSize: '0.875rem',
                    padding: '16px 16px',
                    borderBottom: '2px solid',
                    borderBottomColor: 'primary.main'
                  }}><strong>Inspection Category</strong></TableCell>
                  <TableCell sx={{ 
                    width: 200, 
                    minWidth: 200,
                    fontWeight: 600,
                    backgroundColor: 'grey.100',
                    fontSize: '0.875rem',
                    padding: '16px 16px',
                    borderBottom: '2px solid',
                    borderBottomColor: 'primary.main'
                  }}><strong>Piece Mark 1</strong></TableCell>
                  <TableCell sx={{ 
                    width: 200, 
                    minWidth: 200,
                    fontWeight: 600,
                    backgroundColor: 'grey.100',
                    fontSize: '0.875rem',
                    padding: '16px 16px',
                    borderBottom: '2px solid',
                    borderBottomColor: 'primary.main'
                  }}><strong>Piece Mark 2</strong></TableCell>
                  <TableCell sx={{ 
                    width: 140, 
                    minWidth: 140,
                    fontWeight: 600,
                    backgroundColor: 'grey.100',
                    fontSize: '0.875rem',
                    padding: '16px 16px',
                    borderBottom: '2px solid',
                    borderBottomColor: 'primary.main'
                  }}><strong>Weld Site</strong></TableCell>
                  <TableCell sx={{ 
                    width: 140, 
                    minWidth: 140,
                    fontWeight: 600,
                    backgroundColor: 'grey.100',
                    fontSize: '0.875rem',
                    padding: '16px 16px',
                    borderBottom: '2px solid',
                    borderBottomColor: 'primary.main'
                  }}><strong>Weld Length</strong></TableCell>
                  <TableCell sx={{ 
                    width: 120, 
                    minWidth: 120,
                    fontWeight: 600,
                    backgroundColor: 'grey.100',
                    fontSize: '0.875rem',
                    padding: '16px 16px',
                    borderBottom: '2px solid',
                    borderBottomColor: 'primary.main'
                  }}><strong>Thickness</strong></TableCell>
                  <TableCell sx={{ 
                    width: 140, 
                    minWidth: 140,
                    fontWeight: 600,
                    backgroundColor: 'grey.100',
                    fontSize: '0.875rem',
                    padding: '16px 16px',
                    borderBottom: '2px solid',
                    borderBottomColor: 'primary.main'
                  }}><strong>Fit Up Date</strong></TableCell>
                  <TableCell sx={{ 
                    width: 160, 
                    minWidth: 160,
                    fontWeight: 600,
                    backgroundColor: 'grey.100',
                    fontSize: '0.875rem',
                    padding: '16px 16px',
                    borderBottom: '2px solid',
                    borderBottomColor: 'primary.main'
                  }}><strong>Fit-up Report No</strong></TableCell>
                  <TableCell sx={{ 
                    width: 140, 
                    minWidth: 140,
                    fontWeight: 600,
                    backgroundColor: 'grey.100',
                    fontSize: '0.875rem',
                    padding: '16px 16px',
                    borderBottom: '2px solid',
                    borderBottomColor: 'primary.main'
                  }}><strong>Fit Up Result</strong></TableCell>
                  <TableCell sx={{ 
                    width: 140, 
                    minWidth: 140,
                    fontWeight: 600,
                    backgroundColor: 'grey.100',
                    fontSize: '0.875rem',
                    padding: '16px 16px',
                    borderBottom: '2px solid',
                    borderBottomColor: 'primary.main'
                  }}><strong>User Update</strong></TableCell>
                  <TableCell sx={{ 
                    width: 140, 
                    minWidth: 140,
                    fontWeight: 600,
                    backgroundColor: 'grey.100',
                    fontSize: '0.875rem',
                    padding: '16px 16px',
                    borderBottom: '2px solid',
                    borderBottomColor: 'primary.main'
                  }}><strong>Master Link</strong></TableCell>
                  <TableCell sx={{ 
                    width: 120, 
                    minWidth: 120,
                    fontWeight: 600,
                    backgroundColor: 'grey.100',
                    fontSize: '0.875rem',
                    padding: '16px 16px',
                    borderBottom: '2px solid',
                    borderBottomColor: 'primary.main'
                  }}><strong>Actions</strong></TableCell>
                </TableRow>
              </TableHead>
            <TableBody>
              {records.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={16} align="center" sx={{ padding: '24px 16px' }}>
                    <Typography variant="body2" color="text.secondary">
                      No fit-up records found for this project.
                    </Typography>
                    <Button
                      variant="outlined"
                      startIcon={<Add />}
                      onClick={handleAddClick}
                      sx={{ mt: 2 }}
                    >
                      Add First Record
                    </Button>
                  </TableCell>
                </TableRow>
              ) : filteredRecords.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={16} align="center" sx={{ padding: '24px 16px' }}>
                    <Typography variant="body2" color="text.secondary">
                      No records match current search.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filteredRecords.map((record) => (
                  <TableRow 
                    key={record.id} 
                    hover 
                    selected={selectedRows.includes(record.id)}
                    sx={{ 
                      '&:hover': {
                        backgroundColor: 'action.hover'
                      }
                    }}
                  >
                    <TableCell padding="checkbox" sx={{ padding: '12px 8px' }}>
                      <Checkbox
                        checked={selectedRows.includes(record.id)}
                        onChange={() => {
                          setSelectedRows(prev =>
                            prev.includes(record.id)
                              ? prev.filter(id => id !== record.id)
                              : [...prev, record.id]
                          );
                        }}
                        size="small"
                      />
                    </TableCell>
                    <TableCell sx={{ padding: '12px 16px', fontSize: '0.875rem' }}>
                      {editingRows.has(record.id) ? (
                        <TextField
                          value={editData[record.id]?.block_no || record.block_no || ''}
                          onChange={(e) => handleInlineEditChange(record.id, 'block_no', e.target.value)}
                          size="small"
                          fullWidth
                          inputProps={{ style: { fontSize: '0.875rem' } }}
                        />
                      ) : (
                        record.block_no || 'N/A'
                      )}
                    </TableCell>
                    <TableCell sx={{ padding: '12px 16px', fontSize: '0.875rem' }}>{record.spool_no || 'N/A'}</TableCell>
                    <TableCell sx={{ padding: '12px 16px', fontSize: '0.875rem' }}>{record.system_no || 'N/A'}</TableCell>
                    <TableCell sx={{ padding: '12px 16px', fontSize: '0.875rem' }}>{record.joint_no || 'N/A'}</TableCell>
                    <TableCell sx={{ padding: '12px 16px', fontSize: '0.875rem' }}>{record.weld_type || 'N/A'}</TableCell>
                    <TableCell sx={{ padding: '12px 16px', fontSize: '0.875rem' }}>{record.inspection_category || 'type-I'}</TableCell>
                    <TableCell sx={{ padding: '12px 16px', fontSize: '0.875rem' }}>
                      <Box sx={{ lineHeight: 1.2 }}>
                        <Typography variant="body2" sx={{ fontWeight: 'medium', mb: 0.5 }}>
                          {record.part1_piece_mark_no || 'N/A'}
                        </Typography>
                        {record.part1_material_type && record.part1_grade && (
                          <Typography variant="caption" color="textSecondary" sx={{ display: 'block' }}>
                            {record.part1_material_type} - {record.part1_grade}
                          </Typography>
                        )}
                        {(record.part1_thickness || (() => {
                          const m = materials.find(x => (x.piece_mark_no || '').trim() === (record.part1_piece_mark_no || '').trim());
                          return m?.pipe_dia;
                        })()) && (
                          <Typography variant="caption" color="textSecondary" sx={{ display: 'block' }}>
                            {record.part1_thickness ? `thk: ${record.part1_thickness}` : ''}
                          </Typography>
                        )}
                        {record.part1_heat_no && (
                          <Typography variant="caption" color="textSecondary" sx={{ display: 'block' }}>
                            heat: {record.part1_heat_no}
                          </Typography>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell sx={{ padding: '12px 16px', fontSize: '0.875rem' }}>
                      <Box sx={{ lineHeight: 1.2 }}>
                        <Typography variant="body2" sx={{ fontWeight: 'medium', mb: 0.5 }}>
                          {record.part2_piece_mark_no || 'N/A'}
                        </Typography>
                        {record.part2_material_type && record.part2_grade && (
                          <Typography variant="caption" color="textSecondary" sx={{ display: 'block' }}>
                            {record.part2_material_type} - {record.part2_grade}
                          </Typography>
                        )}
                        {(record.part2_thickness || (() => {
                          const m = materials.find(x => (x.piece_mark_no || '').trim() === (record.part2_piece_mark_no || '').trim());
                          return m?.pipe_dia;
                        })()) && (
                          <Typography variant="caption" color="textSecondary" sx={{ display: 'block' }}>
                            {record.part2_thickness ? `thk: ${record.part2_thickness}` : ''}
                          </Typography>
                        )}
                        {record.part2_heat_no && (
                          <Typography variant="caption" color="textSecondary" sx={{ display: 'block' }}>
                            heat: {record.part2_heat_no}
                          </Typography>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell sx={{ padding: '12px 16px', fontSize: '0.875rem' }}>
                      <Chip 
                        label={record.weld_site || 'N/A'} 
                        size="small" 
                        color={record.weld_site === 'shop weld' ? 'primary' : 'secondary'}
                      />
                    </TableCell>
                    <TableCell sx={{ padding: '12px 16px', fontSize: '0.875rem' }}>
                      {record.weld_length ? `${record.weld_length} mm` : 'N/A'}
                    </TableCell>
                    <TableCell sx={{ padding: '12px 16px', fontSize: '0.875rem' }}>
                      {calculateLowerThickness(record) || 'N/A'}
                    </TableCell>
                    <TableCell sx={{ padding: '12px 16px' }}>
                      {editingRows.has(record.id) ? (
                        <TextField
                          type="date"
                          value={editData[record.id]?.fit_up_date || record.fit_up_date || ''}
                          onChange={(e) => handleInlineEditChange(record.id, 'fit_up_date', e.target.value)}
                          size="small"
                          fullWidth
                          InputLabelProps={{ shrink: true }}
                          inputProps={{ style: { fontSize: '0.875rem' } }}
                        />
                      ) : (
                        formatDate(record.fit_up_date)
                      )}
                    </TableCell>
                    <TableCell sx={{ padding: '12px 16px' }}>
                      {editingRows.has(record.id) ? (
                        <TextField
                          value={editData[record.id]?.fit_up_report_no || record.fit_up_report_no || ''}
                          onChange={(e) => handleInlineEditChange(record.id, 'fit_up_report_no', e.target.value)}
                          size="small"
                          fullWidth
                          inputProps={{ style: { fontSize: '0.875rem' } }}
                        />
                      ) : (
                        record.fit_up_report_no || 'N/A'
                      )}
                    </TableCell>
                    <TableCell sx={{ padding: '12px 16px' }}>
                      {editingRows.has(record.id) ? (
                        <FormControl fullWidth size="small">
                          <Select
                            value={editData[record.id]?.fit_up_result || record.fit_up_result || 'pending'}
                            onChange={(e) => handleInlineEditChange(record.id, 'fit_up_result', e.target.value)}
                            size="small"
                          >
                            <MenuItem value="pending">Pending</MenuItem>
                            <MenuItem value="accepted">Accepted</MenuItem>
                            <MenuItem value="rejected">Rejected</MenuItem>
                          </Select>
                        </FormControl>
                      ) : (
                        <Chip 
                          label={record.fit_up_result || 'Pending'} 
                          color={getStatusColor(record.fit_up_result) as any}
                          size="small"
                        />
                      )}
                    </TableCell>
                    <TableCell sx={{ padding: '12px 16px', fontSize: '0.875rem' }}>{record.updated_by || '-'}</TableCell>
                    <TableCell sx={{ padding: '12px 16px', fontSize: '0.875rem' }}>
                      {masterJoints.length > 0 ? (
                        masterJoints.some(m =>
                          (m.structure_category||'').trim() === (record.system_no||'').trim() &&
                          (m.page_no||'').trim() === (record.line_no||'').trim() &&
                          (m.draw_no||'').trim() === (record.spool_no||'').trim() &&
                          (m.joint_no||'').trim() === (record.joint_no||'').trim()
                        ) ? (
                          <Chip label="In Master" color="success" size="small" variant="outlined" />
                        ) : (
                          <Chip label="Not in Master" color="warning" size="small" variant="outlined" />
                        )
                      ) : (
                        <Chip label="-" size="small" variant="outlined" />
                      )}
                    </TableCell>
                    <TableCell sx={{ padding: '12px 16px' }}>
                      {(() => {
                        const accepted = (record.fit_up_result || '').toLowerCase() === 'accepted';
                        const allowEdit = isAdmin() || ((user?.role || '').toLowerCase() === 'inspector' && !accepted);
                        const allowDelete = canDelete();
                        return (
                          <Box>
                            <IconButton size="small" color="primary" onClick={() => handleEditClick(record)} disabled={!allowEdit}>
                              <Edit />
                            </IconButton>
                            <IconButton size="small" color="error" onClick={() => handleDeleteClick(record)} disabled={!allowDelete}>
                              <Delete />
                            </IconButton>
                          </Box>
                        );
                      })()}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          </Box>
        </Paper>
      )}

      {/* Inline Edit Controls */}
      {isInlineEditMode && (
        <Paper sx={{ p: 2, mt: 2, backgroundColor: 'primary.light', color: 'white' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="h6">
              Editing {editingRows.size} record(s)
            </Typography>
            <Box>
              <Button
                variant="contained"
                color="secondary"
                onClick={handleCancelInlineEdits}
                sx={{ mr: 2 }}
              >
                Cancel
              </Button>
              <Button
                variant="contained"
                color="success"
                onClick={handleSaveInlineEdits}
                disabled={loading}
              >
                {loading ? <CircularProgress size={24} /> : 'Save All Changes'}
              </Button>
            </Box>
          </Box>
          <Typography variant="body2" sx={{ mt: 1 }}>
            You are editing {editingRows.size} selected records. Changes will be saved for all edited fields.
          </Typography>
        </Paper>
      )}

      {/* Information Footer */}
      <Box sx={{ mt: 4, p: 2, backgroundColor: 'grey.50', borderRadius: 1 }}>
        <Typography variant="body2" color="textSecondary">
          <strong>Note:</strong> This page displays all fit-up inspection records for the selected project. 
          The data is automatically populated from the material register when piece marks are referenced.
        </Typography>
      </Box>

      {/* Add Fit-up Dialog */}
      <Dialog open={addDialogOpen} onClose={() => setAddDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Add New Structure Fit-up Inspection</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Master Joint</InputLabel>
                <Select
                  value={formData.master_joint_id || ''}
                  label="Master Joint"
                  onChange={(e) => applyMasterJoint(Number(e.target.value))}
                >
                  {getFilteredMasterJoints.map(j => (
                    <MenuItem key={j.id} value={j.id}>{keyFor(j)}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Typography variant="caption" color="textSecondary" sx={{ mt: 0.5, display: 'block' }}>
                Available: {getFilteredMasterJoints.length} / Total: {masterJoints.length}
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Block no"
                value={formData.block_no || ''}
                onChange={(e) => setFormData({ ...formData, block_no: e.target.value })}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Structure Category"
                value={formData.system_no}
                onChange={(e) => setFormData({ ...formData, system_no: e.target.value })}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Page No"
                value={formData.line_no}
                onChange={(e) => setFormData({ ...formData, line_no: e.target.value })}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Drawing No"
                value={formData.spool_no}
                onChange={(e) => setFormData({ ...formData, spool_no: e.target.value })}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Joint No"
                value={formData.joint_no}
                onChange={(e) => setFormData({ ...formData, joint_no: e.target.value })}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                select
                label="Weld Type"
                value={formData.weld_type || ''}
                onChange={(e) => setFormData({ ...formData, weld_type: e.target.value })}
                fullWidth
              >
                <MenuItem value="BW">BW</MenuItem>
                <MenuItem value="FW">FW</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                select
                label="Inspection Category"
                value={formData.inspection_category || 'type-I'}
                onChange={(e) => setFormData({ ...formData, inspection_category: e.target.value as NewFitUpInspection['inspection_category'] })}
                fullWidth
              >
                <MenuItem value="type-I">Type I</MenuItem>
                <MenuItem value="type-II">Type II</MenuItem>
                <MenuItem value="type-III">Type III</MenuItem>
                <MenuItem value="Special">Special</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Piece Mark 1</InputLabel>
                <Select
                  value={formData.part1_piece_mark_no || ''}
                  label="Piece Mark 1"
                  onChange={(e) => applyMaterial(1, String(e.target.value))}
                >
                  {materials.map(m => (
                    <MenuItem key={m.id} value={m.piece_mark_no}>{m.piece_mark_no}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Typography variant="caption" color="textSecondary" sx={{ mt: 0.5, display: 'block' }}>
                {(() => {
                  const m = materials.find(x => (x.piece_mark_no || '').trim() === (formData.part1_piece_mark_no || '').trim());
                  const info = [
                    formData.part1_material_type && formData.part1_grade ? `${formData.part1_material_type} - ${formData.part1_grade}` : '',
                    formData.part1_thickness ? `thk: ${formData.part1_thickness}` : ''
                  ].filter(Boolean).join(' • ');
                  return info || '-';
                })()}
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Piece Mark 2</InputLabel>
                <Select
                  value={formData.part2_piece_mark_no || ''}
                  label="Piece Mark 2"
                  onChange={(e) => applyMaterial(2, String(e.target.value))}
                >
                  {materials.map(m => (
                    <MenuItem key={m.id} value={m.piece_mark_no}>{m.piece_mark_no}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Typography variant="caption" color="textSecondary" sx={{ mt: 0.5, display: 'block' }}>
                {(() => {
                  const m = materials.find(x => (x.piece_mark_no || '').trim() === (formData.part2_piece_mark_no || '').trim());
                  const info = [
                    formData.part2_material_type && formData.part2_grade ? `${formData.part2_material_type} - ${formData.part2_grade}` : '',
                    formData.part2_thickness ? `thk: ${formData.part2_thickness}` : ''
                  ].filter(Boolean).join(' • ');
                  return info || '-';
                })()}
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                select
                label="Weld Site"
                value={formData.weld_site || ''}
                onChange={(e) => setFormData({ ...formData, weld_site: e.target.value })}
                fullWidth
              >
                <MenuItem value="shop weld">shop weld</MenuItem>
                <MenuItem value="float weld">float weld</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Weld Length (mm)"
                type="number"
                value={formData.weld_length}
                onChange={(e) => setFormData({ ...formData, weld_length: Number(e.target.value) })}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Fit-up Date"
                type="date"
                value={formData.fit_up_date}
                onChange={(e) => setFormData({ ...formData, fit_up_date: e.target.value })}
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Fit-up Report No"
                value={formData.fit_up_report_no || ''}
                onChange={(e) => setFormData({ ...formData, fit_up_report_no: e.target.value })}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Fit Up Result</InputLabel>
                <Select
                  value={formData.fit_up_result}
                  label="Fit Up Result"
                  onChange={(e) => setFormData({ ...formData, fit_up_result: e.target.value })}
                >
                  <MenuItem value="pending">Pending</MenuItem>
                  <MenuItem value="accepted">Accepted</MenuItem>
                  <MenuItem value="rejected">Rejected</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Remarks"
                value={formData.remarks}
                onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                fullWidth
                multiline
                rows={3}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleAddSubmit} variant="contained">Add Fit-up</Button>
        </DialogActions>
      </Dialog>

      {/* Edit Fit-up Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Edit Structure Fit-up Inspection</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Master Joint</InputLabel>
                <Select
                  value={formData.master_joint_id || ''}
                  label="Master Joint"
                  onChange={(e) => applyMasterJoint(Number(e.target.value))}
                >
                  {getFilteredMasterJoints.map(j => (
                    <MenuItem key={j.id} value={j.id}>{keyFor(j)}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Typography variant="caption" color="textSecondary" sx={{ mt: 0.5, display: 'block' }}>
                Available: {getFilteredMasterJoints.length} / Total: {masterJoints.length}
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Block no"
                value={formData.block_no || ''}
                onChange={(e) => setFormData({ ...formData, block_no: e.target.value })}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Structure Category"
                value={formData.system_no}
                onChange={(e) => setFormData({ ...formData, system_no: e.target.value })}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Page No"
                value={formData.line_no}
                onChange={(e) => setFormData({ ...formData, line_no: e.target.value })}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Drawing No"
                value={formData.spool_no}
                onChange={(e) => setFormData({ ...formData, spool_no: e.target.value })}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Joint No"
                value={formData.joint_no}
                onChange={(e) => setFormData({ ...formData, joint_no: e.target.value })}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Weld Type"
                value={formData.weld_type}
                onChange={(e) => setFormData({ ...formData, weld_type: e.target.value })}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Piece Mark 1"
                value={formData.part1_piece_mark_no}
                onChange={(e) => setFormData({ ...formData, part1_piece_mark_no: e.target.value })}
                onBlur={async (e) => {
                  const v = e.target.value.trim();
                  const m = await lookupMaterial(v);
                  if (m) {
                    setFormData({
                      ...formData,
                      part1_piece_mark_no: v,
                      part1_material_type: m.material_type || '',
                      part1_grade: m.grade || '',
                      part1_thickness: m.thickness || '',
                      part1_heat_no: m.heat_no || ''
                    });
                  }
                }}
                fullWidth
              />
              <Typography variant="caption" color="textSecondary" sx={{ mt: 0.5, display: 'block' }}>
                {(() => {
                  const m = materials.find(x => (x.piece_mark_no || '').trim() === (formData.part1_piece_mark_no || '').trim());
                  const info = [
                    formData.part1_material_type && formData.part1_grade ? `${formData.part1_material_type} - ${formData.part1_grade}` : '',
                    formData.part1_thickness ? `thk: ${formData.part1_thickness}` : ''
                  ].filter(Boolean).join(' • ');
                  return info || '-';
                })()}
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Piece Mark 2"
                value={formData.part2_piece_mark_no}
                onChange={(e) => setFormData({ ...formData, part2_piece_mark_no: e.target.value })}
                onBlur={async (e) => {
                  const v = e.target.value.trim();
                  const m = await lookupMaterial(v);
                  if (m) {
                    setFormData({
                      ...formData,
                      part2_piece_mark_no: v,
                      part2_material_type: m.material_type || '',
                      part2_grade: m.grade || '',
                      part2_thickness: m.thickness || '',
                      part2_heat_no: m.heat_no || ''
                    });
                  }
                }}
                fullWidth
              />
              <Typography variant="caption" color="textSecondary" sx={{ mt: 0.5, display: 'block' }}>
                {(() => {
                  const m = materials.find(x => (x.piece_mark_no || '').trim() === (formData.part2_piece_mark_no || '').trim());
                  const info = [
                    formData.part2_material_type && formData.part2_grade ? `${formData.part2_material_type} - ${formData.part2_grade}` : '',
                    formData.part2_thickness ? `thk: ${formData.part2_thickness}` : ''
                  ].filter(Boolean).join(' • ');
                  return info || '-';
                })()}
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                select
                label="Weld Site"
                value={formData.weld_site || ''}
                onChange={(e) => setFormData({ ...formData, weld_site: e.target.value })}
                fullWidth
              >
                <MenuItem value="shop weld">shop weld</MenuItem>
                <MenuItem value="float weld">float weld</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Weld Length (mm)"
                type="number"
                value={formData.weld_length}
                onChange={(e) => setFormData({ ...formData, weld_length: Number(e.target.value) })}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Fit-up Date"
                type="date"
                value={formData.fit_up_date}
                onChange={(e) => setFormData({ ...formData, fit_up_date: e.target.value })}
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Fit-up Report No"
                value={formData.fit_up_report_no || ''}
                onChange={(e) => setFormData({ ...formData, fit_up_report_no: e.target.value })}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Fit Up Result</InputLabel>
                <Select
                  value={formData.fit_up_result}
                  label="Fit Up Result"
                  onChange={(e) => setFormData({ ...formData, fit_up_result: e.target.value })}
                >
                  <MenuItem value="pending">Pending</MenuItem>
                  <MenuItem value="accepted">Accepted</MenuItem>
                  <MenuItem value="rejected">Rejected</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Remarks"
                value={formData.remarks}
                onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                fullWidth
                multiline
                rows={3}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleEditSubmit} variant="contained">Update Fit-up</Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this fit-up inspection record?
            {selectedRecord && (
              <Box sx={{ mt: 1 }}>
                <Typography variant="body2" color="textSecondary">
                  Drawing No: {selectedRecord.spool_no || 'N/A'}, 
                  Structure Category: {selectedRecord.system_no || 'N/A'}, 
                  Joint No: {selectedRecord.joint_no || 'N/A'}
                </Typography>
              </Box>
            )}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDeleteConfirm} variant="contained" color="error">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Bulk Create Results Dialog */}
      <Dialog open={bulkCreateDialogOpen} onClose={() => setBulkCreateDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Bulk Create Final Inspections - Results</DialogTitle>
        <DialogContent>
          {bulkCreateResult && (
            <Box sx={{ mt: 2 }}>
              <Alert 
                severity={bulkCreateResult.created_count > 0 ? "success" : "warning"} 
                sx={{ mb: 3 }}
              >
                {bulkCreateResult.message}
              </Alert>
              
              <Typography variant="h6" gutterBottom>
                Summary
              </Typography>
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={6}>
                  <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'success.light', color: 'success.contrastText' }}>
                    <Typography variant="h4">{bulkCreateResult.created_count}</Typography>
                    <Typography variant="body2">Created</Typography>
                  </Paper>
                </Grid>
                <Grid item xs={6}>
                  <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'warning.light', color: 'warning.contrastText' }}>
                    <Typography variant="h4">{bulkCreateResult.skipped_count}</Typography>
                    <Typography variant="body2">Skipped</Typography>
                  </Paper>
                </Grid>
              </Grid>

              {bulkCreateResult.created_finals && bulkCreateResult.created_finals.length > 0 && (
                <>
                  <Typography variant="h6" gutterBottom>
                    Created Final Inspections ({bulkCreateResult.created_finals.length})
                  </Typography>
                  <TableContainer component={Paper} sx={{ mb: 3 }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell><strong>ID</strong></TableCell>
                          <TableCell><strong>Joint No</strong></TableCell>
                          <TableCell><strong>Structure Category</strong></TableCell>
                          <TableCell><strong>Drawing No</strong></TableCell>
                          <TableCell><strong>Final Report No</strong></TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {bulkCreateResult.created_finals.map((final: any) => (
                          <TableRow key={final.id}>
                            <TableCell>{final.id}</TableCell>
                            <TableCell>{final.joint_no || 'N/A'}</TableCell>
                            <TableCell>{final.system_no || 'N/A'}</TableCell>
                            <TableCell>{final.spool_no || 'N/A'}</TableCell>
                            <TableCell>{final.final_report_no || 'N/A'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </>
              )}

              {bulkCreateResult.errors && bulkCreateResult.errors.length > 0 && (
                <>
                  <Typography variant="h6" gutterBottom color="error">
                    Errors ({bulkCreateResult.errors.length})
                  </Typography>
                  <Alert severity="error" sx={{ mb: 2 }}>
                    <Typography variant="body2">
                      {bulkCreateResult.errors.map((error: string, index: number) => (
                        <Box key={index} sx={{ mb: 0.5 }}>
                          • {error}
                        </Box>
                      ))}
                    </Typography>
                  </Alert>
                </>
              )}

              <Typography variant="body2" color="textSecondary" sx={{ mt: 3 }}>
                <strong>Note:</strong> Created final inspections can be viewed in the Final Inspection page.
                You can now navigate to <a href="/structureproject/final-inspection" style={{ color: 'primary.main', textDecoration: 'underline' }}>Final Inspection</a> to update welder no, WPS no, and NDT testing details.
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBulkCreateDialogOpen(false)}>Close</Button>
          <Button 
            variant="contained" 
            onClick={() => {
              setBulkCreateDialogOpen(false);
              window.location.href = '/structureproject/final-inspection';
            }}
          >
            Go to Final Inspection
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default FitUpInspection;
