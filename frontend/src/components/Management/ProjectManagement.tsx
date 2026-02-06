import React, { useEffect, useState } from 'react';
import { 
  Container, Typography, Box, Paper, Button, Table, TableHead, TableRow, TableCell, TableBody, 
  Dialog, DialogTitle, DialogContent, DialogActions, Grid, TextField, Chip, MenuItem, 
  IconButton, Alert, Snackbar, CircularProgress
} from '@mui/material';
import { AccountTree, Add, Edit, Delete, Refresh } from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import ApiService from '../../services/api';

interface Project {
  id: number;
  name: string;
  code: string;
  description?: string;
  project_type: 'pipe' | 'structure';
}

const ProjectManagement: React.FC = () => {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<{ 
    id?: number; 
    name: string; 
    code: string; 
    description: string; 
    project_type: 'pipe' | 'structure' 
  }>({ 
    name: '', 
    code: '', 
    description: '', 
    project_type: 'structure' 
  });
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info' | 'warning';
  }>({
    open: false,
    message: '',
    severity: 'info'
  });

  const load = async () => {
    if (!user || user.role !== 'admin') return;
    setLoading(true);
    try {
      const list = await ApiService.getProjects();
      setProjects(list || []);
    } catch (error: any) {
      showSnackbar(`Failed to load projects: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [user]);

  const showSnackbar = (message: string, severity: 'success' | 'error' | 'info' | 'warning') => {
    setSnackbar({
      open: true,
      message,
      severity
    });
  };

  const handleOpenCreate = () => {
    setForm({ 
      name: '', 
      code: '', 
      description: '', 
      project_type: 'structure' 
    });
    setOpenDialog(true);
  };

  const handleOpenEdit = (project: Project) => {
    setForm({
      id: project.id,
      name: project.name,
      code: project.code,
      description: project.description || '',
      project_type: project.project_type
    });
    setOpenDialog(true);
  };

  const handleOpenDelete = (project: Project) => {
    setProjectToDelete(project);
    setDeleteDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.code.trim()) {
      showSnackbar('Project name and code are required', 'error');
      return;
    }

    try {
      if (form.id) {
        // Update existing project - only allowed fields: name, code, description
        await ApiService.updateProject(form.id, {
          name: form.name,
          code: form.code,
          description: form.description
          // Note: project_type is not allowed for updates per backend validation
        });
        showSnackbar('Project updated successfully', 'success');
      } else {
        // Create new project - all fields allowed
        await ApiService.createProject({
          name: form.name,
          code: form.code,
          description: form.description,
          project_type: form.project_type
        });
        showSnackbar('Project created successfully', 'success');
      }
      
      setOpenDialog(false);
      setForm({ name: '', code: '', description: '', project_type: 'structure' });
      await load();
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || error.message || 'Operation failed';
      showSnackbar(`Failed to save project: ${errorMessage}`, 'error');
    }
  };

  const handleDelete = async () => {
    if (!projectToDelete) return;

    try {
      await ApiService.deleteProject(projectToDelete.id);
      showSnackbar('Project deleted successfully', 'success');
      setDeleteDialogOpen(false);
      setProjectToDelete(null);
      await load();
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || error.message || 'Delete failed';
      showSnackbar(`Failed to delete project: ${errorMessage}`, 'error');
    }
  };

  if (!user || user.role !== 'admin') {
    return (
      <Container>
        <Typography>Access denied. Admin role required.</Typography>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ mt: 4 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <AccountTree sx={{ fontSize: 40, mr: 2, color: 'primary.main' }} />
          <Box>
            <Typography variant="h4" component="h1" gutterBottom>
              Project Management
            </Typography>
            <Typography variant="subtitle1" color="textSecondary">
              Create, edit, and manage projects across the organization
            </Typography>
          </Box>
        </Box>
        <Box>
          <Chip 
            label={user.email === 'admin@mpdms.com' ? 'Super Admin' : 'Admin'} 
            color="secondary" 
            sx={{ mr: 2 }} 
          />
          <Button 
            variant="contained" 
            startIcon={<Add />} 
            onClick={handleOpenCreate} 
            sx={{ mr: 1 }}
          >
            New Project
          </Button>
          <Button 
            variant="outlined" 
            startIcon={<Refresh />}
            onClick={load} 
            disabled={loading}
          >
            Refresh
          </Button>
        </Box>
      </Box>

      <Paper sx={{ p: 0, position: 'relative' }}>
        {loading && (
          <Box sx={{ 
            position: 'absolute', 
            top: 0, 
            left: 0, 
            right: 0, 
            bottom: 0, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            backgroundColor: 'rgba(255, 255, 255, 0.7)',
            zIndex: 1
          }}>
            <CircularProgress />
          </Box>
        )}
        <Table>
          <TableHead>
            <TableRow>
              <TableCell><strong>Name</strong></TableCell>
              <TableCell><strong>Code</strong></TableCell>
              <TableCell><strong>Description</strong></TableCell>
              <TableCell><strong>Type</strong></TableCell>
              <TableCell><strong>Actions</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {projects.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 3 }}>
                  <Typography color="textSecondary">
                    No projects found. Create your first project.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              projects.map(project => (
                <TableRow key={project.id} hover>
                  <TableCell>{project.name}</TableCell>
                  <TableCell>{project.code}</TableCell>
                  <TableCell>{project.description || '-'}</TableCell>
                  <TableCell>
                    <Chip 
                      label={project.project_type === 'pipe' ? 'Pipe Fabrication' : 'Structure Fabrication'} 
                      color={project.project_type === 'pipe' ? 'primary' : 'secondary'} 
                      size="small" 
                    />
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <IconButton 
                        size="small" 
                        color="primary"
                        onClick={() => handleOpenEdit(project)}
                        title="Edit project"
                      >
                        <Edit fontSize="small" />
                      </IconButton>
                      <IconButton 
                        size="small" 
                        color="error"
                        onClick={() => handleOpenDelete(project)}
                        title="Delete project"
                      >
                        <Delete fontSize="small" />
                      </IconButton>
                    </Box>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Paper>

      {/* Create/Edit Dialog */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {form.id ? 'Edit Project' : 'Create New Project'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField 
                label="Project Name" 
                value={form.name} 
                onChange={e => setForm({ ...form, name: e.target.value })} 
                fullWidth 
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField 
                label="Project Code" 
                value={form.code} 
                onChange={e => setForm({ ...form, code: e.target.value })} 
                fullWidth 
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField 
                label="Description" 
                value={form.description} 
                onChange={e => setForm({ ...form, description: e.target.value })} 
                fullWidth 
                multiline 
                minRows={2} 
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                select
                label="Project Type"
                value={form.project_type}
                onChange={e => setForm({ ...form, project_type: e.target.value as 'pipe' | 'structure' })}
                fullWidth
              >
                <MenuItem value="pipe">Pipe Fabrication</MenuItem>
                <MenuItem value="structure">Structure Fabrication</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12}>
              <Typography variant="caption" color="textSecondary">
                Projects are isolated by `project_id`. All modules (Master Joint List, Material Register, Fit-up, Final, NDT Requests/Status, WPS, Welder) will store and query data per selected project.
              </Typography>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
          <Button 
            variant="contained" 
            onClick={handleSubmit}
            disabled={!form.name.trim() || !form.code.trim()}
          >
            {form.id ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Delete Project</DialogTitle>
        <DialogContent>
          {projectToDelete && (
            <>
              <Alert severity="warning" sx={{ mb: 2 }}>
                <Typography variant="subtitle2" fontWeight="bold">
                  Warning: This action cannot be undone!
                </Typography>
              </Alert>
              <Typography variant="body1" gutterBottom>
                Are you sure you want to delete the project <strong>"{projectToDelete.name}"</strong> (Code: {projectToDelete.code})?
              </Typography>
              <Typography variant="body2" color="textSecondary" sx={{ mt: 2 }}>
                This will permanently remove the project and all associated data including:
              </Typography>
              <Box component="ul" sx={{ pl: 2, mt: 1, color: 'text.secondary' }}>
                <li><Typography variant="body2">Master Joint List entries</Typography></li>
                <li><Typography variant="body2">Material Register records</Typography></li>
                <li><Typography variant="body2">Fit-up and Final inspections</Typography></li>
                <li><Typography variant="body2">NDT Requests and Status records</Typography></li>
                <li><Typography variant="body2">WPS and Welder registrations</Typography></li>
              </Box>
              <Typography variant="body2" color="error" sx={{ mt: 2, fontWeight: 'bold' }}>
                Please confirm this is an unused project before proceeding.
              </Typography>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleDelete} 
            variant="contained" 
            color="error"
            autoFocus
          >
            Delete Project
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert 
          onClose={() => setSnackbar({ ...snackbar, open: false })} 
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default ProjectManagement;
