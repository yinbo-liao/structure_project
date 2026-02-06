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
  FormControlLabel,
  Checkbox,
  Tooltip
} from '@mui/material';
import { Assignment, Refresh, Add, Edit, Delete, Warning, Info, Save, Cancel, Sync } from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import ApiService from '../../services/api';
import { FitUpInspection as FitUpInspectionType, MaterialRegister as MaterialRegisterType, MasterJointList as MasterJointListType } from '../../types';

type NewFitUpInspection = Omit<FitUpInspectionType, 'id' | 'project_id' | 'created_at' | 'updated_at'> & {
  inspection_category?: 'type-I' | 'type-II' | 'type-III' | 'Special';
};

const StructureFitUpInspection: React.FC = () => {
  const { selectedProject, user, canEdit, canDelete, isAdmin } = useAuth();
  const [records, setRecords] = useState<FitUpInspectionType[]>([]);
  const [materials, setMaterials] = useState<MaterialRegisterType[]>([]);
  const [masterJoints, setMasterJoints] = useState<MasterJointListType[]>([]);
  const [availableMasterJoints, setAvailableMasterJoints] = useState<MasterJointListType[]>([]);
  const [selectedRows, setSelectedRows] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<FitUpInspectionType | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editRowData, setEditRowData] = useState<Partial<FitUpInspectionType>>({});
  const [formData, setFormData] = useState<NewFitUpInspection>({
    draw_no: '',
    structure_category: '',
    page_no: '',
    drawing_rev: '',
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
    dia: '',
    fit_up_date: '',
    fit_up_report_no: '',
    fit_up_result: '',
    remarks: '',
    master_joint_id: undefined,
    inspection_category: 'type-I',
    block_no: ''
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

  const fetchFitUpRecords = async () => {
    if (!selectedProject) return;
    
    setLoading(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const data = await ApiService.getStructureFitUpInspections(selectedProject.id);
      setRecords(data);
      try {
        const opts = await ApiService.getStructureFitUpFilters(selectedProject.id);
        setFilterOptions({
          system_no: opts?.structure_category || [],
          spool_no: opts?.drawing_rev || [],
          joint_no: opts?.joint_no || [],
          fit_up_report_no: opts?.fit_up_report_no || [],
          fit_up_result: opts?.fit_up_result || []
        });
      } catch {}
    } catch (err) {
      setError('Failed to fetch fit-up records');
      console.error('Error fetching fit-up records:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSyncMaterials = async () => {
    if (!selectedProject) return;
    
    setLoading(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const result = await ApiService.syncStructureFitUpMaterials(selectedProject.id);
      setSuccessMessage(`Successfully synced materials. Updated ${result.updated_count} records.`);
      fetchFitUpRecords();
    } catch (err: any) {
      setError(getErrorMessage(err, 'Failed to sync materials'));
      console.error('Error syncing materials:', err);
      setLoading(false);
    }
  };

  const fetchAvailableMasterJoints = async () => {
    if (!selectedProject) return;
    try {
      // Use structure-specific API with excludeWithFitup=true
      const joints = await ApiService.getStructureMasterJointList(selectedProject.id, undefined, undefined, true);
      
      // Sort by drawing_no then joint_no
      const sortedJoints = (joints || []).sort((a: MasterJointListType, b: MasterJointListType) => {
        const keyA = `${(a.draw_no || '').trim()}-${(a.joint_no || '').trim()}`;
        const keyB = `${(b.draw_no || '').trim()}-${(b.joint_no || '').trim()}`;
        return keyA.localeCompare(keyB);
      });
      
      setAvailableMasterJoints(sortedJoints);
    } catch (err) {
      console.error('Error fetching available master joints:', err);
    }
  };

  const handleBulkCreateFinal = async () => {
    if (!selectedRows.length || !selectedProject) return;
    
    if (!window.confirm(`Are you sure you want to create final inspection records for ${selectedRows.length} selected items? Only 'Accepted' items will be processed.`)) {
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const result = await ApiService.bulkCreateFinalInspectionsFromFitup(selectedRows);
      
      let msg = result.message;
      if (result.errors && result.errors.length > 0) {
        msg += ` (${result.errors.length} errors occurred)`;
        console.warn('Bulk create errors:', result.errors);
      }
      
      setSuccessMessage(msg);
      setSelectedRows([]);
      // Ideally navigate to final inspection or refresh
    } catch (err: any) {
      setError(getErrorMessage(err, 'Failed to create final inspections'));
      console.error('Error creating final inspections:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAllClick = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      const newSelecteds = filteredRecords.map((n) => n.id);
      setSelectedRows(newSelecteds);
      return;
    }
    setSelectedRows([]);
  };

  const handleClick = (event: React.MouseEvent<unknown>, id: number) => {
    const selectedIndex = selectedRows.indexOf(id);
    let newSelected: number[] = [];

    if (selectedIndex === -1) {
      newSelected = newSelected.concat(selectedRows, id);
    } else if (selectedIndex === 0) {
      newSelected = newSelected.concat(selectedRows.slice(1));
    } else if (selectedIndex === selectedRows.length - 1) {
      newSelected = newSelected.concat(selectedRows.slice(0, -1));
    } else if (selectedIndex > 0) {
      newSelected = newSelected.concat(
        selectedRows.slice(0, selectedIndex),
        selectedRows.slice(selectedIndex + 1),
      );
    }

    setSelectedRows(newSelected);
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
        // Use structure-specific API for structure projects
        const joints = selectedProject.project_type === 'structure' 
          ? await ApiService.getStructureMasterJointList(selectedProject.id)
          : await ApiService.getMasterJointList(selectedProject.id);
        setMasterJoints(joints || []);
      } catch {}
    };
    loadMasterJoints();
  }, [selectedProject]);

  const handleAddClick = () => {
    fetchAvailableMasterJoints();
    setFormData({
      draw_no: '',
      structure_category: '',  // Changed from system_no
      page_no: '',             // Changed from line_no
      drawing_rev: '',         // Changed from spool_no
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
      dia: '',
      fit_up_date: '',
      fit_up_report_no: '',
      fit_up_result: '',
      remarks: '',
      master_joint_id: undefined,
      inspection_category: 'type-I',
      block_no: ''
    });
    setAddDialogOpen(true);
  };

  const handleInlineEditClick = (record: FitUpInspectionType) => {
    if (!canEdit()) return;
    setEditingId(record.id);
    setEditRowData({
      fit_up_result: record.fit_up_result || '',
      fit_up_report_no: record.fit_up_report_no || '',
      remarks: record.remarks || '',
      weld_length: record.weld_length || 0,
      dia: record.dia || '',
      block_no: record.block_no || '',
      inspection_category: record.inspection_category || 'type-I',
      fit_up_date: record.fit_up_date ? new Date(record.fit_up_date).toISOString().split('T')[0] : ''
    });
  };

  const handleInlineSave = async (record: FitUpInspectionType) => {
    if (!editingId || !editRowData) return;
    
    try {
      const payload = { ...editRowData };
      if (payload.fit_up_date) {
        try {
          payload.fit_up_date = new Date(payload.fit_up_date).toISOString();
        } catch {}
      }
      
      await ApiService.updateStructureFitUpInspection(editingId, payload);
      setEditingId(null);
      setEditRowData({});
      fetchFitUpRecords();
    } catch (err: any) {
      setError(getErrorMessage(err, 'Failed to update fit-up record'));
      console.error('Error updating fit-up record:', err);
    }
  };

  const handleInlineCancel = () => {
    setEditingId(null);
    setEditRowData({});
  };

  const handleInlineChange = (field: keyof FitUpInspectionType, value: any) => {
    setEditRowData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleEditDialogClick = (record: FitUpInspectionType) => {
    setSelectedRecord(record);
    setFormData({
      draw_no: record.draw_no || '',
      structure_category: record.structure_category || '',  // Changed from system_no
      page_no: record.page_no || '',                       // Changed from line_no
      drawing_rev: record.drawing_rev || '',               // Changed from spool_no
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
      dia: record.dia || '',
      fit_up_date: record.fit_up_date || '',
      fit_up_report_no: record.fit_up_report_no || '',
      fit_up_result: record.fit_up_result || '',
      remarks: record.remarks || '',
      master_joint_id: record.master_joint_id,
      inspection_category: record.inspection_category || 'type-I',
      block_no: record.block_no || ''
    });
    setEditDialogOpen(true);
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

  const keyFor = (obj: { system_no?: string; line_no?: string; spool_no?: string; joint_no?: string }) =>
    `${(obj.system_no||'').trim()}-${(obj.line_no||'').trim()}-${(obj.spool_no||'').trim()}-${(obj.joint_no||'').trim()}`;

  // Structure-specific joint display function: draw_no + joint_no
  const getStructureJointDisplayText = (joint: MasterJointListType) => {
    return `${(joint.draw_no || '').trim()} - ${(joint.joint_no || '').trim()}`;
  };

  // Structure-specific applyMasterJoint function
  const applyMasterJoint = (jointId: number) => {
    const mj = masterJoints.find(j => j.id === jointId);
    if (!mj) return;
    
    // For structure projects:
    // - structure_category = Structure Category (from masterJoint.structure_category)
    // - page_no = Page No (from masterJoint.page_no)
    // - drawing_rev = Drawing Rev (from masterJoint.drawing_rev)
    // - joint_no = Joint No (from masterJoint.joint_no)
    // - draw_no = Drawing No (from masterJoint.draw_no) - This is the primary key with joint_no
    // - weld_length = Direct value from masterJoint.weld_length (not calculated)
    // - block_no = Block No (from masterJoint.block_no)
    
    const updatedFormData = {
      ...formData,
      draw_no: mj.draw_no || '',
      structure_category: mj.structure_category || '', // Structure Category
      page_no: mj.page_no || '',     // Page No
      drawing_rev: mj.drawing_rev || '',   // Drawing Rev
      joint_no: mj.joint_no || '',   // Joint No
      weld_type: mj.weld_type || '',
      weld_length: mj.weld_length || 0, // Direct value, not calculated
      master_joint_id: mj.id,
      part1_piece_mark_no: mj.part1_piece_mark_no || '',
      part2_piece_mark_no: mj.part2_piece_mark_no || '',
      inspection_category: mj.inspection_category || 'type-I',
      block_no: mj.block_no || '', // Block no from master joint
      fit_up_report_no: mj.fit_up_report_no || '' // Fit-up report no from master joint
    };
    
    // Remove pipe-specific fields for structure projects
    delete updatedFormData.system_no;
    delete updatedFormData.line_no;
    delete updatedFormData.spool_no;
    
    // Map master joint thickness to dia (displayed as Thickness)
    // Logic: Use lower thickness from part 1 and part 2 materials if available
    let calculatedThickness = mj.thickness || '';
    let t1: number | null = null;
    let t2: number | null = null;

    // Look up material details for piece marks from structure material register
    if (mj.part1_piece_mark_no) {
      const material1 = materials.find(m => (m.piece_mark_no || '').trim() === (mj.part1_piece_mark_no || '').trim());
      if (material1) {
        updatedFormData.part1_material_type = material1.material_type || '';
        updatedFormData.part1_grade = material1.grade || '';
        updatedFormData.part1_thickness = material1.thickness || '';
        updatedFormData.part1_heat_no = material1.heat_no || '';
        
        const match = (material1.thickness || '').match(/([\d.]+)/);
        if (match) t1 = parseFloat(match[1]);
      }
    }
    
    if (mj.part2_piece_mark_no) {
      const material2 = materials.find(m => (m.piece_mark_no || '').trim() === (mj.part2_piece_mark_no || '').trim());
      if (material2) {
        updatedFormData.part2_material_type = material2.material_type || '';
        updatedFormData.part2_grade = material2.grade || '';
        updatedFormData.part2_thickness = material2.thickness || '';
        updatedFormData.part2_heat_no = material2.heat_no || '';
        
        const match = (material2.thickness || '').match(/([\d.]+)/);
        if (match) t2 = parseFloat(match[1]);
      }
    }

    if (t1 !== null && t2 !== null) {
      calculatedThickness = Math.min(t1, t2).toString();
    } else if (t1 !== null) {
      calculatedThickness = t1.toString();
    } else if (t2 !== null) {
      calculatedThickness = t2.toString();
    }

    updatedFormData.dia = calculatedThickness;
    
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
    if (!selectedProject) return;
    
    // Check for duplicate records using draw_no + joint_no for structure projects
    const duplicateKey = `${formData.draw_no || ''}-${formData.joint_no || ''}`;
    const duplicateExists = records.some(record => 
      `${record.draw_no || ''}-${record.joint_no || ''}` === duplicateKey
    );
    
    if (duplicateExists) {
      setError(`Duplicate fit-up record found for: ${formData.draw_no || ''} - ${formData.joint_no || ''}`);
      return;
    }
    
    try {
      // Create payload with structure fields directly
      const payload: any = {
        project_id: selectedProject.id,
        draw_no: formData.draw_no || '',
        structure_category: formData.structure_category || '',
        page_no: formData.page_no || '',
        drawing_rev: formData.drawing_rev || '',
        joint_no: formData.joint_no || '',
        block_no: formData.block_no || '',
        weld_type: formData.weld_type || '',
        part1_piece_mark_no: formData.part1_piece_mark_no || '',
        part2_piece_mark_no: formData.part2_piece_mark_no || '',
        part1_material_type: formData.part1_material_type || '',
        part1_grade: formData.part1_grade || '',
        part1_thickness: formData.part1_thickness || '',
        part1_heat_no: formData.part1_heat_no || '',
        part2_material_type: formData.part2_material_type || '',
        part2_grade: formData.part2_grade || '',
        part2_thickness: formData.part2_thickness || '',
        part2_heat_no: formData.part2_heat_no || '',
        weld_site: formData.weld_site || '',
        weld_length: formData.weld_length || 0,
        dia: formData.dia || '',
        fit_up_report_no: formData.fit_up_report_no || '',
        fit_up_result: formData.fit_up_result || '',
        remarks: formData.remarks || '',
        master_joint_id: formData.master_joint_id,
        inspection_category: formData.inspection_category || 'type-I'
      };
      
      // Handle fit_up_date formatting
      if (formData.fit_up_date) {
        try {
          payload.fit_up_date = new Date(formData.fit_up_date).toISOString();
        } catch {
          // If date parsing fails, don't include it
        }
      }
      
      await ApiService.createStructureFitUpInspection(payload);
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
      // Create payload with structure fields directly
      const payload: any = {
        draw_no: formData.draw_no || '',
        structure_category: formData.structure_category || '',
        page_no: formData.page_no || '',
        drawing_rev: formData.drawing_rev || '',
        joint_no: formData.joint_no || '',
        block_no: formData.block_no || '',
        weld_type: formData.weld_type || '',
        part1_piece_mark_no: formData.part1_piece_mark_no || '',
        part2_piece_mark_no: formData.part2_piece_mark_no || '',
        part1_material_type: formData.part1_material_type || '',
        part1_grade: formData.part1_grade || '',
        part1_thickness: formData.part1_thickness || '',
        part1_heat_no: formData.part1_heat_no || '',
        part2_material_type: formData.part2_material_type || '',
        part2_grade: formData.part2_grade || '',
        part2_thickness: formData.part2_thickness || '',
        part2_heat_no: formData.part2_heat_no || '',
        weld_site: formData.weld_site || '',
        weld_length: formData.weld_length || 0,
        dia: formData.dia || '',
        fit_up_report_no: formData.fit_up_report_no || '',
        fit_up_result: formData.fit_up_result || '',
        remarks: formData.remarks || '',
        master_joint_id: formData.master_joint_id,
        inspection_category: formData.inspection_category || 'type-I'
      };
      
      // Handle fit_up_date formatting
      if (formData.fit_up_date) {
        try {
          payload.fit_up_date = new Date(formData.fit_up_date).toISOString();
        } catch {
          // If date parsing fails, don't include it
        }
      }
      
      await ApiService.updateStructureFitUpInspection(selectedRecord.id, payload);
      setEditDialogOpen(false);
      setSelectedRecord(null);
      fetchFitUpRecords();
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
            variant="outlined"
            startIcon={<Sync />}
            onClick={handleSyncMaterials}
            disabled={loading || !canEdit()}
            sx={{ mr: 2 }}
          >
            Sync Materials
          </Button>
          <Button
            variant="outlined"
            onClick={handleBulkCreateFinal}
            disabled={loading || !canEdit() || selectedRows.length === 0}
            sx={{ mr: 2 }}
            color="secondary"
          >
            Create Final Insp ({selectedRows.length})
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

      {/* Success Alert */}
      {successMessage && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccessMessage(null)}>
          {successMessage}
        </Alert>
      )}

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

      {/* Enhanced Table with all required columns */}
      {!loading && (
        <TableContainer component={Paper} sx={{ width: '100%', overflowX: 'auto', boxShadow: 2 }}>
          <Table stickyHeader size="medium" sx={{ minWidth: 1800 }}>
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">
                  <Checkbox
                    indeterminate={selectedRows.length > 0 && selectedRows.length < filteredRecords.length}
                    checked={filteredRecords.length > 0 && selectedRows.length === filteredRecords.length}
                    onChange={handleSelectAllClick}
                    inputProps={{ 'aria-label': 'select all fitups' }}
                  />
                </TableCell>
                <TableCell sx={{ fontWeight: 600, backgroundColor: 'grey.100', padding: '16px 16px', borderBottom: '2px solid', borderBottomColor: 'primary.main', minWidth: 140 }}>Block No</TableCell>
                <TableCell sx={{ fontWeight: 600, backgroundColor: 'grey.100', padding: '16px 16px', borderBottom: '2px solid', borderBottomColor: 'primary.main', minWidth: 160 }}>Drawing No</TableCell>
                <TableCell sx={{ fontWeight: 600, backgroundColor: 'grey.100', padding: '16px 16px', borderBottom: '2px solid', borderBottomColor: 'primary.main', minWidth: 140 }}>Joint No</TableCell>
                <TableCell sx={{ fontWeight: 600, backgroundColor: 'grey.100', padding: '16px 16px', borderBottom: '2px solid', borderBottomColor: 'primary.main', minWidth: 140 }}>Weld Type</TableCell>
                <TableCell sx={{ fontWeight: 600, backgroundColor: 'grey.100', padding: '16px 16px', borderBottom: '2px solid', borderBottomColor: 'primary.main', minWidth: 140 }}>Thickness</TableCell>
                <TableCell sx={{ fontWeight: 600, backgroundColor: 'grey.100', padding: '16px 16px', borderBottom: '2px solid', borderBottomColor: 'primary.main', minWidth: 220 }}>Part 1 Piece Mark</TableCell>
                <TableCell sx={{ fontWeight: 600, backgroundColor: 'grey.100', padding: '16px 16px', borderBottom: '2px solid', borderBottomColor: 'primary.main', minWidth: 220 }}>Part 2 Piece Mark</TableCell>
                <TableCell sx={{ fontWeight: 600, backgroundColor: 'grey.100', padding: '16px 16px', borderBottom: '2px solid', borderBottomColor: 'primary.main', minWidth: 140 }}>Weld Length</TableCell>
                <TableCell sx={{ fontWeight: 600, backgroundColor: 'grey.100', padding: '16px 16px', borderBottom: '2px solid', borderBottomColor: 'primary.main', minWidth: 160 }}>Fit Up Date</TableCell>
                <TableCell sx={{ fontWeight: 600, backgroundColor: 'grey.100', padding: '16px 16px', borderBottom: '2px solid', borderBottomColor: 'primary.main', minWidth: 180 }}>Fit-up Report No</TableCell>
                <TableCell sx={{ fontWeight: 600, backgroundColor: 'grey.100', padding: '16px 16px', borderBottom: '2px solid', borderBottomColor: 'primary.main', minWidth: 160 }}>Inspection Category</TableCell>
                <TableCell sx={{ fontWeight: 600, backgroundColor: 'grey.100', padding: '16px 16px', borderBottom: '2px solid', borderBottomColor: 'primary.main', minWidth: 140 }}>Fit Up Result</TableCell>
                <TableCell sx={{ fontWeight: 600, backgroundColor: 'grey.100', padding: '16px 16px', borderBottom: '2px solid', borderBottomColor: 'primary.main', minWidth: 140 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredRecords.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={13} align="center">
                    <Typography variant="body1" color="textSecondary">
                      No fit-up records found for this project.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filteredRecords.map((record) => (
                  <TableRow 
                    key={record.id} 
                    hover
                    role="checkbox"
                    aria-checked={selectedRows.includes(record.id)}
                    selected={selectedRows.includes(record.id)}
                  >
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={selectedRows.includes(record.id)}
                        onChange={(event) => handleClick(event as any, record.id)}
                      />
                    </TableCell>
                    <TableCell sx={{ padding: '12px 16px' }}>
                      {editingId === record.id ? (
                        <TextField
                          size="small"
                          value={editRowData.block_no || record.block_no || ''}
                          onChange={(e) => handleInlineChange('block_no', e.target.value)}
                          fullWidth
                          variant="outlined"
                        />
                      ) : (
                        record.block_no || 'N/A'
                      )}
                    </TableCell>
                    <TableCell sx={{ padding: '12px 16px' }}>{record.draw_no || 'N/A'}</TableCell>
                    <TableCell sx={{ padding: '12px 16px' }}>{record.joint_no || 'N/A'}</TableCell>
                    <TableCell sx={{ padding: '12px 16px' }}>{record.weld_type || 'N/A'}</TableCell>
                    <TableCell sx={{ padding: '12px 16px' }}>
                      {(() => {
                        // Priority: Record dia > MJ thickness > Fallback
                        // This ensures that if we calculated a lower thickness based on materials, it is displayed
                        return record.dia || (() => {
                          const mj = masterJoints.find(m => 
                            (m.block_no || '').trim() === (record.block_no || '').trim() && 
                            (m.joint_no || '').trim() === (record.joint_no || '').trim()
                          );
                          return mj?.thickness;
                        })() || 'N/A';
                      })()}
                    </TableCell>
                    <TableCell sx={{ padding: '12px 16px' }}>
                      <Box sx={{ lineHeight: 1.2 }}>
                        <Typography variant="body2" sx={{ fontWeight: 'medium', mb: 0.5 }}>
                          {record.part1_piece_mark_no || 'N/A'}
                        </Typography>
                        {record.part1_material_type && record.part1_grade && (
                          <Typography variant="caption" color="textSecondary" sx={{ display: 'block' }}>
                            {record.part1_material_type} - {record.part1_grade}
                          </Typography>
                        )}
                        {record.part1_thickness && (
                          <Typography variant="caption" color="textSecondary" sx={{ display: 'block' }}>
                            thk: {record.part1_thickness}
                          </Typography>
                        )}
                        {record.part1_heat_no && (
                          <Typography variant="caption" color="textSecondary" sx={{ display: 'block' }}>
                            heat: {record.part1_heat_no}
                          </Typography>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell sx={{ padding: '12px 16px' }}>
                      <Box sx={{ lineHeight: 1.2 }}>
                        <Typography variant="body2" sx={{ fontWeight: 'medium', mb: 0.5 }}>
                          {record.part2_piece_mark_no || 'N/A'}
                        </Typography>
                        {record.part2_material_type && record.part2_grade && (
                          <Typography variant="caption" color="textSecondary" sx={{ display: 'block' }}>
                            {record.part2_material_type} - {record.part2_grade}
                          </Typography>
                        )}
                        {record.part2_thickness && (
                          <Typography variant="caption" color="textSecondary" sx={{ display: 'block' }}>
                            thk: {record.part2_thickness}
                          </Typography>
                        )}
                        {record.part2_heat_no && (
                          <Typography variant="caption" color="textSecondary" sx={{ display: 'block' }}>
                            heat: {record.part2_heat_no}
                          </Typography>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell sx={{ padding: '12px 16px' }}>
                      {editingId === record.id ? (
                        <TextField
                          size="small"
                          type="number"
                          value={editRowData.weld_length || record.weld_length || 0}
                          onChange={(e) => handleInlineChange('weld_length', Number(e.target.value))}
                          fullWidth
                          variant="outlined"
                        />
                      ) : (
                        record.weld_length ? `${record.weld_length} mm` : 'N/A'
                      )}
                    </TableCell>
                    <TableCell sx={{ padding: '12px 16px' }}>
                      {editingId === record.id ? (
                        <TextField
                          size="small"
                          type="date"
                          value={editRowData.fit_up_date || ''}
                          onChange={(e) => handleInlineChange('fit_up_date', e.target.value)}
                          fullWidth
                          variant="outlined"
                          InputLabelProps={{ shrink: true }}
                        />
                      ) : (
                        formatDate(record.fit_up_date)
                      )}
                    </TableCell>
                    <TableCell sx={{ padding: '12px 16px' }}>
                      {editingId === record.id ? (
                        <TextField
                          size="small"
                          value={editRowData.fit_up_report_no || record.fit_up_report_no || ''}
                          onChange={(e) => handleInlineChange('fit_up_report_no', e.target.value)}
                          fullWidth
                          variant="outlined"
                        />
                      ) : (
                        record.fit_up_report_no || 'N/A'
                      )}
                    </TableCell>
                    <TableCell sx={{ padding: '12px 16px' }}>
                      {editingId === record.id ? (
                        <TextField
                          select
                          size="small"
                          value={editRowData.inspection_category || record.inspection_category || 'type-I'}
                          onChange={(e) => handleInlineChange('inspection_category', e.target.value)}
                          fullWidth
                          variant="outlined"
                        >
                          <MenuItem value="type-I">type-I</MenuItem>
                          <MenuItem value="type-II">type-II</MenuItem>
                          <MenuItem value="type-III">type-III</MenuItem>
                          <MenuItem value="Special">Special</MenuItem>
                        </TextField>
                      ) : (
                        <Chip 
                          label={record.inspection_category || 'type-I'} 
                          color="primary"
                          size="small"
                          variant="outlined"
                        />
                      )}
                    </TableCell>
                    <TableCell sx={{ padding: '12px 16px' }}>
                      {editingId === record.id ? (
                        <TextField
                          select
                          size="small"
                          value={editRowData.fit_up_result || record.fit_up_result || 'pending'}
                          onChange={(e) => handleInlineChange('fit_up_result', e.target.value)}
                          fullWidth
                          variant="outlined"
                        >
                          <MenuItem value="pending">Pending</MenuItem>
                          <MenuItem value="accepted">Accepted</MenuItem>
                          <MenuItem value="rejected">Rejected</MenuItem>
                        </TextField>
                      ) : (
                        <Chip 
                          label={record.fit_up_result || 'Pending'} 
                          color={getStatusColor(record.fit_up_result) as any}
                          size="small"
                        />
                      )}
                    </TableCell>
                    <TableCell sx={{ padding: '12px 16px' }}>
                      {editingId === record.id ? (
                        <>
                          <IconButton size="small" color="primary" onClick={() => handleInlineSave(record)}>
                            <Save />
                          </IconButton>
                          <IconButton size="small" color="error" onClick={handleInlineCancel}>
                            <Cancel />
                          </IconButton>
                        </>
                      ) : (
                        <>
                          <IconButton size="small" color="primary" onClick={() => handleInlineEditClick(record)}>
                            <Edit />
                          </IconButton>
                          <IconButton size="small" color="primary" onClick={() => handleEditDialogClick(record)}>
                            <Info />
                          </IconButton>
                          <IconButton size="small" color="error" onClick={() => handleDeleteClick(record)}>
                            <Delete />
                          </IconButton>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

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
                  {availableMasterJoints.map(j => (
                    <MenuItem key={j.id} value={j.id}>{getStructureJointDisplayText(j)}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Structure Category"
                value={formData.structure_category || ''}
                onChange={(e) => setFormData({ ...formData, structure_category: e.target.value })}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Drawing Rev"
                value={formData.drawing_rev || ''}
                onChange={(e) => setFormData({ ...formData, drawing_rev: e.target.value })}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Drawing No"
                value={formData.draw_no || ''}
                onChange={(e) => setFormData({ ...formData, draw_no: e.target.value })}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Page No"
                value={formData.page_no || ''}
                onChange={(e) => setFormData({ ...formData, page_no: e.target.value })}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Block No"
                value={formData.block_no || ''}
                onChange={(e) => setFormData({ ...formData, block_no: e.target.value })}
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
                label="Thickness"
                value={formData.dia || ''}
                onChange={(e) => setFormData({ ...formData, dia: e.target.value })}
                fullWidth
              />
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
                select
                label="Fit Up Result"
                value={formData.fit_up_result}
                onChange={(e) => setFormData({ ...formData, fit_up_result: e.target.value })}
                fullWidth
              >
                <MenuItem value="pending">Pending</MenuItem>
                <MenuItem value="accepted">Accepted</MenuItem>
                <MenuItem value="rejected">Rejected</MenuItem>
              </TextField>
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
            <Grid item xs={12} sm={6}>
              <TextField
                label="Structure Category"
                value={formData.structure_category || ''}
                onChange={(e) => setFormData({ ...formData, structure_category: e.target.value })}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Drawing Rev"
                value={formData.drawing_rev || ''}
                onChange={(e) => setFormData({ ...formData, drawing_rev: e.target.value })}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Drawing No"
                value={formData.draw_no || ''}
                onChange={(e) => setFormData({ ...formData, draw_no: e.target.value })}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Page No"
                value={formData.page_no || ''}
                onChange={(e) => setFormData({ ...formData, page_no: e.target.value })}
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
                label="Thickness"
                value={formData.dia || ''}
                onChange={(e) => setFormData({ ...formData, dia: e.target.value })}
                fullWidth
              />
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
                select
                label="Fit Up Result"
                value={formData.fit_up_result}
                onChange={(e) => setFormData({ ...formData, fit_up_result: e.target.value })}
                fullWidth
              >
                <MenuItem value="pending">Pending</MenuItem>
                <MenuItem value="accepted">Accepted</MenuItem>
                <MenuItem value="rejected">Rejected</MenuItem>
              </TextField>
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
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDeleteConfirm} variant="contained" color="error">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default StructureFitUpInspection;
