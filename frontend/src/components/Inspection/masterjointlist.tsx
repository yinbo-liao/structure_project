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
  MenuItem
} from '@mui/material';
import { Add, Refresh, Upload, Download } from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import EditableTable, { Column } from '../Common/EditableTable';
import ApiService from '../../services/api';

const MasterJointList: React.FC = () => {
  const { selectedProject, canEdit } = useAuth();
  const [joints, setJoints] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

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
        final_report_no: item.final_report_no,  // Added this line
        fitup_status: item.fitup_status,
        final_status: item.final_status,
        inspection_category: item.inspection_category,
        created_at: item.created_at
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
        inspection_category: data.inspection_category
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setUploadFile(e.target.files[0]);
    }
  };

  const downloadTemplate = () => {
    // Create CSV template with ALL columns that match the backend expectations
    // Using column names that the backend normalization will recognize
    const headers = [
      'Drawing No',           // Maps to draw_no (required)
      'Structure Category',   // Maps to structure_category (required)
      'Page No',             // Maps to page_no (required)
      'Drawing Rev',         // Maps to drawing_rev (required)
      'Joint No',            // Maps to joint_no (required)
      'Block no',            // Maps to block_no (optional)
      'Thickness',           // Maps to thickness (optional)
      'Weld Type',           // Maps to weld_type (optional)
      'Weld Length',         // Maps to weld_length (optional)
      'Part 1 Piece Mark',   // Maps to part1_piece_mark_no (optional)
      'Part 2 Piece Mark',   // Maps to part2_piece_mark_no (optional)
      'Inspection Category', // Maps to inspection_category (optional)
      'Fit Up Report No',    // Maps to fit_up_report_no (optional)
      'Final Report No',     // Maps to final_report_no (optional)
      'Fitup Status',        // Maps to fitup_status (optional)
      'Final Status'         // Maps to final_status (optional)
    ];
    
    // Example data matching the table display
    const exampleRow1 = [
      'DWG-001',     // Drawing No
      'BEAM',        // Structure Category
      'PAGE-01',     // Page No
      'REV-A',       // Drawing Rev
      'JNT-001',     // Joint No
      'BLK-01',      // Block no
      '12mm',        // Thickness
      'BUTT',        // Weld Type
      '150',         // Weld Length
      'PM-001',      // Part 1 Piece Mark
      'PM-002',      // Part 2 Piece Mark
      'type-I',      // Inspection Category
      '',            // Fit Up Report No (empty initially)
      '',            // Final Report No (empty initially)
      'pending',     // Fitup Status
      'pending'      // Final Status
    ];
    
    const exampleRow2 = [
      'DWG-001',     // Drawing No
      'COLUMN',      // Structure Category
      'PAGE-02',     // Page No
      'REV-B',       // Drawing Rev
      'JNT-002',     // Joint No
      'BLK-02',      // Block no
      '10mm',        // Thickness
      'SOCKET',      // Weld Type
      '200',         // Weld Length
      'PM-003',      // Part 1 Piece Mark
      'PM-004',      // Part 2 Piece Mark
      'type-II',     // Inspection Category
      '',            // Fit Up Report No
      '',            // Final Report No
      'pending',     // Fitup Status
      'pending'      // Final Status
    ];
    
    const templateData = [headers, exampleRow1, exampleRow2];

    const csvContent = templateData.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'master_joint_list_template_complete.csv';
    link.click();
    URL.revokeObjectURL(url);
  };
  
  const downloadRecords = () => {
    // Download ALL columns that match the table display
    const headers = [
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
      'Fitup Status',
      'Final Status'
    ];
    
    const rows = joints.map(j => [
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
      j.fitup_status || 'pending',
      j.final_status || 'pending'
    ]);
    
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
    { field: 'block_no', headerName: 'Block no', width: 140, editable: true },
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
        { value: 'type-III', label: 'Type III' },
        { value: 'special', label: 'Special' }
      ]
    },
    { field: 'weld_length', headerName: 'Weld Length', width: 140, editable: true, type: 'number' },
    { field: 'fit_up_report_no', headerName: 'Fit Up Report No', width: 180, editable: true },
    { field: 'final_report_no', headerName: 'Final Report No', width: 180, editable: true },
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
          Structure Weld Joint Master List
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
          <Button
            variant="outlined"
            startIcon={<Download />}
            onClick={downloadRecords}
          >
            Download CSV
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
        <Alert severity={message.toLowerCase().includes('error') ? 'error' : 'success'} sx={{ mb: 2 }}>
          {message}
        </Alert>
      )}

      <Paper sx={{ p: 3, mb: 3 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              fullWidth
              label="Block No"
              value={searchBlockNo}
              onChange={(e) => setSearchBlockNo(e.target.value)}
              size="small"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              fullWidth
              label="Drawing No"
              value={searchDrawingNo}
              onChange={(e) => setSearchDrawingNo(e.target.value)}
              size="small"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              fullWidth
              label="Joint No"
              value={searchJointNo}
              onChange={(e) => setSearchJointNo(e.target.value)}
              size="small"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              fullWidth
              label="Inspection Category"
              value={searchInspectionCategory}
              onChange={(e) => setSearchInspectionCategory(e.target.value)}
              size="small"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              fullWidth
              label="Fit Up Report No"
              value={searchFitUpReportNo}
              onChange={(e) => setSearchFitUpReportNo(e.target.value)}
              size="small"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              fullWidth
              label="Final Report No"
              value={searchFinalReportNo}
              onChange={(e) => setSearchFinalReportNo(e.target.value)}
              size="small"
            />
          </Grid>
        </Grid>
      </Paper>

      <EditableTable
        columns={columns}
        data={filteredJoints}
        loading={loading}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
      />

      {/* Add Joint Dialog */}
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Add New Joint</DialogTitle>
        <DialogContent>
          <form onSubmit={handleSubmit}>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Block No"
                  value={formData.block_no}
                  onChange={(e) => setFormData({...formData, block_no: e.target.value})}
                  required
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Drawing No"
                  value={formData.draw_no}
                  onChange={(e) => setFormData({...formData, draw_no: e.target.value})}
                  required
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Drawing Rev"
                  value={formData.drawing_rev}
                  onChange={(e) => setFormData({...formData, drawing_rev: e.target.value})}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Page No"
                  value={formData.page_no}
                  onChange={(e) => setFormData({...formData, page_no: e.target.value})}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Joint No"
                  value={formData.joint_no}
                  onChange={(e) => setFormData({...formData, joint_no: e.target.value})}
                  required
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Weld Type"
                  value={formData.weld_type}
                  onChange={(e) => setFormData({...formData, weld_type: e.target.value})}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Thickness"
                  value={formData.thickness}
                  onChange={(e) => setFormData({...formData, thickness: e.target.value})}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Structure Category"
                  value={formData.structure_category}
                  onChange={(e) => setFormData({...formData, structure_category: e.target.value})}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Part 1 Piece Mark"
                  value={formData.part1_piece_mark_no}
                  onChange={(e) => setFormData({...formData, part1_piece_mark_no: e.target.value})}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Part 2 Piece Mark"
                  value={formData.part2_piece_mark_no}
                  onChange={(e) => setFormData({...formData, part2_piece_mark_no: e.target.value})}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Weld Length"
                  type="number"
                  value={formData.weld_length || ''}
                  onChange={(e) => setFormData({...formData, weld_length: e.target.value ? parseFloat(e.target.value) : undefined})}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Inspection Category</InputLabel>
                  <Select
                    value={formData.inspection_category}
                    label="Inspection Category"
                    onChange={(e) => setFormData({...formData, inspection_category: e.target.value})}
                  >
                    <MenuItem value="type-I">Type I</MenuItem>
                    <MenuItem value="type-II">Type II</MenuItem>
                    <MenuItem value="type-III">Type III</MenuItem>
                    <MenuItem value="special">Special</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
            <DialogActions sx={{ mt: 2 }}>
              <Button onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" variant="contained">Create</Button>
            </DialogActions>
          </form>
        </DialogContent>
      </Dialog>

      {/* Upload Dialog */}
      <Dialog open={uploadOpen} onClose={() => setUploadOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Upload Master Joint List</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" sx={{ mb: 2 }}>
              Upload a CSV file with the following columns: Drawing No, Structure Category, Page No, Drawing Rev, Joint No, Block no, Thickness, Weld Type, Weld Length, Part 1 Piece Mark, Part 2 Piece Mark, Inspection Category, Fit Up Report No, Final Report No, Fitup Status, Final Status
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
              Note: The first 5 columns (Drawing No, Structure Category, Page No, Drawing Rev, Joint No) are required. Other columns are optional.
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
          </Box>
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
