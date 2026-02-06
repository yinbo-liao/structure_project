import React, { useState, useEffect, useMemo } from 'react';
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
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import { Add, Refresh, Search, Clear, Download } from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import EditableTable, { Column } from '../Common/EditableTable';
import ApiService from '../../services/api';
import { MaterialRegister as MaterialRegisterType } from '../../types';

const MaterialRegister: React.FC = () => {
  const { selectedProject, canEdit, canDelete } = useAuth();
  // Always structure project
  const [materials, setMaterials] = useState<MaterialRegisterType[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [messageSeverity, setMessageSeverity] = useState<'success' | 'warning' | 'error'>('success');
  const [uploading, setUploading] = useState(false);

  // Search states
  const [searchPieceMarkNo, setSearchPieceMarkNo] = useState('');
  const [searchMaterialType, setSearchMaterialType] = useState('');
  const [searchHeatNo, setSearchHeatNo] = useState('');
  const [searchStatus, setSearchStatus] = useState('');

  type NewMaterial = Omit<MaterialRegisterType, 'id' | 'project_id' | 'created_at'>;
  const [formData, setFormData] = useState<NewMaterial>({
    piece_mark_no: '',
    material_type: '',
    grade: '',
    thickness: '',
    heat_no: '',
    block_no: '',
    drawing_no: '',
    structure_category: '',
    drawing_rev: '',
    material_report_no: '',
    inspection_status: 'pending'
  });

  useEffect(() => {
    if (selectedProject) {
      fetchMaterials();
    }
  }, [selectedProject]);

  const fetchMaterials = async () => {
    if (!selectedProject) return;
    
    try {
      setLoading(true);
      const data = await ApiService.getMaterialRegister(selectedProject.id);
      setMaterials(data);
    } catch (error) {
      console.error('Error fetching materials:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter materials based on search criteria
  const filteredMaterials = useMemo(() => {
    return materials.filter(material => {
      // Piece Mark No search
      if (searchPieceMarkNo && !material.piece_mark_no?.toLowerCase().includes(searchPieceMarkNo.toLowerCase())) {
        return false;
      }
      
      // Material Type search
      if (searchMaterialType && !material.material_type?.toLowerCase().includes(searchMaterialType.toLowerCase())) {
        return false;
      }
      
      // Heat No search
      if (searchHeatNo && !material.heat_no?.toLowerCase().includes(searchHeatNo.toLowerCase())) {
        return false;
      }
      
      // Status search
      if (searchStatus && material.inspection_status !== searchStatus) {
        return false;
      }
      
      return true;
    });
  }, [materials, searchPieceMarkNo, searchMaterialType, searchHeatNo, searchStatus]);

  const clearSearch = () => {
    setSearchPieceMarkNo('');
    setSearchMaterialType('');
    setSearchHeatNo('');
    setSearchStatus('');
  };

  const getErrorMessage = (error: any, fallback: string) => {
    if (!error || !error.response) return fallback;
    
    const detail = error.response.data?.detail;
    
    // If it's a simple string
    if (typeof detail === 'string') return detail;
    
    // If it's an array of validation errors
    if (Array.isArray(detail)) {
      return detail.map(err => err.msg || JSON.stringify(err)).join('; ');
    }
    
    // If it's an object with a message
    if (detail && typeof detail === 'object' && detail.msg) {
      return detail.msg;
    }
    
    // Fallback to stringifying the entire object
    try {
      return JSON.stringify(detail) || fallback;
    } catch {
      return fallback;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject) return;

    try {
      await ApiService.createMaterialRegister({
        ...formData,
        project_id: selectedProject.id
      });
      setOpen(false);
      setFormData({
        piece_mark_no: '',
        material_type: '',
        grade: '',
        thickness: '',
        heat_no: '',
        block_no: '',
        drawing_no: '',
        structure_category: '',
        drawing_rev: '',
        material_report_no: '',
        inspection_status: 'pending'
      });
      fetchMaterials();
      setMessage('Material record created successfully');
      setMessageSeverity('success');
    } catch (error: any) {
      const errorMessage = getErrorMessage(error, 'Error creating material record');
      setMessage(errorMessage);
      setMessageSeverity('error');
    }
  };

  const handleUpdate = async (id: number, data: any) => {
    await ApiService.updateMaterialRegister(id, data);
    fetchMaterials();
  };

  const handleDelete = async (id: number) => {
    await ApiService.deleteMaterialRegister(id);
    fetchMaterials();
  };

  const columns: Column[] = [
    // Structure project columns with optimized widths for better screen fit
    { field: 'block_no', headerName: 'Block no', width: 140, editable: true },
    { field: 'drawing_no', headerName: 'Drawing No', width: 140, editable: true },
    { field: 'piece_mark_no', headerName: 'Piece Mark No', width: 180, editable: true },
    { field: 'material_type', headerName: 'Material Type', width: 140, editable: true },
    { field: 'grade', headerName: 'Grade', width: 120, editable: true },
    { field: 'thickness', headerName: 'Thickness', width: 120, editable: true },
    { field: 'structure_spec', headerName: 'Spec', width: 120, editable: true },
    { field: 'heat_no', headerName: 'Heat No', width: 140, editable: true },
    { field: 'material_report_no', headerName: 'Material Report No', width: 180, editable: true },
    { field: 'structure_category', headerName: 'Structure Category', width: 160, editable: true },
    { field: 'inspection_status', headerName: 'Status', width: 140, editable: true, type: 'select', 
      options: [
        { value: 'pending', label: 'Pending' },
        { value: 'accepted', label: 'Accepted' },
        { value: 'rejected', label: 'Rejected' }
      ],
      formatValue: (row: any) => {
        const value = row.inspection_status || '';
        if (value === 'pending') return 'Pending';
        if (value === 'accepted') return 'Accepted';
        if (value === 'rejected') return 'Rejected';
        // Handle legacy 'inspected' values
        if (value === 'inspected') return 'Accepted';
        return value || '-';
      }
    },
    { field: 'created_at', headerName: 'Created', width: 140, type: 'date' }
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
          Structure Material Register
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={fetchMaterials}
            disabled={loading}
          >
            Refresh
          </Button>
          <Button
            variant="outlined"
            startIcon={<Download />}
              onClick={() => {
                // Create CSV template with ALL columns that match the table display
                // Using the same headers as the Excel template for consistency
                const headers = [
                  'Block no', 
                  'Drawing No', 
                  'Piece Mark No', 
                  'Material Type', 
                  'Grade', 
                  'Thickness', 
                  'Spec',           // Maps to structure_spec
                  'Heat No', 
                  'Material Report No', 
                  'Structure Category',  // Correct spelling - backend handles both
                  'Status',         // Maps to inspection_status
                  'drawing_rev'     // Additional column for drawing revision
                ];
                
                const sampleData = [
                  'BLK001', 'DRW-001', 'PM-001', 'Plate', 'A36', '10MM', 'ASTM A36', 
                  'HT-001', 'MR-001', 'type-i', 'pending', 'Rev A'
                ];
                
                const csvContent = [
                  headers.join(','),
                  sampleData.join(','),
                  'BLK002,DRW-002,PM-002,Plate,A36,12MM,ASTM A36,HT-002,MR-002,type-ii,accepted,Rev B',
                  'BLK003,DRW-003,PM-003,Plate,A36,15MM,ASTM A572,HT-003,MR-003,Special,pending,Rev C'
                ].join('\n');
                
                const blob = new Blob([csvContent], { type: 'text/csv' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'structure_material_template_complete.csv';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
              }}
          >
            Download CSV Template
          </Button>
          <Button
            variant="outlined"
            startIcon={<Download />}
            sx={{ ml: 1 }}
            onClick={() => {
              window.location.href = '/api/v1/templates/structure-material-v2.xlsx';
            }}
          >
            Download Excel Template
          </Button>
          {canEdit() && (
            <Button
              variant="outlined"
              component="label"
              disabled={uploading}
            >
              Upload CSV/XLSX
              <input
                hidden
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={async (e) => {
                  if (!selectedProject) return;
                  const file = e.target.files?.[0];
                  if (!file) return;
                  try {
                    setUploading(true);
                    const res = await ApiService.uploadMaterialRegister(selectedProject.id, file);
                    const created = res.created || 0;
                    const updated = res.updated || 0;
                    const errors = Array.isArray(res.errors) ? res.errors : [];
                    if (errors.length > 0) {
                      setMessage(`Processed: created ${created}, updated ${updated} • errors ${errors.length} (e.g., ${errors.slice(0, 3).join(' | ')})`);
                      setMessageSeverity('warning');
                    } else {
                      setMessage(`Processed: created ${created}, updated ${updated}`);
                      setMessageSeverity('success');
                    }
                    fetchMaterials();
                  } catch (err: any) {
                    const errorMessage = getErrorMessage(err, 'Upload failed');
                    setMessage(errorMessage);
                    setMessageSeverity('error');
                  } finally {
                    setUploading(false);
                    e.target.value = '';
                  }
                }}
              />
            </Button>
          )}
          {canEdit() && (
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => setOpen(true)}
            >
              Add Material
            </Button>
          )}
        </Box>
      </Box>

      {message && (
        <Alert severity={messageSeverity} sx={{ mb: 2 }} onClose={() => setMessage('')}>
          {message}
        </Alert>
      )}

      {/* Search Section */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          <Search sx={{ verticalAlign: 'middle', mr: 1 }} />
          Search Materials
        </Typography>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              fullWidth
              size="small"
              label="Piece Mark No"
              value={searchPieceMarkNo}
              onChange={(e) => setSearchPieceMarkNo(e.target.value)}
              placeholder="Search by piece mark..."
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              fullWidth
              size="small"
              label="Material Type"
              value={searchMaterialType}
              onChange={(e) => setSearchMaterialType(e.target.value)}
              placeholder="Search by material type..."
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              fullWidth
              size="small"
              label="Heat No"
              value={searchHeatNo}
              onChange={(e) => setSearchHeatNo(e.target.value)}
              placeholder="Search by heat no..."
            />
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Status</InputLabel>
              <Select
                value={searchStatus}
                label="Status"
                onChange={(e) => setSearchStatus(e.target.value)}
              >
                <MenuItem value="">All</MenuItem>
                <MenuItem value="pending">Pending</MenuItem>
                <MenuItem value="accepted">Accepted</MenuItem>
                <MenuItem value="rejected">Rejected</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6} md={1}>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<Clear />}
              onClick={clearSearch}
              size="small"
            >
              Clear
            </Button>
          </Grid>
        </Grid>
        <Box sx={{ mt: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            Showing {filteredMaterials.length} of {materials.length} materials
          </Typography>
          {searchPieceMarkNo || searchMaterialType || searchHeatNo || searchStatus ? (
            <Chip 
              label="Search Active" 
              color="primary" 
              size="small" 
              variant="outlined"
            />
          ) : null}
        </Box>
      </Paper>

      {/* Materials Table - Optimized for PC with better sizing */}
      <Paper sx={{ p: 3, boxShadow: 2, width: '100%', overflow: 'hidden' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h6" fontWeight="600">
            Material Records
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Total: <Typography component="span" variant="body2" fontWeight="bold" color="primary.main">{filteredMaterials.length}</Typography> materials
            </Typography>
            {filteredMaterials.length !== materials.length && (
              <Chip 
                label={`Filtered from ${materials.length}`} 
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
          <EditableTable
            data={filteredMaterials}
            columns={columns}
            onUpdate={handleUpdate}
            onDelete={canDelete() ? handleDelete : undefined}
            loading={loading}
            maxHeight={600}
          />
        </Box>
      </Paper>

      {/* Add Material Dialog */}
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Add New Structure Material</DialogTitle>
        <form onSubmit={handleSubmit}>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Piece Mark No"
                  value={formData.piece_mark_no}
                  onChange={(e) => setFormData({ ...formData, piece_mark_no: e.target.value })}
                  required
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Material Type"
                  value={formData.material_type}
                  onChange={(e) => setFormData({ ...formData, material_type: e.target.value })}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Grade"
                  value={formData.grade}
                  onChange={(e) => setFormData({ ...formData, grade: e.target.value })}
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
                  label="Block no"
                  value={formData.block_no || ''}
                  onChange={(e) => setFormData({ ...formData, block_no: e.target.value })}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Drawing Rev"
                  value={formData.drawing_rev || ''}
                  onChange={(e) => setFormData({ ...formData, drawing_rev: e.target.value })}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Heat No"
                  value={formData.heat_no}
                  onChange={(e) => setFormData({ ...formData, heat_no: e.target.value })}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Structure Category"
                  value={formData.structure_category || ''}
                  onChange={(e) => setFormData({ ...formData, structure_category: e.target.value })}
                  placeholder="e.g., Beam, Column, type-i, type-ii"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Drawing No"
                  value={formData.drawing_no || ''}
                  onChange={(e) => setFormData({ ...formData, drawing_no: e.target.value })}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Material Report No"
                  value={formData.material_report_no || ''}
                  onChange={(e) => setFormData({ ...formData, material_report_no: e.target.value })}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Inspection Status</InputLabel>
                  <Select
                    value={formData.inspection_status}
                    label="Inspection Status"
                    onChange={(e) => setFormData({ ...formData, inspection_status: e.target.value as NewMaterial['inspection_status'] })}
                  >
                    <MenuItem value="pending">Pending</MenuItem>
                    <MenuItem value="accepted">Accepted</MenuItem>
                    <MenuItem value="rejected">Rejected</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained">Add Material</Button>
          </DialogActions>
        </form>
      </Dialog>
    </Container>
  );
};

export default MaterialRegister;