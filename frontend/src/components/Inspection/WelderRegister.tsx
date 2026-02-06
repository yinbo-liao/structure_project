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
      id={`welder-tabpanel-${index}`}
      aria-labelledby={`welder-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

const WelderRegister: React.FC = () => {
  const { selectedProject, isAdmin } = useAuth();
  const isStructureProject = selectedProject?.project_type === 'structure';
  const [items, setItems] = useState<any[]>([]);
  const [form, setForm] = useState<any>({ 
    welder_no: '', 
    welder_name: '', 
    qualification: '', 
    qualified_material: '', 
    thickness_range: '', 
    weld_process: [], 
    qualified_position: '', 
    production_test_date: '', 
    validity: '', 
    status: 'active' 
  });
  const [tabValue, setTabValue] = useState(0);
  const [editOpen, setEditOpen] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [editForm, setEditForm] = useState<any>({});

  const processOptions = ['GTAW', 'FCAW', 'SAW', 'SMAW', 'FCAW-Oribit.'];
  const positionOptions = ['2G', '3G', '4G', '2F', '3F', '6GR', '6G', '5F'];

  const formatDDMMYY = (date: Date) => {
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yy = String(date.getFullYear()).slice(-2);
    return `${dd}/${mm}/${yy}`;
  };

  const computeValidityFrom = (dateISO?: string) => {
    try {
      const base = dateISO ? new Date(dateISO) : new Date();
      const sixMonths = new Date(base.getTime());
      sixMonths.setMonth(sixMonths.getMonth() + 6);
      return formatDDMMYY(sixMonths);
    } catch {
      return '';
    }
  };

  const load = async () => {
    if (!selectedProject) return;
    const data = await ApiService.getWelderRegister(selectedProject.id);
    setItems(data);
  };

  useEffect(() => { load(); }, [selectedProject]);

  const submit = async () => {
    if (!selectedProject) return;
    const payload = {
      ...form,
      project_id: selectedProject.id,
      validity: computeValidityFrom(form.production_test_date),
      weld_process: Array.isArray(form.weld_process) ? (form.weld_process as string[]).join(',') : form.weld_process
    };
    await ApiService.createWelderRegister(payload);
    setForm({ 
      welder_no: '', 
      welder_name: '', 
      qualification: '', 
      qualified_material: '', 
      thickness_range: '', 
      weld_process: [], 
      qualified_position: '', 
      production_test_date: '', 
      validity: '', 
      status: 'active' 
    });
    load();
  };

  const openEdit = (item: any) => {
    setEditItem(item);
    setEditForm({
      welder_no: item.welder_no || '',
      welder_name: item.welder_name || '',
      qualification: item.qualification || '',
      qualified_material: item.qualified_material || '',
      thickness_range: item.thickness_range || '',
      weld_process: item.weld_process ? item.weld_process.split(',') : [],
      qualified_position: item.qualified_position || '',
      production_test_date: item.production_test_date || '',
      validity: item.validity || '',
      status: item.status || 'active'
    });
    setEditOpen(true);
  };

  const submitEdit = async () => {
    if (!editItem) return;
    const payload = {
      ...editForm,
      weld_process: Array.isArray(editForm.weld_process) ? (editForm.weld_process as string[]).join(',') : editForm.weld_process
    };
    await ApiService.updateWelderRegister(editItem.id, payload);
    setEditOpen(false);
    load();
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'active': return 'success';
      case 'invalid': return 'error';
      case 'expired': return 'warning';
      default: return 'default';
    }
  };

  const getQualificationColor = (qualification: string) => {
    switch (qualification?.toLowerCase()) {
      case 'pipe': return 'primary';
      case 'structure': return 'secondary';
      default: return 'default';
    }
  };

  const activeWelders = items.filter(item => item.status === 'active');
  const invalidWelders = items.filter(item => item.status === 'invalid');
  const pipeWelders = items.filter(item => item.qualification?.toLowerCase() === 'pipe');
  const structureWelders = items.filter(item => item.qualification?.toLowerCase() === 'structure');

  return (
    <Container maxWidth="xl" sx={{ mt: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">{isStructureProject ? 'Structure Welder Register' : 'Pipe Welder Register'}</Typography>
        <Typography variant="subtitle1" color="text.secondary">
          Total: {items.length} Welders
        </Typography>
      </Box>

      {isAdmin() && (
        <Paper sx={{ p: 3, mb: 4, bgcolor: 'background.default' }}>
          <Typography variant="h6" gutterBottom sx={{ color: 'primary.main' }}>
            Register New Welder
          </Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6} md={3}>
              <TextField 
                label="Welder Number" 
                value={form.welder_no} 
                onChange={e => setForm({ ...form, welder_no: e.target.value })} 
                fullWidth 
                size="small"
                placeholder="e.g., WLD-001"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField 
                label="Welder Name" 
                value={form.welder_name} 
                onChange={e => setForm({ ...form, welder_name: e.target.value })} 
                fullWidth 
                size="small"
                placeholder="Full name"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Qualification</InputLabel>
                <Select 
                  value={form.qualification} 
                  label="Qualification" 
                  onChange={e => setForm({ ...form, qualification: String(e.target.value) })}
                >
                  <MenuItem value="PIPE">PIPE</MenuItem>
                  <MenuItem value="Structure">Structure</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField 
                label="Qualified Material" 
                value={form.qualified_material} 
                onChange={e => setForm({ ...form, qualified_material: e.target.value })} 
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
                label="Production Test Date" 
                type="date" 
                value={form.production_test_date} 
                onChange={e => setForm({ ...form, production_test_date: e.target.value })} 
                fullWidth 
                size="small"
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Weld Process</InputLabel>
                <Select 
                  multiple 
                  value={form.weld_process} 
                  label="Weld Process" 
                  onChange={e => setForm({ ...form, weld_process: e.target.value })}
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
              <FormControl fullWidth size="small">
                <InputLabel>Qualified Position</InputLabel>
                <Select 
                  value={form.qualified_position} 
                  label="Qualified Position" 
                  onChange={e => setForm({ ...form, qualified_position: String(e.target.value) })}
                >
                  {positionOptions.map(p => (
                    <MenuItem key={p} value={p}>{p}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField 
                label="Validity (dd/mm/yy)" 
                value={computeValidityFrom(form.production_test_date)} 
                fullWidth 
                size="small"
                disabled
                placeholder="Auto-calculated"
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
                  <MenuItem value="invalid">Invalid</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Button 
                variant="contained" 
                onClick={submit} 
                fullWidth 
                sx={{ height: '40px' }}
                disabled={!form.welder_no.trim() || !form.welder_name.trim()}
              >
                Register Welder
              </Button>
            </Grid>
          </Grid>
        </Paper>
      )}

      <Paper sx={{ width: '100%' }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)}>
            <Tab label={`All Welders (${items.length})`} />
            <Tab label={`Active (${activeWelders.length})`} />
            <Tab label={`Pipe (${pipeWelders.length})`} />
            <Tab label={`Structure (${structureWelders.length})`} />
          </Tabs>
        </Box>

        <TabPanel value={tabValue} index={0}>
          {items.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="h6" color="text.secondary">
                No welder records found
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Register your first welder using the form above
              </Typography>
            </Box>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell><strong>Welder No</strong></TableCell>
                  <TableCell><strong>Name</strong></TableCell>
                  <TableCell><strong>Qualification</strong></TableCell>
                  <TableCell><strong>Material</strong></TableCell>
                  <TableCell><strong>Thickness Range</strong></TableCell>
                  <TableCell><strong>Process</strong></TableCell>
                  <TableCell><strong>Position</strong></TableCell>
                  <TableCell><strong>Validity</strong></TableCell>
                  <TableCell><strong>Status</strong></TableCell>
                  {isAdmin() && <TableCell><strong>Actions</strong></TableCell>}
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight="bold">
                        {item.welder_no}
                      </Typography>
                    </TableCell>
                    <TableCell>{item.welder_name || '-'}</TableCell>
                    <TableCell>
                      <Chip 
                        label={item.qualification || '-'} 
                        size="small" 
                        color={getQualificationColor(item.qualification)}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>{item.qualified_material || '-'}</TableCell>
                    <TableCell>{item.thickness_range || '-'}</TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.5} flexWrap="wrap">
                        {item.weld_process?.split(',').map((p: string, idx: number) => (
                          <Chip key={idx} label={p.trim()} size="small" variant="outlined" />
                        ))}
                      </Stack>
                    </TableCell>
                    <TableCell>{item.qualified_position || '-'}</TableCell>
                    <TableCell>
                      <Typography 
                        variant="body2" 
                        color={item.status === 'invalid' ? 'error.main' : 'text.primary'}
                        fontWeight={item.status === 'active' ? 'bold' : 'normal'}
                      >
                        {item.validity || '-'}
                      </Typography>
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
          {activeWelders.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="h6" color="text.secondary">
                No active welders found
              </Typography>
            </Box>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell><strong>Welder No</strong></TableCell>
                  <TableCell><strong>Name</strong></TableCell>
                  <TableCell><strong>Qualification</strong></TableCell>
                  <TableCell><strong>Material</strong></TableCell>
                  <TableCell><strong>Thickness Range</strong></TableCell>
                  <TableCell><strong>Process</strong></TableCell>
                  <TableCell><strong>Position</strong></TableCell>
                  <TableCell><strong>Validity</strong></TableCell>
                  {isAdmin() && <TableCell><strong>Actions</strong></TableCell>}
                </TableRow>
              </TableHead>
              <TableBody>
                {activeWelders.map((item) => (
                  <TableRow key={item.id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight="bold">
                        {item.welder_no}
                      </Typography>
                    </TableCell>
                    <TableCell>{item.welder_name || '-'}</TableCell>
                    <TableCell>
                      <Chip 
                        label={item.qualification || '-'} 
                        size="small" 
                        color={getQualificationColor(item.qualification)}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>{item.qualified_material || '-'}</TableCell>
                    <TableCell>{item.thickness_range || '-'}</TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.5} flexWrap="wrap">
                        {item.weld_process?.split(',').map((p: string, idx: number) => (
                          <Chip key={idx} label={p.trim()} size="small" variant="outlined" />
                        ))}
                      </Stack>
                    </TableCell>
                    <TableCell>{item.qualified_position || '-'}</TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight="bold" color="success.main">
                        {item.validity || '-'}
                      </Typography>
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
          {pipeWelders.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="h6" color="text.secondary">
                No pipe welders found
              </Typography>
            </Box>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell><strong>Welder No</strong></TableCell>
                  <TableCell><strong>Name</strong></TableCell>
                  <TableCell><strong>Material</strong></TableCell>
                  <TableCell><strong>Thickness Range</strong></TableCell>
                  <TableCell><strong>Process</strong></TableCell>
                  <TableCell><strong>Position</strong></TableCell>
                  <TableCell><strong>Validity</strong></TableCell>
                  <TableCell><strong>Status</strong></TableCell>
                  {isAdmin() && <TableCell><strong>Actions</strong></TableCell>}
                </TableRow>
              </TableHead>
              <TableBody>
                {pipeWelders.map((item) => (
                  <TableRow key={item.id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight="bold">
                        {item.welder_no}
                      </Typography>
                    </TableCell>
                    <TableCell>{item.welder_name || '-'}</TableCell>
                    <TableCell>{item.qualified_material || '-'}</TableCell>
                    <TableCell>{item.thickness_range || '-'}</TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.5} flexWrap="wrap">
                        {item.weld_process?.split(',').map((p: string, idx: number) => (
                          <Chip key={idx} label={p.trim()} size="small" variant="outlined" />
                        ))}
                      </Stack>
                    </TableCell>
                    <TableCell>{item.qualified_position || '-'}</TableCell>
                    <TableCell>
                      <Typography 
                        variant="body2" 
                        color={item.status === 'invalid' ? 'error.main' : 'text.primary'}
                        fontWeight={item.status === 'active' ? 'bold' : 'normal'}
                      >
                        {item.validity || '-'}
                      </Typography>
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

        <TabPanel value={tabValue} index={3}>
          {structureWelders.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="h6" color="text.secondary">
                No structure welders found
              </Typography>
            </Box>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell><strong>Welder No</strong></TableCell>
                  <TableCell><strong>Name</strong></TableCell>
                  <TableCell><strong>Material</strong></TableCell>
                  <TableCell><strong>Thickness Range</strong></TableCell>
                  <TableCell><strong>Process</strong></TableCell>
                  <TableCell><strong>Position</strong></TableCell>
                  <TableCell><strong>Validity</strong></TableCell>
                  <TableCell><strong>Status</strong></TableCell>
                  {isAdmin() && <TableCell><strong>Actions</strong></TableCell>}
                </TableRow>
              </TableHead>
              <TableBody>
                {structureWelders.map((item) => (
                  <TableRow key={item.id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight="bold">
                        {item.welder_no}
                      </Typography>
                    </TableCell>
                    <TableCell>{item.welder_name || '-'}</TableCell>
                    <TableCell>{item.qualified_material || '-'}</TableCell>
                    <TableCell>{item.thickness_range || '-'}</TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.5} flexWrap="wrap">
                        {item.weld_process?.split(',').map((p: string, idx: number) => (
                          <Chip key={idx} label={p.trim()} size="small" variant="outlined" />
                        ))}
                      </Stack>
                    </TableCell>
                    <TableCell>{item.qualified_position || '-'}</TableCell>
                    <TableCell>
                      <Typography 
                        variant="body2" 
                        color={item.status === 'invalid' ? 'error.main' : 'text.primary'}
                        fontWeight={item.status === 'active' ? 'bold' : 'normal'}
                      >
                        {item.validity || '-'}
                      </Typography>
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
      </Paper>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onClose={() => setEditOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Edit Welder</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <TextField 
                label="Welder Number" 
                value={editForm.welder_no} 
                onChange={e => setEditForm({ ...editForm, welder_no: e.target.value })} 
                fullWidth 
                size="small"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField 
                label="Welder Name" 
                value={editForm.welder_name} 
                onChange={e => setEditForm({ ...editForm, welder_name: e.target.value })} 
                fullWidth 
                size="small"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Qualification</InputLabel>
                <Select 
                  value={editForm.qualification} 
                  label="Qualification" 
                  onChange={e => setEditForm({ ...editForm, qualification: String(e.target.value) })}
                >
                  <MenuItem value="PIPE">PIPE</MenuItem>
                  <MenuItem value="Structure">Structure</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField 
                label="Qualified Material" 
                value={editForm.qualified_material} 
                onChange={e => setEditForm({ ...editForm, qualified_material: e.target.value })} 
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
                label="Production Test Date" 
                type="date" 
                value={editForm.production_test_date} 
                onChange={e => setEditForm({ ...editForm, production_test_date: e.target.value })} 
                fullWidth 
                size="small"
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Weld Process</InputLabel>
                <Select 
                  multiple 
                  value={editForm.weld_process} 
                  label="Weld Process" 
                  onChange={e => setEditForm({ ...editForm, weld_process: e.target.value })}
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
              <FormControl fullWidth size="small">
                <InputLabel>Qualified Position</InputLabel>
                <Select 
                  value={editForm.qualified_position} 
                  label="Qualified Position" 
                  onChange={e => setEditForm({ ...editForm, qualified_position: String(e.target.value) })}
                >
                  {positionOptions.map(p => (
                    <MenuItem key={p} value={p}>{p}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField 
                label="Validity (dd/mm/yy)" 
                value={editForm.validity} 
                fullWidth 
                size="small"
                disabled
                placeholder="Auto-calculated"
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
                  <MenuItem value="invalid">Invalid</MenuItem>
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

export default WelderRegister;
