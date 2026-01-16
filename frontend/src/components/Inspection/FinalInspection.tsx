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
  FormControlLabel,
  Checkbox,
  Tooltip
} from '@mui/material';
import { Checklist, Refresh, Add, Edit, Delete, Warning, Info } from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import ApiService from '../../services/api';
import { FinalInspection as FinalInspectionType, FitUpInspection } from '../../types';
import { calculateWeldLengthFromDiameter, validateWeldLength, isPipeProject } from '../../utils/weldLengthCalculator';

type NewFinalInspection = Omit<FinalInspectionType, 'id' | 'created_at'>;

const FinalInspection: React.FC = () => {
  const { selectedProject, user, canEdit, canDelete, isAdmin } = useAuth();
  const isStructureProject = selectedProject?.project_type === 'structure';
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
    system_no: '',
    line_no: '',
    spool_no: '',
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
    inspection_category: 'type-I'
  });
  const [repairWorkOverride, setRepairWorkOverride] = useState<boolean>(false);
  const [weldLengthValidation, setWeldLengthValidation] = useState<{
    isValid: boolean;
    calculatedLength?: number;
    difference?: number;
    percentageDiff?: number;
    message: string;
  } | null>(null);
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

  const keyFor = (obj: { system_no?: string; line_no?: string; spool_no?: string; joint_no?: string }) =>
    `${(obj.system_no||'').trim()}-${(obj.line_no||'').trim()}-${(obj.spool_no||'').trim()}-${(obj.joint_no||'').trim()}`;

  const makeJointKey = (line?: string | null, spool?: string | null, joint?: string | null) =>
    `${(line || '').trim().toLowerCase()}-${(spool || '').trim().toLowerCase()}-${(joint || '').trim().toLowerCase()}`;

  const findFitupByForm = () => {
    return fitupRecords.find(m =>
      (m.system_no||'').trim() === (formData.system_no||'').trim() &&
      (m.line_no||'').trim() === (formData.line_no||'').trim() &&
      (m.spool_no||'').trim() === (formData.spool_no||'').trim() &&
      (m.joint_no||'').trim() === (formData.joint_no||'').trim()
    );
  };

  // Update weld length validation when pipe_dia or weld_length changes
  useEffect(() => {
    if (isPipeProject(selectedProject?.project_type)) {
      const validation = validateWeldLength(formData.weld_length, formData.pipe_dia, repairWorkOverride ? 1000 : 0.1);
      setWeldLengthValidation(validation);
    } else {
      setWeldLengthValidation(null);
    }
  }, [formData.weld_length, formData.pipe_dia, repairWorkOverride, selectedProject?.project_type]);

  const applyFitupJoint = (fitupId: number) => {
    const fu = fitupRecords.find(j => j.id === fitupId);
    if (!fu) return;
    
    const calculatedLength = calculateWeldLengthFromDiameter(fu.dia || '');
    
    setFormData({
      ...formData,
      fitup_id: fu.id,
      system_no: fu.system_no || '',
      line_no: fu.line_no || '',
      spool_no: fu.spool_no || '',
      joint_no: fu.joint_no || '',
      weld_type: fu.weld_type || '',
      weld_length: calculatedLength || fu.weld_length || 0,
      pipe_dia: fu.dia || ''
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
        const opts = await ApiService.getFinalFilters(selectedProject.id);
        setFilterOptions(opts || { system_no: [], spool_no: [], joint_no: [], final_report_no: [], final_result: [] });
      } catch {}
    };
    loadFilters();
  }, [selectedProject]);

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
      inspection_category: 'type-I'
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
      system_no: record.system_no || '',
      line_no: record.line_no || '',
      spool_no: record.spool_no || '',
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
      inspection_category: record.inspection_category || 'type-I'
    });
    setEditDialogOpen(true);
  };

  const handleDeleteClick = (record: FinalInspectionType) => {
    setSelectedRecord(record);
    setDeleteDialogOpen(true);
  };

  const handleAddSubmit = async () => {
    if (selectedProject?.project_type === 'pipe') {
      const key = makeJointKey(formData.line_no, formData.spool_no, formData.joint_no);
      if (key !== '--') {
        const exists = records.some(r => makeJointKey(r.line_no, r.spool_no, r.joint_no) === key);
        if (exists) {
          setError('Duplicate joint in final inspection: same line, spool and joint already exists');
          return;
        }
      }
    }
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
    
    if (selectedProject?.project_type === 'pipe') {
      const key = makeJointKey(formData.line_no, formData.spool_no, formData.joint_no);
      if (key !== '--') {
        const exists = records.some(r => r.id !== selectedRecord.id && makeJointKey(r.line_no, r.spool_no, r.joint_no) === key);
        if (exists) {
          setError('Duplicate joint in final inspection: same line, spool and joint already exists');
          return;
        }
      }
    }
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
            remarks: nextRecord.remarks || ''
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
    const headers = isStructureProject
      ? [
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
          'Size',
          'Final Date',
          'Report No',
          'Result',
          'Fit-up Link'
        ]
      : [
          'System No',
          'Line No',
          'Spool No',
          'Joint No',
          'Weld Type',
          'WPS No',
          'Welder No',
          'Welder Validity',
          'NDT Type',
          'Weld Length',
          ...(selectedProject?.project_type === 'pipe' ? ['Pipe Dia'] : []),
          'Final Date',
          'Report No',
          'Result',
          'Fit-up Link'
        ];
    const rows = filteredRecords.map(record => {
      const inFitup = fitupRecords.length > 0 ? (
        fitupRecords.some(m =>
          (m.system_no||'').trim() === (record.system_no||'').trim() &&
          (m.line_no||'').trim() === (record.line_no||'').trim() &&
          (m.spool_no||'').trim() === (record.spool_no||'').trim() &&
          (m.joint_no||'').trim() === (record.joint_no||'').trim()
        )
      ) : false;
      const fitupLink = fitupRecords.length === 0 ? '-' : (inFitup ? 'In Fit-up' : 'Fit-up Missing');
      const lengthStr = record.weld_length ? `${record.weld_length} mm` : '';
      const dateStr = formatDate(record.final_date);
      return isStructureProject
        ? [
            record.spool_no || '',
            record.system_no || '',
            record.line_no || '',
            record.joint_no || '',
            record.weld_type || '',
            record.wps_no || '',
            record.welder_no || '',
            record.welder_validity || '',
            record.ndt_type || '',
            lengthStr,
            record.pipe_dia || '',
            dateStr,
            record.final_report_no || '',
            record.final_result || '',
            fitupLink
          ]
        : [
            record.system_no || '',
            record.line_no || '',
            record.spool_no || '',
            record.joint_no || '',
            record.weld_type || '',
            record.wps_no || '',
            record.welder_no || '',
            record.welder_validity || '',
            record.ndt_type || '',
            lengthStr,
            ...(selectedProject?.project_type === 'pipe' ? [record.pipe_dia || ''] : []),
            dateStr,
            record.final_report_no || '',
            record.final_result || '',
            fitupLink
          ];
    });
    const escape = (v: string) => {
      const s = String(v ?? '');
      return '"' + s.replace(/\"/g, '""') + '"';
    };
    const csv = [headers.map(escape).join(','), ...rows.map(r => r.map(escape).join(','))].join('\r\n');
    const blob = new Blob(["\ufeff" + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `final_records_${selectedProject?.code || 'project'}_${new Date().toISOString().slice(0,10)}.csv`;
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
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Checklist sx={{ fontSize: 40, mr: 2, color: 'primary.main' }} />
          <Box>
            <Typography variant="h4" component="h1" gutterBottom>
              {isStructureProject ? 'Structure Final Inspection' : 'Pipe Final Inspection'}
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
            onClick={fetchFinalRecords}
            disabled={loading}
            sx={{ mr: 2 }}
          >
            Refresh
          </Button>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={handleAddClick}
            disabled={!canEdit()}
          >
            Add Final Inspection
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
                {records.filter(r => r.final_result?.toLowerCase() === 'accepted').length}
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
                {records.filter(r => r.final_result?.toLowerCase() === 'rejected').length}
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
                {records.filter(r => !r.final_result || r.final_result?.toLowerCase() === 'pending').length}
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
              <InputLabel>{isStructureProject ? 'Structure Category' : 'System No'}</InputLabel>
              <Select
                label={isStructureProject ? 'Structure Category' : 'System No'}
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
              <InputLabel>{isStructureProject ? 'Drawing No' : 'Spool No'}</InputLabel>
              <Select
                label={isStructureProject ? 'Drawing No' : 'Spool No'}
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
                value={search.final_report_no}
                onChange={(e) => setSearch({ ...search, final_report_no: String(e.target.value) })}
              >
                <MenuItem value="">All</MenuItem>
                {filterOptions.final_report_no.map(v => (
                  <MenuItem key={v} value={v}>{v}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6} md={2.4 as any}>
            <FormControl fullWidth>
              <InputLabel>Result</InputLabel>
              <Select
                label="Result"
                value={search.final_result}
                onChange={(e) => setSearch({ ...search, final_result: String(e.target.value) })}
              >
                <MenuItem value="">All</MenuItem>
                {filterOptions.final_result.map(v => (
                  <MenuItem key={v} value={v}>{v}</MenuItem>
                ))}
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
                onClick={() => setSearch({ system_no: '', spool_no: '', joint_no: '', final_report_no: '', final_result: '' })}
              >
                Clear Filters
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* Records Table */}
      {!loading && (
        <TableContainer component={Paper}>
          <Table sx={{ minWidth: 650 }} aria-label="final inspection records table">
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox" />
              {isStructureProject ? (
                <>
                  <TableCell><strong>Drawing No</strong></TableCell>
                  <TableCell><strong>Structure Category</strong></TableCell>
                  <TableCell><strong>Page No</strong></TableCell>
                </>
              ) : (
                <>
                  <TableCell><strong>System No</strong></TableCell>
                  <TableCell><strong>Line No</strong></TableCell>
                  <TableCell><strong>Spool No</strong></TableCell>
                </>
              )}
              <TableCell><strong>Joint No</strong></TableCell>
              <TableCell><strong>Weld Type</strong></TableCell>
              <TableCell><strong>Inspection Category</strong></TableCell>
              <TableCell><strong>WPS No</strong></TableCell>
              <TableCell><strong>Welder No</strong></TableCell>
              <TableCell><strong>Welder Validity</strong></TableCell>
              <TableCell><strong>NDT Type</strong></TableCell>
              <TableCell><strong>Weld Site</strong></TableCell>
              <TableCell><strong>Weld Length</strong></TableCell>
              {selectedProject?.project_type === 'pipe' && (
                <TableCell><strong>Pipe Dia</strong></TableCell>
              )}
              <TableCell><strong>Final Date</strong></TableCell>
              <TableCell><strong>Report No</strong></TableCell>
              <TableCell><strong>Result</strong></TableCell>
              <TableCell><strong>Fit-up Link</strong></TableCell>
              <TableCell><strong>Actions</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
              {records.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={isStructureProject ? 16 : 17} align="center" sx={{ py: 4 }}>
                    <Typography variant="body1" color="textSecondary">
                      No final inspection records found for this project.
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
                  <TableCell colSpan={isStructureProject ? 16 : 17} align="center" sx={{ py: 4 }}>
                    <Typography variant="body1" color="textSecondary">
                      No records match current search.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filteredRecords.map((record) => (
                  <TableRow key={record.id} hover selected={selectedRows.includes(record.id)}>
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={selectedRows.includes(record.id)}
                        onChange={() => {
                          setSelectedRows(prev =>
                            prev.includes(record.id)
                              ? prev.filter(id => id !== record.id)
                              : [...prev, record.id]
                          );
                        }}
                      />
                    </TableCell>
                    {isStructureProject ? (
                      <>
                        <TableCell>{record.spool_no || 'N/A'}</TableCell>
                        <TableCell>{record.system_no || 'N/A'}</TableCell>
                        <TableCell>{record.line_no || 'N/A'}</TableCell>
                      </>
                    ) : (
                      <>
                        <TableCell>{record.system_no || 'N/A'}</TableCell>
                        <TableCell>{record.line_no || 'N/A'}</TableCell>
                        <TableCell>{record.spool_no || 'N/A'}</TableCell>
                      </>
                    )}
                    <TableCell>{record.joint_no || 'N/A'}</TableCell>
                    <TableCell>{record.weld_type || 'N/A'}</TableCell>
                    <TableCell>{record.inspection_category || 'type-I'}</TableCell>
                    <TableCell>{record.wps_no || 'N/A'}</TableCell>
                    <TableCell>{record.welder_no || 'N/A'}</TableCell>
                    <TableCell>{record.welder_validity || 'N/A'}</TableCell>
                    <TableCell>{record.ndt_type || 'N/A'}</TableCell>
                    <TableCell>
                      <Chip 
                        label={record.weld_site || 'N/A'} 
                        size="small" 
                        color={record.weld_site === 'shop weld' ? 'primary' : 'secondary'}
                      />
                    </TableCell>
                    <TableCell>
                      {record.weld_length ? `${record.weld_length} mm` : 'N/A'}
                    </TableCell>
                    {selectedProject?.project_type === 'pipe' && (
                      <TableCell>{record.pipe_dia || 'N/A'}</TableCell>
                    )}
                    <TableCell>{formatDate(record.final_date)}</TableCell>
                    <TableCell>{record.final_report_no || 'N/A'}</TableCell>
                    <TableCell>
                      <Chip 
                        label={record.final_result || 'Pending'} 
                        color={getStatusColor(record.final_result) as any}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      {fitupRecords.length > 0 ? (
                        fitupRecords.some(m =>
                          (m.system_no||'').trim() === (record.system_no||'').trim() &&
                          (m.line_no||'').trim() === (record.line_no||'').trim() &&
                          (m.spool_no||'').trim() === (record.spool_no||'').trim() &&
                          (m.joint_no||'').trim() === (record.joint_no||'').trim()
                        ) ? (
                          <Chip label="In Fit-up" color="success" size="small" variant="outlined" />
                        ) : (
                          <Chip label="Fit-up Missing" color="warning" size="small" variant="outlined" />
                        )
                      ) : (
                        <Chip label="-" size="small" variant="outlined" />
                      )}
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const accepted = (record.final_result || '').toLowerCase() === 'accepted';
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
        </TableContainer>
      )}

      {/* Information Footer */}
      <Box sx={{ mt: 4, p: 2, backgroundColor: 'grey.50', borderRadius: 1 }}>
        <Typography variant="body2" color="textSecondary">
          <strong>Note:</strong> This page displays all final inspection records for the selected project. 
          Final inspections are typically performed after fit-up inspections and before NDT requests.
        </Typography>
      </Box>

      {/* Add Final Inspection Dialog */}
      <Dialog open={addDialogOpen} onClose={() => setAddDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Add New {isStructureProject ? 'Structure Final' : 'Final'} Inspection</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Fit-up Joint</InputLabel>
                <Select
                  value={formData.fitup_id || ''}
                  label="Fit-up Joint"
                  onChange={(e) => applyFitupJoint(Number(e.target.value))}
                >
                  {fitupRecords.map(j => (
                    <MenuItem key={j.id} value={j.id}>{keyFor(j)}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label={isStructureProject ? 'Structure Category' : 'System No'}
                value={formData.system_no}
                onChange={(e) => setFormData({ ...formData, system_no: e.target.value })}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label={isStructureProject ? 'Page No' : 'Line No'}
                value={formData.line_no}
                onChange={(e) => setFormData({ ...formData, line_no: e.target.value })}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label={isStructureProject ? 'Drawing No' : 'Spool No'}
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
              <FormControl fullWidth>
                <InputLabel>WPS No</InputLabel>
                <Select
                  value={formData.wps_no || ''}
                  label="WPS No"
                  onChange={(e) => setFormData({ ...formData, wps_no: String(e.target.value) })}
                >
                  {wpsList.map((w: any) => (
                    <MenuItem key={w.id} value={w.wps_no}>{w.wps_no}{w.job_trade || w.position ? ` • ${[w.job_trade, w.position].filter(Boolean).join(' / ')}` : ''}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            {(() => {
              const sel = wpsList.find((w: any) => w.wps_no === formData.wps_no);
              if (!sel) return null;
              return (
                <Grid item xs={12}>
                  <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
                    <Typography variant="subtitle2" gutterBottom>WPS Details</Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={6} md={3}>
                        <Typography variant="caption" color="text.secondary">Job Trade</Typography>
                        <Typography variant="body2">{sel.job_trade || '-'}</Typography>
                      </Grid>
                      <Grid item xs={12} sm={6} md={3}>
                        <Typography variant="caption" color="text.secondary">Position</Typography>
                        <Typography variant="body2">{sel.position || '-'}</Typography>
                      </Grid>
                      <Grid item xs={12} sm={6} md={3}>
                        <Typography variant="caption" color="text.secondary">Qualified Material</Typography>
                        <Typography variant="body2">{sel.material_group || '-'}</Typography>
                      </Grid>
                      <Grid item xs={12} sm={6} md={3}>
                        <Typography variant="caption" color="text.secondary">Thickness Range</Typography>
                        <Typography variant="body2">{sel.thickness_range || '-'}</Typography>
                      </Grid>
                      <Grid item xs={12}>
                        <Typography variant="caption" color="text.secondary">Process</Typography>
                        <Box sx={{ mt: 0.5 }}>
                          {(sel.process || '')
                            .split(',')
                            .map((p: string, idx: number) => (
                              <Chip key={idx} label={p.trim()} size="small" sx={{ mr: 0.5, mb: 0.5 }} />
                            ))}
                        </Box>
                      </Grid>
                    </Grid>
                  </Paper>
                </Grid>
              );
            })()}
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Welder No</InputLabel>
                <Select
                  value={formData.welder_no || ''}
                  label="Welder No"
                  onChange={(e) => {
                    const val = String(e.target.value);
                    // Find by welder_no string in list to keep value consistent
                    const w = welderList.find((x: any) => x.welder_no === val);
                    if (w) {
                      setFormData({ ...formData, welder_no: w.welder_no, welder_validity: w.validity || '' });
                    } else {
                      setFormData({ ...formData, welder_no: val });
                    }
                  }}
                >
                  {welderList.map((w: any) => (
                    <MenuItem key={w.id} value={w.welder_no}>{w.welder_no}{w.welder_name ? ` - ${w.welder_name}` : ''}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField label="Welder Validity" value={formData.welder_validity || ''} fullWidth disabled />
            </Grid>
            {(() => {
              const sel = welderList.find((w: any) => w.welder_no === formData.welder_no);
              if (!sel) return null;
              return (
                <Grid item xs={12}>
                  <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
                    <Typography variant="subtitle2" gutterBottom>Welder Details</Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={6} md={3}>
                        <Typography variant="caption" color="text.secondary">Job Trade</Typography>
                        <Typography variant="body2">{sel.weld_process || '-'}</Typography>
                      </Grid>
                      <Grid item xs={12} sm={6} md={3}>
                        <Typography variant="caption" color="text.secondary">Position</Typography>
                        <Typography variant="body2">{sel.qualified_position || '-'}</Typography>
                      </Grid>
                      <Grid item xs={12} sm={6} md={3}>
                        <Typography variant="caption" color="text.secondary">Qualified Material</Typography>
                        <Typography variant="body2">{sel.qualified_material || '-'}</Typography>
                      </Grid>
                      <Grid item xs={12} sm={6} md={3}>
                        <Typography variant="caption" color="text.secondary">Thickness Range</Typography>
                        <Typography variant="body2">{sel.thickness_range || '-'}</Typography>
                      </Grid>
                    </Grid>
                  </Paper>
                </Grid>
              );
            })()}
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>NDT Type</InputLabel>
                <Select
                  multiple
                  value={(formData.ndt_type ? formData.ndt_type.split(',') : []) as any}
                  label="NDT Type"
                  onChange={(e) => setFormData({ ...formData, ndt_type: (e.target.value as string[]).join(',') })}
                  renderValue={(selected) => (selected as string[]).join(', ')}
                >
                  {ndtOptions.map((opt) => (
                    <MenuItem key={opt} value={opt}>{opt}</MenuItem>
                  ))}
                </Select>
              </FormControl>
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
            {selectedProject?.project_type === 'pipe' && (
              <>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Pipe Dia"
                    value={formData.pipe_dia}
                    onChange={(e) => {
                      const v = e.target.value;
                      const calculatedLength = calculateWeldLengthFromDiameter(v);
                      setFormData({ 
                        ...formData, 
                        pipe_dia: v, 
                        weld_length: calculatedLength || formData.weld_length 
                      });
                    }}
                    fullWidth
                    helperText={'Enter diameter with unit (e.g., 12" or 300mm)'}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Weld Length (mm)"
                    type="number"
                    value={formData.weld_length}
                    onChange={(e) => setFormData({ ...formData, weld_length: Number(e.target.value) })}
                    fullWidth
                    error={!!(weldLengthValidation && !weldLengthValidation.isValid)}
                    helperText={weldLengthValidation?.message}
                    InputProps={{
                      endAdornment: weldLengthValidation && (
                        <Tooltip title={weldLengthValidation.message}>
                          {weldLengthValidation.isValid ? (
                            <Info color="success" sx={{ mr: 1 }} />
                          ) : (
                            <Warning color="error" sx={{ mr: 1 }} />
                          )}
                        </Tooltip>
                      )
                    }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={repairWorkOverride}
                        onChange={(e) => setRepairWorkOverride(e.target.checked)}
                      />
                    }
                    label="Repair Work - Allow manual weld length override"
                  />
                  {repairWorkOverride && (
                    <Typography variant="caption" color="textSecondary" sx={{ ml: 4, display: 'block' }}>
                      Manual override enabled. Weld length validation is disabled for repair work.
                    </Typography>
                  )}
                </Grid>
              </>
            )}
            {selectedProject?.project_type !== 'pipe' && (
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Weld Length (mm)"
                  type="number"
                  value={formData.weld_length}
                  onChange={(e) => setFormData({ ...formData, weld_length: Number(e.target.value) })}
                  fullWidth
                />
              </Grid>
            )}
            <Grid item xs={12} sm={6}>
              <TextField
                label="Final Date"
                type="date"
                value={formData.final_date}
                onChange={(e) => setFormData({ ...formData, final_date: e.target.value })}
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Final Report No"
                value={formData.final_report_no}
                onChange={(e) => setFormData({ ...formData, final_report_no: e.target.value })}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                select
                label="Inspection Category"
                value={formData.inspection_category || 'type-I'}
                onChange={(e) => setFormData({ ...formData, inspection_category: e.target.value as NewFinalInspection['inspection_category'] })}
                fullWidth
              >
                <MenuItem value="type-I">Type I</MenuItem>
                <MenuItem value="type-II">Type II</MenuItem>
                <MenuItem value="type-III">Type III</MenuItem>
                <MenuItem value="type-IV">Special</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Final Result</InputLabel>
                <Select
                  value={formData.final_result}
                  label="Final Result"
                  onChange={(e) => setFormData({ ...formData, final_result: e.target.value })}
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
          <Button onClick={handleAddSubmit} variant="contained">
            Add Final Inspection
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Final Inspection Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Edit {isStructureProject ? 'Structure Final' : 'Final'} Inspection</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Fit-up Joint</InputLabel>
                <Select
                  value={formData.fitup_id || ''}
                  label="Fit-up Joint"
                  onChange={(e) => applyFitupJoint(Number(e.target.value))}
                >
                  {fitupRecords.map(j => (
                    <MenuItem key={j.id} value={j.id}>{keyFor(j)}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label={isStructureProject ? 'Structure Category' : 'System No'}
                value={formData.system_no}
                onChange={(e) => setFormData({ ...formData, system_no: e.target.value })}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label={isStructureProject ? 'Page No' : 'Line No'}
                value={formData.line_no}
                onChange={(e) => setFormData({ ...formData, line_no: e.target.value })}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label={isStructureProject ? 'Drawing No' : 'Spool No'}
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
              <FormControl fullWidth>
                <InputLabel>WPS No</InputLabel>
                <Select
                  value={formData.wps_no || ''}
                  label="WPS No"
                  onChange={(e) => setFormData({ ...formData, wps_no: String(e.target.value) })}
                >
                  {wpsList.map((w: any) => (
                    <MenuItem key={w.id} value={w.wps_no}>{w.wps_no}{w.job_trade || w.position ? ` • ${[w.job_trade, w.position].filter(Boolean).join(' / ')}` : ''}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            {(() => {
              const sel = wpsList.find((w: any) => w.wps_no === formData.wps_no);
              if (!sel) return null;
              return (
                <Grid item xs={12}>
                  <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
                    <Typography variant="subtitle2" gutterBottom>WPS Details</Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={6} md={3}>
                        <Typography variant="caption" color="text.secondary">Job Trade</Typography>
                        <Typography variant="body2">{sel.job_trade || '-'}</Typography>
                      </Grid>
                      <Grid item xs={12} sm={6} md={3}>
                        <Typography variant="caption" color="text.secondary">Position</Typography>
                        <Typography variant="body2">{sel.position || '-'}</Typography>
                      </Grid>
                      <Grid item xs={12} sm={6} md={3}>
                        <Typography variant="caption" color="text.secondary">Qualified Material</Typography>
                        <Typography variant="body2">{sel.material_group || '-'}</Typography>
                      </Grid>
                      <Grid item xs={12} sm={6} md={3}>
                        <Typography variant="caption" color="text.secondary">Thickness Range</Typography>
                        <Typography variant="body2">{sel.thickness_range || '-'}</Typography>
                      </Grid>
                      <Grid item xs={12}>
                        <Typography variant="caption" color="text.secondary">Process</Typography>
                        <Box sx={{ mt: 0.5 }}>
                          {(sel.process || '')
                            .split(',')
                            .map((p: string, idx: number) => (
                              <Chip key={idx} label={p.trim()} size="small" sx={{ mr: 0.5, mb: 0.5 }} />
                            ))}
                        </Box>
                      </Grid>
                    </Grid>
                  </Paper>
                </Grid>
              );
            })()}
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Welder No</InputLabel>
                <Select
                  value={formData.welder_no || ''}
                  label="Welder No"
                  onChange={(e) => {
                    const val = String(e.target.value);
                    const w = welderList.find((x: any) => x.welder_no === val);
                    if (w) {
                      setFormData({ ...formData, welder_no: w.welder_no, welder_validity: w.validity || '' });
                    } else {
                      setFormData({ ...formData, welder_no: val });
                    }
                  }}
                >
                  {welderList.map((w: any) => (
                    <MenuItem key={w.id} value={w.welder_no}>{w.welder_no}{w.welder_name ? ` - ${w.welder_name}` : ''}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField label="Welder Validity" value={formData.welder_validity || ''} fullWidth disabled />
            </Grid>
            {(() => {
              const sel = welderList.find((w: any) => w.welder_no === formData.welder_no);
              if (!sel) return null;
              return (
                <Grid item xs={12}>
                  <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
                    <Typography variant="subtitle2" gutterBottom>Welder Details</Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={6} md={3}>
                        <Typography variant="caption" color="text.secondary">Job Trade</Typography>
                        <Typography variant="body2">{sel.weld_process || '-'}</Typography>
                      </Grid>
                      <Grid item xs={12} sm={6} md={3}>
                        <Typography variant="caption" color="text.secondary">Position</Typography>
                        <Typography variant="body2">{sel.qualified_position || '-'}</Typography>
                      </Grid>
                      <Grid item xs={12} sm={6} md={3}>
                        <Typography variant="caption" color="text.secondary">Qualified Material</Typography>
                        <Typography variant="body2">{sel.qualified_material || '-'}</Typography>
                      </Grid>
                      <Grid item xs={12} sm={6} md={3}>
                        <Typography variant="caption" color="text.secondary">Thickness Range</Typography>
                        <Typography variant="body2">{sel.thickness_range || '-'}</Typography>
                      </Grid>
                    </Grid>
                  </Paper>
                </Grid>
              );
            })()}
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>NDT Type</InputLabel>
                <Select
                  multiple
                  value={(formData.ndt_type ? formData.ndt_type.split(',') : []) as any}
                  label="NDT Type"
                  onChange={(e) => setFormData({ ...formData, ndt_type: (e.target.value as string[]).join(',') })}
                  renderValue={(selected) => (selected as string[]).join(', ')}
                >
                  {ndtOptions.map((opt) => (
                    <MenuItem key={opt} value={opt}>{opt}</MenuItem>
                  ))}
                </Select>
              </FormControl>
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
            {selectedProject?.project_type === 'pipe' && (
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Pipe Dia"
                  value={formData.pipe_dia}
                  onChange={(e) => setFormData({ ...formData, pipe_dia: e.target.value })}
                  fullWidth
                />
              </Grid>
            )}
            <Grid item xs={12} sm={6}>
              <TextField
                label="Final Date"
                type="date"
                value={formData.final_date}
                onChange={(e) => setFormData({ ...formData, final_date: e.target.value })}
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Final Report No"
                value={formData.final_report_no}
                onChange={(e) => setFormData({ ...formData, final_report_no: e.target.value })}
                fullWidth
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
          <Button onClick={handleEditSubmit} variant="contained">
            Update Final Inspection
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this final inspection record? This action cannot be undone.
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

export default FinalInspection;
