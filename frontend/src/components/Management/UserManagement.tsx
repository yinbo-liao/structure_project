import React, { useEffect, useMemo, useState } from 'react';
import { Container, Typography, Box, Paper, Button, Table, TableHead, TableRow, TableCell, TableBody, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Grid, MenuItem, Chip, Checkbox, FormControlLabel, IconButton, Alert } from '@mui/material';
import { Person, Engineering, Add, Assignment, Refresh, LockReset } from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import ApiService from '../../services/api';

type User = {
  id: number;
  email: string;
  full_name?: string;
  role: string;
  is_active: boolean;
  created_at: string;
  assigned_projects?: { id: number; name: string; code: string }[];
};

type Project = { id: number; name: string; code: string };

const UserManagement: React.FC = () => {
  const { user } = useAuth();

  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [openCreate, setOpenCreate] = useState(false);
  const [openAssign, setOpenAssign] = useState(false);
  const [openResetPassword, setOpenResetPassword] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [resetPassword, setResetPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');
  const [resetError, setResetError] = useState<string | null>(null);

  const [formData, setFormData] = useState<{ email: string; full_name: string; password: string; role: string; is_active: boolean }>({
    email: '',
    full_name: '',
    password: '',
    role: 'inspector',
    is_active: true
  });
  const [assignProjectIds, setAssignProjectIds] = useState<number[]>([]);
  const roles = ['admin', 'inspector', 'visitor'];

  const expiresOn = (u: User) => {
    if (u.role === 'admin') return '-';
    try {
      const created = new Date(u.created_at);
      const exp = new Date(created);
      exp.setMonth(exp.getMonth() + 3);
      return exp.toLocaleDateString();
    } catch {
      return '-';
    }
  };

  const load = async () => {
    if (user?.role !== 'admin') return;
    setLoading(true);
    try {
      const [us, ps] = await Promise.all([
        ApiService.getUsers(),
        ApiService.getProjects()
      ]);
      setUsers(us || []);
      setProjects(ps || []);
    } catch (error) {
      console.error('Failed to load user management data:', error);
      // You might want to set an error state here to display to the user
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [user]);

  if (!user || user.role !== 'admin') {
    return (
      <Container>
        <Typography>Access denied. Admin role required.</Typography>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ mt: 4 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 4 }}>
        <Person sx={{ fontSize: 40, mr: 2, color: 'primary.main' }} />
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            User Management
          </Typography>
          <Typography variant="subtitle1" color="textSecondary">
            Manage system users and their project assignments
          </Typography>
        </Box>
      </Box>

      <Paper sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Button variant="contained" startIcon={<Add />} onClick={() => setOpenCreate(true)} sx={{ mr: 2 }}>Add User</Button>
          <Button variant="outlined" startIcon={<Assignment />} onClick={load} disabled={loading}>Refresh</Button>
          <Box sx={{ ml: 2 }}>
            <Chip label="Admin: full access" color="success" sx={{ mr: 1 }} />
            <Chip label="Inspector: edit within assigned projects" color="primary" sx={{ mr: 1 }} />
            <Chip label="Visitor: read-only within assigned projects" />
          </Box>
        </Box>
      </Paper>

      <Paper sx={{ p: 0 }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell><strong>Email</strong></TableCell>
              <TableCell><strong>Name</strong></TableCell>
              <TableCell><strong>Role</strong></TableCell>
              <TableCell><strong>Active</strong></TableCell>
              <TableCell><strong>Expires (3 months)</strong></TableCell>
              <TableCell><strong>Projects</strong></TableCell>
              <TableCell><strong>Actions</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(users || []).map(u => (
              <TableRow key={u.id} hover>
                <TableCell>{u.email}</TableCell>
                <TableCell>{u.full_name || '-'}</TableCell>
                <TableCell>{u.role}</TableCell>
                <TableCell>{u.is_active ? 'Yes' : 'No'}</TableCell>
                <TableCell>{expiresOn(u)}</TableCell>
                <TableCell>
                  {(u.assigned_projects || []).length === 0 ? '-' : (u.assigned_projects || []).map(p => p.code).join(', ')}
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button size="small" variant="outlined" onClick={() => { setSelectedUser(u); setAssignProjectIds((u.assigned_projects || []).map(p => p.id)); setOpenAssign(true); }}>Assign Projects</Button>
                    <Button size="small" variant="outlined" color="warning" startIcon={<LockReset />} onClick={() => { setSelectedUser(u); setResetPassword(''); setResetConfirmPassword(''); setResetError(null); setOpenResetPassword(true); }}>Reset Password</Button>
                  </Box>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={openCreate} onClose={() => setOpenCreate(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add New User</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField label="Email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} fullWidth />
            </Grid>
            <Grid item xs={12}>
              <TextField label="Full Name" value={formData.full_name} onChange={e => setFormData({ ...formData, full_name: e.target.value })} fullWidth />
            </Grid>
            <Grid item xs={12}>
              <TextField label="Password" type="password" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} fullWidth />
            </Grid>
            <Grid item xs={12}>
              <TextField select label="Role" value={formData.role} onChange={e => setFormData({ ...formData, role: String(e.target.value) })} fullWidth>
                {roles.map(r => (<MenuItem key={r} value={r}>{r}</MenuItem>))}
              </TextField>
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel control={<Checkbox checked={formData.is_active} onChange={e => setFormData({ ...formData, is_active: e.target.checked })} />} label="Active" />
            </Grid>
            <Grid item xs={12}>
              <Typography variant="caption" color="textSecondary">
                Inspectors and visitors are validated every 3 months from account creation.
              </Typography>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenCreate(false)}>Cancel</Button>
          <Button variant="contained" onClick={async () => {
            const u = await ApiService.createUser({ email: formData.email, password: formData.password, full_name: formData.full_name, role: formData.role });
            setOpenCreate(false);
            setFormData({ email: '', full_name: '', password: '', role: 'inspector', is_active: true });
            await load();
            setSelectedUser(u as any);
            setAssignProjectIds([]);
            setOpenAssign(true);
          }}>Create</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={openAssign} onClose={() => setOpenAssign(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Assign Projects</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>Select projects for {selectedUser?.email}</Typography>
          <Grid container spacing={1}>
            {(projects || []).map(p => (
              <Grid item xs={12} sm={6} key={p.id}>
                <FormControlLabel control={<Checkbox checked={assignProjectIds.includes(p.id)} onChange={(e) => {
                  const checked = e.target.checked;
                  setAssignProjectIds(prev => checked ? [...prev, p.id] : prev.filter(id => id !== p.id));
                }} />} label={`${p.name} (${p.code})`} />
              </Grid>
            ))}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenAssign(false)}>Close</Button>
          <Button variant="contained" onClick={async () => {
            if (!selectedUser) return;
            await ApiService.assignProjectsToUser(selectedUser.id, assignProjectIds);
            setOpenAssign(false);
            setSelectedUser(null);
            setAssignProjectIds([]);
            await load();
          }}>Save Assignments</Button>
        </DialogActions>
      </Dialog>

      {/* Password Reset Dialog */}
      <Dialog open={openResetPassword} onClose={() => setOpenResetPassword(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Reset Password for {selectedUser?.email}</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <Alert severity="warning" sx={{ mb: 3 }}>
              This will reset the user's password. They will be required to change it on their next login.
            </Alert>

            {resetError && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {resetError}
              </Alert>
            )}

            <TextField
              fullWidth
              label="New Password"
              type="password"
              value={resetPassword}
              onChange={(e) => setResetPassword(e.target.value)}
              margin="normal"
              required
              helperText="Must be at least 8 characters with uppercase, lowercase, number, and special character"
            />

            <TextField
              fullWidth
              label="Confirm New Password"
              type="password"
              value={resetConfirmPassword}
              onChange={(e) => setResetConfirmPassword(e.target.value)}
              margin="normal"
              required
            />

            <Box sx={{ mt: 2, p: 2, bgcolor: 'info.light', borderRadius: 1 }}>
              <Typography variant="body2" color="text.secondary">
                <strong>Password Requirements:</strong>
                <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px' }}>
                  <li>Minimum 8 characters</li>
                  <li>At least one uppercase letter (A-Z)</li>
                  <li>At least one lowercase letter (a-z)</li>
                  <li>At least one number (0-9)</li>
                  <li>At least one special character (!@#$%^&* etc.)</li>
                </ul>
              </Typography>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenResetPassword(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="warning"
            onClick={async () => {
              setResetError(null);

              // Validate passwords
              if (resetPassword !== resetConfirmPassword) {
                setResetError('Passwords do not match');
                return;
              }

              const validatePassword = (password: string): string | null => {
                if (password.length < 8) {
                  return 'Password must be at least 8 characters long';
                }
                if (!/[A-Z]/.test(password)) {
                  return 'Password must contain at least one uppercase letter';
                }
                if (!/[a-z]/.test(password)) {
                  return 'Password must contain at least one lowercase letter';
                }
                if (!/[0-9]/.test(password)) {
                  return 'Password must contain at least one number';
                }
                if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
                  return 'Password must contain at least one special character';
                }
                return null;
              };

              const passwordError = validatePassword(resetPassword);
              if (passwordError) {
                setResetError(passwordError);
                return;
              }

              if (!selectedUser) {
                setResetError('User not found');
                return;
              }

              try {
                await ApiService.resetPassword(selectedUser.id, resetPassword);
                setOpenResetPassword(false);
                setResetPassword('');
                setResetConfirmPassword('');
                setResetError(null);
                
                // Show success message
                alert(`Password reset successfully for ${selectedUser.email}. They will be required to change it on next login.`);
              } catch (err: any) {
                setResetError(err.response?.data?.detail || 'Failed to reset password');
              }
            }}
            disabled={!resetPassword || !resetConfirmPassword}
          >
            Reset Password
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default UserManagement;
