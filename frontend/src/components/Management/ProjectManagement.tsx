import React, { useEffect, useState } from 'react';
import { Container, Typography, Box, Paper, Button, Table, TableHead, TableRow, TableCell, TableBody, Dialog, DialogTitle, DialogContent, DialogActions, Grid, TextField, Chip } from '@mui/material';
import { AccountTree, Add } from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import ApiService from '../../services/api';

const ProjectManagement: React.FC = () => {
  const { user } = useAuth();
  const [projects, setProjects] = useState<{ id: number; name: string; code: string; description?: string }[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<{ name: string; code: string; description: string }>({ name: '', code: '', description: '' });

  const load = async () => {
    if (!user || user.role !== 'admin') return;
    setLoading(true);
    try {
      const list = await ApiService.getProjects();
      setProjects(list || []);
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
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <AccountTree sx={{ fontSize: 40, mr: 2, color: 'primary.main' }} />
          <Box>
            <Typography variant="h4" component="h1" gutterBottom>
              Project Management
            </Typography>
            <Typography variant="subtitle1" color="textSecondary">
              Create and manage projects across the organization
            </Typography>
          </Box>
        </Box>
        <Box>
          <Chip label={user.email === 'admin@mpdms.com' ? 'Super Admin' : 'Admin'} color="secondary" sx={{ mr: 2 }} />
          <Button variant="contained" startIcon={<Add />} onClick={() => setOpen(true)} sx={{ mr: 1 }}>New Project</Button>
          <Button variant="outlined" onClick={load} disabled={loading}>Refresh</Button>
        </Box>
      </Box>

      <Paper sx={{ p: 0 }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell><strong>Name</strong></TableCell>
              <TableCell><strong>Code</strong></TableCell>
              <TableCell><strong>Description</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(projects || []).map(p => (
              <TableRow key={p.id} hover>
                <TableCell>{p.name}</TableCell>
                <TableCell>{p.code}</TableCell>
                <TableCell>{p.description || '-'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create New Project</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField label="Project Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} fullWidth />
            </Grid>
            <Grid item xs={12}>
              <TextField label="Project Code" value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} fullWidth />
            </Grid>
            <Grid item xs={12}>
              <TextField label="Description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} fullWidth multiline minRows={2} />
            </Grid>
            <Grid item xs={12}>
              <Typography variant="caption" color="textSecondary">
                New projects are isolated by `project_id`. All modules (Master Joint List, Material Register, Fit-up, Final, NDT Requests/Status, WPS, Welder) will store and query data per selected project.
              </Typography>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={async () => {
            const created = await ApiService.createProject({ name: form.name, code: form.code, description: form.description });
            setOpen(false);
            setForm({ name: '', code: '', description: '' });
            await load();
          }}>Create</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default ProjectManagement;