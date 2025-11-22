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
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Card,
  CardContent
} from '@mui/material';
import { Add, Refresh, Upload, Download } from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import EditableTable, { Column } from '../Common/EditableTable';
import ApiService from '../../services/api';
import { MasterJointList as MasterJointListType } from '../../types';

const MasterJointList: React.FC = () => {
  const { selectedProject, canEdit, canDelete } = useAuth();
  const [joints, setJoints] = useState<MasterJointListType[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  type NewJoint = Omit<MasterJointListType, 'id' | 'project_id' | 'created_at'>;
  const [formData, setFormData] = useState<NewJoint>({
    draw_no: '',
    system_no: '',
    line_no: '',
    spool_no: '',
    joint_no: '',
    pipe_dia: '',
    weld_type: '',
    part1_piece_mark_no: '',
    part2_piece_mark_no: '',
    fitup_status: 'pending',
    final_status: 'pending'
  });

  useEffect(() => {
    if (selectedProject) {
      fetchJoints();
    }
  }, [selectedProject]);

  const fetchJoints = async () => {
    if (!selectedProject) return;
    
    try {
      setLoading(true);
      const data = await ApiService.getMasterJointList(selectedProject.id);
      setJoints(data);
    } catch (error) {
      console.error('Error fetching master joints:', error);
      setMessage('Error fetching master joints');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject) return;

    try {
      await ApiService.createMasterJointList({
        ...formData,
        project_id: selectedProject.id
      });
      setOpen(false);
      setFormData({
        draw_no: '',
        system_no: '',
        line_no: '',
        spool_no: '',
        joint_no: '',
        pipe_dia: '',
        weld_type: '',
        part1_piece_mark_no: '',
        part2_piece_mark_no: '',
        fitup_status: 'pending',
        final_status: 'pending'
      });
      fetchJoints();
      setMessage('Joint record created successfully');
    } catch (error: any) {
      setMessage(error.response?.data?.detail || 'Error creating joint record');
    }
  };

  const handleUpdate = async (id: number, data: any) => {
    try {
      await ApiService.updateMasterJointList(id, data);
      fetchJoints();
      setMessage('Joint record updated successfully');
    } catch (error: any) {
      setMessage(error.response?.data?.detail || 'Error updating joint record');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await ApiService.deleteMasterJointList(id);
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
      const result = await ApiService.uploadMasterJointList(selectedProject.id, uploadFile);
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setUploadFile(e.target.files[0]);
    }
  };

  const downloadTemplate = () => {
  const templateData = [
      ['draw_no', 'system_no', 'line_no', 'spool_no', 'joint_no', 'pipe_dia', 'weld_type', 'part1_piece_mark_no', 'part2_piece_mark_no', 'fitup_status'],
      ['DWG-001', 'SYS-01', 'LINE-01', 'SPL-001', 'JNT-001', 'DN100', 'BUTT', 'PM-001', 'PM-002', 'pending'],
      ['DWG-001', 'SYS-01', 'LINE-01', 'SPL-001', 'JNT-002', 'DN80', 'SOCKET', 'PM-003', 'PM-004', 'done']
    ];

    const csvContent = templateData.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'master_joint_list_template.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const columns: Column[] = [
    { field: 'draw_no', headerName: 'Drawing No', width: 120, editable: true },
    { field: 'system_no', headerName: 'System No', width: 100, editable: true },
    { field: 'line_no', headerName: 'Line No', width: 100, editable: true },
    { field: 'spool_no', headerName: 'Spool No', width: 100, editable: true },
    { field: 'joint_no', headerName: 'Joint No', width: 100, editable: true },
    { field: 'pipe_dia', headerName: 'Pipe Dia', width: 100, editable: true },
    { field: 'weld_type', headerName: 'Weld Type', width: 120, editable: true },
    { field: 'part1_piece_mark_no', headerName: 'Part 1 Piece Mark', width: 150, editable: true },
    { field: 'part2_piece_mark_no', headerName: 'Part 2 Piece Mark', width: 150, editable: true },
    { field: 'fitup_status', headerName: 'Fit-up Status', width: 160, editable: false },
    { field: 'final_status', headerName: 'Final Status', width: 160, editable: false },
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
          Master Joint List
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
            onClick={downloadTemplate}
          >
            Template
          </Button>
          {canEdit() && (
            <>
              <Button
                variant="outlined"
                startIcon={<Upload />}
                onClick={() => setUploadOpen(true)}
              >
                Upload
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
        </Box>
      </Box>

      {message && (
        <Alert severity={message.includes('Error') ? 'error' : 'success'} sx={{ mb: 2 }} onClose={() => setMessage('')}>
          {message}
        </Alert>
      )}

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Joint Summary
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Chip 
              label={`Total Joints: ${joints.length}`} 
              variant="outlined" 
            />
            <Chip 
              label={`Fit Up Done: ${joints.filter(j => (j.fitup_status && j.fitup_status !== 'pending')).length}`} 
              color="success" 
              variant="outlined"
            />
            <Chip 
              label={`Pending Fit Up: ${joints.filter(j => j.fitup_status === 'pending').length}`} 
              color="default" 
              variant="outlined"
            />
            <Chip 
              label={`Final Done: ${joints.filter(j => (j.final_status && j.final_status !== 'pending')).length}`} 
              color="success" 
              variant="outlined"
            />
          </Box>
        </CardContent>
      </Card>

      <Box sx={{ mt: 3 }}>
        <EditableTable
          data={joints}
          columns={columns}
          onUpdate={handleUpdate}
          onDelete={canDelete() ? handleDelete : undefined}
          loading={loading}
          maxHeight={500}
        />
      </Box>

      {/* Add Joint Dialog */}
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Add New Joint</DialogTitle>
        <form onSubmit={handleSubmit}>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 1 }}>
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
                  label="System No"
                  value={formData.system_no}
                  onChange={(e) => setFormData({ ...formData, system_no: e.target.value })}
                  required
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Line No"
                  value={formData.line_no}
                  onChange={(e) => setFormData({ ...formData, line_no: e.target.value })}
                  required
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Spool No"
                  value={formData.spool_no}
                  onChange={(e) => setFormData({ ...formData, spool_no: e.target.value })}
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
                  label="Pipe Dia"
                  value={formData.pipe_dia}
                  onChange={(e) => setFormData({ ...formData, pipe_dia: e.target.value })}
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
                  label="Part 1 Piece Mark No"
                  value={formData.part1_piece_mark_no}
                  onChange={(e) => setFormData({ ...formData, part1_piece_mark_no: e.target.value })}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Part 2 Piece Mark No"
                  value={formData.part2_piece_mark_no}
                  onChange={(e) => setFormData({ ...formData, part2_piece_mark_no: e.target.value })}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Fit-up Status</InputLabel>
                  <Select
                    value={formData.fitup_status}
                    label="Fit-up Status"
                    onChange={(e) => setFormData({ ...formData, fitup_status: e.target.value as 'pending' | 'done' })}
                  >
                    <MenuItem value="pending">Pending</MenuItem>
                    <MenuItem value="done">Fit Up Done</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Final Status</InputLabel>
                  <Select
                    value={formData.final_status}
                    label="Final Status"
                    onChange={(e) => setFormData({ ...formData, final_status: e.target.value as 'pending' | 'done' })}
                  >
                    <MenuItem value="pending">Pending</MenuItem>
                    <MenuItem value="done">Final Done</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained">Add Joint</Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Upload Dialog */}
      <Dialog open={uploadOpen} onClose={() => setUploadOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Upload Master Joint List</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Upload CSV file with joint data. Required columns: draw_no, system_no, line_no, spool_no, joint_no.
          </Typography>
          <input
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            style={{ marginBottom: '16px' }}
          />
          {uploadFile && (
            <Typography variant="body2">
              Selected file: {uploadFile.name}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUploadOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleFileUpload} 
            variant="contained" 
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
