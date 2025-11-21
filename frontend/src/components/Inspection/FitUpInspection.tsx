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
  Select
} from '@mui/material';
import { Assignment, Refresh, Add, Edit, Delete } from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import ApiService from '../../services/api';
import { FitUpInspection as FitUpInspectionType, MaterialRegister as MaterialRegisterType, MasterJointList as MasterJointListType } from '../../types';

type NewFitUpInspection = Omit<FitUpInspectionType, 'id' | 'project_id' | 'created_at' | 'updated_at'>;

const FitUpInspection: React.FC = () => {
  const { selectedProject } = useAuth();
  const [records, setRecords] = useState<FitUpInspectionType[]>([]);
  const [materials, setMaterials] = useState<MaterialRegisterType[]>([]);
  const [masterJoints, setMasterJoints] = useState<MasterJointListType[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<FitUpInspectionType | null>(null);
  const [formData, setFormData] = useState<NewFitUpInspection>({
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
    dia: '',
    fit_up_date: '',
    fit_up_report_no: '',
    fit_up_result: '',
    remarks: '',
    master_joint_id: undefined
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
    try {
      const data = await ApiService.getFitUpInspections(selectedProject.id);
      setRecords(data);
      try {
        const opts = await ApiService.getFitUpFilters(selectedProject.id);
        setFilterOptions(opts || { system_no: [], spool_no: [], joint_no: [], fit_up_report_no: [], fit_up_result: [] });
      } catch {}
    } catch (err) {
      setError('Failed to fetch fit-up records');
      console.error('Error fetching fit-up records:', err);
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

  // Handler functions
  const handleAddClick = () => {
    setFormData({
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
      dia: '',
      fit_up_date: '',
      fit_up_report_no: '',
      fit_up_result: '',
      remarks: '',
      master_joint_id: undefined
    });
    setAddDialogOpen(true);
  };

  const handleEditClick = (record: FitUpInspectionType) => {
    setSelectedRecord(record);
    setFormData({
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
      dia: record.dia || '',
      fit_up_date: record.fit_up_date || '',
      fit_up_report_no: record.fit_up_report_no || '',
      fit_up_result: record.fit_up_result || '',
      remarks: record.remarks || '',
      master_joint_id: record.master_joint_id
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

  const keyFor = (obj: { system_no?: string; line_no?: string; spool_no?: string; joint_no?: string }) =>
    `${(obj.system_no||'').trim()}-${(obj.line_no||'').trim()}-${(obj.spool_no||'').trim()}-${(obj.joint_no||'').trim()}`;

  const findMasterByForm = () => {
    return masterJoints.find(m =>
      (m.system_no||'').trim() === (formData.system_no||'').trim() &&
      (m.line_no||'').trim() === (formData.line_no||'').trim() &&
      (m.spool_no||'').trim() === (formData.spool_no||'').trim() &&
      (m.joint_no||'').trim() === (formData.joint_no||'').trim()
    );
  };

  const applyMasterJoint = (jointId: number) => {
    const mj = masterJoints.find(j => j.id === jointId);
    if (!mj) return;
    const calc = (s: string) => {
      const m = s?.match(/([0-9]+(?:\.[0-9]+)?)/);
      const v = m ? parseFloat(m[1]) : 0;
      const factor = s?.includes('"') ? 25.4 : 1;
      return parseFloat((3.14 * v * factor).toFixed(3));
    };
    setFormData({
      ...formData,
      system_no: mj.system_no || '',
      line_no: mj.line_no || '',
      spool_no: mj.spool_no || '',
      joint_no: mj.joint_no || '',
      weld_type: mj.weld_type || '',
      dia: mj.pipe_dia || '',
      weld_length: calc(mj.pipe_dia || ''),
      master_joint_id: mj.id
    });
  };

  const handleDeleteClick = (record: FitUpInspectionType) => {
    setSelectedRecord(record);
    setDeleteDialogOpen(true);
  };

  const handleAddSubmit = async () => {
    try {
      const mj = findMasterByForm();
      const payload = {
        ...formData,
        project_id: selectedProject!.id,
        master_joint_id: mj?.id,
        remarks: mj ? formData.remarks : `${formData.remarks ? formData.remarks + ' • ' : ''}Not in master joint list`
      } as any;
      await ApiService.createFitUpInspection(payload);
      setAddDialogOpen(false);
      fetchFitUpRecords();
    } catch (err) {
      setError('Failed to create fit-up record');
      console.error('Error creating fit-up record:', err);
    }
  };

  const handleEditSubmit = async () => {
    if (!selectedRecord) return;
    
    try {
      const mj = findMasterByForm();
      const payload = {
        ...formData,
        master_joint_id: mj?.id,
        remarks: mj ? formData.remarks : `${formData.remarks ? formData.remarks + ' • ' : ''}Not in master joint list`
      } as any;
      await ApiService.updateFitUpInspection(selectedRecord.id, payload);
      setEditDialogOpen(false);
      setSelectedRecord(null);
      fetchFitUpRecords();
    } catch (err) {
      setError('Failed to update fit-up record');
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
    } catch (err) {
      setError('Failed to delete fit-up record');
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

  const downloadCSV = () => {
    const headers = [
      'System',
      'Line',
      'Spool',
      'Joint',
      'Weld Type',
      'Piece Mark 1',
      'Piece Mark 2',
      'Weld Site',
      'Length',
      'Pipe Dia',
      'Date',
      'Fit-up Report No',
      'Result',
      'Master Link'
    ];
    const rows = filteredRecords.map(record => {
      const inMaster = masterJoints.length > 0 ? (
        masterJoints.some(m =>
          (m.system_no||'').trim() === (record.system_no||'').trim() &&
          (m.line_no||'').trim() === (record.line_no||'').trim() &&
          (m.spool_no||'').trim() === (record.spool_no||'').trim() &&
          (m.joint_no||'').trim() === (record.joint_no||'').trim()
        )
      ) : false;
      const masterLink = masterJoints.length === 0 ? '-' : (inMaster ? 'In Master' : 'Not in Master');
      const lengthStr = record.weld_length ? `${record.weld_length} mm` : '';
      const dateStr = formatDate(record.fit_up_date);
      return [
        record.system_no || '',
        record.line_no || '',
        record.spool_no || '',
        record.joint_no || '',
        record.weld_type || '',
        record.part1_piece_mark_no || '',
        record.part2_piece_mark_no || '',
        record.weld_site || '',
        lengthStr,
        record.dia || '',
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
    const csv = [headers.map(escape).join(','), ...rows.map(r => r.map(escape).join(','))].join('\r\n');
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
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Assignment sx={{ fontSize: 40, mr: 2, color: 'primary.main' }} />
          <Box>
            <Typography variant="h4" component="h1" gutterBottom>
              Fit-up Inspection
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
            startIcon={<Add />}
            onClick={handleAddClick}
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
              <InputLabel>System No</InputLabel>
              <Select
                label="System No"
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
              <InputLabel>Spool No</InputLabel>
              <Select
                label="Spool No"
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
              <InputLabel>Result</InputLabel>
              <Select
                label="Result"
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

      {/* Records Table */}
      {!loading && (
        <TableContainer component={Paper}>
          <Table sx={{ minWidth: 650 }} aria-label="fit-up records table">
              <TableHead>
                <TableRow>
                  <TableCell><strong>System</strong></TableCell>
                  <TableCell><strong>Line</strong></TableCell>
                  <TableCell><strong>Spool</strong></TableCell>
                  <TableCell><strong>Joint</strong></TableCell>
                  <TableCell><strong>Weld Type</strong></TableCell>
                  <TableCell><strong>Piece Mark 1</strong></TableCell>
                  <TableCell><strong>Piece Mark 2</strong></TableCell>
                  <TableCell><strong>Weld Site</strong></TableCell>
                  <TableCell><strong>Length</strong></TableCell>
                  <TableCell><strong>Pipe Dia</strong></TableCell>
                  <TableCell><strong>Date</strong></TableCell>
                  <TableCell><strong>Fit-up Report No</strong></TableCell>
                  <TableCell><strong>Result</strong></TableCell>
                  <TableCell><strong>User Update</strong></TableCell>
                  <TableCell><strong>Master Link</strong></TableCell>
                  <TableCell><strong>Actions</strong></TableCell>
                </TableRow>
              </TableHead>
            <TableBody>
              {records.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={15} align="center" sx={{ py: 4 }}>
                    <Typography variant="body1" color="textSecondary">
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
                  <TableCell colSpan={15} align="center" sx={{ py: 4 }}>
                    <Typography variant="body1" color="textSecondary">
                      No records match current search.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filteredRecords.map((record) => (
                  <TableRow key={record.id} hover>
                    <TableCell>{record.system_no || 'N/A'}</TableCell>
                    <TableCell>{record.line_no || 'N/A'}</TableCell>
                    <TableCell>{record.spool_no || 'N/A'}</TableCell>
                    <TableCell>{record.joint_no || 'N/A'}</TableCell>
                    <TableCell>{record.weld_type || 'N/A'}</TableCell>
                    <TableCell>
                      <Box>
                        <Typography variant="body2">{record.part1_piece_mark_no || 'N/A'}</Typography>
                        {record.part1_material_type && (
                          <Typography variant="caption" color="textSecondary">
                            {record.part1_material_type} - {record.part1_grade}
                          </Typography>
                        )}
                        <Typography variant="caption" color="textSecondary">
                          {record.part1_thickness ? `thk: ${record.part1_thickness}` : ''}
                          {(() => {
                            const m = materials.find(x => (x.piece_mark_no || '').trim() === (record.part1_piece_mark_no || '').trim());
                            const d = m?.pipe_dia ? ` • dia: ${m.pipe_dia}` : '';
                            return d;
                          })()}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box>
                        <Typography variant="body2">{record.part2_piece_mark_no || 'N/A'}</Typography>
                        {record.part2_material_type && (
                          <Typography variant="caption" color="textSecondary">
                            {record.part2_material_type} - {record.part2_grade}
                          </Typography>
                        )}
                        <Typography variant="caption" color="textSecondary">
                          {record.part2_thickness ? `thk: ${record.part2_thickness}` : ''}
                          {(() => {
                            const m = materials.find(x => (x.piece_mark_no || '').trim() === (record.part2_piece_mark_no || '').trim());
                            const d = m?.pipe_dia ? ` • dia: ${m.pipe_dia}` : '';
                            return d;
                          })()}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={record.weld_site || 'N/A'} 
                        size="small" 
                        color={record.weld_site === 'shop' ? 'primary' : 'secondary'}
                      />
                    </TableCell>
                    <TableCell>
                      {record.weld_length ? `${record.weld_length} mm` : 'N/A'}
                    </TableCell>
                    <TableCell>{record.dia || 'N/A'}</TableCell>
                    <TableCell>{formatDate(record.fit_up_date)}</TableCell>
                    <TableCell>{record.fit_up_report_no || 'N/A'}</TableCell>
                    <TableCell>
                      <Chip 
                        label={record.fit_up_result || 'Pending'} 
                        color={getStatusColor(record.fit_up_result) as any}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>{record.updated_by || '-'}</TableCell>
                    <TableCell>
                      {masterJoints.length > 0 ? (
                        masterJoints.some(m =>
                          (m.system_no||'').trim() === (record.system_no||'').trim() &&
                          (m.line_no||'').trim() === (record.line_no||'').trim() &&
                          (m.spool_no||'').trim() === (record.spool_no||'').trim() &&
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
                    <TableCell>
                      <IconButton size="small" color="primary" onClick={() => handleEditClick(record)}>
                        <Edit />
                      </IconButton>
                      <IconButton size="small" color="error" onClick={() => handleDeleteClick(record)}>
                        <Delete />
                      </IconButton>
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
          <strong>Note:</strong> This page displays all fit-up inspection records for the selected project. 
          The data is automatically populated from the material register when piece marks are referenced.
        </Typography>
      </Box>

      {/* Add Fit-up Dialog */}
      <Dialog open={addDialogOpen} onClose={() => setAddDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Add New Fit-up Inspection</DialogTitle>
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
                  {masterJoints.map(j => (
                    <MenuItem key={j.id} value={j.id}>{keyFor(j)}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="System No"
                value={formData.system_no}
                onChange={(e) => setFormData({ ...formData, system_no: e.target.value })}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Line No"
                value={formData.line_no}
                onChange={(e) => setFormData({ ...formData, line_no: e.target.value })}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Spool No"
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
                label="Pipe Dia"
                value={formData.dia || ''}
                onChange={(e) => {
                  const v = e.target.value;
                  const m = v.match(/([0-9]+(?:\.[0-9]+)?)/);
                  const num = m ? parseFloat(m[1]) : 0;
                  const factor = v.includes('"') ? 25.4 : 1;
                  const len = parseFloat((3.14 * num * factor).toFixed(3));
                  setFormData({ ...formData, dia: v, weld_length: len });
                }}
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
                    formData.part1_thickness ? `thk: ${formData.part1_thickness}` : '',
                    m?.pipe_dia ? `dia: ${m.pipe_dia}` : ''
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
                    formData.part2_thickness ? `thk: ${formData.part2_thickness}` : '',
                    m?.pipe_dia ? `dia: ${m.pipe_dia}` : ''
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
                <InputLabel>Fit-up Result</InputLabel>
                <Select
                  value={formData.fit_up_result}
                  label="Fit-up Result"
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
        <DialogTitle>Edit Fit-up Inspection</DialogTitle>
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
                  {masterJoints.map(j => (
                    <MenuItem key={j.id} value={j.id}>{keyFor(j)}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="System No"
                value={formData.system_no}
                onChange={(e) => setFormData({ ...formData, system_no: e.target.value })}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Line No"
                value={formData.line_no}
                onChange={(e) => setFormData({ ...formData, line_no: e.target.value })}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Spool No"
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
                    formData.part1_thickness ? `thk: ${formData.part1_thickness}` : '',
                    m?.pipe_dia ? `dia: ${m.pipe_dia}` : ''
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
                    formData.part2_thickness ? `thk: ${formData.part2_thickness}` : '',
                    m?.pipe_dia ? `dia: ${m.pipe_dia}` : ''
                  ].filter(Boolean).join(' • ');
                  return info || '-';
                })()}
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Weld Site"
                value={formData.weld_site}
                onChange={(e) => setFormData({ ...formData, weld_site: e.target.value })}
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
                <InputLabel>Fit-up Result</InputLabel>
                <Select
                  value={formData.fit_up_result}
                  label="Fit-up Result"
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
                  System: {selectedRecord.system_no || 'N/A'}, Line: {selectedRecord.line_no || 'N/A'}, 
                  Joint: {selectedRecord.joint_no || 'N/A'}
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
    </Container>
  );
};

export default FitUpInspection;
