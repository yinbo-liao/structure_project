import React, { useState, useEffect } from 'react';
import {
  Container,
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  Box,
  AppBar,
  Toolbar,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  Chip,
  LinearProgress
} from '@mui/material';
import {
  AccountCircle,
  Engineering,
  Business,
  Logout,
  VpnKey,
  Summarize,
  TrendingUp,
  Assessment
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import ApiService from '../../services/api';
import { Project, ProjectSummary } from '../../types';

const ProjectSelection: React.FC = () => {
  const { user, logout, setSelectedProject } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectSummaries, setProjectSummaries] = useState<Record<number, ProjectSummary>>({});
  const [loading, setLoading] = useState(true);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [selectedProjectForSummary, setSelectedProjectForSummary] = useState<Project | null>(null);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [message, setMessage] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', code: '', description: '' });
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignProject, setAssignProject] = useState<Project | null>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);

  useEffect(() => {
    try {
      const cached = localStorage.getItem('projectsCache');
      if (cached) {
        const arr = JSON.parse(cached);
        if (Array.isArray(arr)) {
          setProjects(arr);
          setLoading(false);
        }
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetchProjectsAndSummaries();
  }, []);

  const fetchProjectsAndSummaries = async () => {
    try {
      if (projects.length === 0) setLoading(true);
      const projectsData = await ApiService.getProjects();
      setProjects(projectsData);
      try { localStorage.setItem('projectsCache', JSON.stringify(projectsData)); } catch {}
    } catch (error) {
      console.error('Error fetching projects:', error);
    } finally {
      setLoading(false);
    }

    try {
      const tasks = projects.map(p => 
        ApiService.getProjectSummary(p.id)
          .then(summary => ({ id: p.id, summary }))
          .catch(() => null)
      );
      const results = await Promise.allSettled(tasks);
      const next: Record<number, ProjectSummary> = {};
      results.forEach(r => {
        if (r.status === 'fulfilled' && r.value) {
          next[r.value.id] = r.value.summary;
        }
      });
      if (Object.keys(next).length) {
        setProjectSummaries(prev => ({ ...prev, ...next }));
      }
    } catch (e) {
      // Non-blocking: summaries load best-effort
    }
  };

  const handleProjectSelect = (project: Project) => {
    setSelectedProject(project);
    navigate('/dashboard');
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleChangePassword = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setMessage('New passwords do not match');
      return;
    }

    if (passwordData.newPassword.length < 6) {
      setMessage('Password must be at least 6 characters long');
      return;
    }

    try {
      await ApiService.changePassword(user!.id, {
        current_password: passwordData.currentPassword,
        new_password: passwordData.newPassword
      });
      setMessage('Password changed successfully');
      setChangePasswordOpen(false);
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error: any) {
      setMessage(error.response?.data?.detail || 'Error changing password');
    }
  };

  const openCreateDialog = () => {
    setMessage('');
    setCreateForm({ name: '', code: '', description: '' });
    setCreateOpen(true);
  };

  const handleCreateProject = async () => {
    if (!createForm.name.trim() || !createForm.code.trim()) {
      setMessage('Project name and code are required');
      return;
    }
    try {
      await ApiService.createProject({
        name: createForm.name.trim(),
        code: createForm.code.trim(),
        description: createForm.description.trim() || undefined
      });
      setCreateOpen(false);
      await fetchProjectsAndSummaries();
    } catch (error: any) {
      setMessage(error.response?.data?.detail || 'Error creating project');
    }
  };

  const openAssignDialog = async (project: Project) => {
    setAssignProject(project);
    setSelectedUserId(null);
    setMessage('');
    try {
      const list = await ApiService.getUsers();
      setUsers(list);
      setAssignOpen(true);
    } catch (error: any) {
      setMessage(error.response?.data?.detail || 'Failed to load users');
    }
  };

  const handleAssignProject = async () => {
    if (!assignProject || !selectedUserId) return;
    try {
      const userDetail = users.find(u => u.id === selectedUserId);
      const currentIds = (userDetail?.assigned_projects || []).map((p: any) => p.id);
      const nextIds = Array.from(new Set([...currentIds, assignProject.id]));
      await ApiService.assignProjectsToUser(selectedUserId, nextIds);
      setAssignOpen(false);
    } catch (error: any) {
      setMessage(error.response?.data?.detail || 'Failed to assign project');
    }
  };

  const handleViewSummary = (project: Project) => {
    setSelectedProjectForSummary(project);
    setSummaryOpen(true);
  };

  const getProgressColor = (progress: number) => {
    if (progress >= 80) return 'success';
    if (progress >= 50) return 'warning';
    return 'error';
  };

  const calculateProjectProgress = (summary: ProjectSummary): number => {
    if (summary.total_joints === 0) return 0;
    return Math.round((summary.fitup_done / summary.total_joints) * 100);
  };

  return (
    <Container maxWidth="xl">
      <AppBar position="static" color="default" elevation={1}>
        <Toolbar>
          <Engineering sx={{ mr: 2, color: 'primary.main' }} />
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Multi-Project Data Management System
          </Typography>
          <Typography variant="body1" sx={{ mr: 2 }}>
            Welcome, {user?.full_name || user?.email} ({user?.role})
          </Typography>
          <Button color="inherit" onClick={handleMenuOpen}>
            <AccountCircle sx={{ mr: 1 }} />
            Menu
          </Button>
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleMenuClose}
          >
            <MenuItem onClick={() => { setChangePasswordOpen(true); handleMenuClose(); }}>
              <VpnKey sx={{ mr: 1 }} />
              Change Password
            </MenuItem>
            {user?.role === 'admin' && (
              <MenuItem onClick={() => { openCreateDialog(); handleMenuClose(); }}>
                <Engineering sx={{ mr: 1 }} />
                Create Project
              </MenuItem>
            )}
            <MenuItem onClick={() => { logout(); handleMenuClose(); }}>
              <Logout sx={{ mr: 1 }} />
              Logout
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      {loading && (
        <Box sx={{ mt: 2 }}>
          <LinearProgress />
          <Typography variant="body2" sx={{ mt: 1, textAlign: 'center' }}>
            Loading projects...
          </Typography>
        </Box>
      )}

      <Box sx={{ mt: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom align="center">
          Select Project
        </Typography>
        <Typography variant="subtitle1" gutterBottom align="center" color="textSecondary">
          Choose a project to start data management
        </Typography>

        <Grid container spacing={3} sx={{ mt: 2 }}>
          {projects.map((project) => {
            const summary = projectSummaries[project.id];
            const progress = summary ? calculateProjectProgress(summary) : 0;
            
            return (
              <Grid item xs={12} sm={6} md={4} lg={3} key={project.id}>
                <Card 
                  sx={{ 
                    height: '100%', 
                    display: 'flex', 
                    flexDirection: 'column',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease-in-out',
                    '&:hover': {
                      boxShadow: 6,
                      transform: 'translateY(-2px)'
                    }
                  }}
                >
                  <CardContent sx={{ flexGrow: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                      <Business sx={{ mr: 1, color: 'primary.main' }} />
                      <Typography variant="h6" component="h2" noWrap>
                        {project.name}
                      </Typography>
                    </Box>
                    
                    <Typography variant="body2" color="textSecondary" gutterBottom>
                      Code: {project.code}
                    </Typography>
                    
                    <Typography variant="body2" sx={{ mb: 2 }} noWrap>
                      {project.description}
                    </Typography>

                    {summary && (
                      <Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                          <Typography variant="caption" color="textSecondary">
                            Progress
                          </Typography>
                          <Typography variant="caption" fontWeight="bold">
                            {progress}%
                          </Typography>
                        </Box>
                        <LinearProgress 
                          variant="determinate" 
                          value={progress} 
                          color={getProgressColor(progress)}
                          sx={{ mb: 1 }}
                        />
                        
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 2 }}>
                          <Chip 
                            size="small" 
                            label={`${summary.fitup_done}/${summary.total_joints} Joints`}
                            color="primary" 
                            variant="outlined"
                          />
                          <Chip 
                            size="small" 
                            label={`${summary.final_done} Final`}
                            color="secondary" 
                            variant="outlined"
                          />
                        </Box>

                        <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'text.secondary' }}>
                          <span>Material: {summary.material_used}</span>
                          <span>NDT: {summary.ndt_requests_total}</span>
                        </Box>
                      </Box>
                    )}
                  </CardContent>
                  
                <Box sx={{ p: 2, display: 'flex', gap: 1 }}>
                  <Button 
                    variant="contained" 
                    fullWidth
                    onClick={() => handleProjectSelect(project)}
                  >
                    Enter
                  </Button>
                  <Button 
                    variant="outlined"
                    onClick={() => handleViewSummary(project)}
                    disabled={!summary}
                  >
                    <Summarize />
                  </Button>
                  {user?.role === 'admin' && (
                    <Button
                      variant="outlined"
                      onClick={() => openAssignDialog(project)}
                    >
                      Assign
                    </Button>
                  )}
                </Box>
              </Card>
            </Grid>
          );
        })}
      </Grid>

        {projects.length === 0 && !loading && (
          <Box sx={{ textAlign: 'center', mt: 8 }}>
            <Engineering sx={{ fontSize: 80, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              No Projects Assigned
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Please contact your administrator to get project assignments.
            </Typography>
          </Box>
        )}
      </Box>

      {/* Change Password Dialog */}
      <Dialog open={changePasswordOpen} onClose={() => setChangePasswordOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Change Password</DialogTitle>
        <DialogContent>
          {message && (
            <Alert severity={message.includes('successfully') ? 'success' : 'error'} sx={{ mb: 2 }}>
              {message}
            </Alert>
          )}
          <TextField
            autoFocus
            margin="dense"
            label="Current Password"
            type="password"
            fullWidth
            variant="outlined"
            value={passwordData.currentPassword}
            onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            label="New Password"
            type="password"
            fullWidth
            variant="outlined"
            value={passwordData.newPassword}
            onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            label="Confirm New Password"
            type="password"
            fullWidth
            variant="outlined"
            value={passwordData.confirmPassword}
            onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setChangePasswordOpen(false)}>Cancel</Button>
          <Button onClick={handleChangePassword} variant="contained">
            Change Password
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create Project</DialogTitle>
        <DialogContent>
          {message && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {message}
            </Alert>
          )}
          <TextField
            autoFocus
            margin="dense"
            label="Project Name"
            fullWidth
            variant="outlined"
            value={createForm.name}
            onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            label="Project Code"
            fullWidth
            variant="outlined"
            value={createForm.code}
            onChange={(e) => setCreateForm({ ...createForm, code: e.target.value })}
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            label="Description"
            fullWidth
            variant="outlined"
            value={createForm.description}
            onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button onClick={handleCreateProject} variant="contained">Create</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={assignOpen} onClose={() => setAssignOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Assign Project</DialogTitle>
        <DialogContent>
          {message && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {message}
            </Alert>
          )}
          <TextField
            select
            label="Select User"
            fullWidth
            value={selectedUserId ?? ''}
            onChange={(e) => setSelectedUserId(Number(e.target.value))}
            sx={{ mt: 1 }}
          >
            {users.map((u) => (
              <MenuItem key={u.id} value={u.id}>
                {u.full_name || u.email} ({u.role})
              </MenuItem>
            ))}
          </TextField>
          {assignProject && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2">Project: {assignProject.name} ({assignProject.code})</Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAssignOpen(false)}>Cancel</Button>
          <Button onClick={handleAssignProject} variant="contained" disabled={!selectedUserId}>Assign</Button>
        </DialogActions>
      </Dialog>

      {/* Project Summary Dialog */}
      <Dialog open={summaryOpen} onClose={() => setSummaryOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Assessment sx={{ mr: 1 }} />
            Project Summary
          </Box>
        </DialogTitle>
        <DialogContent>
          {selectedProjectForSummary && projectSummaries[selectedProjectForSummary.id] && (
            (() => {
              const summary = projectSummaries[selectedProjectForSummary.id];
              const progress = calculateProjectProgress(summary);
              
              return (
                <Box>
                  <Typography variant="h6" gutterBottom>
                    {selectedProjectForSummary.name}
                  </Typography>
                  <Typography variant="subtitle2" color="textSecondary" gutterBottom>
                    {selectedProjectForSummary.code}
                  </Typography>

                  <Grid container spacing={3} sx={{ mt: 1 }}>
                    <Grid item xs={12} sm={6}>
                      <Card variant="outlined">
                        <CardContent>
                          <Typography variant="h6" color="primary" gutterBottom>
                            Project Progress
                          </Typography>
                          <Typography variant="body2" gutterBottom>
                            <strong>Total Joints:</strong> {summary.total_joints}
                          </Typography>
                          <Typography variant="body2" gutterBottom>
                            <strong>Fit-up Done:</strong> {summary.fitup_done}
                          </Typography>
                          <Typography variant="body2" gutterBottom>
                            <strong>Final Done:</strong> {summary.final_done}
                          </Typography>
                          <Box sx={{ mt: 2 }}>
                            <Typography variant="body2" gutterBottom>
                              Overall Progress: {progress}%
                            </Typography>
                            <LinearProgress 
                              variant="determinate" 
                              value={progress} 
                              color={getProgressColor(progress)}
                            />
                          </Box>
                        </CardContent>
                      </Card>
                    </Grid>

                    <Grid item xs={12} sm={6}>
                      <Card variant="outlined">
                        <CardContent>
                          <Typography variant="h6" color="primary" gutterBottom>
                            Material Management
                          </Typography>
                          <Typography variant="body2" gutterBottom>
                            <strong>Material Used:</strong> {summary.material_used}
                          </Typography>
                          <Typography variant="body2" gutterBottom>
                            <strong>Pending Inspection:</strong> {summary.material_pending_inspection}
                          </Typography>
                          <Typography variant="body2">
                            <strong>Outstanding:</strong> {summary.material_missing_from_fitup}
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>

                    <Grid item xs={12} sm={6}>
                      <Card variant="outlined">
                        <CardContent>
                          <Typography variant="h6" color="primary" gutterBottom>
                            NDT Requests
                          </Typography>
                          <Typography variant="body2" gutterBottom>
                            <strong>Total:</strong> {summary.ndt_requests_total}
                          </Typography>
                          <Typography variant="body2" gutterBottom>
                            <strong>Pending:</strong> {summary.ndt_requests_pending}
                          </Typography>
                          <Typography variant="body2">
                            <strong>Approved:</strong> {summary.ndt_requests_approved}
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>

                    <Grid item xs={12} sm={6}>
                      <Card variant="outlined">
                        <CardContent>
                          <Typography variant="h6" color="primary" gutterBottom>
                            Weld Statistics
                          </Typography>
                          <Typography variant="body2" gutterBottom>
                            <strong>Accept Length:</strong> {summary.weld_accept_length_total.toFixed(1)}m
                          </Typography>
                          <Typography variant="body2" gutterBottom>
                            <strong>Reject Length:</strong> {summary.weld_reject_length_total.toFixed(1)}m
                          </Typography>
                          <Typography variant="body2">
                            <strong>Success Rate:</strong> {
                              summary.weld_accept_length_total + summary.weld_reject_length_total > 0
                                ? Math.round((summary.weld_accept_length_total / (summary.weld_accept_length_total + summary.weld_reject_length_total)) * 100)
                                : 0
                            }%
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>

                    {Object.keys(summary.ndt_success_rates).length > 0 && (
                      <Grid item xs={12}>
                        <Card variant="outlined">
                          <CardContent>
                            <Typography variant="h6" color="primary" gutterBottom>
                              NDT Success Rates
                            </Typography>
                            <Grid container spacing={2}>
                              {Object.entries(summary.ndt_success_rates).map(([type, rate]) => (
                                <Grid item xs={6} sm={4} md={2.4} key={type}>
                                  <Box textAlign="center">
                                    <Typography variant="body2" fontWeight="bold">
                                      {type}
                                    </Typography>
                                    <Typography variant="h6" color="primary">
                                      {rate}%
                                    </Typography>
                                  </Box>
                                </Grid>
                              ))}
                            </Grid>
                          </CardContent>
                        </Card>
                      </Grid>
                    )}
                  </Grid>
                </Box>
              );
            })()
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSummaryOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default ProjectSelection;