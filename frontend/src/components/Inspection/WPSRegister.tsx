import React, { useEffect, useState } from 'react';
import { 
  Container, Typography, Box, Paper, Grid, TextField, Button, 
  FormControl, InputLabel, Select, MenuItem, Chip, 
  Table, TableHead, TableRow, TableCell, TableBody,
  Tabs, Tab, Stack, Dialog, DialogTitle, DialogContent, DialogActions
} from '@mui/material';
import { useAuth } from '../../contexts/AuthContext';
import ApiService from '../../services/api';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`wps-tabpanel-${index}`}
      aria-labelledby={`wps-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

const WPSRegister: React.FC = () => {
  const { selectedProject, isAdmin } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [form, setForm] = useState<any>({ 
    wps_no: '', 
    job_trade: 'structure', 
    position: '', 
    process: [], 
    material_group: '', 
    thickness_range: '', 
    pipe_dia: '', 
    status: 'active' 
  });
  const [tabValue, setTabValue] = useState(0);
  const [editOpen, setEditOpen] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [editForm, setEditForm] = useState<any>({});

  const positionOptions = (trade: string) => trade === 'pipe'
    ? ['6G', '5F']
    : ['2G', '3G', '4G', '2F', '3F', '6GR'];

  const processOptions = ['GTAW', 'FCAW', 'SAW', 'SMAW', 'FCAW-Oribit.'];

  const load = async () => {
    if (!selectedProject) return;
    const data = await ApiService.getWPSRegister(selectedProject.id);
    setItems(data);
  };

  useEffect(() => { load(); }, [selectedProject]);

  const submit = async () => {
    if (!selectedProject) return;
    const payload = {
      ...form,
      project_id: selectedProject.id,
      process: Array.isArray(form.process) ? (form.process as string[]).join(',') : form.process
    };
    await ApiService.createWPSRegister(payload);
    setForm({ 
      wps_no: '', 
      job_trade: 'structure', 
      position: '', 
      process: [], 
      material_group: '', 
      thickness_range: '', 
      pipe_dia: '', 
      status: 'active' 
    });
    load();
  };

  const openEdit = (item: any) => {
    setEditItem(item);
    setEditForm({
      wps_no: item.wps_no || '',
      job_trade: item.job_trade || 'structure',
      position: item.position || '',
      process: item.process ? item.process.split(',') : [],
      material_group: item.material_group || '',
      thickness_range: item.thickness_range || '',
      pipe_dia: item.pipe_dia || '',
      status: item.status || 'active'
    });
    setEditOpen(true);
  };

  const submitEdit = async () => {
    if (!editItem) return;
    const payload = {
      ...editForm,
      process: Array.isArray(editForm.process) ? (editForm.process as string[]).join(',') : editForm.process
    };
    await ApiService.updateWPSRegister(editItem.id, payload);
    setEditOpen(false);
    load();
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'active': return 'success';
      case 'inactive': return 'default';
      case 'pending': return 'warning';
      case 'expired': return 'error';
      default: return 'default';
    }
  };

  const structureWPS = items.filter(item => item.job_trade === 'structure');
  const pipeWPS = items.filter(item => item.job_trade === 'pipe');

  return (
    <Container maxWidth="xl" sx={{ mt: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">WPS Register</Typography>
        <Typography variant="subtitle1" color="text.secondary">
          Total: {items.length} WPS
        </Typography>
      </Box>

      {isAdmin() && (
        <Paper sx={{ p: 3, mb: 4, bgcolor: 'background.default' }}>
          <Typography variant="h6" gutterBottom sx={{ color: 'primary.main' }}>
            Add New WPS
          </Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6} md={3}>
              <TextField 
                label="WPS Number" 
                value={form.wps_no} 
                onChange={e => setForm({ ...form, wps_no: e.target.value })} 
                fullWidth 
                size="small"
                placeholder="e.g., WPS-001"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Job Trade</InputLabel>
                <Select 
                  value={form.job_trade} 
                  label="Job Trade" 
                  onChange={e => {
                    const jt = String(e.target.value);
                    const pos = positionOptions(jt);
                    setForm({ ...form, job_trade: jt, position: pos.includes(form.position) ? form.position : '', pipe_dia: jt === 'structure' ? 'N.A' : '' });
                  }}
                >
                  <MenuItem value="structure">Structure</MenuItem>
                  <MenuItem value="pipe">Pipe</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Position</InputLabel>
                <Select 
                  value={form.position} 
                  label="Position" 
                  onChange={e => setForm({ ...form, position: String(e.target.value) })}
                >
                  {positionOptions(form.job_trade).map(p => (
                    <MenuItem key={p} value={p}>{p}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Process</InputLabel>
                <Select 
                  multiple 
                  value={form.process} 
                  label="Process" 
                  onChange={e => setForm({ ...form, process: e.target.value })}
                  renderValue={(selected) => (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {(selected as string[]).map((value) => (
                        <Chip key={value} label={value} size="small" />
                      ))}
                    </Box>
                  )}
                >
                  {processOptions.map(p => (
                    <MenuItem key={p} value={p}>{p}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField 
                label="Material Group" 
                value={form.material_group} 
                onChange={e => setForm({ ...form, material_group: e.target.value })} 
                fullWidth 
                size="small"
                placeholder="e.g., CS, SS"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField 
                label="Thickness Range" 
                value={form.thickness_range} 
                onChange={e => setForm({ ...form, thickness_range: e.target.value })} 
                fullWidth 
                size="small"
                placeholder="e.g., 3-25mm"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField 
                label="Pipe Diameter" 
                value={form.pipe_dia} 
                onChange={e => setForm({ ...form, pipe_dia: e.target.value })} 
                fullWidth 
                size="small"
                placeholder={form.job_trade === 'structure' ? 'N.A' : 'e.g., 6", 8"'}
                disabled={form.job_trade === 'structure'}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Status</InputLabel>
                <Select 
                  value={form.status} 
                  label="Status" 
                  onChange={e => setForm({ ...form, status: String(e.target.value) })}
                >
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="inactive">Inactive</MenuItem>
                  <MenuItem value="pending">Pending</MenuItem>
                  <MenuItem value="expired">Expired</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Button 
                variant="contained" 
                onClick={submit} 
                fullWidth 
                sx={{ height: '40px' }}
                disabled={!form.wps_no.trim()}
              >
                Add WPS
              </Button>
            </Grid>
          </Grid>
        </Paper>
      )}

      <Paper sx={{ width: '100%' }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)}>
            <Tab label={`All WPS (${items.length})`} />
            <Tab label={`Structure (${structureWPS.length})`} />
            <Tab label={`Pipe (${pipeWPS.length})`} />
          </Tabs>
        </Box>

        <TabPanel value={tabValue} index={0}>
          {items.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="h6" color="text.secondary">
                No WPS records found
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Add your first WPS using the form above
              </Typography>
            </Box>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell><strong>WPS No</strong></TableCell>
                  <TableCell><strong>Job Trade</strong></TableCell>
                  <TableCell><strong>Position</strong></TableCell>
                  <TableCell><strong>Process</strong></TableCell>
                  <TableCell><strong>Material Group</strong></TableCell>
                  <TableCell><strong>Thickness Range</strong></TableCell>
                  <TableCell><strong>Pipe Dia</strong></TableCell>
                  <TableCell><strong>Status</strong></TableCell>
                  {isAdmin() && <TableCell><strong>Actions</strong></TableCell>}
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight="bold">
                        {item.wps_no}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={item.job_trade || '-'} 
                        size="small" 
                        color={item.job_trade === 'pipe' ? 'primary' : 'secondary'}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>{item.position || '-'}</TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.5} flexWrap="wrap">
                        {item.process?.split(',').map((p: string, idx: number) => (
                          <Chip key={idx} label={p.trim()} size="small" variant="outlined" />
                        ))}
                      </Stack>
                    </TableCell>
                    <TableCell>{item.material_group || '-'}</TableCell>
                    <TableCell>{item.thickness_range || '-'}</TableCell>
                    <TableCell>
                      {item.job_trade === 'pipe' ? (item.pipe_dia || '-') : 'N.A'}
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={item.status || 'active'} 
                        size="small" 
                        color={getStatusColor(item.status)}
                        variant="filled"
                      />
                    </TableCell>
                    {isAdmin() && (
                      <TableCell>
                        <Button 
                          variant="outlined" 
                          size="small" 
                          onClick={() => openEdit(item)}
                        >
                          Edit
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          {structureWPS.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="h6" color="text.secondary">
                No Structure WPS records found
              </Typography>
            </Box>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell><strong>WPS No</strong></TableCell>
                  <TableCell><strong>Position</strong></TableCell>
                  <TableCell><strong>Process</strong></TableCell>
                  <TableCell><strong>Material Group</strong></TableCell>
                  <TableCell><strong>Thickness Range</strong></TableCell>
                  <TableCell><strong>Pipe Dia</strong></TableCell>
                  <TableCell><strong>Status</strong></TableCell>
                  {isAdmin() && <TableCell><strong>Actions</strong></TableCell>}
                </TableRow>
              </TableHead>
              <TableBody>
                {structureWPS.map((item) => (
                  <TableRow key={item.id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight="bold">
                        {item.wps_no}
                      </Typography>
                    </TableCell>
                    <TableCell>{item.position || '-'}</TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.5} flexWrap="wrap">
                        {item.process?.split(',').map((p: string, idx: number) => (
                          <Chip key={idx} label={p.trim()} size="small" variant="outlined" />
                        ))}
                      </Stack>
                    </TableCell>
                    <TableCell>{item.material_group || '-'}</TableCell>
                    <TableCell>{item.thickness_range || '-'}</TableCell>
                    <TableCell>N.A</TableCell>
                    <TableCell>
                      <Chip 
                        label={item.status || 'active'} 
                        size="small" 
                        color={getStatusColor(item.status)}
                        variant="filled"
                      />
                    </TableCell>
                    {isAdmin() && (
                      <TableCell>
                        <Button 
                          variant="outlined" 
                          size="small" 
                          onClick={() => openEdit(item)}
                        >
                          Edit
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabPanel>

        <TabPanel value={tabValue} index={2}>
          {pipeWPS.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="h6" color="text.secondary">
                No Pipe WPS records found
              </Typography>
            </Box>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell><strong>WPS No</strong></TableCell>
                  <TableCell><strong>Position</strong></TableCell>
                  <TableCell><strong>Process</strong></TableCell>
                  <TableCell><strong>Material Group</strong></TableCell>
                  <TableCell><strong>Thickness Range</strong></TableCell>
                  <TableCell><strong>Pipe Dia</strong></TableCell>
                  <TableCell><strong>Status</strong></TableCell>
                  {isAdmin() && <TableCell><strong>Actions</strong></TableCell>}
                </TableRow>
              </TableHead>
              <TableBody>
                {pipeWPS.map((item) => (
                  <TableRow key={item.id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight="bold">
                        {item.wps_no}
                      </Typography>
                    </TableCell>
                    <TableCell>{item.position || '-'}</TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.5} flexWrap="wrap">
                        {item.process?.split(',').map((p: string, idx: number) => (
                          <Chip key={idx} label={p.trim()} size="small" variant="outlined" />
                        ))}
                      </Stack>
                    </TableCell>
                    <TableCell>{item.material_group || '-'}</TableCell>
                    <TableCell>{item.thickness_range || '-'}</TableCell>
                    <TableCell>{item.pipe_dia || '-'}</TableCell>
                    <TableCell>
                      <Chip 
                        label={item.status || 'active'} 
                        size="small" 
                        color={getStatusColor(item.status)}
                        variant="filled"
                      />
                    </TableCell>
                    {isAdmin() && (
                      <TableCell>
                        <Button 
                          variant="outlined" 
                          size="small" 
                          onClick={() => openEdit(item)}
                        >
                          Edit
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabPanel>
      </Paper>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onClose={() => setEditOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Edit WPS</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <TextField 
                label="WPS Number" 
                value={editForm.wps_no} 
                onChange={e => setEditForm({ ...editForm, wps_no: e.target.value })} 
                fullWidth 
                size="small"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Job Trade</InputLabel>
                <Select 
                  value={editForm.job_trade} 
                  label="Job Trade" 
                  onChange={e => {
                    const jt = String(e.target.value);
                    const pos = positionOptions(jt);
                    setEditForm({ ...editForm, job_trade: jt, position: pos.includes(editForm.position) ? editForm.position : '', pipe_dia: jt === 'structure' ? 'N.A' : editForm.pipe_dia });
                  }}
                >
                  <MenuItem value="structure">Structure</MenuItem>
                  <MenuItem value="pipe">Pipe</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Position</InputLabel>
                <Select 
                  value={editForm.position} 
                  label="Position" 
                  onChange={e => setEditForm({ ...editForm, position: String(e.target.value) })}
                >
                  {positionOptions(editForm.job_trade).map(p => (
                    <MenuItem key={p} value={p}>{p}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Process</InputLabel>
                <Select 
                  multiple 
                  value={editForm.process} 
                  label="Process" 
                  onChange={e => setEditForm({ ...editForm, process: e.target.value })}
                  renderValue={(selected) => (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {(selected as string[]).map((value) => (
                        <Chip key={value} label={value} size="small" />
                      ))}
                    </Box>
                  )}
                >
                  {processOptions.map(p => (
                    <MenuItem key={p} value={p}>{p}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField 
                label="Material Group" 
                value={editForm.material_group} 
                onChange={e => setEditForm({ ...editForm, material_group: e.target.value })} 
                fullWidth 
                size="small"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField 
                label="Thickness Range" 
                value={editForm.thickness_range} 
                onChange={e => setEditForm({ ...editForm, thickness_range: e.target.value })} 
                fullWidth 
                size="small"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField 
                label="Pipe Diameter" 
                value={editForm.pipe_dia} 
                onChange={e => setEditForm({ ...editForm, pipe_dia: e.target.value })} 
                fullWidth 
                size="small"
                placeholder={editForm.job_trade === 'structure' ? 'N.A' : 'e.g., 6", 8"'}
                disabled={editForm.job_trade === 'structure'}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Status</InputLabel>
                <Select 
                  value={editForm.status} 
                  label="Status" 
                  onChange={e => setEditForm({ ...editForm, status: String(e.target.value) })}
                >
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="inactive">Inactive</MenuItem>
                  <MenuItem value="pending">Pending</MenuItem>
                  <MenuItem value="expired">Expired</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOpen(false)}>Cancel</Button>
          <Button onClick={submitEdit} variant="contained">Save Changes</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default WPSRegister;
