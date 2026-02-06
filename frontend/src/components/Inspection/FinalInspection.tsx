import React, { useState, useEffect } from 'react';
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
import { Checklist, Refresh, Add, Edit, Delete, Search, Clear, Download } from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import ApiService from '../../services/api';
import { FinalInspection as FinalInspectionType, FitUpInspection } from '../../types';

type NewFinalInspection = Omit<FinalInspectionType, 'id' | 'created_at'>;

const FinalInspection: React.FC = () => {
  const { selectedProject, user, canEdit, canDelete, isAdmin } = useAuth();
  const [records, setRecords] = useState<FinalInspectionType[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRows, setSelectedRows] = useState<number[]>([]);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<FinalInspectionType | null>(null);
  const [formData, setFormData] = useState<NewFinalInspection>({
    fitup_id: 0,
    project_id: selectedProject?.id || 0,
    system_no: '', // Structure Category
    line_no: '',   // Page No
    spool_no: '',  // Drawing No
    joint_no: '',
    weld_type: '',
    wps_no: '',
    welder_no: '',
    weld_site: '',
    final_date: '',
    final_report_no: '',
    final_result: '',
    ndt_type: '',
    weld_length: 0,
    pipe_dia: '',
    remarks: '',
    inspection_category: 'type-I',
    block_no: ''
  });
  
  const [fitupRecords, setFitupRecords] = useState<FitUpInspection[]>([]);
  const [wpsList, setWpsList] = useState<any[]>([]);
  const [welderList, setWelderList] = useState<any[]>([]);
  const ndtOptions = ['RT', 'UT', 'PT', 'MPI', 'FT', 'PMI', 'NA'];
  const [search, setSearch] = useState({
    system_no: '',
    spool_no: '',
    joint_no: '',
    final_report_no: '',
    final_result: ''
  });
  const [filterOptions, setFilterOptions] = useState<{ system_no: string[]; spool_no: string[]; joint_no: string[]; final_report_no: string[]; final_result: string[] }>({
    system_no: [], spool_no: [], joint_no: [], final_report_no: [], final_result: []
  });
  const [editGroupIds, setEditGroupIds] = useState<number[]>([]);
  const [editGroupIndex, setEditGroupIndex] = useState<number>(0);
  const [bulkUpdateDialogOpen, setBulkUpdateDialogOpen] = useState(false);
  const [bulkUpdateLoading, setBulkUpdateLoading] = useState(false);
  const [bulkUpdateForm, setBulkUpdateForm] = useState({
    wps_no: '',
    welder_no: '',
    ndt_type: '',
    final_report_no: '',
    final_date: ''
  });
  const [bulkUpdateResult, setBulkUpdateResult] = useState<{
    message: string;
    updated_count: number;
    skipped_count?: number;
    errors?: string[];
  } | null>(null);

  // Inline edit state
  const [editingRows, setEditingRows] = useState<Set<number>>(new Set());
  const [editData, setEditData] = useState<Record<number, Partial<FinalInspectionType>>>({});
  const [isInlineEditMode, setIsInlineEditMode] = useState(false);

  const keyFor = (obj: { system_no?: string; line_no?: string; spool_no?: string; joint_no?: string; block_no?: string }) => {
    if (obj.block_no) {
      return `${obj.block_no} - ${obj.joint_no || ''} (${obj.spool_no || ''})`;
    }
    return `${(obj.system_no||'').trim()}-${(obj.line_no||'').trim()}-${(obj.spool_no||'').trim()}-${(obj.joint_no||'').trim()}`;
  };

  const findFitupByForm = () => {
    return fitupRecords.find(m =>
      (m.structure_category || m.system_no || '').trim() === (formData.system_no || '').trim() &&
      (m.page_no || m.line_no || '').trim() === (formData.line_no || '').trim() &&
      (m.draw_no || m.spool_no || '').trim() === (formData.spool_no || '').trim() &&
      (m.joint_no || '').trim() === (formData.joint_no || '').trim()
    );
  };

  // Calculate thickness from fit-up record (lower thickness between part1 and part2)
  const calculateThicknessFromFitup = (fitupRecord: FitUpInspection): string => {
    const thickness1 = parseFloat(fitupRecord.part1_thickness || '0');
    const thickness2 = parseFloat(fitupRecord.part2_thickness || '0');
    
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

  const applyFitupJoint = (fitupId: number) => {
    const fu = fitupRecords.find(j => j.id === fitupId);
    if (!fu) return;
    
    setFormData({
      ...formData,
      fitup_id: fu.id,
      system_no: fu.structure_category || fu.system_no || '',
      line_no: fu.page_no || fu.line_no || '',
      spool_no: fu.draw_no || fu.spool_no || '',
      joint_no: fu.joint_no || '',
      weld_type: fu.weld_type || '',
      weld_length: fu.weld_length || 0,
      pipe_dia: '',
      block_no: fu.block_no || ''
    });
  };

  const fetchFinalRecords = async () => {
    if (!selectedProject) return;
    
    setLoading(true);
    setError(null);
    try {
      const data = await ApiService.getFinalInspections(selectedProject.id);
      setRecords(data);
      try {
        const opts = await ApiService.getFinalFilters(selectedProject.id);
        setFilterOptions(opts || { system_no: [], spool_no: [], joint_no: [], final_report_no: [], final_result: [] });
      } catch {}
    } catch (err) {
      setError('Failed to fetch final inspection records');
      console.error('Error fetching final inspection records:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFinalRecords();
    const loadFitups = async () => {
      if (!selectedProject) return;
      try {
        const data = await ApiService.getFitUpInspections(selectedProject.id);
        setFitupRecords(data || []);
      } catch {}
    };
    loadFitups();
    const loadWps = async () => {
      if (!selectedProject) return;
      try {
        const data = await ApiService.getWPSRegister(selectedProject.id);
        setWpsList(data || []);
      } catch {}
    };
    loadWps();
    const loadWelders = async () => {
      if (!selectedProject) return;
      try {
        const data = await ApiService.getWelderRegister(selectedProject.id);
        setWelderList(data || []);
      } catch {}
    };
    loadWelders();
    const loadFilters = async () => {
      if (!selectedProject) return;
      try {
        const opts: any = await ApiService.getFinalFilters(selectedProject.id);
        setFilterOptions({
          system_no: opts?.system_no || opts?.structure_category || [],
          spool_no: opts?.spool_no || opts?.drawing_rev || [],
          joint_no: opts?.joint_no || [],
          final_report_no: opts?.final_report_no || [],
          final_result: opts?.final_result || []
        });
      } catch {}
    };
    loadFilters();
  }, [selectedProject]);

  // Auto-lookup from Master Joint List based on Block No + Joint No
  useEffect(() => {
    const lookupMasterJoint = async () => {
      if (!formData.block_no || !formData.joint_no || !selectedProject) return;

      try {
        const results = await ApiService.getStructureMasterJointList(
          selectedProject.id,
          undefined,
          undefined,
          undefined,
          formData.block_no,
          formData.joint_no
        );

        if (results && results.length > 0) {
          const match = results[0];
          setFormData(prev => {
            // Map fields: draw_no -> spool_no, structure_category -> system_no, page_no -> line_no
            const newSpool = match.draw_no || prev.spool_no;
            const newSystem = match.structure_category || prev.system_no;
            const newLine = match.page_no || prev.line_no;

            if (newSpool !== prev.spool_no || newSystem !== prev.system_no || newLine !== prev.line_no) {
              return {
                ...prev,
                spool_no: newSpool,
                system_no: newSystem,
                line_no: newLine
              };
            }
            return prev;
          });
        }
      } catch (err) {
        console.error('Error looking up master joint:', err);
      }
    };

    const timer = setTimeout(() => {
      lookupMasterJoint();
    }, 500);

    return () => clearTimeout(timer);
  }, [formData.block_no, formData.joint_no, selectedProject]);

  // Auto-lookup thickness from fit-up records when Block No + Joint No changes
  useEffect(() => {
    const lookupThicknessFromFitup = () => {
      if (!formData.block_no || !formData.joint_no) return;

      // Find matching fit-up record by Block No + Joint No
      const matchingFitup = fitupRecords.find(fitup =>
        (fitup.block_no || '').trim() === (formData.block_no || '').trim() &&
        (fitup.joint_no || '').trim() === (formData.joint_no || '').trim()
      );

      if (matchingFitup) {
        const thickness = calculateThicknessFromFitup(matchingFitup);
        if (thickness && thickness !== formData.pipe_dia) {
          setFormData(prev => ({
            ...prev,
            pipe_dia: thickness
          }));
        }
      }
    };

    const timer = setTimeout(() => {
      lookupThicknessFromFitup();
    }, 500);

    return () => clearTimeout(timer);
  }, [formData.block_no, formData.joint_no, fitupRecords, formData.pipe_dia]);

  // Handler functions
  const handleAddClick = () => {
    setFormData({
      fitup_id: 0,
      project_id: selectedProject?.id || 0,
      system_no: '',
      line_no: '',
      spool_no: '',
      joint_no: '',
      weld_type: '',
      wps_no: '',
      welder_no: '',
      weld_site: '',
      welder_validity: '',
      final_date: '',
      final_report_no: '',
      final_result: '',
      ndt_type: '',
      weld_length: 0,
      pipe_dia: '',
      remarks: '',
      inspection_category: 'type-I',
      block_no: ''
    });
    setAddDialogOpen(true);
  };

  const handleEditClick = (record: FinalInspectionType) => {
    const groupIds =
      selectedRows.includes(record.id) && selectedRows.length > 0
        ? selectedRows
        : [record.id];
    setEditGroupIds(groupIds);
    const idx = groupIds.indexOf(record.id);
    setEditGroupIndex(idx >= 0 ? idx : 0);
    setSelectedRecord(record);
    setFormData({
      fitup_id: record.fitup_id || 0,
      project_id: record.project_id,
      system_no: record.structure_category || record.system_no || '',
      line_no: record.page_no || record.line_no || '',
      spool_no: record.draw_no || record.spool_no || '',
      joint_no: record.joint_no || '',
      weld_type: record.weld_type || '',
      wps_no: record.wps_no || '',
      welder_no: record.welder_no || '',
      weld_site: record.weld_site || '',
      welder_validity: record.welder_validity || '',
      final_date: record.final_date || '',
      final_report_no: record.final_report_no || '',
      final_result: record.final_result || '',
      ndt_type: record.ndt_type || '',
      weld_length: record.weld_length || 0,
      pipe_dia: record.pipe_dia || '',
      remarks: record.remarks || '',
      inspection_category: record.inspection_category || 'type-I',
      block_no: record.block_no || ''
    });
    setEditDialogOpen(true);
  };

  const handleDeleteClick = (record: FinalInspectionType) => {
    setSelectedRecord(record);
    setDeleteDialogOpen(true);
  };

  const handleAddSubmit = async () => {
    try {
      const f = findFitupByForm();
      const payload: any = {
        ...formData,
        project_id: selectedProject!.id,
        fitup_id: f?.id || 0,
        remarks: f ? formData.remarks : `${formData.remarks ? formData.remarks + ' • ' : ''}fit up not done`
      };
      if (!payload.final_date) {
        delete payload.final_date;
      } else {
        try {
          payload.final_date = new Date(payload.final_date).toISOString();
        } catch {
          delete payload.final_date;
        }
      }
      await ApiService.createFinalInspection(payload);
      setAddDialogOpen(false);
      fetchFinalRecords();
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      const message =
        typeof detail === 'string'
          ? detail
          : detail && detail.msg
          ? detail.msg
          : err?.message || 'Failed to create final inspection record';
      setError(message);
      console.error('Error creating final inspection record:', err);
    }
  };

  const handleEditSubmit = async () => {
    if (!selectedRecord) return;
    
    try {
      const f = findFitupByForm();
      const payload: any = {
        ...formData,
        fitup_id: f?.id || 0,
        remarks: f ? formData.remarks : `${formData.remarks ? formData.remarks + ' • ' : ''}fit up not done`
      };
      if (!payload.final_date) {
        delete payload.final_date;
      } else {
        try {
          payload.final_date = new Date(payload.final_date).toISOString();
        } catch {
          delete payload.final_date;
        }
      }
      await ApiService.updateFinalInspection(selectedRecord.id, payload);
      const groupSize = editGroupIds.length;
      const currentIndex = editGroupIndex;
      const hasNext = groupSize > 0 && currentIndex < groupSize - 1;
      if (hasNext) {
        const nextId = editGroupIds[currentIndex + 1];
        const nextRecord = records.find(r => r.id === nextId);
        if (nextRecord) {
          setSelectedRecord(nextRecord);
          setFormData({
            fitup_id: nextRecord.fitup_id || 0,
            project_id: nextRecord.project_id,
            system_no: nextRecord.system_no || '',
            line_no: nextRecord.line_no || '',
            spool_no: nextRecord.spool_no || '',
            joint_no: nextRecord.joint_no || '',
            weld_type: nextRecord.weld_type || '',
            wps_no: nextRecord.wps_no || '',
            welder_no: nextRecord.welder_no || '',
            weld_site: nextRecord.weld_site || '',
            welder_validity: nextRecord.welder_validity || '',
            final_date: nextRecord.final_date || '',
            final_report_no: nextRecord.final_report_no || '',
            final_result: nextRecord.final_result || '',
            ndt_type: nextRecord.ndt_type || '',
            weld_length: nextRecord.weld_length || 0,
            pipe_dia: nextRecord.pipe_dia || '',
            remarks: nextRecord.remarks || '',
            block_no: nextRecord.block_no || ''
          });
          setEditGroupIndex(currentIndex + 1);
        } else {
          setEditDialogOpen(false);
          setSelectedRecord(null);
          setEditGroupIds([]);
          setEditGroupIndex(0);
          fetchFinalRecords();
        }
      } else {
        setEditDialogOpen(false);
        setSelectedRecord(null);
        setEditGroupIds([]);
        setEditGroupIndex(0);
        fetchFinalRecords();
      }
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      const message =
        typeof detail === 'string'
          ? detail
          : detail && detail.msg
          ? detail.msg
          : err?.message || 'Failed to update final inspection record';
      setError(message);
      console.error('Error updating final inspection record:', err);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!selectedRecord) return;
    
    try {
      await ApiService.deleteFinalInspection(selectedRecord.id);
      setDeleteDialogOpen(false);
      setSelectedRecord(null);
      fetchFinalRecords();
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      const message =
        typeof detail === 'string'
          ? detail
          : detail && detail.msg
          ? detail.msg
          : err?.message || 'Failed to delete final inspection record';
      setError(message);
      console.error('Error deleting final inspection record:', err);
    }
  };

  // Inline edit handlers
  const handleInlineEditChange = (id: number, field: keyof FinalInspectionType, value: any) => {
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
          await ApiService.updateFinalInspection(update.id, payload);
        }
      }
      
      // Refresh records and exit edit mode
      await fetchFinalRecords();
      setEditingRows(new Set());
      setEditData({});
      setIsInlineEditMode(false);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      const message =
        typeof detail === 'string'
          ? detail
          : detail && detail.msg
          ? detail.msg
          : err?.message || 'Failed to save inline edits';
      setError(message);
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
    const sys = (r.structure_category || r.system_no || '').trim();
    const spool = (r.draw_no || r.spool_no || '').trim();
    const joint = (r.joint_no || '').trim();
    const rep = (r.final_report_no || '').trim();
    const res = (r.final_result || '').trim().toLowerCase();
    const qs = search.system_no.trim();
    const qsp = search.spool_no.trim();
    const qj = search.joint_no.trim();
    const qr = search.final_report_no.trim();
    const qres = search.final_result.trim().toLowerCase();
    return (!qs || sys === qs) && (!qsp || spool === qsp) && (!qj || joint === qj) && (!qr || rep === qr) && (!qres || res === qres);
  });

  const downloadCSV = () => {
    const headers = [
      'Drawing No',
      'Structure Category',
      'Page No',
      'Joint No',
      'Weld Type',
      'WPS No',
      'Welder No',
      'Welder Validity',
      'NDT Type',
      'Weld Length',
      'Thickness',
      'Final Date',
      'Report No',
      'Result',
      'Fit-up Link'
    ];
    const rows = filteredRecords.map(record => {
      const inFitup = fitupRecords.length > 0 ? (
        fitupRecords.some(m =>
          (m.structure_category || m.system_no || '').trim() === (record.structure_category || record.system_no || '').trim() &&
          (m.page_no || m.line_no || '').trim() === (record.page_no || record.line_no || '').trim() &&
          (m.draw_no || m.spool_no || '').trim() === (record.draw_no || record.spool_no || '').trim() &&
          (m.joint_no || '').trim() === (record.joint_no || '').trim()
        )
      ) : false;
      
      return [
        record.draw_no || record.spool_no || '',
        record.structure_category || record.system_no || '',
        record.page_no || record.line_no || '',
        record.joint_no || '',
        record.weld_type || '',
        record.wps_no || '',
        record.welder_no || '',
        record.welder_validity || '',
        record.ndt_type || '',
        record.weld_length || 0,
        record.pipe_dia || '',
        record.final_date ? formatDate(record.final_date) : '',
        record.final_report_no || '',
        record.final_result || '',
        inFitup ? 'Yes' : 'No'
      ].map(cell => `"${cell}"`).join(',');
    });
    
    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `final_inspection_${selectedProject?.code || 'export'}_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  // Bulk update handler
  const handleBulkUpdateClick = () => {
    if (selectedRows.length === 0) {
      setError('Please select at least one final inspection record to update.');
      return;
    }
    
    setBulkUpdateForm({
      wps_no: '',
      welder_no: '',
      ndt_type: '',
      final_report_no: '',
      final_date: ''
    });
    setBulkUpdateResult(null);
    setBulkUpdateDialogOpen(true);
  };

  const handleBulkUpdateSubmit = async () => {
    if (selectedRows.length === 0) {
      setError('No records selected for bulk update.');
      return;
    }

    setBulkUpdateLoading(true);
    setError(null);
    
    try {
      // Prepare update data with only non-empty fields
      const updateData: any = {};
      if (bulkUpdateForm.wps_no.trim()) updateData.wps_no = bulkUpdateForm.wps_no.trim();
      if (bulkUpdateForm.welder_no.trim()) updateData.welder_no = bulkUpdateForm.welder_no.trim();
      if (bulkUpdateForm.ndt_type.trim()) updateData.ndt_type = bulkUpdateForm.ndt_type.trim();
      if (bulkUpdateForm.final_report_no.trim()) updateData.final_report_no = bulkUpdateForm.final_report_no.trim();
      if (bulkUpdateForm.final_date.trim()) {
        try {
          updateData.final_date = new Date(bulkUpdateForm.final_date).toISOString();
        } catch {
          // If date parsing fails, keep as is
          updateData.final_date = bulkUpdateForm.final_date;
        }
      }

      // Check if any fields are provided
      if (Object.keys(updateData).length === 0) {
        setError('Please provide at least one field to update.');
        setBulkUpdateLoading(false);
        return;
      }

      const result = await ApiService.bulkUpdateFinalInspections(selectedRows, updateData);
      // Cast result to any to avoid TS error since the backend return type might be loose in the frontend definition
      const anyResult = result as any;
      setBulkUpdateResult({
        ...result,
        skipped_count: anyResult.skipped_count || 0 
      });
      
      // Refresh records after successful update
      if (result.updated_count > 0) {
        fetchFinalRecords();
        // Clear selection after successful update
        setSelectedRows([]);
      }
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      const message =
        typeof detail === 'string'
          ? detail
          : detail && detail.msg
          ? detail.msg
          : err?.message || 'Failed to perform bulk update';
      setError(message);
      console.error('Error performing bulk update:', err);
    } finally {
      setBulkUpdateLoading(false);
    }
  };

  // Calculate statistics
  const acceptedCount = filteredRecords.filter(r => r.final_result?.toLowerCase() === 'accepted').length;
  const rejectedCount = filteredRecords.filter(r => r.final_result?.toLowerCase() === 'rejected').length;
  const pendingCount = filteredRecords.filter(r => !r.final_result || r.final_result.toLowerCase() === 'pending').length;
  const totalWeldLength = filteredRecords.reduce((sum, r) => sum + (r.weld_length || 0), 0);

  if (!selectedProject) {
    return (
      <Container>
        <Typography>Please select a project first.</Typography>
      </Container>
    );
  }

  return (
    <Container maxWidth={false} sx={{ mt: 4, px: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Final Inspection
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={fetchFinalRecords}
            disabled={loading}
          >
            Refresh
          </Button>
          <Button
            variant="outlined"
            startIcon={<Download />}
            onClick={downloadCSV}
          >
            Export CSV
          </Button>
          {canEdit() && selectedRows.length > 0 && (
            <Button
              variant="contained"
              color="secondary"
              onClick={handleBulkUpdateClick}
              disabled={selectedRows.length === 0}
            >
              Bulk Update ({selectedRows.length})
            </Button>
          )}
          {canEdit() && (
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={handleAddClick}
            >
              Add Final Inspection
            </Button>
          )}
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Statistics Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>
                Total Records
              </Typography>
              <Typography variant="h5" component="div">
                {filteredRecords.length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>
                Accepted
              </Typography>
              <Typography variant="h5" component="div" color="success.main">
                {acceptedCount}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>
                Rejected
              </Typography>
              <Typography variant="h5" component="div" color="error.main">
                {rejectedCount}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>
                Total Weld Length
              </Typography>
              <Typography variant="h5" component="div">
                {totalWeldLength.toFixed(2)} mm
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Search Section */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          <Search sx={{ verticalAlign: 'middle', mr: 1 }} />
          Search Final Inspections
        </Typography>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={6} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Structure Category</InputLabel>
              <Select
                value={search.system_no}
                label="Structure Category"
                onChange={(e) => setSearch({ ...search, system_no: e.target.value })}
              >
                <MenuItem value="">All</MenuItem>
                {filterOptions.system_no.map((opt) => (
                  <MenuItem key={opt} value={opt}>{opt}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Drawing No</InputLabel>
              <Select
                value={search.spool_no}
                label="Drawing No"
                onChange={(e) => setSearch({ ...search, spool_no: e.target.value })}
              >
                <MenuItem value="">All</MenuItem>
                {filterOptions.spool_no.map((opt) => (
                  <MenuItem key={opt} value={opt}>{opt}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <TextField
              fullWidth
              size="small"
              label="Joint No"
              value={search.joint_no}
              onChange={(e) => setSearch({ ...search, joint_no: e.target.value })}
              placeholder="Joint No"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <TextField
              fullWidth
              size="small"
              label="Report No"
              value={search.final_report_no}
              onChange={(e) => setSearch({ ...search, final_report_no: e.target.value })}
              placeholder="Report No"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Result</InputLabel>
              <Select
                value={search.final_result}
                label="Result"
                onChange={(e) => setSearch({ ...search, final_result: e.target.value })}
              >
                <MenuItem value="">All</MenuItem>
                <MenuItem value="accepted">Accepted</MenuItem>
                <MenuItem value="rejected">Rejected</MenuItem>
                <MenuItem value="pending">Pending</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6} md={1}>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<Clear />}
              onClick={() => setSearch({ system_no: '', spool_no: '', joint_no: '', final_report_no: '', final_result: '' })}
              size="small"
            >
              Clear
            </Button>
          </Grid>
        </Grid>
        <Box sx={{ mt: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            Showing {filteredRecords.length} of {records.length} records
          </Typography>
          {search.system_no || search.spool_no || search.joint_no || search.final_report_no || search.final_result ? (
            <Chip 
              label="Search Active" 
              color="primary" 
              size="small" 
              variant="outlined"
            />
          ) : null}
        </Box>
      </Paper>

      {/* Records Table */}
      <Paper sx={{ p: 3, boxShadow: 2, width: '100%', overflow: 'hidden' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h6" fontWeight="600">
            Final Inspection Records
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
          </Box>
        </Box>

        {/* Inline Edit Controls */}
        {isInlineEditMode && editingRows.size > 0 && (
          <Box sx={{ mb: 3, p: 2, bgcolor: 'primary.light', borderRadius: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Checklist sx={{ color: 'primary.contrastText' }} />
              <Typography variant="body1" color="primary.contrastText" fontWeight="bold">
                Editing {editingRows.size} record{editingRows.size > 1 ? 's' : ''}
              </Typography>
              <Chip 
                label="Inline Edit Mode" 
                color="primary" 
                size="small" 
                variant="outlined"
                sx={{ color: 'primary.contrastText', borderColor: 'primary.contrastText' }}
              />
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="contained"
                color="success"
                onClick={handleSaveInlineEdits}
                disabled={loading}
                size="small"
              >
                {loading ? <CircularProgress size={20} /> : 'Save All Changes'}
              </Button>
              <Button
                variant="outlined"
                color="inherit"
                onClick={handleCancelInlineEdits}
                size="small"
                sx={{ color: 'primary.contrastText', borderColor: 'primary.contrastText' }}
              >
                Cancel
              </Button>
            </Box>
          </Box>
        )}
        
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : filteredRecords.length === 0 ? (
          <Alert severity="info">No final inspection records found.</Alert>
        ) : (
          <Box sx={{ width: '100%', overflowX: 'auto' }}>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    {canEdit() && (
                      <TableCell padding="checkbox">
                        <Checkbox
                          indeterminate={selectedRows.length > 0 && selectedRows.length < filteredRecords.length}
                          checked={filteredRecords.length > 0 && selectedRows.length === filteredRecords.length}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedRows(filteredRecords.map(r => r.id));
                            } else {
                              setSelectedRows([]);
                            }
                          }}
                        />
                      </TableCell>
                    )}
                    <TableCell>Drawing No</TableCell>
                    <TableCell>Structure Category</TableCell>
                    <TableCell>Page No</TableCell>
                    <TableCell>Joint No</TableCell>
                    <TableCell>Weld Type</TableCell>
                    <TableCell>WPS No</TableCell>
                    <TableCell>Welder No</TableCell>
                    <TableCell>NDT Type</TableCell>
                    <TableCell>Weld Length</TableCell>
                    <TableCell>Thickness</TableCell>
                    <TableCell>Final Date</TableCell>
                    <TableCell>Report No</TableCell>
                    <TableCell>Result</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredRecords.map((record) => (
                    <TableRow key={record.id} hover>
                      {canEdit() && (
                        <TableCell padding="checkbox">
                          <Checkbox
                            checked={selectedRows.includes(record.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedRows([...selectedRows, record.id]);
                              } else {
                                setSelectedRows(selectedRows.filter(id => id !== record.id));
                              }
                            }}
                          />
                        </TableCell>
                      )}
                      <TableCell>{record.draw_no || record.spool_no || '-'}</TableCell>
                      <TableCell>{record.structure_category || record.system_no || '-'}</TableCell>
                      <TableCell>{record.page_no || record.line_no || '-'}</TableCell>
                      <TableCell>{record.joint_no || '-'}</TableCell>
                      <TableCell>{record.weld_type || '-'}</TableCell>
                      <TableCell>
                        {editingRows.has(record.id) ? (
                          <FormControl fullWidth size="small">
                            <Select
                              value={editData[record.id]?.wps_no || record.wps_no || ''}
                              onChange={(e) => handleInlineEditChange(record.id, 'wps_no', e.target.value)}
                              size="small"
                            >
                              <MenuItem value="">Select WPS</MenuItem>
                              {wpsList.map((wps) => (
                                <MenuItem key={wps.id} value={wps.wps_no}>{wps.wps_no}</MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        ) : (
                          record.wps_no || '-'
                        )}
                      </TableCell>
                      <TableCell>
                        {editingRows.has(record.id) ? (
                          <FormControl fullWidth size="small">
                            <Select
                              value={editData[record.id]?.welder_no || record.welder_no || ''}
                              onChange={(e) => handleInlineEditChange(record.id, 'welder_no', e.target.value)}
                              size="small"
                            >
                              <MenuItem value="">Select Welder</MenuItem>
                              {welderList.map((welder) => (
                                <MenuItem key={welder.id} value={welder.welder_no}>{welder.welder_no}</MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        ) : (
                          record.welder_no || '-'
                        )}
                      </TableCell>
                      <TableCell>
                        {editingRows.has(record.id) ? (
                          <FormControl fullWidth size="small">
                              <Select
                                multiple
                                value={editData[record.id]?.ndt_type ? 
                                (editData[record.id]?.ndt_type?.split(',') || []).map(item => item.trim()) : 
                                (record.ndt_type ? record.ndt_type.split(',').map(item => item.trim()) : [])}
                              onChange={(e) => {
                                const selected = Array.isArray(e.target.value) ? e.target.value : [e.target.value];
                                handleInlineEditChange(record.id, 'ndt_type', selected.join(', '));
                              }}
                              renderValue={(selected) => (selected as string[]).join(', ')}
                              size="small"
                            >
                              {ndtOptions.map((opt) => (
                                <MenuItem key={opt} value={opt}>
                                  <Checkbox checked={
                                    editData[record.id]?.ndt_type ? 
                                    (editData[record.id]?.ndt_type?.split(',') || []).map(item => item.trim()).includes(opt) :
                                    (record.ndt_type ? record.ndt_type.split(',').map(item => item.trim()).includes(opt) : false)
                                  } />
                                  {opt}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        ) : (
                          record.ndt_type || '-'
                        )}
                      </TableCell>
                      <TableCell>{record.weld_length || 0} mm</TableCell>
                      <TableCell>{record.pipe_dia || '-'}</TableCell>
                      <TableCell>
                        {editingRows.has(record.id) ? (
                          <TextField
                            type="date"
                            value={editData[record.id]?.final_date || record.final_date || ''}
                            onChange={(e) => handleInlineEditChange(record.id, 'final_date', e.target.value)}
                            size="small"
                            fullWidth
                            InputLabelProps={{ shrink: true }}
                            inputProps={{ style: { fontSize: '0.875rem' } }}
                          />
                        ) : (
                          formatDate(record.final_date)
                        )}
                      </TableCell>
                      <TableCell>
                        {editingRows.has(record.id) ? (
                          <TextField
                            value={editData[record.id]?.final_report_no || record.final_report_no || ''}
                            onChange={(e) => handleInlineEditChange(record.id, 'final_report_no', e.target.value)}
                            size="small"
                            fullWidth
                            inputProps={{ style: { fontSize: '0.875rem' } }}
                          />
                        ) : (
                          record.final_report_no || '-'
                        )}
                      </TableCell>
                      <TableCell>
                        {editingRows.has(record.id) ? (
                          <FormControl fullWidth size="small">
                            <Select
                              value={editData[record.id]?.final_result || record.final_result || 'pending'}
                              onChange={(e) => handleInlineEditChange(record.id, 'final_result', e.target.value)}
                              size="small"
                            >
                              <MenuItem value="pending">Pending</MenuItem>
                              <MenuItem value="accepted">Accepted</MenuItem>
                              <MenuItem value="rejected">Rejected</MenuItem>
                            </Select>
                          </FormControl>
                        ) : (
                          <Chip
                            label={record.final_result || 'Pending'}
                            color={getStatusColor(record.final_result)}
                            size="small"
                          />
                        )}
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          {canEdit() && (
                            <>
                              {isInlineEditMode && editingRows.has(record.id) ? (
                                <IconButton size="small" color="success" onClick={handleSaveInlineEdits}>
                                  <Checklist />
                                </IconButton>
                              ) : (
                                <IconButton size="small" onClick={() => {
                                  // If multiple rows are selected, enter inline edit mode
                                  if (selectedRows.length > 1 && selectedRows.includes(record.id)) {
                                    // Enter inline edit mode for all selected rows
                                    setEditingRows(new Set(selectedRows));
                                    const initialEditData: Record<number, Partial<FinalInspectionType>> = {};
                                    selectedRows.forEach(id => {
                                      const rowRecord = records.find(r => r.id === id);
                                      if (rowRecord) {
                                        initialEditData[id] = {
                                          wps_no: rowRecord.wps_no,
                                          welder_no: rowRecord.welder_no,
                                          ndt_type: rowRecord.ndt_type,
                                          final_date: rowRecord.final_date,
                                          final_report_no: rowRecord.final_report_no,
                                          final_result: rowRecord.final_result
                                        };
                                      }
                                    });
                                    setEditData(initialEditData);
                                    setIsInlineEditMode(true);
                                  } else {
                                    // Single row edit - open dialog (existing behavior)
                                    handleEditClick(record);
                                  }
                                }}>
                                  <Edit />
                                </IconButton>
                              )}
                            </>
                          )}
                          {canDelete() && (
                            <IconButton size="small" onClick={() => handleDeleteClick(record)}>
                              <Delete />
                            </IconButton>
                          )}
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}
      </Paper>

      {/* Add Dialog */}
      <Dialog open={addDialogOpen} onClose={() => setAddDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Add Final Inspection</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Block No"
                value={formData.block_no}
                onChange={(e) => setFormData({ ...formData, block_no: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Joint No"
                value={formData.joint_no}
                onChange={(e) => setFormData({ ...formData, joint_no: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Drawing No"
                value={formData.spool_no}
                onChange={(e) => setFormData({ ...formData, spool_no: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Structure Category"
                value={formData.system_no}
                onChange={(e) => setFormData({ ...formData, system_no: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Page No"
                value={formData.line_no}
                onChange={(e) => setFormData({ ...formData, line_no: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Weld Type"
                value={formData.weld_type}
                onChange={(e) => setFormData({ ...formData, weld_type: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>WPS No</InputLabel>
                <Select
                  value={formData.wps_no}
                  label="WPS No"
                  onChange={(e) => setFormData({ ...formData, wps_no: e.target.value })}
                >
                  <MenuItem value="">Select WPS</MenuItem>
                  {wpsList.map((wps) => (
                    <MenuItem key={wps.id} value={wps.wps_no}>{wps.wps_no}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Welder No</InputLabel>
                <Select
                  value={formData.welder_no}
                  label="Welder No"
                  onChange={(e) => setFormData({ ...formData, welder_no: e.target.value })}
                >
                  <MenuItem value="">Select Welder</MenuItem>
                  {welderList.map((welder) => (
                    <MenuItem key={welder.id} value={welder.welder_no}>{welder.welder_no}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Weld Site"
                value={formData.weld_site}
                onChange={(e) => setFormData({ ...formData, weld_site: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Weld Length (mm)"
                type="number"
                value={formData.weld_length}
                onChange={(e) => setFormData({ ...formData, weld_length: parseFloat(e.target.value) || 0 })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Thickness (mm)"
                value={formData.pipe_dia}
                onChange={(e) => setFormData({ ...formData, pipe_dia: e.target.value })}
                InputProps={{
                  readOnly: true,
                }}
                helperText="Auto-filled from fit-up records"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>NDT Type</InputLabel>
                <Select
                  multiple
                  value={formData.ndt_type ? formData.ndt_type.split(',').map(item => item.trim()) : []}
                  label="NDT Type"
                  onChange={(e) => {
                    const selected = Array.isArray(e.target.value) ? e.target.value : [e.target.value];
                    setFormData({ ...formData, ndt_type: selected.join(', ') });
                  }}
                  renderValue={(selected) => (selected as string[]).join(', ')}
                >
                  {ndtOptions.map((opt) => (
                    <MenuItem key={opt} value={opt}>
                      <Checkbox checked={formData.ndt_type ? formData.ndt_type.split(',').map(item => item.trim()).includes(opt) : false} />
                      {opt}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Final Date"
                type="date"
                value={formData.final_date}
                onChange={(e) => setFormData({ ...formData, final_date: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Final Report No"
                value={formData.final_report_no}
                onChange={(e) => setFormData({ ...formData, final_report_no: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Final Result</InputLabel>
                <Select
                  value={formData.final_result}
                  label="Final Result"
                  onChange={(e) => setFormData({ ...formData, final_result: e.target.value })}
                >
                  <MenuItem value="">Select Result</MenuItem>
                  <MenuItem value="pending">Pending</MenuItem>
                  <MenuItem value="accepted">Accepted</MenuItem>
                  <MenuItem value="rejected">Rejected</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Remarks"
                value={formData.remarks}
                onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                multiline
                rows={3}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleAddSubmit} variant="contained">Add Final Inspection</Button>
        </DialogActions>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          Edit Final Inspection
          {editGroupIds.length > 1 && (
            <Typography variant="body2" color="text.secondary">
              ({editGroupIndex + 1} of {editGroupIds.length})
            </Typography>
          )}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Block No"
                value={formData.block_no}
                onChange={(e) => setFormData({ ...formData, block_no: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Joint No"
                value={formData.joint_no}
                onChange={(e) => setFormData({ ...formData, joint_no: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Drawing No"
                value={formData.spool_no}
                onChange={(e) => setFormData({ ...formData, spool_no: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Structure Category"
                value={formData.system_no}
                onChange={(e) => setFormData({ ...formData, system_no: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Page No"
                value={formData.line_no}
                onChange={(e) => setFormData({ ...formData, line_no: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Weld Type"
                value={formData.weld_type}
                onChange={(e) => setFormData({ ...formData, weld_type: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>WPS No</InputLabel>
                <Select
                  value={formData.wps_no}
                  label="WPS No"
                  onChange={(e) => setFormData({ ...formData, wps_no: e.target.value })}
                >
                  <MenuItem value="">Select WPS</MenuItem>
                  {wpsList.map((wps) => (
                    <MenuItem key={wps.id} value={wps.wps_no}>{wps.wps_no}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Welder No</InputLabel>
                <Select
                  value={formData.welder_no}
                  label="Welder No"
                  onChange={(e) => setFormData({ ...formData, welder_no: e.target.value })}
                >
                  <MenuItem value="">Select Welder</MenuItem>
                  {welderList.map((welder) => (
                    <MenuItem key={welder.id} value={welder.welder_no}>{welder.welder_no}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Weld Site"
                value={formData.weld_site}
                onChange={(e) => setFormData({ ...formData, weld_site: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Weld Length (mm)"
                type="number"
                value={formData.weld_length}
                onChange={(e) => setFormData({ ...formData, weld_length: parseFloat(e.target.value) || 0 })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Thickness (mm)"
                value={formData.pipe_dia}
                onChange={(e) => setFormData({ ...formData, pipe_dia: e.target.value })}
                InputProps={{
                  readOnly: true,
                }}
                helperText="Auto-filled from fit-up records"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>NDT Type</InputLabel>
                <Select
                  multiple
                  value={formData.ndt_type ? formData.ndt_type.split(',').map(item => item.trim()) : []}
                  label="NDT Type"
                  onChange={(e) => {
                    const selected = Array.isArray(e.target.value) ? e.target.value : [e.target.value];
                    setFormData({ ...formData, ndt_type: selected.join(', ') });
                  }}
                  renderValue={(selected) => (selected as string[]).join(', ')}
                >
                  {ndtOptions.map((opt) => (
                    <MenuItem key={opt} value={opt}>
                      <Checkbox checked={formData.ndt_type ? formData.ndt_type.split(',').map(item => item.trim()).includes(opt) : false} />
                      {opt}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Final Date"
                type="date"
                value={formData.final_date}
                onChange={(e) => setFormData({ ...formData, final_date: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Final Report No"
                value={formData.final_report_no}
                onChange={(e) => setFormData({ ...formData, final_report_no: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Final Result</InputLabel>
                <Select
                  value={formData.final_result}
                  label="Final Result"
                  onChange={(e) => setFormData({ ...formData, final_result: e.target.value })}
                >
                  <MenuItem value="">Select Result</MenuItem>
                  <MenuItem value="pending">Pending</MenuItem>
                  <MenuItem value="accepted">Accepted</MenuItem>
                  <MenuItem value="rejected">Rejected</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Remarks"
                value={formData.remarks}
                onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                multiline
                rows={3}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleEditSubmit} variant="contained">
            {editGroupIds.length > 1 && editGroupIndex < editGroupIds.length - 1 ? 'Save & Next' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this final inspection record?
            {selectedRecord && (
              <>
                <br />
                <strong>Joint No: {selectedRecord.joint_no}</strong>
                <br />
                <strong>Drawing No: {selectedRecord.draw_no || selectedRecord.spool_no}</strong>
              </>
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

      {/* Bulk Update Dialog */}
      <Dialog open={bulkUpdateDialogOpen} onClose={() => setBulkUpdateDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Bulk Update Final Inspections</DialogTitle>
        <DialogContent>
          {bulkUpdateResult ? (
            <Box sx={{ mt: 2 }}>
              <Alert 
                severity={bulkUpdateResult.updated_count > 0 ? "success" : "warning"} 
                sx={{ mb: 3 }}
              >
                {bulkUpdateResult.message}
              </Alert>
              
              <Typography variant="h6" gutterBottom>
                Summary
              </Typography>
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={6}>
                  <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'success.light', color: 'success.contrastText' }}>
                    <Typography variant="h4">{bulkUpdateResult.updated_count}</Typography>
                    <Typography variant="body2">Updated</Typography>
                  </Paper>
                </Grid>
                <Grid item xs={6}>
                  <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'warning.light', color: 'warning.contrastText' }}>
                    <Typography variant="h4">{bulkUpdateResult.skipped_count || 0}</Typography>
                    <Typography variant="body2">Skipped</Typography>
                  </Paper>
                </Grid>
              </Grid>

              {bulkUpdateResult.errors && bulkUpdateResult.errors.length > 0 && (
                <>
                  <Typography variant="h6" gutterBottom color="error">
                    Errors ({bulkUpdateResult.errors.length})
                  </Typography>
                  <Alert severity="error" sx={{ mb: 2 }}>
                    <Typography variant="body2">
                      {bulkUpdateResult.errors.map((error: string, index: number) => (
                        <Box key={index} sx={{ mb: 0.5 }}>
                          • {error}
                        </Box>
                      ))}
                    </Typography>
                  </Alert>
                </>
              )}

              <Typography variant="body2" color="textSecondary" sx={{ mt: 3 }}>
                <strong>Note:</strong> The selected {selectedRows.length} records have been updated with the provided values.
              </Typography>
            </Box>
          ) : (
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12}>
                <Alert severity="info" sx={{ mb: 2 }}>
                  You are updating {selectedRows.length} selected final inspection records. 
                  Only fill in the fields you want to update for all selected records.
                </Alert>
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>WPS No</InputLabel>
                  <Select
                    value={bulkUpdateForm.wps_no}
                    label="WPS No"
                    onChange={(e) => setBulkUpdateForm({ ...bulkUpdateForm, wps_no: e.target.value })}
                  >
                    <MenuItem value="">Leave unchanged</MenuItem>
                    {wpsList.map((wps) => (
                      <MenuItem key={wps.id} value={wps.wps_no}>{wps.wps_no}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Welder No</InputLabel>
                  <Select
                    value={bulkUpdateForm.welder_no}
                    label="Welder No"
                    onChange={(e) => setBulkUpdateForm({ ...bulkUpdateForm, welder_no: e.target.value })}
                  >
                    <MenuItem value="">Leave unchanged</MenuItem>
                    {welderList.map((welder) => (
                      <MenuItem key={welder.id} value={welder.welder_no}>{welder.welder_no}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>NDT Type</InputLabel>
                  <Select
                    value={bulkUpdateForm.ndt_type}
                    label="NDT Type"
                    onChange={(e) => setBulkUpdateForm({ ...bulkUpdateForm, ndt_type: e.target.value })}
                  >
                    <MenuItem value="">Leave unchanged</MenuItem>
                    {ndtOptions.map((opt) => (
                      <MenuItem key={opt} value={opt}>{opt}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Final Report No"
                  value={bulkUpdateForm.final_report_no}
                  onChange={(e) => setBulkUpdateForm({ ...bulkUpdateForm, final_report_no: e.target.value })}
                  placeholder="Leave empty to keep unchanged"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Final Date"
                  type="date"
                  value={bulkUpdateForm.final_date}
                  onChange={(e) => setBulkUpdateForm({ ...bulkUpdateForm, final_date: e.target.value })}
                  InputLabelProps={{ shrink: true }}
                  placeholder="Leave empty to keep unchanged"
                />
              </Grid>
              <Grid item xs={12}>
                <Alert severity="warning">
                  <Typography variant="body2">
                    <strong>Warning:</strong> This will update all {selectedRows.length} selected records with the values you provide above. 
                    Empty fields will not be changed.
                  </Typography>
                </Alert>
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          {bulkUpdateResult ? (
            <Button onClick={() => {
              setBulkUpdateDialogOpen(false);
              setBulkUpdateResult(null);
            }} variant="contained">
              Close
            </Button>
          ) : (
            <>
              <Button onClick={() => setBulkUpdateDialogOpen(false)}>Cancel</Button>
              <Button 
                onClick={handleBulkUpdateSubmit} 
                variant="contained" 
                disabled={bulkUpdateLoading}
              >
                {bulkUpdateLoading ? <CircularProgress size={24} /> : `Update ${selectedRows.length} Records`}
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default FinalInspection;
