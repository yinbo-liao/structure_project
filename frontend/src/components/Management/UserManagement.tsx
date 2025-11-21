import React, { useEffect, useMemo, useState } from 'react';
import { Container, Typography, Box, Paper, Button, Table, TableHead, TableRow, TableCell, TableBody, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Grid, MenuItem, Chip, Checkbox, FormControlLabel } from '@mui/material';
import { Person, Engineering, Add, Assignment } from '@mui/icons-material';
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
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);

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
                  <Button size="small" variant="outlined" onClick={() => { setSelectedUser(u); setAssignProjectIds((u.assigned_projects || []).map(p => p.id)); setOpenAssign(true); }}>Assign Projects</Button>
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
    </Container>
  );
};

export default UserManagement;