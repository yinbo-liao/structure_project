import React, { useEffect, useMemo, useState } from 'react';
import { Container, Typography, Box, Paper, Table, TableHead, TableRow, TableCell, TableBody, Chip, Button, Grid, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem, Snackbar, Alert, Checkbox } from '@mui/material';
import { RequestQuote } from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import ApiService from '../../services/api';
import { NDTRequest, FinalInspection } from '../../types';

const NDTRequests: React.FC = () => {
  const { selectedProject, canEdit } = useAuth();
  // Always Structure
  const [rows, setRows] = useState<NDTRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<NDTRequest>>({ department: 'structure', contractor: 'GW', status: 'pending', requirement: 'full joint', weld_process: 'GTAW', inspection_category: 'type-I' });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [finals, setFinals] = useState<FinalInspection[]>([]);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteRow, setDeleteRow] = useState<NDTRequest | null>(null);
  const [snackOpen, setSnackOpen] = useState(false);
  const [snackMsg, setSnackMsg] = useState('');
  const [snackSeverity, setSnackSeverity] = useState<'success' | 'error'>('success');
  const [methodFilter, setMethodFilter] = useState<string>('All');
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [bulk, setBulk] = useState<{ contractor: string; department: string; requirement: string; weld_process: string }>({ contractor: 'GW', department: 'structure', requirement: 'full joint', weld_process: 'GTAW' });
  const contractorOptions = useMemo(() => ['Merlion', 'Renu-ndt', 'Jasscan NDT', 'A start NDT', 'GW', 'TOM'], []);
  const methodOrder = ['RT','UT','PT','MPI','FT','PMI'];
  const [requiredMethods, setRequiredMethods] = useState<Set<string>>(new Set());
  const [drafts, setDrafts] = useState<Record<string, { request_time?: string; rfi_no?: string }>>({});
  const canonicalMethod = (m: string) => {
    const x = (m || '').trim().toUpperCase();
    if (x === 'MPI' || x === 'MPI') return 'MPI'; // Map MPI to MP for backend
    if (x === 'PAUT') return 'PAUT';
    return x;
  };
  const finalOptions = useMemo(() => finals.map(fi => ({
    id: fi.id,
    label: `${fi.line_no || '-'}-${fi.spool_no || '-'}-${fi.joint_no || '-'}`,
    fi
  })), [finals]);

  // Always call hooks; render fallback inside JSX when no project is selected

  const load = async () => {
    if (!selectedProject) return;
    setLoading(true);
    try {
      const results = await Promise.allSettled([
        ApiService.getStructureNDTRequests(selectedProject.id),
        ApiService.getFinalInspections(selectedProject.id),
        ApiService.getNDTRequirements(selectedProject.id)
      ]);
      if (results[0].status === 'fulfilled') {
        const fetched: any[] = Array.isArray(results[0].value) ? results[0].value as any[] : [];
        const keyOf = (r: any) => `${selectedProject?.id || 0}-${r.system_no || ''}-${r.line_no || ''}-${r.spool_no || ''}-${r.joint_no || ''}-${canonicalMethod(r.ndt_type || '')}`;
        setRows(prev => {
          const map = new Map<string, any>();
          // prefer fetched over prev
          fetched.forEach(r => map.set(keyOf(r), r));
          prev.forEach(r => {
            const k = keyOf(r);
            if (!map.has(k)) map.set(k, r);
          });
          return Array.from(map.values());
        });
      }
      if (results[1].status === 'fulfilled') {
        const finalsAll = results[1].value as any[];
        setFinals(finalsAll.filter(f => (f.final_result || '').toLowerCase() === 'accepted'));
      } else {
        setFinals([]);
      }
      if (results[2].status === 'fulfilled') {
        const reqs = results[2].value as any[];
        const set = new Set<string>();
        (reqs || []).forEach((r: any) => { if (r.required && r.method) set.add(canonicalMethod(r.method)); });
        setRequiredMethods(set);
      } else {
        setRequiredMethods(new Set());
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [selectedProject]);

  // Single source of truth: load() handles finals fetching with error tolerance

  const existingKeys = useMemo(() => {
    const s = new Set<string>();
    rows.forEach(r => {
      const key = `${selectedProject?.id || 0}-${r.system_no || ''}-${r.line_no || ''}-${r.spool_no || ''}-${r.joint_no || ''}-${canonicalMethod(r.ndt_type || '')}`;
      s.add(key);
    });
    return s;
  }, [rows, selectedProject]);

  const existingMap = useMemo(() => {
    const m = new Map<string, any>();
    rows.forEach(r => {
      const key = `${selectedProject?.id || 0}-${r.system_no || ''}-${r.line_no || ''}-${r.spool_no || ''}-${r.joint_no || ''}-${canonicalMethod(r.ndt_type || '')}`;
      m.set(key, r);
    });
    return m;
  }, [rows, selectedProject]);

  const duplicateGroups = useMemo(() => {
    const groups = new Map<string, NDTRequest[]>();
    rows.forEach(r => {
      const key = `${selectedProject?.id || 0}-${r.system_no || ''}-${r.line_no || ''}-${r.spool_no || ''}-${r.joint_no || ''}-${canonicalMethod(r.ndt_type || '')}`;
      const list = groups.get(key) || [];
      list.push(r);
      groups.set(key, list);
    });
    const out: { key: string; ids: number[]; keepId: number }[] = [];
    const score = (x: NDTRequest) => {
      let sc = 0;
      if (x.request_time) sc += 2;
      if ((x as any).ndt_report_no) sc += 2;
      if ((x as any).ndt_result) sc += 1;
      if (x.created_at) sc += 1;
      return sc;
    };
    groups.forEach((list, key) => {
      if (list.length > 1) {
        let best = list[0];
        list.forEach(item => { if (score(item) > score(best)) best = item; });
        out.push({ key, ids: list.map(x => x.id), keepId: best.id });
      }
    });
    return out;
  }, [rows, selectedProject]);

  const existingByFinalMethod = useMemo(() => {
    const m = new Map<string, any>();
    rows.forEach(r => {
      const k = `${(r as any).final_id || 0}-${canonicalMethod(r.ndt_type || '')}`;
      if (!m.has(k)) m.set(k, r);
    });
    return m;
  }, [rows]);

  const requiredFromFinals = useMemo(() => {
    const out: { key: string; final: FinalInspection; method: string; exists: boolean }[] = [];
    finals.forEach(fi => {
      const methods = (fi.ndt_type || '')
        .split(',')
        .map(s => canonicalMethod(s))
        .filter(Boolean)
        .filter(m => m !== 'NA');
      const allow = requiredMethods.size ? methods.filter(m => requiredMethods.has(m)) : methods;
      allow.forEach(m => {
        const key = `${selectedProject?.id || 0}-${fi.system_no || ''}-${fi.line_no || ''}-${fi.spool_no || ''}-${fi.joint_no || ''}-${m}`;
        const exists = existingKeys.has(key) || existingByFinalMethod.has(`${fi.id}-${m}`);
        out.push({ key, final: fi, method: m, exists });
      });
    });
    return out;
  }, [finals, selectedProject, existingKeys, requiredMethods, existingByFinalMethod]);

  const missingRequired = useMemo(() => requiredFromFinals.filter(e => !e.exists), [requiredFromFinals]);
  const methodOptions = useMemo(() => {
    const set = new Set<string>();
    requiredFromFinals.forEach(e => set.add(e.method));
    rows.forEach(r => { if (r.ndt_type) set.add(canonicalMethod(r.ndt_type)); });
    const opts = Array.from(set);
    opts.sort((a,b) => methodOrder.indexOf(a) - methodOrder.indexOf(b));
    return ['All', ...opts];
  }, [requiredFromFinals, rows]);
  const filteredRequired = useMemo(() => {
    const base = requiredFromFinals.filter(e => !e.exists);
    const list = methodFilter === 'All' ? base : base.filter(e => e.method === methodFilter);
    const idx = (m: string) => {
      const i = methodOrder.indexOf(m);
      return i === -1 ? Number.MAX_SAFE_INTEGER : i;
    };
    return [...list].sort((a,b) => {
      const ai = idx(a.method);
      const bi = idx(b.method);
      if (ai !== bi) return ai - bi;
      const aj = `${a.final.system_no || ''}-${a.final.line_no || ''}-${a.final.spool_no || ''}-${a.final.joint_no || ''}`;
      const bj = `${b.final.system_no || ''}-${b.final.line_no || ''}-${b.final.spool_no || ''}-${b.final.joint_no || ''}`;
      return aj.localeCompare(bj);
    });
  }, [requiredFromFinals, methodFilter]);

  const downloadCSV = () => {
    const headers = [
          'NDT-Contractor',
          'Dept',
          'Drawing No',
          'Structure Category',
          'Page No',
          'Joint No',
          'Weld Type',
          'Inspection Category',
          'Welder No',
          'Size',
          'Weld Length',
          'Weld Process',
          'Requirement',
          'NDT Method',
          'Request Status',
          'Request Date',
          'RFI No'
        ];
    const csvRows = filteredRequired.map(e => {
      const status = e.exists ? 'RFI Raised' : 'pending';
      const reqDate = e.exists ? (existingMap.get(e.key)?.request_time ? new Date(existingMap.get(e.key).request_time).toLocaleDateString() : '') : (selectedKeys.has(e.key) ? (drafts[e.key]?.request_time || '') : '');
      const rfiNo = e.exists ? (existingMap.get(e.key)?.ndt_report_no || '') : (selectedKeys.has(e.key) ? (drafts[e.key]?.rfi_no || '') : '');
      return [
        bulk.contractor || '',
        bulk.department || '',
        e.final.block_no || '',

        e.final.joint_no || '',
        e.final.weld_type || '',
        e.final.inspection_category || 'type-I',
        e.final.welder_no || '',
        (e.final as any).pipe_dia || (e.final as any).size || '',
        e.final.weld_length != null ? String(e.final.weld_length) : '',
        bulk.weld_process || 'GTAW',
        bulk.requirement || '',
        e.method || '',
        status,
        reqDate,
        rfiNo
      ];
    });
    const escape = (v: string) => {
      const s = String(v ?? '');
      return '"' + s.replace(/\"/g, '""') + '"';
    };
    const csv = [headers.map(escape).join(','), ...csvRows.map(r => r.map(escape).join(','))].join('\r\n');
    const blob = new Blob(["\ufeff" + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ndt_requests_${selectedProject?.code || 'project'}_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const requestsViewRows = useMemo(() => {
    const base = methodFilter === 'All' ? rows : rows.filter(r => canonicalMethod(r.ndt_type || '') === methodFilter);
    const idx = (m: string) => {
      const i = methodOrder.indexOf(m);
      return i === -1 ? Number.MAX_SAFE_INTEGER : i;
    };
    return [...base].sort((a,b) => {
      const ai = idx(canonicalMethod(a.ndt_type || ''));
      const bi = idx(canonicalMethod(b.ndt_type || ''));
      if (ai !== bi) return ai - bi;
      const aj = `${a.block_no || ''}-${a.joint_no || ''}`;
      const bj = `${b.block_no || ''}-${b.joint_no || ''}`;
      return aj.localeCompare(bj);
    });
  }, [rows, methodFilter]);

  const createFromFinal = async (e: { final: FinalInspection; method: string }) => {
    if (!selectedProject) return;
    const fi = e.final;
    const key = `${selectedProject?.id || 0}-${fi.block_no || ''}-${fi.joint_no || ''}-${e.method}`;
    const draft = drafts[key] || {};
    if (!draft.request_time || !draft.rfi_no) {
      setSnackMsg('Please fill Request Date and RFI No for this row');
      setSnackSeverity('error');
      setSnackOpen(true);
      return;
    }
    const payload = {
      project_id: selectedProject.id,
      project_name: selectedProject.name,
      project_code: selectedProject.code,
      department: bulk.department,
      incharge_person: 'QA',
      contact: '',
      request_time: new Date(`${draft.request_time}T00:00:00`).toISOString(),
      contractor: bulk.contractor,
      job_location: '',
      test_time: new Date().toISOString(),
      requirement: bulk.requirement,
      detail_description: '',
      status: 'RFI Raised', // Set status directly to RFI Raised
      ndt_type: e.method,
      ndt_report_no: draft.rfi_no,
      final_id: fi.id
    } as any;
    try {
      const created = await ApiService.createStructureNDTRequest(payload);
      const createdRow = { ...created, ...payload } as any;
      setSnackMsg('NDT request created');
      setSnackSeverity('success');
      setSnackOpen(true);
      setRows(prev => [createdRow, ...prev]);
      setSelectedKeys(prev => {
        const next = new Set(prev);
        next.delete(`${selectedProject?.id || 0}-${fi.system_no || ''}-${fi.line_no || ''}-${fi.spool_no || ''}-${fi.joint_no || ''}-${e.method}`);
        return next;
      });
      setDrafts(prev => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      // keep UI responsive; background refresh to sync server state
      load();
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      let msg = '';
      if (typeof detail === 'string') {
        msg = detail;
      } else if (Array.isArray(detail)) {
        msg = detail.map(d => d.msg || JSON.stringify(d)).join(', ');
      } else if (detail && typeof detail === 'object') {
        msg = JSON.stringify(detail);
      } else if (err?.message) {
        msg = err.message;
      }
      if (typeof msg === 'string' && msg.toLowerCase().includes('duplicate')) {
        setSnackMsg('NDT request already exists for this joint and method');
        setSnackSeverity('success');
        setSnackOpen(true);
        setSelectedKeys(prev => {
          const next = new Set(prev);
          next.delete(`${selectedProject?.id || 0}-${fi.system_no || ''}-${fi.line_no || ''}-${fi.spool_no || ''}-${fi.joint_no || ''}-${e.method}`);
          return next;
        });
        setDrafts(prev => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
        load();
      } else {
        setSnackMsg(msg || 'Failed to create NDT request');
        setSnackSeverity('error');
        setSnackOpen(true);
      }
    }
  };

  const generateMissing = async () => {
    if (!selectedProject) return;
    try {
      for (const e of missingRequired) {
        try {
          await createFromFinal(e);
        } catch (err) {}
      }
      setSnackMsg('Generated missing NDT requests');
      setSnackSeverity('success');
      setSnackOpen(true);
      await load();
    } catch (e: any) {
      setSnackMsg(e?.response?.data?.detail || 'Failed to generate requests');
      setSnackSeverity('error');
      setSnackOpen(true);
    }
  };

  const toggleSelected = (key: string) => {
    setSelectedKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const createSelected = async () => {
    if (!selectedProject) return;
    const toCreate = filteredRequired.filter(e => selectedKeys.has(e.key));
    if (!toCreate.length) {
      setSnackMsg('No rows selected');
      setSnackSeverity('error');
      setSnackOpen(true);
      return;
    }
    const createdList: any[] = [];
    let missingCount = 0;
    const errors: string[] = [];
    for (const e of toCreate) {
      const fi = e.final;
      const key = e.key;
      const draft = drafts[key] || {};
      if (!draft.request_time || !draft.rfi_no) {
        missingCount++;
        continue;
      }
        try {
          const payload = {
            project_id: selectedProject.id,
            project_name: selectedProject.name,
            project_code: selectedProject.code,
            department: bulk.department,
            incharge_person: 'QA',
            contact: '',
            request_time: new Date(`${draft.request_time}T00:00:00`).toISOString(),
            contractor: bulk.contractor,
            job_location: '',
            test_time: new Date().toISOString(),
            requirement: bulk.requirement,
            detail_description: '',
            status: 'RFI Raised', // Set status directly to RFI Raised
            ndt_type: e.method,
            ndt_report_no: draft.rfi_no,
            final_id: fi.id
          } as any;
          const created = await ApiService.createStructureNDTRequest(payload);
          const createdRow = { ...created, ...payload } as any;
          createdList.push(createdRow);
          // Ensure NDT status record exists for this final inspection
          try {
            await ApiService.ensureNDTStatusRecord(fi.id);
          } catch (err) {
            // Silently ignore; status record may already exist
          }
        } catch (err: any) {
          const detail = err?.response?.data?.detail;
          let msg = 'Unknown error';
          if (typeof detail === 'string') {
            msg = detail;
          } else if (Array.isArray(detail)) {
            msg = detail.map(d => d.msg || JSON.stringify(d)).join(', ');
          } else if (detail && typeof detail === 'object') {
            msg = JSON.stringify(detail);
          } else if (err?.message) {
            msg = err.message;
          }
          errors.push(`${e.method} for joint ${fi.joint_no}: ${msg}`);
        }
    }
    if (createdList.length) {
      setRows(prev => [...createdList, ...prev]);
    }
    let snackMsg = '';
    let snackSeverity: 'success' | 'error' = 'success';
    if (createdList.length === 0 && missingCount === 0 && errors.length === 0) {
      snackMsg = 'No rows created (unknown error)';
      snackSeverity = 'error';
    } else if (createdList.length === 0 && missingCount > 0) {
      snackMsg = 'Please fill Request Date and RFI No for selected rows';
      snackSeverity = 'error';
    } else if (createdList.length === 0 && errors.length > 0) {
      snackMsg = `Failed to create: ${errors[0]}`;
      snackSeverity = 'error';
    } else {
      snackMsg = `Created ${createdList.length} selected NDT requests`;
      if (missingCount) snackMsg += ` • ${missingCount} missing date/RFI`;
      if (errors.length) snackMsg += ` • ${errors.length} errors`;
    }
    setSnackMsg(snackMsg);
    setSnackSeverity(snackSeverity);
    setSnackOpen(true);
    if (createdList.length > 0) {
      setSelectedKeys(new Set());
      setDrafts(prev => {
        const next = { ...prev };
        toCreate.forEach(e => { delete next[e.key]; });
        return next;
      });
      load();
    }
  };

  const updateStatus = async (id: number, status: string) => {
    await ApiService.updateStructureNDTStatus(id, status);
    load();
  };

  const submit = async () => {
    if (!selectedProject) return;
    if (!form.final_id) {
      alert('Please select an accepted final inspection');
      return;
    }
    try {
      const payload = {
        project_id: selectedProject.id,
        project_name: selectedProject.name,
        project_code: selectedProject.code,
        department: form.department || 'structure',
        incharge_person: form.incharge_person || 'QA',
        contact: form.contact || '',
        request_time: form.request_time || new Date().toISOString(),
        contractor: form.contractor || 'GW',
        job_location: form.job_location || '',
        test_time: form.test_time || new Date().toISOString(),
        requirement: form.requirement || '',
        detail_description: form.detail_description || '',
        status: form.status || 'pending',
        ndt_type: form.ndt_type || 'UT',
        ndt_report_no: form.ndt_report_no,
        ndt_result: form.ndt_result,
        final_id: form.final_id as number
      } as any;
      if (editingId) {
        await ApiService.updateStructureNDTRequest(editingId, payload);
      } else {
        try {
          const created = await ApiService.createStructureNDTRequest(payload);
        } catch (err: any) {
          const detail = err?.response?.data?.detail;
          let msg = '';
          if (typeof detail === 'string') {
            msg = detail;
          } else if (Array.isArray(detail)) {
            msg = detail.map(d => d.msg || JSON.stringify(d)).join(', ');
          } else if (detail && typeof detail === 'object') {
            msg = JSON.stringify(detail);
          } else if (err?.message) {
            msg = err.message;
          }
          if (typeof msg === 'string' && msg.toLowerCase().includes('duplicate')) {
            setSnackMsg('NDT request already exists for this joint and method');
            setSnackSeverity('success');
            setSnackOpen(true);
          } else {
            throw err;
          }
        }
      }
      setOpen(false);
      setEditingId(null);
      load();
    } catch (e: any) {
      alert(e?.response?.data?.detail || 'Failed to create NDT request');
    }
  };

  const deleteDuplicateRequests = async () => {
    const extras: number[] = [];
    duplicateGroups.forEach(g => {
      g.ids.forEach(id => { if (id !== g.keepId) extras.push(id); });
    });
    if (!extras.length) return;
    try {
      for (const id of extras) {
        try { await ApiService.deleteStructureNDTRequest(id); } catch {}
      }
      setSnackMsg(`Deleted ${extras.length} duplicate request${extras.length > 1 ? 's' : ''}`);
      setSnackSeverity('success');
      setSnackOpen(true);
      await load();
    } catch (e: any) {
      setSnackMsg(e?.response?.data?.detail || 'Failed to delete duplicates');
      setSnackSeverity('error');
      setSnackOpen(true);
    }
  };

  const onEdit = (r: NDTRequest) => {
    setForm({
      final_id: (r as any).final_id,
      contractor: r.contractor,
      department: r.department,
      requirement: r.requirement,
      ndt_type: r.ndt_type,
      ndt_report_no: (r as any).ndt_report_no,
      ndt_result: (r as any).ndt_result,
      request_time: r.request_time,
      test_time: r.test_time,
      system_no: r.system_no,
      line_no: r.line_no,
      spool_no: r.spool_no,
      joint_no: r.joint_no,
      weld_type: r.weld_type,
      welder_no: r.welder_no,
      weld_process: r.weld_process as any,
      weld_size: r.weld_size,
      detail_description: r.detail_description,
      status: r.status,
      inspection_category: r.inspection_category || 'type-I'
    });
    setEditingId(r.id);
    setOpen(true);
  };

  const onDelete = async (id: number) => {
    try {
      await ApiService.deleteStructureNDTRequest(id);
      setSnackMsg('NDT request deleted');
      setSnackSeverity('success');
      setSnackOpen(true);
      load();
    } catch (e: any) {
      setSnackMsg(e?.response?.data?.detail || 'Failed to delete NDT request');
      setSnackSeverity('error');
      setSnackOpen(true);
    }
  };

  const openDeleteDialog = (row: NDTRequest) => {
    setDeleteRow(row);
    setDeleteOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteRow) return;
    setDeleteOpen(false);
    await onDelete(deleteRow.id);
    setDeleteRow(null);
  };

  const cancelDelete = () => {
    setDeleteOpen(false);
    setDeleteRow(null);
  };

  return (
    <Container maxWidth={false} sx={{ mt: 4, px: 2 }}>
      {!selectedProject ? (
        <Box sx={{ py: 6, textAlign: 'center' }}>
          <Typography>Please select a project first.</Typography>
        </Box>
      ) : (
        <>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 4 }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <RequestQuote sx={{ fontSize: 40, mr: 2, color: 'primary.main' }} />
              <Box>
                <Typography variant="h4" component="h1" gutterBottom>
                  Structure NDT Requests
                </Typography>
                <Typography variant="subtitle1" color="textSecondary">
                  {selectedProject.name} ({selectedProject.code})
                </Typography>
              </Box>
            </Box>
            <Box>
              <Button variant="outlined" onClick={load} disabled={loading} sx={{ mr: 1 }}>Refresh</Button>
              {canEdit() && <Button variant="contained" onClick={() => setOpen(true)} sx={{ mr: 1 }}>New Request</Button>}
            </Box>
          </Box>

          <Paper sx={{ mb: 3, boxShadow: 2 }}>
            <Box sx={{ px: 3, py: 2, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', borderBottom: '1px solid', borderBottomColor: 'grey.200' }}>
              <Typography variant="subtitle1" fontWeight="600" sx={{ mr: 2 }}>
                NDT Method Filter:
              </Typography>
              {methodOptions.map(m => (
                <Chip 
                  key={m} 
                  label={m} 
                  color={methodFilter === m ? 'primary' : 'default'} 
                  onClick={() => setMethodFilter(m)}
                  size="medium"
                  sx={{ fontWeight: methodFilter === m ? 600 : 400 }}
                />
              ))}
              <Box sx={{ flexGrow: 1 }} />
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <TextField select size="small" label="Contractor" value={bulk.contractor} onChange={e => setBulk({ ...bulk, contractor: e.target.value })} sx={{ minWidth: 180 }}>
                  {contractorOptions.map(v => (<MenuItem key={v} value={v}>{v}</MenuItem>))}
                </TextField>
                <TextField select size="small" label="Dept" value={bulk.department} onChange={e => setBulk({ ...bulk, department: e.target.value })} sx={{ minWidth: 130 }}>
                  {['structure','hull','ele','mech'].map(v => (<MenuItem key={v} value={v}>{v}</MenuItem>))}
                </TextField>
                <TextField select size="small" label="Requirement" value={bulk.requirement} onChange={e => setBulk({ ...bulk, requirement: e.target.value })} sx={{ minWidth: 170 }}>
                  {['full joint','partial'].map(v => (<MenuItem key={v} value={v}>{v}</MenuItem>))}
                </TextField>
                <TextField select size="small" label="Weld Process" value={bulk.weld_process} onChange={e => setBulk({ ...bulk, weld_process: e.target.value })} sx={{ minWidth: 170 }}>
                  {['GTAW','SMAW','FCAW'].map(v => (<MenuItem key={v} value={v}>{v}</MenuItem>))}
                </TextField>
                <Button variant="contained" onClick={downloadCSV} disabled={filteredRequired.length === 0} sx={{ minWidth: 140 }}>Download CSV</Button>
                {canEdit() && <Button variant="contained" onClick={createSelected} disabled={!filteredRequired.some(e => selectedKeys.has(e.key))} sx={{ minWidth: 160 }}>Create Selected</Button>}
                {duplicateGroups.length > 0 && canEdit() && (
                  <Button variant="outlined" color="warning" onClick={deleteDuplicateRequests} sx={{ minWidth: 200 }}>Delete Duplicate Requests</Button>
                )}
              </Box>
            </Box>
            <Box sx={{ width: '100%', overflowX: 'auto', p: 1 }}>
            <Table size="medium" sx={{ minWidth: 1600 }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600, backgroundColor: 'grey.100', fontSize: '0.875rem', padding: '16px 8px', borderBottom: '2px solid', borderBottomColor: 'primary.main', width: 60 }}><strong>Select</strong></TableCell>
                  <TableCell sx={{ fontWeight: 600, backgroundColor: 'grey.100', fontSize: '0.875rem', padding: '16px 16px', borderBottom: '2px solid', borderBottomColor: 'primary.main', width: 140, minWidth: 140 }}><strong>Block no</strong></TableCell>
                  <TableCell sx={{ fontWeight: 600, backgroundColor: 'grey.100', fontSize: '0.875rem', padding: '16px 16px', borderBottom: '2px solid', borderBottomColor: 'primary.main', width: 140, minWidth: 140 }}><strong>Drawing No</strong></TableCell>
                  <TableCell sx={{ fontWeight: 600, backgroundColor: 'grey.100', fontSize: '0.875rem', padding: '16px 16px', borderBottom: '2px solid', borderBottomColor: 'primary.main', width: 160, minWidth: 160 }}><strong>NDT Contractor</strong></TableCell>
                  <TableCell sx={{ fontWeight: 600, backgroundColor: 'grey.100', fontSize: '0.875rem', padding: '16px 16px', borderBottom: '2px solid', borderBottomColor: 'primary.main', width: 120, minWidth: 120 }}><strong>contractor</strong></TableCell>
                  <TableCell sx={{ fontWeight: 600, backgroundColor: 'grey.100', fontSize: '0.875rem', padding: '16px 16px', borderBottom: '2px solid', borderBottomColor: 'primary.main', width: 140, minWidth: 140 }}><strong>Structure Category</strong></TableCell>
                  <TableCell sx={{ fontWeight: 600, backgroundColor: 'grey.100', fontSize: '0.875rem', padding: '16px 16px', borderBottom: '2px solid', borderBottomColor: 'primary.main', width: 140, minWidth: 140 }}><strong>Joint No</strong></TableCell>
                  <TableCell sx={{ fontWeight: 600, backgroundColor: 'grey.100', fontSize: '0.875rem', padding: '16px 16px', borderBottom: '2px solid', borderBottomColor: 'primary.main', width: 140, minWidth: 140 }}><strong>Weld Type</strong></TableCell>
                  <TableCell sx={{ fontWeight: 600, backgroundColor: 'grey.100', fontSize: '0.875rem', padding: '16px 16px', borderBottom: '2px solid', borderBottomColor: 'primary.main', width: 160, minWidth: 160 }}><strong>Inspection Category</strong></TableCell>
                  <TableCell sx={{ fontWeight: 600, backgroundColor: 'grey.100', fontSize: '0.875rem', padding: '16px 16px', borderBottom: '2px solid', borderBottomColor: 'primary.main', width: 140, minWidth: 140 }}><strong>Welder No</strong></TableCell>
                  <TableCell sx={{ fontWeight: 600, backgroundColor: 'grey.100', fontSize: '0.875rem', padding: '16px 16px', borderBottom: '2px solid', borderBottomColor: 'primary.main', width: 140, minWidth: 140 }}><strong>Weld Length</strong></TableCell>
                  <TableCell sx={{ fontWeight: 600, backgroundColor: 'grey.100', fontSize: '0.875rem', padding: '16px 16px', borderBottom: '2px solid', borderBottomColor: 'primary.main', width: 160, minWidth: 160 }}><strong>Requirement</strong></TableCell>
                  <TableCell sx={{ fontWeight: 600, backgroundColor: 'grey.100', fontSize: '0.875rem', padding: '16px 16px', borderBottom: '2px solid', borderBottomColor: 'primary.main', width: 140, minWidth: 140 }}><strong>NDT Method</strong></TableCell>
                  <TableCell sx={{ fontWeight: 600, backgroundColor: 'grey.100', fontSize: '0.875rem', padding: '16px 16px', borderBottom: '2px solid', borderBottomColor: 'primary.main', width: 180, minWidth: 180 }}><strong>Request Status</strong></TableCell>
                  <TableCell sx={{ fontWeight: 600, backgroundColor: 'grey.100', fontSize: '0.875rem', padding: '16px 16px', borderBottom: '2px solid', borderBottomColor: 'primary.main', width: 180, minWidth: 180 }}><strong>Request Date</strong></TableCell>
                  <TableCell sx={{ fontWeight: 600, backgroundColor: 'grey.100', fontSize: '0.875rem', padding: '16px 16px', borderBottom: '2px solid', borderBottomColor: 'primary.main', width: 160, minWidth: 160 }}><strong>RFI No</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredRequired.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={17} align="center" sx={{ padding: '24px 16px' }}>
                      <Typography variant="body2" color="text.secondary">
                        No required NDT methods from final inspections
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : filteredRequired.map((e) => {
                    const req = existingMap.get(e.key);
                    return (
                  <TableRow 
                    key={e.key}
                    sx={{ 
                      '&:hover': {
                        backgroundColor: 'action.hover'
                      }
                    }}
                  >
                    <TableCell sx={{ padding: '12px 8px' }}>
                      <Checkbox 
                        checked={selectedKeys.has(e.key)} 
                        onChange={() => toggleSelected(e.key)} 
                        disabled={e.exists || !canEdit()}
                        size="small"
                      />
                    </TableCell>
                    <TableCell sx={{ padding: '12px 16px', fontSize: '0.875rem' }}>{e.final.block_no || '-'}</TableCell>
                    <TableCell sx={{ padding: '12px 16px', fontSize: '0.875rem' }}>{(req as any)?.draw_no || (e.final as any).draw_no || '-'}</TableCell>
                    <TableCell sx={{ padding: '12px 16px', fontSize: '0.875rem' }}>{bulk.contractor || '-'}</TableCell>
                    <TableCell sx={{ padding: '12px 16px', fontSize: '0.875rem' }}>{(req as any)?.draw_no || (e.final as any).draw_no || e.final.system_no || '-'}</TableCell>
                    <TableCell sx={{ padding: '12px 16px', fontSize: '0.875rem' }}>{(req as any)?.structure_category || (e.final as any).structure_category || e.final.line_no || '-'}</TableCell>
                    <TableCell sx={{ padding: '12px 16px', fontSize: '0.875rem' }}>{(req as any)?.joint_no || (e.final as any).joint_no || '-'}</TableCell>
                    <TableCell sx={{ padding: '12px 16px', fontSize: '0.875rem' }}>{e.final.weld_type || '-'}</TableCell>
                    <TableCell sx={{ padding: '12px 16px', fontSize: '0.875rem' }}>{e.final.inspection_category || 'type-I'}</TableCell>
                    <TableCell sx={{ padding: '12px 16px', fontSize: '0.875rem' }}>{e.final.welder_no || '-'}</TableCell>
                    <TableCell sx={{ padding: '12px 16px', fontSize: '0.875rem' }}>{e.final.weld_length || '-'}</TableCell>
                    <TableCell sx={{ padding: '12px 16px', fontSize: '0.875rem' }}>{bulk.requirement}</TableCell>
                    <TableCell sx={{ padding: '12px 16px', fontSize: '0.875rem' }}>{e.method}</TableCell>
                    <TableCell sx={{ padding: '12px 16px' }}>
                      <TextField
                        select
                        size="small"
                        value={e.exists ? 'RFI Raised' : 'pending'}
                        onChange={(ev) => {
                          const val = String(ev.target.value);
                          if (val === 'RFI Raised' && !e.exists) {
                            createFromFinal(e);
                          }
                        }}
                        disabled={!(selectedKeys.has(e.key) && !e.exists && drafts[e.key]?.request_time && drafts[e.key]?.rfi_no)}
                        sx={{ minWidth: 140 }}
                      >
                        <MenuItem value="pending">pending</MenuItem>
                        <MenuItem value="RFI Raised">RFI Raised</MenuItem>
                      </TextField>
                    </TableCell>
                    <TableCell sx={{ padding: '12px 16px' }}>
                      {e.exists ? (
                        existingMap.get(e.key)?.request_time ? new Date(existingMap.get(e.key).request_time).toLocaleDateString() : '-'
                      ) : selectedKeys.has(e.key) ? (
                        <TextField
                          size="small"
                          type="date"
                          value={drafts[e.key]?.request_time || ''}
                          onChange={(ev) => setDrafts(prev => ({ ...prev, [e.key]: { ...prev[e.key], request_time: ev.target.value } }))}
                          sx={{ minWidth: 160 }}
                        />
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell sx={{ padding: '12px 16px' }}>
                      {e.exists ? (
                        existingMap.get(e.key)?.ndt_report_no || '-'
                      ) : selectedKeys.has(e.key) ? (
                        <TextField
                          size="small"
                          placeholder="Enter RFI No"
                          value={drafts[e.key]?.rfi_no || ''}
                          onChange={(ev) => setDrafts(prev => ({ ...prev, [e.key]: { ...prev[e.key], rfi_no: ev.target.value } }))}
                          sx={{ minWidth: 140 }}
                        />
                      ) : (
                        '-'
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            }
              </TableBody>
            </Table>
            </Box>
          </Paper>

          

          <Dialog open={open} onClose={() => setOpen(false)} maxWidth="md" fullWidth>
            <DialogTitle>{editingId ? 'Edit' : 'New'} Structure NDT Request</DialogTitle>
            <DialogContent>
              <Grid container spacing={2} sx={{ mt: 1 }}>
                <Grid item xs={12} sm={6}><TextField select fullWidth label="Joint (Final Accepted)" value={form.final_id as any || ''} onChange={e => {
                  const id = Number(e.target.value);
                  const opt = finalOptions.find(o => o.id === id);
                  if (!opt) return;
                  const fi = opt.fi;
                  setForm({
                    ...form,
                    final_id: id,
                    system_no: fi.system_no,
                    line_no: fi.line_no,
                    spool_no: fi.spool_no,
                    joint_no: fi.joint_no,
                    weld_type: fi.weld_type,
                    welder_no: fi.welder_no,
                    weld_size: fi.weld_length,
                    pipe_dia: (fi as any).pipe_dia,
                    inspection_category: fi.inspection_category || 'type-I'  // Auto-populate inspection category
                  });
                }}>
                  {finalOptions.map(o => (
                    <MenuItem key={o.id} value={o.id}>{o.label}</MenuItem>
                  ))}
                </TextField></Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    select
                    fullWidth
                    label="NDT-Contractor"
                    value={form.contractor || ''}
                    onChange={e => setForm({ ...form, contractor: e.target.value })}
                  >
                    {contractorOptions.map(v => (<MenuItem key={v} value={v}>{v}</MenuItem>))}
                  </TextField>
                </Grid>
                <Grid item xs={12} sm={6}><TextField fullWidth label="Department" value={form.department || ''} onChange={e => setForm({ ...form, department: e.target.value })} /></Grid>
                <Grid item xs={12} sm={6}><TextField select fullWidth label="Requirement" value={form.requirement || 'full joint'} onChange={e => setForm({ ...form, requirement: e.target.value })}>
                  {['full joint','partial'].map(v => (<MenuItem key={v} value={v}>{v}</MenuItem>))}
                </TextField></Grid>
                <Grid item xs={12} sm={6}><TextField select fullWidth label="NDT Type" value={form.ndt_type || 'UT'} onChange={e => setForm({ ...form, ndt_type: e.target.value })}>
                  {['RT','UT','PT','MP','FT','PMI'].map(m => (<MenuItem key={m} value={m}>{m}</MenuItem>))}
                </TextField></Grid>
                <Grid item xs={12} sm={6}><TextField fullWidth label="Report No" value={form.ndt_report_no || ''} onChange={e => setForm({ ...form, ndt_report_no: e.target.value })} /></Grid>
                <Grid item xs={12} sm={6}><TextField select fullWidth label="Result" value={form.ndt_result || ''} onChange={e => setForm({ ...form, ndt_result: e.target.value })}>
                  {['accepted','rejected'].map(v => (<MenuItem key={v} value={v}>{v}</MenuItem>))}
                </TextField></Grid>
                <Grid item xs={12} sm={6}><TextField select fullWidth label="Weld Process" value={form.weld_process || 'GTAW'} onChange={e => setForm({ ...form, weld_process: e.target.value })}>
                  {['GTAW','SMAW','FCAW'].map(v => (<MenuItem key={v} value={v}>{v}</MenuItem>))}
                </TextField></Grid>
                <Grid item xs={12} sm={6}><TextField fullWidth type="datetime-local" label="Request Time" value={form.request_time as any || ''} onChange={e => setForm({ ...form, request_time: e.target.value })} InputLabelProps={{ shrink: true }} /></Grid>
                <Grid item xs={12} sm={6}><TextField fullWidth type="datetime-local" label="Test Time" value={form.test_time as any || ''} onChange={e => setForm({ ...form, test_time: e.target.value })} InputLabelProps={{ shrink: true }} /></Grid>
                <Grid item xs={12} sm={6}><TextField fullWidth label="Drawing No" value={form.system_no || ''} onChange={e => setForm({ ...form, system_no: e.target.value })} /></Grid>
                <Grid item xs={12} sm={6}><TextField fullWidth label="Structure Category" value={form.line_no || ''} onChange={e => setForm({ ...form, line_no: e.target.value })} /></Grid>
                <Grid item xs={12} sm={6}><TextField fullWidth label="Page No" value={form.spool_no || ''} onChange={e => setForm({ ...form, spool_no: e.target.value })} /></Grid>
                <Grid item xs={12} sm={6}><TextField fullWidth label="Joint No" value={form.joint_no || ''} onChange={e => setForm({ ...form, joint_no: e.target.value })} /></Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    select
                    fullWidth
                    label="Inspection Category"
                    value={form.inspection_category || 'type-I'}
                    onChange={e => setForm({ ...form, inspection_category: e.target.value as NDTRequest['inspection_category'] })}
                  >
                    <MenuItem value="type-I">Type I</MenuItem>
                    <MenuItem value="type-II">Type II</MenuItem>
                    <MenuItem value="type-III">Type III</MenuItem>
                    <MenuItem value="type-IV">Special</MenuItem>
                  </TextField>
                </Grid>
                <Grid item xs={12}><TextField fullWidth label="Detail" value={form.detail_description || ''} onChange={e => setForm({ ...form, detail_description: e.target.value })} multiline rows={3} /></Grid>
              </Grid>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={submit} variant="contained">{editingId ? 'Save' : 'Create'}</Button>
            </DialogActions>
          </Dialog>
          <Dialog open={deleteOpen} onClose={cancelDelete} maxWidth="sm" fullWidth>
            <DialogTitle>Delete NDT Request</DialogTitle>
            <DialogContent>
              <Typography>
                Confirm deletion for joint: {(deleteRow?.line_no || '-') + '-' + (deleteRow?.spool_no || '-') + '-' + (deleteRow?.joint_no || '-')}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Contractor: {deleteRow?.contractor || '-'} • Requirement: {deleteRow?.requirement || '-'}
              </Typography>
            </DialogContent>
            <DialogActions>
              <Button onClick={cancelDelete}>Cancel</Button>
              <Button onClick={confirmDelete} color="error" variant="contained">Delete</Button>
            </DialogActions>
          </Dialog>

          <Snackbar open={snackOpen} autoHideDuration={3000} onClose={() => setSnackOpen(false)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
            <Alert onClose={() => setSnackOpen(false)} severity={snackSeverity} sx={{ width: '100%' }}>
              {snackMsg}
            </Alert>
          </Snackbar>
        </>
      )}
    </Container>
  );
};

export default NDTRequests;
