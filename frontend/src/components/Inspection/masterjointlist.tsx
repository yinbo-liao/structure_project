import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Container,
  Paper,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Grid,
  Box,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tooltip,
  CircularProgress
} from '@mui/material';
import { Add, Refresh, Upload, Download, Sync } from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import EditableTable, { Column } from '../Common/EditableTable';
import ApiService from '../../services/api';

const MasterJointList: React.FC = () => {
  const { selectedProject, canEdit, canDelete, isAdmin } = useAuth();
  const [joints, setJoints] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [, setSyncStatus] = useState<any>(null);
  const [selectedJointIds, setSelectedJointIds] = useState<number[]>([]);

  const [searchBlockNo, setSearchBlockNo] = useState('');
  const [searchDrawingNo, setSearchDrawingNo] = useState('');
  const [searchJointNo, setSearchJointNo] = useState('');
  const [searchInspectionCategory, setSearchInspectionCategory] = useState('');
  const [searchFitUpReportNo, setSearchFitUpReportNo] = useState('');
  const [searchFinalReportNo, setSearchFinalReportNo] = useState('');

  const [formData, setFormData] = useState({
    draw_no: '',
    block_no: '',
    structure_category: '',
    page_no: '',
    drawing_rev: '',
    joint_no: '',
    thickness: '',
    weld_type: '',
    weld_length: undefined as number | undefined,
    part1_piece_mark_no: '',
    part2_piece_mark_no: '',
    fitup_status: 'pending',
    final_status: 'pending',
    inspection_category: 'type-I'
  });

  const fetchJoints = useCallback(async () => {
    if (!selectedProject) return;
    
    try {
      setLoading(true);
      const structureData = await ApiService.getStructureMasterJointList(selectedProject.id);
      const data = structureData.map((item: any) => ({
        id: item.id,
        project_id: item.project_id,
        draw_no: item.draw_no,
        block_no: item.block_no || '',
        structure_category: item.structure_category || '',
        page_no: item.page_no || '',
        drawing_rev: item.drawing_rev || '',
        joint_no: item.joint_no,
        thickness: item.thickness || '',
        weld_type: item.weld_type,
        weld_length: item.weld_length,
        part1_piece_mark_no: item.part1_piece_mark_no,
        part2_piece_mark_no: item.part2_piece_mark_no,
        fit_up_report_no: item.fit_up_report_no,
        final_report_no: item.final_report_no,
        fitup_status: item.fitup_status,
        final_status: item.final_status,
        inspection_category: item.inspection_category,
        created_at: item.created_at,
        // NDT Testing Columns
        ndt_rt_report_no: item.ndt_rt_report_no || '-',
        ndt_rt_result: item.ndt_rt_result || '-',
        ndt_ut_report_no: item.ndt_ut_report_no || '-',
        ndt_ut_result: item.ndt_ut_result || '-',
        ndt_mpi_report_no: item.ndt_mpi_report_no || '-',
        ndt_mpi_result: item.ndt_mpi_result || '-',
        ndt_pt_report_no: item.ndt_pt_report_no || '-',
        ndt_pt_result: item.ndt_pt_result || '-',
        ndt_pmi_report_no: item.ndt_pmi_report_no || '-',
        ndt_pmi_result: item.ndt_pmi_result || '-',
        ndt_ft_report_no: item.ndt_ft_report_no || '-',
        ndt_ft_result: item.ndt_ft_result || '-',
        ndt_paut_report_no: item.ndt_paut_report_no || '-',
        ndt_paut_result: item.ndt_paut_result || '-',
        ndt_comprehensive_status: item.ndt_comprehensive_status || '-',
        ndt_last_sync: item.ndt_last_sync || '',
        ndt_sync_status: item.ndt_sync_status || ''
      }));
      setJoints(data);
    } catch (error: any) {
      console.error('Error fetching master joints:', error);
      const detail = error?.response?.data?.detail;
      setMessage(detail || 'Error fetching master joints');
    } finally {
      setLoading(false);
    }
  }, [selectedProject]);

  useEffect(() => {
    if (selectedProject) {
      fetchJoints();
    }
  }, [selectedProject, fetchJoints]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject) return;

    try {
      const structureData = {
        project_id: selectedProject.id,
        draw_no: formData.draw_no,
        structure_category: formData.structure_category,
        page_no: formData.page_no,
        drawing_rev: formData.drawing_rev,
        joint_no: formData.joint_no,
        block_no: formData.block_no,
        thickness: formData.thickness,
        weld_type: formData.weld_type,
        weld_length: formData.weld_length,
        part1_piece_mark_no: formData.part1_piece_mark_no,
        part2_piece_mark_no: formData.part2_piece_mark_no,
        fitup_status: formData.fitup_status,
        final_status: formData.final_status,
        inspection_category: formData.inspection_category
      };
      await ApiService.createStructureMasterJointList(structureData);
      setOpen(false);
      setFormData({
        draw_no: '',
        block_no: '',
        structure_category: '',
        page_no: '',
        drawing_rev: '',
        joint_no: '',
        thickness: '',
        weld_type: '',
        weld_length: undefined,
        part1_piece_mark_no: '',
        part2_piece_mark_no: '',
        fitup_status: 'pending',
        final_status: 'pending',
        inspection_category: 'type-I'
      });
      fetchJoints();
      setMessage('Joint record created successfully');
    } catch (error: any) {
      setMessage(error.response?.data?.detail || 'Error creating joint record');
    }
  };

  const handleUpdate = async (id: number, data: any) => {
    try {
      const structureData = {
        draw_no: data.draw_no,
        structure_category: data.structure_category,
        page_no: data.page_no,
        drawing_rev: data.drawing_rev,
        joint_no: data.joint_no,
        block_no: data.block_no,
        thickness: data.thickness,
        weld_type: data.weld_type,
        weld_length: data.weld_length,
        part1_piece_mark_no: data.part1_piece_mark_no,
        part2_piece_mark_no: data.part2_piece_mark_no,
        fitup_status: data.fitup_status,
        final_status: data.final_status,
        inspection_category: data.inspection_category,
        // NDT Fields
        ndt_rt_report_no: data.ndt_rt_report_no,
        ndt_rt_result: data.ndt_rt_result,
        ndt_ut_report_no: data.ndt_ut_report_no,
        ndt_ut_result: data.ndt_ut_result,
        ndt_mpi_report_no: data.ndt_mpi_report_no,
        ndt_mpi_result: data.ndt_mpi_result,
        ndt_pt_report_no: data.ndt_pt_report_no,
        ndt_pt_result: data.ndt_pt_result,
        ndt_pmi_report_no: data.ndt_pmi_report_no,
        ndt_pmi_result: data.ndt_pmi_result,
        ndt_ft_report_no: data.ndt_ft_report_no,
        ndt_ft_result: data.ndt_ft_result,
        ndt_paut_report_no: data.ndt_paut_report_no,
        ndt_paut_result: data.ndt_paut_result,
        ndt_comprehensive_status: data.ndt_comprehensive_status
      };
      await ApiService.updateStructureMasterJointList(id, structureData);
      fetchJoints();
      setMessage('Joint record updated successfully');
    } catch (error: any) {
      setMessage(error.response?.data?.detail || 'Error updating joint record');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await ApiService.deleteStructureMasterJointList(id);
      fetchJoints();
      setMessage('Joint record deleted successfully');
    } catch (error: any) {
      setMessage(error.response?.data?.detail || 'Error deleting joint record');
    }
  };

  const handleFileUpload = async () => {
    if (!selectedProject || !uploadFile) return;

    try {
      setUploading(true);
      const result = await ApiService.uploadStructureMasterJointList(selectedProject.id, uploadFile);
      setUploadOpen(false);
      setUploadFile(null);
      fetchJoints();
      setMessage(`Successfully uploaded ${result.created_count} joints${result.errors ? ` with ${result.errors.length} errors` : ''}`);
      if (result.errors && result.errors.length > 0) {
        console.error('Upload errors:', result.errors);
      }
    } catch (error: any) {
      setMessage(error.response?.data?.detail || 'Error uploading file');
    } finally {
      setUploading(false);
    }
  };

  const handleAutoSyncNDT = async () => {
    if (!selectedProject) return;

    try {
      setSyncing(true);
      setSyncStatus(null);
      const result = await ApiService.autoSyncNDTStatus(selectedProject.id);
      setSyncStatus(result);
      fetchJoints();
      // Use defensive coding to handle undefined values
      const syncedCount = result?.synced_count ?? 0;
      const skippedCount = result?.skipped_count ?? 0;
      setMessage(`Auto NDT sync completed: ${syncedCount} joints updated, ${skippedCount} skipped`);
    } catch (error: any) {
      setMessage(error.response?.data?.detail || 'Error auto-syncing NDT data');
    } finally {
      setSyncing(false);
    }
  };

  const handleBulkCreateOrUpdateFitUp = async () => {
    if (!selectedProject || selectedJointIds.length === 0) return;

    const confirmed = window.confirm(
      `Create or update fit-up records for ${selectedJointIds.length} selected master joint(s)? Existing fit-up records will be updated from the latest master joint data.`
    );
    if (!confirmed) return;

    try {
      setLoading(true);
      const result = await ApiService.bulkCreateOrUpdateStructureFitUpFromMasterJoints(selectedJointIds);
      await fetchJoints();
      setSelectedJointIds([]);

      let msg = `Fit-up sync completed: ${result.created_count} created, ${result.updated_count} updated, ${result.skipped_count} skipped.`;
      if (result.errors && result.errors.length > 0) {
        msg += ` ${result.errors.length} error(s) occurred.`;
        console.warn('Bulk fit-up sync errors:', result.errors);
      }
      setMessage(msg);
    } catch (error: any) {
      setMessage(error?.response?.data?.detail || 'Error creating/updating fit-up records from selected master joints');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setUploadFile(e.target.files[0]);
    }
  };

  const downloadRecords = () => {
    // Download ALL columns that match the table display
    const baseHeaders = [
      'Block no',
      'Drawing No',
      'Drawing Rev',
      'Page No',
      'Joint No',
      'Weld Type',
      'Thickness',
      'Structure Category',
      'Part 1 Piece Mark',
      'Part 2 Piece Mark',
      'Inspection Category',
      'Weld Length',
      'Fit Up Report No',
      'Final Report No',
      // NDT Testing Columns
      'NDT RT Report No',
      'NDT RT Result',
      'NDT UT Report No',
      'NDT UT Result',
      'NDT MPI Report No',
      'NDT MPI Result',
      'NDT PT Report No',
      'NDT PT Result',
      'NDT PMI Report No',
      'NDT PMI Result',
      'NDT FT Report No',
      'NDT FT Result',
      'NDT PAUT Report No',
      'NDT PAUT Result',
      'NDT Comprehensive Status'
    ];
    
    const adminHeaders = [
      'NDT Last Sync',
      'NDT Sync Status'
    ];

    const headers = isAdmin() ? [...baseHeaders, ...adminHeaders] : baseHeaders;
    
    const rows = joints.map(j => {
      const baseRow = [
        j.block_no || '',
        j.draw_no || '',
        j.drawing_rev || '',
        j.page_no || '',
        j.joint_no || '',
        j.weld_type || '',
        j.thickness || '',
        j.structure_category || '',
        j.part1_piece_mark_no || '',
        j.part2_piece_mark_no || '',
        j.inspection_category || 'type-I',
        j.weld_length != null ? String(j.weld_length) : '',
        j.fit_up_report_no || '',
        j.final_report_no || '',
        // NDT Testing Columns
        j.ndt_rt_report_no || '',
        j.ndt_rt_result || '',
        j.ndt_ut_report_no || '',
        j.ndt_ut_result || '',
        j.ndt_mpi_report_no || '',
        j.ndt_mpi_result || '',
        j.ndt_pt_report_no || '',
        j.ndt_pt_result || '',
        j.ndt_pmi_report_no || '',
        j.ndt_pmi_result || '',
        j.ndt_ft_report_no || '',
        j.ndt_ft_result || '',
        j.ndt_paut_report_no || '',
        j.ndt_paut_result || '',
        j.ndt_comprehensive_status || ''
      ];

      const adminRow = [
        j.ndt_last_sync || '',
        j.ndt_sync_status || ''
      ];

      return isAdmin() ? [...baseRow, ...adminRow] : baseRow;
    });
    
    const escape = (v: string) => {
      const s = String(v ?? '');
      return '"' + s.replace(/"/g, '""') + '"';
    };
    const csv = [headers.map(escape).join(','), ...rows.map(r => r.map(escape).join(','))].join('\r\n');
    const blob = new Blob(["\ufeff" + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `master_joint_list_structure_complete_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const filteredJoints = useMemo(() => {
    return joints.filter(joint => {
      if (searchBlockNo && !joint.block_no?.toLowerCase().includes(searchBlockNo.toLowerCase())) {
        return false;
      }
      if (searchDrawingNo && !joint.draw_no?.toLowerCase().includes(searchDrawingNo.toLowerCase())) {
        return false;
      }
      if (searchJointNo && !joint.joint_no?.toLowerCase().includes(searchJointNo.toLowerCase())) {
        return false;
      }
      if (searchInspectionCategory && !joint.inspection_category?.toLowerCase().includes(searchInspectionCategory.toLowerCase())) {
        return false;
      }
      if (searchFitUpReportNo && !joint.fit_up_report_no?.toLowerCase().includes(searchFitUpReportNo.toLowerCase())) {
        return false;
      }
      if (searchFinalReportNo && !joint.final_report_no?.toLowerCase().includes(searchFinalReportNo.toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [joints, searchBlockNo, searchDrawingNo, searchJointNo, searchInspectionCategory, searchFitUpReportNo, searchFinalReportNo]);

  const columns: Column[] = [
    { field: 'block_no', headerName: 'Block No', width: 140, editable: true },
    { field: 'draw_no', headerName: 'Drawing No', width: 140, editable: true },
    { field: 'drawing_rev', headerName: 'Drawing Rev', width: 140, editable: true },
    { field: 'page_no', headerName: 'Page No', width: 120, editable: true },
    { field: 'joint_no', headerName: 'Joint No', width: 120, editable: true },
    { field: 'weld_type', headerName: 'Weld Type', width: 140, editable: true },
    { field: 'thickness', headerName: 'Thickness', width: 120, editable: true },
    { field: 'structure_category', headerName: 'Structure Category', width: 160, editable: true },
    { field: 'part1_piece_mark_no', headerName: 'Part 1 Piece Mark', width: 180, editable: true },
    { field: 'part2_piece_mark_no', headerName: 'Part 2 Piece Mark', width: 180, editable: true },
    { field: 'inspection_category', headerName: 'Inspection Category', width: 160, editable: true, type: 'select', 
      options: [
        { value: 'type-I', label: 'Type I' },
        { value: 'type-II', label: 'Type II' },
        { value: 'type-III', label: 'Type III' }
      ]
    },
    { field: 'weld_length', headerName: 'Weld Length', width: 120, editable: true },
    { field: 'fit_up_report_no', headerName: 'Fit Up Report No', width: 160, editable: true },
    { field: 'final_report_no', headerName: 'Final Report No', width: 160, editable: true },
    // NDT Testing Columns
    { field: 'ndt_rt_report_no', headerName: 'RT Report No', width: 150, editable: true },
    { 
      field: 'ndt_rt_result', 
      headerName: 'RT Result', 
      width: 120, 
      editable: true,
      type: 'select',
      options: [
        { value: 'Accepted', label: 'Accepted' },
        { value: 'Rejected', label: 'Rejected' },
        { value: 'Pending', label: 'Pending' }
      ]
    },
    { field: 'ndt_ut_report_no', headerName: 'UT Report No', width: 150, editable: true },
    { 
      field: 'ndt_ut_result', 
      headerName: 'UT Result', 
      width: 120, 
      editable: true,
      type: 'select',
      options: [
        { value: 'Accepted', label: 'Accepted' },
        { value: 'Rejected', label: 'Rejected' },
        { value: 'Pending', label: 'Pending' }
      ]
    },
    { field: 'ndt_mpi_report_no', headerName: 'MPI Report No', width: 150, editable: true },
    { 
      field: 'ndt_mpi_result', 
      headerName: 'MPI Result', 
      width: 120, 
      editable: true,
      type: 'select',
      options: [
        { value: 'Accepted', label: 'Accepted' },
        { value: 'Rejected', label: 'Rejected' },
        { value: 'Pending', label: 'Pending' }
      ]
    },
    { field: 'ndt_pt_report_no', headerName: 'PT Report No', width: 150, editable: true },
    { 
      field: 'ndt_pt_result', 
      headerName: 'PT Result', 
      width: 120, 
      editable: true,
      type: 'select',
      options: [
        { value: 'Accepted', label: 'Accepted' },
        { value: 'Rejected', label: 'Rejected' },
        { value: 'Pending', label: 'Pending' }
      ]
    },
    { field: 'ndt_pmi_report_no', headerName: 'PMI Report No', width: 150, editable: true },
    { 
      field: 'ndt_pmi_result', 
      headerName: 'PMI Result', 
      width: 120, 
      editable: true,
      type: 'select',
      options: [
        { value: 'Accepted', label: 'Accepted' },
        { value: 'Rejected', label: 'Rejected' },
        { value: 'Pending', label: 'Pending' }
      ]
    },
    { field: 'ndt_ft_report_no', headerName: 'FT Report No', width: 150, editable: true },
    { 
      field: 'ndt_ft_result', 
      headerName: 'FT Result', 
      width: 120, 
      editable: true,
      type: 'select',
      options: [
        { value: 'Accepted', label: 'Accepted' },
        { value: 'Rejected', label: 'Rejected' },
        { value: 'Pending', label: 'Pending' }
      ]
    },
    { field: 'ndt_paut_report_no', headerName: 'PAUT Report No', width: 150, editable: true },
    { 
      field: 'ndt_paut_result', 
      headerName: 'PAUT Result', 
      width: 120, 
      editable: true,
      type: 'select',
      options: [
        { value: 'Accepted', label: 'Accepted' },
        { value: 'Rejected', label: 'Rejected' },
        { value: 'Pending', label: 'Pending' }
      ]
    },
    { field: 'ndt_comprehensive_status', headerName: 'NDT Status', width: 150, editable: true },
    ...(isAdmin() ? [
      { field: 'ndt_last_sync', headerName: 'NDT Last Sync', width: 180, editable: false },
      { field: 'ndt_sync_status', headerName: 'NDT Sync Status', width: 150, editable: false },
    ] : [])
  ];

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
          Structure Master Joint List
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={fetchJoints}
            disabled={loading}
          >
            Refresh
          </Button>

          <Button
            variant="outlined"
            startIcon={<Download />}
            onClick={downloadRecords}
          >
            Download Records
          </Button>
          {canEdit() && (
            <Button
              variant="contained"
              color="secondary"
              startIcon={<Add />}
              onClick={handleBulkCreateOrUpdateFitUp}
              disabled={loading || selectedJointIds.length === 0}
            >
              {selectedJointIds.length > 0
                ? `Create/Update Fit Up (${selectedJointIds.length})`
                : 'Create/Update Fit Up'}
            </Button>
          )}
          {canEdit() && (
            <>
              <Button
                variant="outlined"
                startIcon={<Upload />}
                onClick={() => setUploadOpen(true)}
              >
                Upload CSV
              </Button>
              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={() => setOpen(true)}
              >
                Add Joint
              </Button>
            </>
          )}
          <Tooltip title="Sync NDT Status from NDT Status Table (auto-sync when fitup/final completed)">
            <Button
              variant="contained"
              color="primary"
              startIcon={syncing ? <CircularProgress size={20} /> : <Sync />}
              onClick={handleAutoSyncNDT}
              disabled={syncing || !canEdit()}
            >
              Sync NDT
            </Button>
          </Tooltip>
        </Box>
      </Box>

      {message && (
        <Alert severity={message.toLowerCase().includes('successfully') || message.includes('Auto NDT sync completed') ? 'success' : 'error'} sx={{ mb: 2 }} onClose={() => setMessage('')}>
          {message}
        </Alert>
      )}

      {/* Search Section */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Search Joints
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={4} md={2}>
            <TextField
              fullWidth
              size="small"
              label="Block No"
              value={searchBlockNo}
              onChange={(e) => setSearchBlockNo(e.target.value)}
            />
          </Grid>
          <Grid item xs={12} sm={4} md={2}>
            <TextField
              fullWidth
              size="small"
              label="Drawing No"
              value={searchDrawingNo}
              onChange={(e) => setSearchDrawingNo(e.target.value)}
            />
          </Grid>
          <Grid item xs={12} sm={4} md={2}>
            <TextField
              fullWidth
              size="small"
              label="Joint No"
              value={searchJointNo}
              onChange={(e) => setSearchJointNo(e.target.value)}
            />
          </Grid>
          <Grid item xs={12} sm={4} md={2}>
            <TextField
              fullWidth
              size="small"
              label="Insp Category"
              value={searchInspectionCategory}
              onChange={(e) => setSearchInspectionCategory(e.target.value)}
            />
          </Grid>
          <Grid item xs={12} sm={4} md={2}>
            <TextField
              fullWidth
              size="small"
              label="FitUp Report"
              value={searchFitUpReportNo}
              onChange={(e) => setSearchFitUpReportNo(e.target.value)}
            />
          </Grid>
          <Grid item xs={12} sm={4} md={2}>
            <TextField
              fullWidth
              size="small"
              label="Final Report"
              value={searchFinalReportNo}
              onChange={(e) => setSearchFinalReportNo(e.target.value)}
            />
          </Grid>
        </Grid>
      </Paper>

      <Paper sx={{ p: 2, height: 650, width: '100%' }}>
        <EditableTable
          data={filteredJoints}
          columns={columns}
          onUpdate={handleUpdate}
          onDelete={canDelete() ? handleDelete : undefined}
          loading={loading}
          maxHeight={600}
          selectedIds={selectedJointIds}
          onSelectionChange={setSelectedJointIds}
        />
      </Paper>

      {/* Add Joint Dialog */}
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Add New Joint</DialogTitle>
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
                label="Drawing No"
                value={formData.draw_no}
                onChange={(e) => setFormData({ ...formData, draw_no: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Drawing Rev"
                value={formData.drawing_rev}
                onChange={(e) => setFormData({ ...formData, drawing_rev: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Page No"
                value={formData.page_no}
                onChange={(e) => setFormData({ ...formData, page_no: e.target.value })}
                required
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
                label="Weld Type"
                value={formData.weld_type}
                onChange={(e) => setFormData({ ...formData, weld_type: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Thickness"
                value={formData.thickness}
                onChange={(e) => setFormData({ ...formData, thickness: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Structure Category"
                value={formData.structure_category}
                onChange={(e) => setFormData({ ...formData, structure_category: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Part 1 Piece Mark"
                value={formData.part1_piece_mark_no}
                onChange={(e) => setFormData({ ...formData, part1_piece_mark_no: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Part 2 Piece Mark"
                value={formData.part2_piece_mark_no}
                onChange={(e) => setFormData({ ...formData, part2_piece_mark_no: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Inspection Category</InputLabel>
                <Select
                  value={formData.inspection_category}
                  label="Inspection Category"
                  onChange={(e) => setFormData({ ...formData, inspection_category: e.target.value })}
                >
                  <MenuItem value="type-I">Type I</MenuItem>
                  <MenuItem value="type-II">Type II</MenuItem>
                  <MenuItem value="type-III">Type III</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                type="number"
                label="Weld Length"
                value={formData.weld_length || ''}
                onChange={(e) => setFormData({ ...formData, weld_length: e.target.value ? Number(e.target.value) : undefined })}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained" color="primary">
            Create
          </Button>
        </DialogActions>
      </Dialog>

      {/* Upload Dialog */}
      <Dialog open={uploadOpen} onClose={() => setUploadOpen(false)}>
        <DialogTitle>Upload Master Joint List</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileChange}
              style={{ display: 'block', width: '100%' }}
            />
            <Typography variant="caption" color="textSecondary" sx={{ mt: 1, display: 'block' }}>
              Supported formats: CSV, Excel (.xlsx, .xls)
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUploadOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleFileUpload} 
            variant="contained" 
            color="primary"
            disabled={!uploadFile || uploading}
          >
            {uploading ? 'Uploading...' : 'Upload'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default MasterJointList;
