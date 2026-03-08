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
  Checkbox,
  Autocomplete,
  ListItemText
} from '@mui/material';
import { Refresh, Add, Edit, Delete, Search, Clear, Download, Save, Close } from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import ApiService from '../../services/api';
import { FinalInspection as FinalInspectionType, FitUpInspection } from '../../types';

// Define a structure-specific type extending the base type
interface StructureFinalInspectionType extends FinalInspectionType {
  // Ensure structure fields are present
  structure_category?: string;
  page_no?: string;
  drawing_rev?: string;
  fitup?: FitUpInspection; // Allow access to nested fitup for fallback
}

type NewStructureFinalInspection = Omit<StructureFinalInspectionType, 'id' | 'created_at' | 'fitup'>;

const StructureFinalInspection: React.FC = () => {
  const { selectedProject, canEdit, canDelete } = useAuth();
  const [records, setRecords] = useState<StructureFinalInspectionType[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRows, setSelectedRows] = useState<number[]>([]);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<StructureFinalInspectionType | null>(null);
  
  // Form Data - REMOVED pipe_dia field as it doesn't exist in backend model
  const [formData, setFormData] = useState<NewStructureFinalInspection>({
    fitup_id: 0,
    project_id: selectedProject?.id || 0,
    structure_category: '', 
    page_no: '',   
    drawing_rev: '',
    draw_no: '', // Drawing No
    joint_no: '',
    block_no: '',
    weld_type: '',
    wps_no: '',
    welder_no: '',
    weld_site: '',
    final_date: '',
    final_report_no: '',
    final_result: '',
    ndt_type: '',
    weld_length: 0,
    remarks: '',
    inspection_category: 'type-I'
  });
  
  const [fitupRecords, setFitupRecords] = useState<FitUpInspection[]>([]);
  const [pendingFitups, setPendingFitups] = useState<any[]>([]);
  const [wpsList, setWpsList] = useState<any[]>([]);
  const [welderList, setWelderList] = useState<any[]>([]);
  
  const activeWpsList = wpsList.filter(w => w.status === 'active');
  const activeWelderList = welderList.filter(w => w.status === 'active');

  const getWpsDetails = (wpsNo: string | undefined) => {
    if (!wpsNo) return null;
    const wps = wpsList.find(w => w.wps_no === wpsNo);
    if (!wps) return null;
    return (
      <Box sx={{ mt: 1, p: 1, bgcolor: 'action.hover', borderRadius: 1, fontSize: '0.75rem' }}>
        <Grid container spacing={1}>
          <Grid item xs={6}><strong>Pos:</strong> {wps.position || '-'}</Grid>
          <Grid item xs={6}><strong>Proc:</strong> {wps.process || '-'}</Grid>
          <Grid item xs={6}><strong>Mat:</strong> {wps.material_group || '-'}</Grid>
          <Grid item xs={6}><strong>Thk:</strong> {wps.thickness_range || '-'}</Grid>
        </Grid>
      </Box>
    );
  };

  const getWelderDetails = (welderNo: string | undefined) => {
    if (!welderNo) return null;
    const welder = welderList.find(w => w.welder_no === welderNo);
    if (!welder) return null;
    return (
      <Box sx={{ mt: 1, p: 1, bgcolor: 'action.hover', borderRadius: 1, fontSize: '0.75rem' }}>
        <Grid container spacing={1}>
          <Grid item xs={6}><strong>Mat:</strong> {welder.qualified_material || '-'}</Grid>
          <Grid item xs={6}><strong>Thk:</strong> {welder.thickness_range || '-'}</Grid>
          <Grid item xs={6}><strong>Proc:</strong> {welder.weld_process || '-'}</Grid>
          <Grid item xs={6}><strong>Pos:</strong> {welder.qualified_position || '-'}</Grid>
        </Grid>
      </Box>
    );
  };

  const ndtOptions = ['RT', 'UT', 'PT', 'MPI', 'FT', 'PMI', 'NA'];
  
  // Search State
  const [search, setSearch] = useState({
    structure_category: '',
    draw_no: '',
    joint_no: '',
    final_report_no: '',
    final_result: ''
  });
  
  // Filter Options
  const [filterOptions, setFilterOptions] = useState<{ structure_category: string[]; draw_no: string[]; joint_no: string[]; final_report_no: string[]; final_result: string[] }>({
    structure_category: [], draw_no: [], joint_no: [], final_report_no: [], final_result: []
  });
  
  const [editGroupIds, setEditGroupIds] = useState<number[]>([]);
  const [editGroupIndex, setEditGroupIndex] = useState<number>(0);

  // Bulk Update State
  const [bulkUpdateDialogOpen, setBulkUpdateDialogOpen] = useState(false);
  const [bulkUpdateData, setBulkUpdateData] = useState({
    final_date: '',
    final_result: '',
    final_report_no: '',
    welder_no: '',
    wps_no: '',
    ndt_type: ''
  });

  const handleBulkUpdateClick = () => {
    setBulkUpdateData({
        final_date: '',
        final_result: '',
        final_report_no: '',
        welder_no: '',
        wps_no: '',
        ndt_type: ''
    });
    setBulkUpdateDialogOpen(true);
  };

  const handleBulkUpdateSubmit = async () => {
    if (selectedRows.length === 0) return;
    
    setLoading(true);
    try {
        const updates: any = {};
        if (bulkUpdateData.final_date) updates.final_date = new Date(bulkUpdateData.final_date).toISOString();
        if (bulkUpdateData.final_result) updates.final_result = bulkUpdateData.final_result;
        if (bulkUpdateData.final_report_no) updates.final_report_no = bulkUpdateData.final_report_no;
        if (bulkUpdateData.welder_no) updates.welder_no = bulkUpdateData.welder_no;
        if (bulkUpdateData.wps_no) updates.wps_no = bulkUpdateData.wps_no;
        if (bulkUpdateData.ndt_type) updates.ndt_type = bulkUpdateData.ndt_type;

        if (Object.keys(updates).length === 0) {
            setBulkUpdateDialogOpen(false);
            setLoading(false);
            return;
        }

        await ApiService.bulkUpdateFinalInspections(selectedRows, updates);
        setBulkUpdateDialogOpen(false);
        setSelectedRows([]);
        fetchFinalRecords();
    } catch (err: any) {
        setError(err.message || 'Failed to bulk update records');
        console.error(err);
    } finally {
        setLoading(false);
    }
  };

  // Helper to find fitup based on form data
  const findFitupByForm = () => {
    return fitupRecords.find(m =>
      (m.structure_category || '').trim() === (formData.structure_category || '').trim() &&
      (m.page_no || '').trim() === (formData.page_no || '').trim() &&
      (m.drawing_rev || '').trim() === (formData.drawing_rev || '').trim() &&
      (m.draw_no || '').trim() === (formData.draw_no || '').trim() &&
      (m.joint_no || '').trim() === (formData.joint_no || '').trim() &&
      (m.block_no || '').trim() === (formData.block_no || '').trim()
    );
  };

  const applyFitupJoint = (fitupId: number) => {
    const fu = fitupRecords.find(j => j.id === fitupId);
    if (!fu) return;
    
    setFormData({
      ...formData,
      fitup_id: fu.id,
      structure_category: fu.structure_category || '',
      page_no: fu.page_no || '',
      drawing_rev: fu.drawing_rev || '',
      draw_no: fu.draw_no || '',
      joint_no: fu.joint_no || '',
      block_no: fu.block_no || '',
      weld_type: fu.weld_type || '',
      weld_length: fu.weld_length || 0,
      inspection_category: fu.inspection_category || 'type-I'
    });
  };

  const fetchFinalRecords = async () => {
    if (!selectedProject) return;
    
    setLoading(true);
    setError(null);
    try {
      const data = await ApiService.getStructureFinalInspections(selectedProject.id);
      setRecords(data);
      try {
        const opts = await ApiService.getStructureFinalFilters(selectedProject.id);
        // Backend correctly returns structure fields
        setFilterOptions({
          structure_category: opts.structure_category || [],
          draw_no: opts.draw_no || [],
          joint_no: opts.joint_no || [],
          final_report_no: opts.final_report_no || [],
          final_result: opts.final_result || []
        });
      } catch {}
    } catch (err) {
      setError('Failed to fetch final inspection records');
      console.error('Error fetching final inspection records:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadPendingFitups = async () => {
    if (!selectedProject) return;
    try {
      const data = await ApiService.getStructureFitUpPendingFinal(selectedProject.id);
      const uniqueMap = new Map();
      if (Array.isArray(data)) {
        data.forEach(f => {
          const key = `${(f.block_no || '').trim()}-${(f.joint_no || '').trim()}`;
          if (key !== '-' && (!uniqueMap.has(key) || f.id > uniqueMap.get(key).id)) {
            uniqueMap.set(key, f);
          }
        });
        const uniqueData = Array.from(uniqueMap.values()).sort((a, b) => {
          const blockCompare = (a.block_no || '').localeCompare(b.block_no || '');
          if (blockCompare !== 0) return blockCompare;
          return (a.joint_no || '').localeCompare(b.joint_no || '');
        });
        setPendingFitups(uniqueData);
      } else {
        setPendingFitups([]);
      }
    } catch (err) {
      console.error('Error loading pending fitups:', err);
      setPendingFitups([]);
    }
  };

  useEffect(() => {
    fetchFinalRecords();
    const loadFitups = async () => {
      if (!selectedProject) return;
      try {
        const data = await ApiService.getStructureFitUpInspections(selectedProject.id);
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
            const newDraw = match.draw_no || prev.draw_no;
            const newCat = match.structure_category || prev.structure_category;
            const newPage = match.page_no || prev.page_no;
            const newRev = match.drawing_rev || prev.drawing_rev;

            if (newDraw !== prev.draw_no || newCat !== prev.structure_category || newPage !== prev.page_no || newRev !== prev.drawing_rev) {
              return {
                ...prev,
                draw_no: newDraw,
                structure_category: newCat,
                page_no: newPage,
                drawing_rev: newRev,
                weld_length: match.weld_length || prev.weld_length,
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

  const handlePendingJointSelect = (fitupId: number) => {
    const selectedFitup = pendingFitups.find(f => f.id === fitupId);
    if (selectedFitup) {
      setFormData(prev => ({
        ...prev,
        fitup_id: selectedFitup.id,
        structure_category: selectedFitup.structure_category || '',
        page_no: selectedFitup.page_no || '',
        drawing_rev: selectedFitup.drawing_rev || '',
        draw_no: selectedFitup.draw_no || '',
        joint_no: selectedFitup.joint_no || '',
        block_no: selectedFitup.block_no || '',
        weld_type: selectedFitup.weld_type || '',
        weld_length: selectedFitup.weld_length || 0,
        inspection_category: selectedFitup.inspection_category || 'type-I'
      }));
    }
  };

  const handleAddClick = () => {
    loadPendingFitups();
    setFormData({
      fitup_id: 0,
      project_id: selectedProject?.id || 0,
      structure_category: '', 
      page_no: '',   
      drawing_rev: '',
      draw_no: '',
      joint_no: '',
      block_no: '',
      weld_type: '',
      wps_no: '',
      welder_no: '',
      weld_site: '',
      final_date: '',
      final_report_no: '',
      final_result: '',
      ndt_type: '',
      weld_length: 0,
      remarks: '',
      inspection_category: 'type-I'
    });
    setAddDialogOpen(true);
  };

  const handleEditClick = (record: StructureFinalInspectionType) => {
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
      structure_category: record.structure_category || '',
      page_no: record.page_no || '',
      drawing_rev: record.drawing_rev || record.fitup?.drawing_rev || '',
      draw_no: record.draw_no || '',
      joint_no: record.joint_no || '',
      block_no: record.block_no || '',
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
      remarks: record.remarks || '',
      inspection_category: record.inspection_category || 'type-I'
    });
    setEditDialogOpen(true);
  };

  const handleDeleteClick = (record: StructureFinalInspectionType) => {
    setSelectedRecord(record);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!selectedRecord) return;
    try {
      await ApiService.deleteStructureFinalInspection(selectedRecord.id);
      setDeleteDialogOpen(false);
      setSelectedRecord(null);
      fetchFinalRecords();
    } catch (err: any) {
      setError(err.message || 'Failed to delete record');
      console.error(err);
    }
  };

  const handleAddSubmit = async () => {
    try {
      const f = findFitupByForm();
      const finalFitupId = formData.fitup_id || f?.id || 0;
      const payload: any = {
        ...formData,
        project_id: selectedProject!.id,
        fitup_id: finalFitupId,
        remarks: finalFitupId ? formData.remarks : `${formData.remarks ? formData.remarks + ' • ' : ''}fit up not done`
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
      await ApiService.createStructureFinalInspection(payload);
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
      await ApiService.updateStructureFinalInspection(selectedRecord.id, payload);
      const groupSize = editGroupIds.length;
      const currentIndex = editGroupIndex;
      const hasNext = groupSize > 0 && currentIndex < groupSize - 1;
      if (hasNext) {
        const nextId = editGroupIds[currentIndex + 1];
        const nextRecord = records.find(r => r.id === nextId);
        if (nextRecord) {
          handleEditClick(nextRecord);
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
      setError(err.message || 'Failed to update record');
      console.error(err);
    }
  };

  const getStatusColor = (result?: string) => {
    switch (result?.toLowerCase()) {
      case 'accepted': return 'success';
      case 'rejected': return 'error';
      case 'pending': return 'warning';
      default: return 'default';
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
    const cat = (r.structure_category || '').trim();
    const draw = (r.draw_no || '').trim();
    const joint = (r.joint_no || '').trim();
    const rep = (r.final_report_no || '').trim();
    const res = (r.final_result || '').trim().toLowerCase();
    
    const qcat = search.structure_category.trim();
    const qdraw = search.draw_no.trim();
    const qj = search.joint_no.trim();
    const qr = search.final_report_no.trim();
    const qres = search.final_result.trim().toLowerCase();
    
    return (!qcat || cat === qcat) && 
           (!qdraw || draw === qdraw) &&
           (!qj || joint.includes(qj)) &&
           (!qr || rep.includes(qr)) && 
           (!qres || res === qres);
  });

  const downloadCSV = () => {
    const headers = [
      'Block No', 'Drawing No', 'Structure Category', 'Page No', 'Joint No',
      'Weld Type', 'WPS No', 'Welder No', 'NDT Type', 'Weld Length',
      'Final Result', 'Final Date', 'Report No', 'Remarks'
    ];
    
    const csvContent = [
      headers.join(','),
      ...filteredRecords.map(r => [
        r.block_no, r.draw_no, r.structure_category, r.page_no, r.joint_no,
        r.weld_type, r.wps_no, r.welder_no, r.ndt_type, r.weld_length,
        r.final_result, r.final_date ? new Date(r.final_date).toLocaleDateString() : '', r.final_report_no, `"${(r.remarks || '').replace(/"/g, '""')}"`
      ].join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', 'structure_final_inspections.csv');
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <Container maxWidth={false} disableGutters sx={{ mt: 2, mb: 2, px: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Structure Final Inspection
        </Typography>
        <Box>
          {canEdit() && (
            <Button
              variant="outlined"
              startIcon={<Edit />}
              onClick={handleBulkUpdateClick}
              disabled={selectedRows.length === 0}
              sx={{ mr: 2 }}
            >
              Bulk Update
            </Button>
          )}
          <Button
            variant="outlined"
            startIcon={<Download />}
            onClick={downloadCSV}
            sx={{ mr: 2 }}
          >
            Export CSV
          </Button>
          {canEdit() && (
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={handleAddClick}
            >
              New Inspection
            </Button>
          )}
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>{error}</Alert>}

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
                value={search.structure_category}
                label="Structure Category"
                onChange={(e) => setSearch({ ...search, structure_category: e.target.value })}
              >
                <MenuItem value="">All</MenuItem>
                {filterOptions.structure_category.map((opt) => (
                  <MenuItem key={opt} value={opt}>{opt}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Drawing No</InputLabel>
              <Select
                value={search.draw_no}
                label="Drawing No"
                onChange={(e) => setSearch({ ...search, draw_no: e.target.value })}
              >
                <MenuItem value="">All</MenuItem>
                {filterOptions.draw_no.map((opt) => (
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
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12}>
             <Button variant="text" onClick={() => setSearch({ structure_category: '', draw_no: '', joint_no: '', final_report_no: '', final_result: '' })} startIcon={<Clear />}>
               Clear Filters
             </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* Table Section */}
      <TableContainer component={Paper}>
        <Table stickyHeader size="small" sx={{ minWidth: 1500 }}>
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox">
                 <Checkbox 
                    checked={records.length > 0 && selectedRows.length === records.length}
                    indeterminate={selectedRows.length > 0 && selectedRows.length < records.length}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedRows(records.map(r => r.id));
                      else setSelectedRows([]);
                    }}
                 />
              </TableCell>
              <TableCell>Block No</TableCell>
              <TableCell>Drawing No</TableCell>
              <TableCell>Structure Category</TableCell>
              <TableCell>Page No</TableCell>
              <TableCell>Joint No</TableCell>
              <TableCell>Weld Type</TableCell>
              <TableCell>WPS No</TableCell>
              <TableCell>Welder No</TableCell>
              <TableCell>NDT Type</TableCell>
              <TableCell>Weld Length</TableCell>
              <TableCell>Result</TableCell>
              <TableCell>Date</TableCell>
              <TableCell>Report No</TableCell>
              {(canEdit() || canDelete()) && <TableCell>Actions</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={15} align="center"><CircularProgress /></TableCell>
              </TableRow>
            ) : filteredRecords.length === 0 ? (
              <TableRow>
                <TableCell colSpan={15} align="center">No records found</TableCell>
              </TableRow>
            ) : (
              filteredRecords.map((record) => (
                <TableRow key={record.id} hover selected={selectedRows.includes(record.id)}>
                   <TableCell padding="checkbox">
                      <Checkbox 
                        checked={selectedRows.includes(record.id)}
                        onChange={(e) => {
                           if (e.target.checked) setSelectedRows([...selectedRows, record.id]);
                           else setSelectedRows(selectedRows.filter(id => id !== record.id));
                        }}
                      />
                   </TableCell>
                   <TableCell>{record.block_no}</TableCell>
                   <TableCell>{record.draw_no}</TableCell>
                   <TableCell>{record.structure_category}</TableCell>
                   <TableCell>{record.page_no}</TableCell>
                   <TableCell>{record.joint_no}</TableCell>
                   <TableCell>{record.weld_type}</TableCell>
                   <TableCell>{record.wps_no}</TableCell>
                   <TableCell>{record.welder_no}</TableCell>
                   <TableCell>{record.ndt_type}</TableCell>
                   <TableCell>{record.weld_length}</TableCell>
                   <TableCell>
                     <Chip 
                       label={record.final_result} 
                       color={getStatusColor(record.final_result)} 
                       size="small" 
                       variant="outlined"
                     />
                   </TableCell>
                   <TableCell>{formatDate(record.final_date)}</TableCell>
                   <TableCell>{record.final_report_no}</TableCell>
                   {(canEdit() || canDelete()) && (
                     <TableCell>
                      <IconButton size="small" onClick={() => handleEditClick(record)} disabled={!canEdit()}><Edit fontSize="small" /></IconButton>
                      <IconButton size="small" onClick={() => handleDeleteClick(record)} disabled={!canDelete()}><Delete fontSize="small" /></IconButton>
                     </TableCell>
                   )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Add Dialog */}
      <Dialog open={addDialogOpen} onClose={() => setAddDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Add New Structure Final Inspection</DialogTitle>
        <DialogContent>
           <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
             <Button variant="outlined" onClick={loadPendingFitups}>Refresh Pending Fitups</Button>
             {pendingFitups.length > 0 && (
               <FormControl fullWidth size="small">
                 <InputLabel>Select Pending Fitup</InputLabel>
                 <Select
                   value=""
                   label="Select Pending Fitup"
                   onChange={(e) => handlePendingJointSelect(Number(e.target.value))}
                 >
                   {pendingFitups.map(f => (
                     <MenuItem key={f.id} value={f.id}>
                       {f.block_no} - {f.joint_no} ({f.draw_no})
                     </MenuItem>
                   ))}
                 </Select>
               </FormControl>
             )}
             <Grid container spacing={2}>
               <Grid item xs={6}><TextField label="Block No" fullWidth value={formData.block_no} onChange={e => setFormData({...formData, block_no: e.target.value})} /></Grid>
               <Grid item xs={6}><TextField label="Joint No" fullWidth value={formData.joint_no} onChange={e => setFormData({...formData, joint_no: e.target.value})} /></Grid>
               <Grid item xs={6}><TextField label="Drawing No" fullWidth value={formData.draw_no} onChange={e => setFormData({...formData, draw_no: e.target.value})} /></Grid>
               <Grid item xs={6}><TextField label="Structure Category" fullWidth value={formData.structure_category} onChange={e => setFormData({...formData, structure_category: e.target.value})} /></Grid>
               <Grid item xs={6}><TextField label="Page No" fullWidth value={formData.page_no} onChange={e => setFormData({...formData, page_no: e.target.value})} /></Grid>
               <Grid item xs={6}><TextField label="Drawing Rev" fullWidth value={formData.drawing_rev} onChange={e => setFormData({...formData, drawing_rev: e.target.value})} /></Grid>
               <Grid item xs={6}><TextField label="Weld Type" fullWidth value={formData.weld_type} onChange={e => setFormData({...formData, weld_type: e.target.value})} /></Grid>
               <Grid item xs={6}><TextField label="Weld Length" type="number" fullWidth value={formData.weld_length} onChange={e => setFormData({...formData, weld_length: parseFloat(e.target.value)})} /></Grid>
              <Grid item xs={6}>
                 <Autocomplete
                   options={activeWpsList}
                   getOptionLabel={(option) => option.wps_no}
                   value={activeWpsList.find(w => w.wps_no === formData.wps_no) || null}
                   onChange={(_, newValue) => setFormData({...formData, wps_no: newValue?.wps_no || ''})}
                   renderInput={(params) => <TextField {...params} label="WPS No" fullWidth />}
                   renderOption={(props, option) => (
                     <li {...props}>
                       <Box>
                         <Typography variant="body1">{option.wps_no}</Typography>
                         <Typography variant="caption" color="textSecondary" display="block">
                           Pos: {option.position || '-'} | Proc: {option.process || '-'} | Mat: {option.material_group || '-'} | Thk: {option.thickness_range || '-'}
                         </Typography>
                       </Box>
                     </li>
                   )}
                   isOptionEqualToValue={(option, value) => option.wps_no === value.wps_no}
                 />
                 {getWpsDetails(formData.wps_no)}
              </Grid>
              <Grid item xs={6}>
                 <Autocomplete
                   options={activeWelderList}
                   getOptionLabel={(option) => option.welder_no}
                   value={activeWelderList.find(w => w.welder_no === formData.welder_no) || null}
                   onChange={(_, newValue) => setFormData({...formData, welder_no: newValue?.welder_no || ''})}
                   renderInput={(params) => <TextField {...params} label="Welder No" fullWidth />}
                   renderOption={(props, option) => (
                     <li {...props}>
                       <Box>
                         <Typography variant="body1">{option.welder_no}</Typography>
                         <Typography variant="caption" color="textSecondary" display="block">
                           Mat: {option.qualified_material || '-'} | Thk: {option.thickness_range || '-'} | Proc: {option.weld_process || '-'} | Pos: {option.qualified_position || '-'}
                         </Typography>
                       </Box>
                     </li>
                   )}
                   isOptionEqualToValue={(option, value) => option.welder_no === value.welder_no}
                 />
                 {getWelderDetails(formData.welder_no)}
              </Grid>
              <Grid item xs={6}>
                  <FormControl fullWidth>
                    <InputLabel>NDT Type</InputLabel>
                    <Select
                      multiple
                      value={formData.ndt_type ? formData.ndt_type.split(',').map(s => s.trim()).filter(Boolean) : []}
                      label="NDT Type"
                      onChange={(e) => {
                        const val = e.target.value;
                        const newValue = typeof val === 'string' ? val.split(',') : val;
                        setFormData({ ...formData, ndt_type: newValue.join(', ') });
                      }}
                      renderValue={(selected) => (selected as string[]).join(', ')}
                    >
                       {ndtOptions.map(o => (
                         <MenuItem key={o} value={o}>
                           <Checkbox checked={formData.ndt_type ? formData.ndt_type.split(',').map(s => s.trim()).includes(o) : false} />
                           <ListItemText primary={o} />
                         </MenuItem>
                       ))}
                    </Select>
                  </FormControl>
               </Grid>
               <Grid item xs={6}><TextField label="Final Date" type="date" fullWidth InputLabelProps={{ shrink: true }} value={formData.final_date ? formData.final_date.split('T')[0] : ''} onChange={e => setFormData({...formData, final_date: e.target.value})} /></Grid>
               <Grid item xs={6}><TextField label="Report No" fullWidth value={formData.final_report_no} onChange={e => setFormData({...formData, final_report_no: e.target.value})} /></Grid>
               <Grid item xs={6}>
                  <FormControl fullWidth>
                    <InputLabel>Result</InputLabel>
                    <Select value={formData.final_result} label="Result" onChange={e => setFormData({...formData, final_result: e.target.value})}>
                       <MenuItem value="accepted">Accepted</MenuItem>
                       <MenuItem value="rejected">Rejected</MenuItem>
                    </Select>
                  </FormControl>
               </Grid>
               <Grid item xs={12}><TextField label="Remarks" fullWidth multiline rows={2} value={formData.remarks} onChange={e => setFormData({...formData, remarks: e.target.value})} /></Grid>
             </Grid>
           </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleAddSubmit} variant="contained" color="primary">Add</Button>
        </DialogActions>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Edit Structure Final Inspection</DialogTitle>
        <DialogContent>
           <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
             <Grid container spacing={2}>
               <Grid item xs={6}><TextField label="Block No" fullWidth value={formData.block_no} onChange={e => setFormData({...formData, block_no: e.target.value})} /></Grid>
               <Grid item xs={6}><TextField label="Joint No" fullWidth value={formData.joint_no} onChange={e => setFormData({...formData, joint_no: e.target.value})} /></Grid>
               <Grid item xs={6}><TextField label="Drawing No" fullWidth value={formData.draw_no} onChange={e => setFormData({...formData, draw_no: e.target.value})} /></Grid>
               <Grid item xs={6}><TextField label="Structure Category" fullWidth value={formData.structure_category} onChange={e => setFormData({...formData, structure_category: e.target.value})} /></Grid>
               <Grid item xs={6}><TextField label="Page No" fullWidth value={formData.page_no} onChange={e => setFormData({...formData, page_no: e.target.value})} /></Grid>
               <Grid item xs={6}><TextField label="Drawing Rev" fullWidth value={formData.drawing_rev} onChange={e => setFormData({...formData, drawing_rev: e.target.value})} /></Grid>
               <Grid item xs={6}><TextField label="Weld Type" fullWidth value={formData.weld_type} onChange={e => setFormData({...formData, weld_type: e.target.value})} /></Grid>
               <Grid item xs={6}><TextField label="Weld Length" type="number" fullWidth value={formData.weld_length} onChange={e => setFormData({...formData, weld_length: parseFloat(e.target.value)})} /></Grid>
              <Grid item xs={6}>
                  <Autocomplete
                    options={activeWpsList}
                    getOptionLabel={(option) => option.wps_no}
                    value={activeWpsList.find(w => w.wps_no === formData.wps_no) || null}
                    onChange={(_, newValue) => setFormData({...formData, wps_no: newValue?.wps_no || ''})}
                    renderInput={(params) => <TextField {...params} label="WPS No" fullWidth />}
                    renderOption={(props, option) => (
                      <li {...props}>
                        <Box>
                          <Typography variant="body1">{option.wps_no}</Typography>
                          <Typography variant="caption" color="textSecondary" display="block">
                            Pos: {option.position || '-'} | Proc: {option.process || '-'} | Mat: {option.material_group || '-'} | Thk: {option.thickness_range || '-'}
                          </Typography>
                        </Box>
                      </li>
                    )}
                    isOptionEqualToValue={(option, value) => option.wps_no === value.wps_no}
                  />
                  {getWpsDetails(formData.wps_no)}
              </Grid>
              <Grid item xs={6}>
                  <Autocomplete
                    options={activeWelderList}
                    getOptionLabel={(option) => option.welder_no}
                    value={activeWelderList.find(w => w.welder_no === formData.welder_no) || null}
                    onChange={(_, newValue) => setFormData({...formData, welder_no: newValue?.welder_no || ''})}
                    renderInput={(params) => <TextField {...params} label="Welder No" fullWidth />}
                    renderOption={(props, option) => (
                      <li {...props}>
                        <Box>
                          <Typography variant="body1">{option.welder_no}</Typography>
                          <Typography variant="caption" color="textSecondary" display="block">
                            Mat: {option.qualified_material || '-'} | Thk: {option.thickness_range || '-'} | Proc: {option.weld_process || '-'} | Pos: {option.qualified_position || '-'}
                          </Typography>
                        </Box>
                      </li>
                    )}
                    isOptionEqualToValue={(option, value) => option.welder_no === value.welder_no}
                  />
                  {getWelderDetails(formData.welder_no)}
              </Grid>
              <Grid item xs={6}>
                  <FormControl fullWidth>
                    <InputLabel>NDT Type</InputLabel>
                    <Select
                      multiple
                      value={formData.ndt_type ? formData.ndt_type.split(',').map(s => s.trim()).filter(Boolean) : []}
                      label="NDT Type"
                      onChange={(e) => {
                        const val = e.target.value;
                        const newValue = typeof val === 'string' ? val.split(',') : val;
                        setFormData({ ...formData, ndt_type: newValue.join(', ') });
                      }}
                      renderValue={(selected) => (selected as string[]).join(', ')}
                    >
                       {ndtOptions.map(o => (
                         <MenuItem key={o} value={o}>
                           <Checkbox checked={formData.ndt_type ? formData.ndt_type.split(',').map(s => s.trim()).includes(o) : false} />
                           <ListItemText primary={o} />
                         </MenuItem>
                       ))}
                    </Select>
                  </FormControl>
               </Grid>
               <Grid item xs={6}><TextField label="Final Date" type="date" fullWidth InputLabelProps={{ shrink: true }} value={formData.final_date ? formData.final_date.split('T')[0] : ''} onChange={e => setFormData({...formData, final_date: e.target.value})} /></Grid>
               <Grid item xs={6}><TextField label="Report No" fullWidth value={formData.final_report_no} onChange={e => setFormData({...formData, final_report_no: e.target.value})} /></Grid>
               <Grid item xs={6}>
                  <FormControl fullWidth>
                    <InputLabel>Result</InputLabel>
                    <Select value={formData.final_result} label="Result" onChange={e => setFormData({...formData, final_result: e.target.value})}>
                       <MenuItem value="accepted">Accepted</MenuItem>
                       <MenuItem value="rejected">Rejected</MenuItem>
                    </Select>
                  </FormControl>
               </Grid>
               <Grid item xs={12}><TextField label="Remarks" fullWidth multiline rows={2} value={formData.remarks} onChange={e => setFormData({...formData, remarks: e.target.value})} /></Grid>
             </Grid>
           </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleEditSubmit} variant="contained" color="primary">Save</Button>
        </DialogActions>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to delete this record?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained">Delete</Button>
        </DialogActions>
      </Dialog>

      {/* Bulk Update Dialog */}
      <Dialog open={bulkUpdateDialogOpen} onClose={() => setBulkUpdateDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Bulk Update ({selectedRows.length} records)</DialogTitle>
        <DialogContent>
           <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
             <Typography variant="body2" color="textSecondary">
               Only filled fields will be updated. Leave blank to keep existing values.
             </Typography>
             <TextField label="Final Date" type="date" fullWidth InputLabelProps={{ shrink: true }} value={bulkUpdateData.final_date} onChange={e => setBulkUpdateData({...bulkUpdateData, final_date: e.target.value})} />
             <FormControl fullWidth>
                <InputLabel>Result</InputLabel>
                <Select value={bulkUpdateData.final_result} label="Result" onChange={e => setBulkUpdateData({...bulkUpdateData, final_result: e.target.value})}>
                   <MenuItem value=""><em>(No Change)</em></MenuItem>
                   <MenuItem value="accepted">Accepted</MenuItem>
                   <MenuItem value="rejected">Rejected</MenuItem>
                </Select>
             </FormControl>
             <TextField label="Report No" fullWidth value={bulkUpdateData.final_report_no} onChange={e => setBulkUpdateData({...bulkUpdateData, final_report_no: e.target.value})} />
             
             <Autocomplete
               options={activeWelderList}
               getOptionLabel={(option) => option.welder_no}
               value={activeWelderList.find(w => w.welder_no === bulkUpdateData.welder_no) || null}
               onChange={(_, newValue) => setBulkUpdateData({...bulkUpdateData, welder_no: newValue?.welder_no || ''})}
               renderInput={(params) => <TextField {...params} label="Welder No" fullWidth placeholder="(No Change)" />}
               renderOption={(props, option) => (
                 <li {...props}>
                   <Box>
                     <Typography variant="body1">{option.welder_no}</Typography>
                     <Typography variant="caption" color="textSecondary" display="block">
                       Mat: {option.qualified_material || '-'} | Thk: {option.thickness_range || '-'} | Proc: {option.weld_process || '-'} | Pos: {option.qualified_position || '-'}
                     </Typography>
                   </Box>
                 </li>
               )}
               isOptionEqualToValue={(option, value) => option.welder_no === value.welder_no}
             />
             {getWelderDetails(bulkUpdateData.welder_no)}

             <Autocomplete
               options={activeWpsList}
               getOptionLabel={(option) => option.wps_no}
               value={activeWpsList.find(w => w.wps_no === bulkUpdateData.wps_no) || null}
               onChange={(_, newValue) => setBulkUpdateData({...bulkUpdateData, wps_no: newValue?.wps_no || ''})}
               renderInput={(params) => <TextField {...params} label="WPS No" fullWidth placeholder="(No Change)" />}
               renderOption={(props, option) => (
                 <li {...props}>
                   <Box>
                     <Typography variant="body1">{option.wps_no}</Typography>
                     <Typography variant="caption" color="textSecondary" display="block">
                       Pos: {option.position || '-'} | Proc: {option.process || '-'} | Mat: {option.material_group || '-'} | Thk: {option.thickness_range || '-'}
                     </Typography>
                   </Box>
                 </li>
               )}
               isOptionEqualToValue={(option, value) => option.wps_no === value.wps_no}
             />
             {getWpsDetails(bulkUpdateData.wps_no)}
             <FormControl fullWidth>
                <InputLabel>NDT Type</InputLabel>
                <Select
                  multiple
                  value={bulkUpdateData.ndt_type ? bulkUpdateData.ndt_type.split(',').map(s => s.trim()).filter(Boolean) : []}
                  label="NDT Type"
                  onChange={(e) => {
                    const val = e.target.value;
                    const newValue = typeof val === 'string' ? val.split(',') : val;
                    setBulkUpdateData({ ...bulkUpdateData, ndt_type: newValue.join(', ') });
                  }}
                  renderValue={(selected) => {
                    if ((selected as string[]).length === 0) {
                      return <em>(No Change)</em>;
                    }
                    return (selected as string[]).join(', ');
                  }}
                  displayEmpty
                >
                   {ndtOptions.map(o => (
                     <MenuItem key={o} value={o}>
                       <Checkbox checked={bulkUpdateData.ndt_type ? bulkUpdateData.ndt_type.split(',').map(s => s.trim()).includes(o) : false} />
                       <ListItemText primary={o} />
                     </MenuItem>
                   ))}
                </Select>
             </FormControl>
           </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBulkUpdateDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleBulkUpdateSubmit} variant="contained" color="primary">Update All</Button>
        </DialogActions>
      </Dialog>

    </Container>
  );
};

export default StructureFinalInspection;
