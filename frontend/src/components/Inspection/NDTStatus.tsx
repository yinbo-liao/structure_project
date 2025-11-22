import React, { useEffect, useMemo, useState } from 'react';
import { Container, Typography, Box, Button, Paper, Table, TableHead, TableRow, TableCell, TableBody, Chip, Dialog, DialogTitle, DialogContent, DialogActions, Grid, TextField, MenuItem, TablePagination, IconButton } from '@mui/material';
import { Edit, Delete } from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import ApiService from '../../services/api';
import { NDTStatusRecord, NDTTest, NDTRequest } from '../../types';

const NDTStatus: React.FC = () => {
  const { selectedProject, canEdit, user, isAdmin, canDelete } = useAuth();
  const [rows, setRows] = useState<NDTStatusRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<{ welder_no?: string; weld_size?: number; weld_site?: string; ndt_type?: string; ndt_report_no?: string; ndt_result?: string; rejected_length?: number }>({});
  const [editRow, setEditRow] = useState<NDTStatusRecord | null>(null);
  const [requests, setRequests] = useState<NDTRequest[]>([]);
  const [tests, setTests] = useState<NDTTest[]>([]);
  const [methodFilter, setMethodFilter] = useState<string>('All');
  const [page, setPage] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteRow, setDeleteRow] = useState<DisplayRow | null>(null);

  const load = async () => {
    if (!selectedProject) return;
    setLoading(true);
    try {
      setError(null);
      let statusData: any[] | null = null;
      try {
        statusData = await ApiService.getNDTStatus(selectedProject.id);
      } catch (e) {
        try {
          statusData = await ApiService.getNDTStatusRecords(selectedProject.id);
        } catch (e2) {
          statusData = null;
        }
      }
      if (statusData) {
        setRows(statusData as any);
      } else {
        setError('Failed to load status');
      }
      try {
        const reqs = await ApiService.getNDTRequests(selectedProject.id);
        setRequests(reqs as any);
      } catch {}
      try {
        const t = await ApiService.getNDTTests(selectedProject.id);
        setTests(t as any);
      } catch {}
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || 'Failed to load NDT Status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [selectedProject]);

  const openEdit = (rec: any, method?: string) => {
    const mth = method || rec.ndt_type || '';
    const tk = testsByKey.get(`${rec.final_id}_${mth}`);
    const currentResult = (tk?.result || rec.ndt_result || '').toLowerCase();
    const rjLen = currentResult === 'rejected' ? (rec.rejected_length || 0) : 0;
    setEditId(rec.id);
    setEditForm({ 
      welder_no: rec.welder_no || '', 
      weld_size: rec.weld_size, 
      weld_site: rec.weld_site || '', 
      ndt_type: mth, 
      ndt_report_no: (tk?.report_no || rec.ndt_report_no || ''), 
      ndt_result: ((tk?.result || rec.ndt_result || '') as any),
      rejected_length: rjLen
    });
    setEditOpen(true);
    setEditRow(rec);
  };

  const ensureEdit = async (finalId: number, method?: string) => {
    const rec = statusByFinal[finalId];
    if (rec) {
      openEdit(rec, method);
      return;
    }
    if (!selectedProject) return;
    await ApiService.ensureNDTStatusRecord(finalId);
    const updated = await ApiService.getNDTStatus(selectedProject.id);
    setRows(updated);
    const next = updated.find((r: any) => r.final_id === finalId);
    if (next) openEdit(next, method);
  };

  const submitEdit = async () => {
    if (!editId || !editRow) return;
    const method = (editForm.ndt_type || '').trim();
    const result = (editForm.ndt_result || '').toLowerCase();
    const rejected_length = result === 'rejected' ? (editForm.rejected_length ?? 0) : 0;
    await ApiService.updateNDTStatusRecord(editId, {
      welder_no: editForm.welder_no,
      weld_size: editForm.weld_size,
      weld_site: editForm.weld_site,
      ndt_type: method,
      ndt_report_no: editForm.ndt_report_no,
      ndt_result: result,
      rejected_length
    });
    setEditOpen(false);
    load();
  };

  const statusColor = (status: string) => {
    const s = (status || '').toLowerCase();
    if (s === 'accepted') return 'success';
    if (s === 'pending') return 'warning';
    if (s === 'rejected') return 'error';
    return 'default';
  };

  const allMethods = ['RT','UT','MT','PT','PAUT'];
  const requestedMethods = useMemo(() => {
    const methodSet = new Set<string>();
    (requests || []).forEach((r: NDTRequest) => {
      if (r.ndt_type) methodSet.add(r.ndt_type);
    });
    (rows || []).forEach((s: NDTStatusRecord) => {
      const parts = (s.ndt_type || '')
        .split(/[,;\/\s]+/)
        .map((x) => x.trim())
        .filter(Boolean);
      if (!parts.length && s.ndt_type) methodSet.add(s.ndt_type);
      parts.forEach((p) => methodSet.add(p));
    });
    return Array.from(methodSet).sort((a, b) => {
      const aIdx = allMethods.indexOf(a);
      const bIdx = allMethods.indexOf(b);
      return (aIdx === -1 ? 99 : aIdx) - (bIdx === -1 ? 99 : bIdx);
    });
  }, [requests, rows]);
  const requestedFinalIds = useMemo(() => new Set<number>((requests || []).map((r: NDTRequest) => r.final_id as number).filter(Boolean)), [requests]);
  const statusByFinal = useMemo<Record<number, NDTStatusRecord>>(() => {
    const m: Record<number, NDTStatusRecord> = {};
    rows.forEach((r: NDTStatusRecord) => { m[r.final_id] = r; });
    return m;
  }, [rows]);
  const testsByKey = useMemo(() => {
    const m = new Map<string, NDTTest>();
    tests.forEach((t: NDTTest) => { m.set(`${t.final_id}_${t.method}`, t); });
    return m;
  }, [tests]);
  const reqMethodsByFinal = useMemo(() => {
    const m = new Map<number, Set<string>>();
    (requests || []).forEach((r: NDTRequest) => {
      if (!r.final_id || !r.ndt_type) return;
      const set = m.get(r.final_id) || new Set<string>();
      set.add(r.ndt_type);
      m.set(r.final_id, set);
    });
    return m;
  }, [requests]);
  const testMethodsByFinal = useMemo(() => {
    const m = new Map<number, Set<string>>();
    (tests || []).forEach((t: NDTTest) => {
      const set = m.get(t.final_id) || new Set<string>();
      set.add(t.method);
      m.set(t.final_id, set);
    });
    return m;
  }, [tests]);
  const methodOrder: Record<string, number> = { RT: 0, UT: 1, MT: 2, PT: 3, PAUT: 4 };
  const makeKey = (system?: string, line?: string, spool?: string, joint?: string, method?: string) => `${(system || '').trim()}-${(line || '').trim()}-${(spool || '').trim()}-${(joint || '').trim()}-${(method || '').trim()}`;
  interface DisplayRow {
    final_id: number;
    system_no?: string;
    line_no?: string;
    spool_no?: string;
    joint_no?: string;
    weld_type?: string;
    weld_site?: string;
    weld_size?: number;
    pipe_dia?: string;
    method?: string;
    report_no?: string;
    result?: string;
    ndt_request_id?: number;
  }
  const displayRows = useMemo<DisplayRow[]>(() => {
    const best = new Map<string, DisplayRow>();
    const score = (x: DisplayRow) => {
      let sc = 0;
      if (x.system_no) sc += 4;
      if (x.weld_site) sc += 2;
      if (x.report_no && x.report_no !== '-') sc += 2;
      if (x.result && x.result !== '-') sc += 1;
      if (x.ndt_request_id) sc += 1;
      return sc;
    };
    // Pass 1: requests as drivers
    (requests || []).forEach((r: NDTRequest) => {
      const s = statusByFinal[r.final_id as number];
      const method = (r.ndt_type) as string | undefined;
      const methodMatch = methodFilter === 'All' || method === methodFilter;
      if (!methodMatch) return;
      const tk = testsByKey.get(`${r.final_id}_${method || ''}`);
      const row: DisplayRow = {
        final_id: r.final_id as number,
        system_no: s?.system_no || (r.system_no as any),
        line_no: s?.line_no || (r.line_no as any),
        spool_no: s?.spool_no || (r.spool_no as any),
        joint_no: s?.joint_no || (r.joint_no as any),
        weld_type: s?.weld_type || (r.weld_type as any),
        weld_site: s?.weld_site,
        weld_size: (s?.weld_size ?? (r.weld_size as any)) as number | undefined,
        pipe_dia: (s as any)?.pipe_dia || (r as any)?.pipe_dia,
        method: method || '-',
        report_no: (s?.ndt_report_no || (r as any).ndt_report_no || tk?.report_no || '-') as string,
        result: (s?.ndt_result || (r as any).ndt_result || tk?.result || '-') as string,
        ndt_request_id: r.id,
      };
      const key = `${row.method || ''}:${row.line_no || ''}-${row.spool_no || ''}-${row.joint_no || ''}`;
      const prev = best.get(key);
      if (!prev || score(row) > score(prev)) best.set(key, row);
    });
    // Pass 2: status-only records (no request)
    (rows || []).forEach((s: NDTStatusRecord) => {
      const allowed = new Set<string>();
      (reqMethodsByFinal.get(s.final_id) || new Set<string>()).forEach((m) => allowed.add(m));
      (testMethodsByFinal.get(s.final_id) || new Set<string>()).forEach((m) => allowed.add(m));
      const fm = (s.ndt_type || '').trim();
      const tokens = fm.split(/[,;\/\s]+/).map((x) => x.trim()).filter(Boolean);
      if (!allowed.size && tokens.length === 1) allowed.add(tokens[0]);
      if (!allowed.size && fm && !tokens.length) allowed.add(fm);
      allowed.forEach((method) => {
        const methodMatch = methodFilter === 'All' || method === methodFilter;
        if (!methodMatch) return;
        const tk = testsByKey.get(`${s.final_id}_${method || ''}`);
        const row: DisplayRow = {
          final_id: s.final_id as number,
          system_no: s.system_no,
          line_no: s.line_no,
          spool_no: s.spool_no,
          joint_no: s.joint_no,
          weld_type: s.weld_type,
          weld_site: s.weld_site,
          weld_size: s.weld_size,
          pipe_dia: (s as any)?.pipe_dia,
          method: method || '-',
          report_no: (tk?.report_no || s.ndt_report_no || '-') as string,
          result: (tk?.result || s.ndt_result || '-') as string,
        };
        const key = `${row.method || ''}:${row.line_no || ''}-${row.spool_no || ''}-${row.joint_no || ''}`;
        const prev = best.get(key);
        if (!prev || score(row) > score(prev)) best.set(key, row);
      });
    });
    // Pass 3: test-only records (no request or status)
    (tests || []).forEach((t: NDTTest) => {
      const method = t.method as string | undefined;
      const methodMatch = methodFilter === 'All' || method === methodFilter;
      if (!methodMatch) return;
      
      // Try to find existing status record for this final_id
      const s = statusByFinal[t.final_id as number];
      const r = (requests || []).find(req => req.final_id === t.final_id && req.ndt_type === method);
      
      const row: DisplayRow = {
        final_id: t.final_id as number,
        system_no: s?.system_no || (r?.system_no as any),
        line_no: s?.line_no || (r?.line_no as any),
        spool_no: s?.spool_no || (r?.spool_no as any),
        joint_no: s?.joint_no || (r?.joint_no as any),
        weld_type: s?.weld_type || (r?.weld_type as any),
        weld_site: s?.weld_site,
        weld_size: s?.weld_size || (r?.weld_size as any) || t.test_length,
        pipe_dia: (s as any)?.pipe_dia || (r as any)?.pipe_dia,
        method: method || '-',
        report_no: t.report_no || s?.ndt_report_no || (r as any)?.ndt_report_no || '-',
        result: t.result || s?.ndt_result || (r as any)?.ndt_result || '-',
      };
      const key = `${row.method || ''}:${row.line_no || ''}-${row.spool_no || ''}-${row.joint_no || ''}`;
      const prev = best.get(key);
      if (!prev || score(row) > score(prev)) best.set(key, row);
    });
    const rowsOut = Array.from(best.values());
    rowsOut.sort((a, b) => {
      const am = methodOrder[a.method || ''] ?? 99;
      const bm = methodOrder[b.method || ''] ?? 99;
      if (am !== bm) return am - bm;
      const aKey = `${a.line_no || ''}-${a.spool_no || ''}-${a.joint_no || ''}`;
      const bKey = `${b.line_no || ''}-${b.spool_no || ''}-${b.joint_no || ''}`;
      return aKey.localeCompare(bKey);
    });
    return rowsOut;
  }, [requests, rows, tests, statusByFinal, methodFilter, testsByKey]);

  const duplicateKeys = useMemo(() => {
    const counts = new Map<string, number>();
    displayRows.forEach((d) => {
      const k = makeKey(d.system_no, d.line_no, d.spool_no, d.joint_no, d.method);
      counts.set(k, (counts.get(k) || 0) + 1);
    });
    const list = Array.from(counts.entries())
      .filter(([, c]) => c > 1)
      .map(([k, c]) => ({ key: k, count: c }));
    const set = new Set(list.map((i) => i.key));
    return { list, set };
  }, [displayRows]);

  // Calculate reject rates by method
  const rejectRates = useMemo(() => {
    const methodStats: Record<string, { totalLength: number; rejectedLength: number; rejectRate: number }> = {};
    
    displayRows.forEach((row) => {
      const method = row.method || 'Unknown';
      const weldSize = row.weld_size || 0;
      const statusRecord = statusByFinal[row.final_id];
      const rejectedLength = statusRecord?.rejected_length || 0;
      
      if (!methodStats[method]) {
        methodStats[method] = { totalLength: 0, rejectedLength: 0, rejectRate: 0 };
      }
      
      methodStats[method].totalLength += weldSize;
      methodStats[method].rejectedLength += rejectedLength;
    });
    
    // Calculate reject rates
    Object.keys(methodStats).forEach(method => {
      const stats = methodStats[method];
      if (stats.totalLength > 0) {
        stats.rejectRate = (stats.rejectedLength / stats.totalLength) * 100;
      } else {
        stats.rejectRate = 0;
      }
    });
    
    return methodStats;
  }, [displayRows, statusByFinal]);

  return (
    <Container maxWidth="xl" sx={{ mt: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">NDT Status</Typography>
      </Box>
      {error && (
        <Box sx={{ mb: 2 }}>
          <Paper sx={{ p: 2, bgcolor: 'error.light' }}>
            <Typography color="error.contrastText">{error}</Typography>
          </Paper>
        </Box>
      )}
      {duplicateKeys.list.length > 0 && (
        <Box sx={{ mb: 2 }}>
          <Paper sx={{ p: 2, bgcolor: 'warning.light' }}>
            <Typography>Duplicate records detected for same joint and method key. Please delete repeat records.</Typography>
            <Typography variant="body2" sx={{ mt: 1 }}>{duplicateKeys.list.slice(0, 6).map(i => `${i.key} x${i.count}`).join(' • ')}</Typography>
          </Paper>
        </Box>
      )}

      {/* Reject Rate Summary */}
      {Object.keys(rejectRates).length > 0 && (
        <Box sx={{ mb: 2 }}>
          <Paper sx={{ p: 2, bgcolor: 'info.light' }}>
            <Typography variant="h6" gutterBottom>NDT Reject Rate Summary</Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
              {Object.entries(rejectRates).map(([method, stats]) => (
                <Box key={method} sx={{ 
                  p: 1.5, 
                  border: '1px solid', 
                  borderColor: 'divider', 
                  borderRadius: 1,
                  minWidth: 150,
                  backgroundColor: 'background.paper'
                }}>
                  <Typography variant="subtitle1" fontWeight="bold">{method}</Typography>
                  <Typography variant="body2">Total Length: {stats.totalLength.toFixed(1)} mm</Typography>
                  <Typography variant="body2" color="error">Rejected: {stats.rejectedLength.toFixed(1)} mm</Typography>
                  <Typography variant="body2" color={stats.rejectRate > 5 ? 'error' : 'success'} fontWeight="bold">
                    Reject Rate: {stats.rejectRate.toFixed(1)}%
                  </Typography>
                </Box>
              ))}
            </Box>
            <Typography variant="caption" sx={{ mt: 1, display: 'block' }}>
              Reject Rate = (Rejected Length / Total Weld Length) × 100%
            </Typography>
          </Paper>
        </Box>
      )}
      
      <Paper>
          <Box sx={{ px: 2, py: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="subtitle1" sx={{ mr: 2 }}>Method:</Typography>
          <Button variant={methodFilter === 'All' ? 'contained' : 'outlined'} size="small" onClick={() => { setMethodFilter('All'); setPage(0); load(); }}>All</Button>
          {requestedMethods.map((m: string) => (
            <Button key={m} variant={methodFilter === m ? 'contained' : 'outlined'} size="small" onClick={() => { setMethodFilter(m); setPage(0); load(); }}>{m}</Button>
          ))}
          <Box sx={{ flex: 1 }} />
          <Button variant="outlined" onClick={load} disabled={loading}>Refresh</Button>
        </Box>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell><strong>System no</strong></TableCell>
              <TableCell><strong>Line no</strong></TableCell>
              <TableCell><strong>Spool no</strong></TableCell>
              <TableCell><strong>Joint no</strong></TableCell>
              <TableCell><strong>Weld Type</strong></TableCell>
              <TableCell><strong>Welder No</strong></TableCell>
              <TableCell><strong>Weld Site</strong></TableCell>
              <TableCell><strong>Test Length</strong></TableCell>
              <TableCell><strong>Pipe Dia</strong></TableCell>
              <TableCell><strong>Method</strong></TableCell>
              <TableCell><strong>Report No</strong></TableCell>
              <TableCell><strong>Result</strong></TableCell>
              <TableCell><strong>Rejected Length (mm)</strong></TableCell>
              {canEdit() && <TableCell><strong>Actions</strong></TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {useMemo(() => displayRows.slice(page * 50, page * 50 + 50), [displayRows, page]).map((d, idx) => {
              const r = statusByFinal[d.final_id];
              const isDup = duplicateKeys.set.has(makeKey(d.system_no, d.line_no, d.spool_no, d.joint_no, d.method));
              const tk = testsByKey.get(`${d.final_id}_${d.method || ''}`);
              const rejectedLength = ((d.result || '').toLowerCase() === 'rejected') ? (r?.rejected_length || 0) : 0;
              return (
                <TableRow key={`${makeKey(d.system_no, d.line_no, d.spool_no, d.joint_no, d.method)}-${d.final_id}-${idx}`}>
                  <TableCell>{d.system_no || '-'}</TableCell>
                  <TableCell>{d.line_no || '-'}</TableCell>
                  <TableCell>{d.spool_no || '-'}</TableCell>
                  <TableCell>{d.joint_no || '-'}</TableCell>
                  <TableCell>{d.weld_type || '-'}</TableCell>
                  <TableCell>{r?.welder_no || '-'}</TableCell>
                  <TableCell>{d.weld_site || '-'}</TableCell>
                  <TableCell>{d.weld_size ?? '-'}</TableCell>
                  <TableCell>{d.pipe_dia || '-'}</TableCell>
                  <TableCell>{d.method || '-'}</TableCell>
                  <TableCell>{d.report_no || '-'}</TableCell>
                  <TableCell>
                    {(() => {
                      const label = d.result || '-';
                      const val = (label || '').toLowerCase();
                      if (val === 'accepted') {
                        return (<Box sx={{ px: 1, py: 0.5, borderRadius: 1, display: 'inline-block', bgcolor: 'success.light', color: 'success.contrastText' }}>{label}</Box>);
                      }
                      if (val === 'rejected') {
                        return (<Box sx={{ px: 1, py: 0.5, borderRadius: 1, display: 'inline-block', bgcolor: 'error.light', color: 'error.contrastText' }}>{label}</Box>);
                      }
                      return (<Typography>{label}</Typography>);
                    })()}
                  </TableCell>
                  <TableCell>
                    {rejectedLength > 0 ? (
                      <Typography color="error" fontWeight="bold">
                        {rejectedLength} mm
                      </Typography>
                    ) : (
                      <Typography color="text.secondary">
                        0 mm
                      </Typography>
                    )}
                  </TableCell>
                {canEdit() && (
                  <TableCell>
                    {(() => {
                      const accepted = (d.result || '').toLowerCase() === 'accepted';
                      const allowEdit = isAdmin() || ((user?.role || '').toLowerCase() === 'inspector' && !accepted);
                      const allowDelete = canDelete();
                      return (
                        <Box>
                          <IconButton size="small" color="primary" onClick={() => ensureEdit(d.final_id, d.method || '')} disabled={!allowEdit}>
                            <Edit />
                          </IconButton>
                          {isDup && <Chip label="Duplicate" color="warning" size="small" sx={{ ml: 1 }} />}
                          <IconButton size="small" color="error" sx={{ ml: 0.5 }} onClick={() => { setDeleteRow(d); setDeleteOpen(true); }} disabled={!allowDelete}>
                            <Delete />
                          </IconButton>
                        </Box>
                      );
                    })()}
                  </TableCell>
                )}
              </TableRow>
            );
          })}
          </TableBody>
        </Table>
        <TablePagination
          component="div"
          count={displayRows.length}
          page={page}
          onPageChange={(_, p) => setPage(p)}
          rowsPerPage={50}
          onRowsPerPageChange={() => {}}
          rowsPerPageOptions={[50]}
        />
      </Paper>

      <Dialog open={editOpen} onClose={() => setEditOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit NDT Status</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}><TextField fullWidth label="System" value={editRow?.system_no || '-'} disabled /></Grid>
            <Grid item xs={12} sm={6}><TextField fullWidth label="Line" value={editRow?.line_no || '-'} disabled /></Grid>
            <Grid item xs={12} sm={6}><TextField fullWidth label="Spool no" value={editRow?.spool_no || '-'} disabled /></Grid>
            <Grid item xs={12} sm={6}><TextField fullWidth label="Joint" value={editRow?.joint_no || '-'} disabled /></Grid>
            <Grid item xs={12} sm={6}><TextField fullWidth label="Weld Type" value={editRow?.weld_type || '-'} disabled /></Grid>
            <Grid item xs={12} sm={6}><TextField select fullWidth label="Weld Site" value={editForm.weld_site || ''} onChange={e => setEditForm({ ...editForm, weld_site: e.target.value })}><MenuItem value="shop weld">shop weld</MenuItem><MenuItem value="float weld">float weld</MenuItem></TextField></Grid>
            <Grid item xs={12} sm={6}><TextField fullWidth type="number" label="Test Length" value={editForm.weld_size as any || ''} onChange={e => setEditForm({ ...editForm, weld_size: Number(e.target.value) })} /></Grid>
            <Grid item xs={12} sm={6}><TextField select fullWidth label="Method" value={editForm.ndt_type || ''} onChange={e => setEditForm({ ...editForm, ndt_type: e.target.value })}>{requestedMethods.map((m: string) => (<MenuItem key={m} value={m}>{m}</MenuItem>))}</TextField></Grid>
            <Grid item xs={12} sm={6}><TextField fullWidth label="Report No" value={editForm.ndt_report_no || ''} onChange={e => setEditForm({ ...editForm, ndt_report_no: e.target.value })} /></Grid>
            <Grid item xs={12} sm={6}><TextField select fullWidth label="Result" value={editForm.ndt_result || ''} onChange={e => setEditForm({ ...editForm, ndt_result: e.target.value })}><MenuItem value="accepted">Accepted</MenuItem><MenuItem value="rejected">Rejected</MenuItem></TextField></Grid>
            <Grid item xs={12} sm={6}>
              <TextField 
                fullWidth 
                type="number" 
                label="Rejected Length (mm)" 
                value={editForm.rejected_length as any || 0} 
                onChange={e => setEditForm({ ...editForm, rejected_length: Number(e.target.value) })}
                helperText="Enter 0 mm for accepted welds, actual length for rejected welds"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOpen(false)}>Cancel</Button>
          <Button onClick={submitEdit} variant="contained">Save</Button>
        </DialogActions>
      </Dialog>
      <Dialog open={deleteOpen} onClose={() => { setDeleteOpen(false); setDeleteRow(null); }} maxWidth="sm" fullWidth>
        <DialogTitle>Delete Record</DialogTitle>
        <DialogContent>
          <Typography>Confirm deletion for joint: {(deleteRow?.line_no || '-') + '-' + (deleteRow?.spool_no || '-') + '-' + (deleteRow?.joint_no || '-')} ({deleteRow?.method || '-'})</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setDeleteOpen(false); setDeleteRow(null); }}>Cancel</Button>
          <Button color="error" variant="contained" onClick={async () => {
            if (!deleteRow) return;
            try {
              const rec = statusByFinal[deleteRow.final_id];
              if (rec) {
                await ApiService.deleteNDTStatusRecord(rec.id);
              } else if (deleteRow.ndt_request_id) {
                await ApiService.deleteNDTRequest(deleteRow.ndt_request_id);
              } else {
                const tk = testsByKey.get(`${deleteRow.final_id}_${deleteRow.method || ''}`);
                if (tk) {
                  await ApiService.deleteNDTTest(tk.id);
                }
              }
            } finally {
              setDeleteOpen(false);
              setDeleteRow(null);
              load();
            }
          }}>Delete</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default NDTStatus;
