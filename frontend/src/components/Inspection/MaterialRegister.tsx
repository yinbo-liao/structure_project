import React, { useState, useEffect } from 'react';
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
  Chip
} from '@mui/material';
import { Add, Refresh } from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import EditableTable, { Column } from '../Common/EditableTable';
import ApiService from '../../services/api';
import { MaterialRegister as MaterialRegisterType } from '../../types';

const MaterialRegister: React.FC = () => {
  const { selectedProject, canEdit, canDelete } = useAuth();
  const [materials, setMaterials] = useState<MaterialRegisterType[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [messageSeverity, setMessageSeverity] = useState<'success' | 'warning' | 'error'>('success');
  const [uploading, setUploading] = useState(false);

  type NewMaterial = Omit<MaterialRegisterType, 'id' | 'project_id' | 'created_at'>;
  const [formData, setFormData] = useState<NewMaterial>({
    piece_mark_no: '',
    material_type: '',
    grade: '',
    thickness: '',
    heat_no: '',
    spec: '',
    category: '',
    pipe_dia: '',
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
        spec: '',
        category: '',
        pipe_dia: '',
        inspection_status: 'pending'
      });
      fetchMaterials();
      setMessage('Material record created successfully');
    } catch (error: any) {
      setMessage(error.response?.data?.detail || 'Error creating material record');
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
    { field: 'piece_mark_no', headerName: 'Piece Mark No', width: 150, editable: true },
    { field: 'material_type', headerName: 'Material Type', width: 120, editable: true },
    { field: 'grade', headerName: 'Grade', width: 100, editable: true },
    { field: 'thickness', headerName: 'Thickness', width: 100, editable: true },
    { field: 'pipe_dia', headerName: 'Pipe Dia', width: 100, editable: true },
    { field: 'heat_no', headerName: 'Heat No', width: 120, editable: true },
    { field: 'spec', headerName: 'Spec', width: 120, editable: true },
    { field: 'category', headerName: 'Category', width: 120, editable: true },
    { field: 'inspection_status', headerName: 'Status', width: 120, editable: true, type: 'select', 
      options: [
        { value: 'pending', label: 'Pending' },
        { value: 'inspected', label: 'Inspected' },
        { value: 'rejected', label: 'Rejected' }
      ]
    },
    { field: 'created_at', headerName: 'Created', width: 120, type: 'date' }
  ];

  if (!selectedProject) {
    return (
      <Container>
        <Typography>Please select a project first.</Typography>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ mt: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Material Register
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
                    setMessage(err.response?.data?.detail || 'Upload failed');
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

      <EditableTable
        data={materials}
        columns={columns}
        onUpdate={handleUpdate}
        onDelete={canDelete() ? handleDelete : undefined}
        loading={loading}
        maxHeight={500}
      />

      {/* Add Material Dialog */}
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Add New Material</DialogTitle>
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
                  label="Pipe Dia"
                  value={formData.pipe_dia}
                  onChange={(e) => setFormData({ ...formData, pipe_dia: e.target.value })}
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
                  label="Specification"
                  value={formData.spec}
                  onChange={(e) => setFormData({ ...formData, spec: e.target.value })}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Category"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  select
                  label="Inspection Status"
                  value={formData.inspection_status}
                  onChange={(e) => setFormData({ ...formData, inspection_status: e.target.value as NewMaterial['inspection_status'] })}
                  SelectProps={{ native: true }}
                >
                  <option value="pending">Pending</option>
                  <option value="inspected">Inspected</option>
                  <option value="rejected">Rejected</option>
                </TextField>
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