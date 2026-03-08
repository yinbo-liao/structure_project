import React, { useEffect, useMemo, useState } from 'react';
import { Container, Typography, Box, Button, Paper, Table, TableHead, TableRow, TableCell, TableBody, Chip, Dialog, DialogTitle, DialogContent, DialogActions, Grid, TextField, MenuItem, TablePagination, IconButton, Snackbar, Alert, InputAdornment, FormControlLabel, Checkbox, Tooltip } from '@mui/material';
import { Edit, Delete, Search, Clear, Warning, Info, Download } from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import ApiService from '../../services/api';
import { NDTStatusRecord, NDTTest, NDTRequest, FinalInspection } from '../../types';
import { calculateWeldLengthFromDiameter, validateWeldLength, isPipeProject } from '../../utils/weldLengthCalculator';

const NDTStatus: React.FC = () => {
  const { selectedProject, canEdit, user, isAdmin, canDelete } = useAuth();
  const isStructureProject = selectedProject?.project_type === 'structure';
  const [rows, setRows] = useState<NDTStatusRecord[]>([]);
  const [finals, setFinals] = useState<FinalInspection[]>([]);
  const [loading, setLoading] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<{ welder_no?: string; weld_size?: number; weld_site?: string; ndt_type?: string; ndt_report_no?: string; ndt_result?: string; rejected_length?: number; pipe_dia?: string; test_length?: number }>({});
  const [editRow, setEditRow] = useState<NDTStatusRecord | null>(null);
  const [repairWorkOverride, setRepairWorkOverride] = useState<boolean>(false);
  const [weldLengthValidation, setWeldLengthValidation] = useState<{
    isValid: boolean;
    calculatedLength?: number;
    difference?: number;
    percentageDiff?: number;
    message: string;
  } | null>(null);
  const [requests, setRequests] = useState<NDTRequest[]>([]);
  const [tests, setTests] = useState<NDTTest[]>([]);
  const [methodFilter, setMethodFilter] = useState<string>('All');
  const [page, setPage] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error' | 'info' | 'warning'>('info');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteRow, setDeleteRow] = useState<DisplayRow | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [editGroupKeys, setEditGroupKeys] = useState<string[]>([]);
  const [editGroupIndex, setEditGroupIndex] = useState<number>(0);
  
  // Search filters
  const [searchLineNo, setSearchLineNo] = useState<string>('');
  const [searchSpoolNo, setSearchSpoolNo] = useState<string>('');
  const [searchJointNo, setSearchJointNo] = useState<string>('');
  const [searchReportNo, setSearchReportNo] = useState<string>('');
  const [searchResult, setSearchResult] = useState<string>('All');

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
      try {
        const fins = await ApiService.getFinalInspections(selectedProject.id);
        setFinals(fins as any);
      } catch {}
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || 'Failed to load NDT Status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [selectedProject]);

  // Update weld length validation when pipe_dia or weld_size changes
  useEffect(() => {
    if (editOpen && isPipeProject(selectedProject?.project_type)) {
      const validation = validateWeldLength(editForm.weld_size, editForm.pipe_dia, repairWorkOverride ? 1000 : 0.1);
      setWeldLengthValidation(validation);
    } else {
      setWeldLengthValidation(null);
    }
  }, [editForm.weld_size, editForm.pipe_dia, repairWorkOverride, editOpen, selectedProject?.project_type]);

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
      rejected_length: rjLen,
      pipe_dia: rec.pipe_dia || '',
      test_length: tk?.test_length
    });
    setEditOpen(true);
    setEditRow(rec);
    setRepairWorkOverride(false);
  };

  const ensureEdit = async (finalId: number, method?: string, groupKeys?: string[], currentKey?: string) => {
    try {
      // First, try to find existing NDT status record
      const rec = statusByFinal[finalId];
      if (rec) {
        if (groupKeys && currentKey) {
          setEditGroupKeys(groupKeys);
          const idx = groupKeys.indexOf(currentKey);
          setEditGroupIndex(idx >= 0 ? idx : 0);
        } else {
          setEditGroupKeys([]);
          setEditGroupIndex(0);
        }
        openEdit(rec, method);
        return;
      }
      
      if (!selectedProject) return;
      
      // Try to find NDT request for this joint
      const ndtRequest = requests.find((r: NDTRequest) => r.final_id === finalId && (!method || r.ndt_type === method));
      
      if (ndtRequest) {
        // If we have an NDT request, try to edit it directly
        // First check if we can create/edit an NDT status record
        try {
          await ApiService.ensureNDTStatusRecord(finalId);
          const updated = await ApiService.getNDTStatus(selectedProject.id);
          setRows(updated);
          const next = updated.find((r: any) => r.final_id === finalId);
          if (next) {
            if (groupKeys && currentKey) {
              setEditGroupKeys(groupKeys);
              const idx = groupKeys.indexOf(currentKey);
              setEditGroupIndex(idx >= 0 ? idx : 0);
            } else {
              setEditGroupKeys([]);
              setEditGroupIndex(0);
            }
            openEdit(next, method);
            showSnackbar('NDT status record loaded for editing', 'success');
            return;
          }
        } catch (ensureError: any) {
          // If cannot ensure status record, try to edit NDT request directly
          console.log('Cannot ensure status record, trying to edit NDT request directly:', ensureError.message);
        }
        
        // Create a mock NDT status record from the NDT request for editing
        const mockStatusRecord: any = {
          id: ndtRequest.id, // Use NDT request ID temporarily
          final_id: ndtRequest.final_id,
          project_id: ndtRequest.project_id,
          system_no: ndtRequest.system_no,
          line_no: ndtRequest.line_no,
          spool_no: ndtRequest.spool_no,
          joint_no: ndtRequest.joint_no,
          weld_type: ndtRequest.weld_type,
          welder_no: ndtRequest.welder_no,
          weld_size: ndtRequest.weld_size,
          weld_site: '',
          pipe_dia: ndtRequest.pipe_dia,
          ndt_type: ndtRequest.ndt_type,
          ndt_report_no: ndtRequest.ndt_report_no || '',
          ndt_result: ndtRequest.ndt_result || '',
          rejected_length: 0,
          isFromRequest: true // Flag to indicate this came from NDT request
        };
        
        if (groupKeys && currentKey) {
          setEditGroupKeys(groupKeys);
          const idx = groupKeys.indexOf(currentKey);
          setEditGroupIndex(idx >= 0 ? idx : 0);
        } else {
          setEditGroupKeys([]);
          setEditGroupIndex(0);
        }
        openEdit(mockStatusRecord, method);
        showSnackbar('Editing NDT request directly. Changes will update the NDT request record.', 'info');
        return;
      }
      
      // If no NDT request found, try to ensure NDT status record
      try {
        await ApiService.ensureNDTStatusRecord(finalId);
        const updated = await ApiService.getNDTStatus(selectedProject.id);
        setRows(updated);
        const next = updated.find((r: any) => r.final_id === finalId);
        if (next) {
          if (groupKeys && currentKey) {
            setEditGroupKeys(groupKeys);
            const idx = groupKeys.indexOf(currentKey);
            setEditGroupIndex(idx >= 0 ? idx : 0);
          } else {
            setEditGroupKeys([]);
            setEditGroupIndex(0);
          }
          openEdit(next, method);
          showSnackbar('NDT status record loaded for editing', 'success');
        } else {
          showSnackbar('Failed to create NDT status record. The joint may not have an accepted final inspection or corresponding NDT request.', 'error');
        }
      } catch (ensureError: any) {
        const errorMsg = ensureError?.response?.data?.detail || ensureError?.message || 'No NDT request found and cannot create status record';
        showSnackbar(`Cannot edit this joint: ${errorMsg}`, 'error');
      }
    } catch (error: any) {
      showSnackbar(`Edit failed: ${error?.message || 'Unknown error'}`, 'error');
    }
  };

  const submitEdit = async () => {
    if (!editId || !editRow) return;
    const method = (editForm.ndt_type || '').trim();
    const result = (editForm.ndt_result || '').toLowerCase();
    const rejected_length = result === 'rejected' ? (editForm.rejected_length ?? 0) : 0;
    
    try {
      // Check if we're editing an NDT request (has isFromRequest flag)
      if ((editRow as any).isFromRequest) {
        // Update NDT request instead of NDT status record
        await ApiService.updateNDTRequest(editId, {
          ndt_report_no: editForm.ndt_report_no,
          ndt_result: result,
          weld_size: editForm.weld_size,
          ndt_type: method
        });
        showSnackbar('NDT request updated successfully', 'success');
      } else {
        // Update NDT status record
        await ApiService.updateNDTStatusRecord(editId, {
          welder_no: editForm.welder_no,
          weld_size: editForm.weld_size,
          weld_site: editForm.weld_site,
          ndt_type: method,
          ndt_report_no: editForm.ndt_report_no,
          ndt_result: result,
          rejected_length,
          test_length: editForm.test_length
        });
        showSnackbar('NDT status updated successfully', 'success');
      }
      
      const groupSize = editGroupKeys.length;
      const currentIndex = editGroupIndex;
      const hasNext = groupSize > 0 && currentIndex < groupSize - 1;
      if (hasNext) {
        const nextKey = editGroupKeys[currentIndex + 1];
        const parts = nextKey.split('-');
        const finalIdPart = parts[parts.length - 2];
        const finalIdNum = parseInt(finalIdPart, 10);
        setEditGroupIndex(currentIndex + 1);
        await ensureEdit(finalIdNum, method, editGroupKeys, nextKey);
      } else {
        setEditOpen(false);
        setEditRow(null);
        setEditId(null);
        setEditGroupKeys([]);
        setEditGroupIndex(0);
        load();
      }
    } catch (e: any) {
      const errorMsg = e?.response?.data?.detail || e?.message || 'Failed to update record';
      showSnackbar(errorMsg, 'error');
    }
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
  const finalById = useMemo<Record<number, FinalInspection>>(() => {
    const m: Record<number, FinalInspection> = {};
    finals.forEach((f: FinalInspection) => { m[f.id] = f; });
    return m;
  }, [finals]);
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
    welder_no?: string;
    block_no?: string;
  }
  const displayRows = useMemo<DisplayRow[]>(() => {
    const isPipe = isPipeProject(selectedProject?.project_type);
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
    // Pass 1: requests as drivers (method-specific)
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
        report_no: (tk?.report_no || (r as any).ndt_report_no || s?.ndt_report_no || '-') as string,
        result: (tk?.result || (r as any).ndt_result || '-') as string,
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
      const isSingleMethod = allowed.size === 1;
      allowed.forEach((method) => {
        const methodMatch = methodFilter === 'All' || method === methodFilter;
        if (!methodMatch) return;
        const tk = testsByKey.get(`${s.final_id}_${method || ''}`);
        const baseReport = isSingleMethod ? s.ndt_report_no : undefined;
        const baseResult = isSingleMethod ? s.ndt_result : undefined;
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
          report_no: (tk?.report_no || baseReport || '-') as string,
          result: (tk?.result || baseResult || '-') as string,
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
        report_no: t.report_no || (r as any)?.ndt_report_no || s?.ndt_report_no || '-',
        result: t.result || (r as any)?.ndt_result || '-',
      };
      const key = `${row.method || ''}:${row.line_no || ''}-${row.spool_no || ''}-${row.joint_no || ''}`;
      const prev = best.get(key);
      if (!prev || score(row) > score(prev)) best.set(key, row);
    });
    
    // Apply search filters
    let filteredRows = Array.from(best.values()).map((row) => {
      const fin = finalById[row.final_id];
      if (fin) {
        // For both pipe and structure projects, inherit data from final inspection
        const updatedRow = {
          ...row,
          weld_size: fin.weld_length ?? row.weld_size,
          pipe_dia: fin.pipe_dia || row.pipe_dia,
          weld_site: fin.weld_site || row.weld_site,
          welder_no: fin.welder_no || row.welder_no,
        };
        
        // For structure projects, also inherit structure-specific fields
        if (isStructureProject) {
          return {
            ...updatedRow,
            system_no: fin.draw_no || updatedRow.system_no, // Drawing No
            line_no: fin.structure_category || updatedRow.line_no, // Structure Category
            spool_no: fin.page_no || updatedRow.spool_no, // Page No
            // Block No should be inherited from final inspection
            block_no: fin.block_no,
          };
        }
        
        return updatedRow;
      }
      return row;
    });
    
    // Filter by Line No / Structure Category
    if (searchLineNo.trim()) {
      const searchTerm = searchLineNo.toLowerCase().trim();
      filteredRows = filteredRows.filter(row => 
        row.line_no?.toLowerCase().includes(searchTerm) || false
      );
    }
    
    // Filter by Spool No / Drawing No
    if (searchSpoolNo.trim()) {
      const searchTerm = searchSpoolNo.toLowerCase().trim();
      filteredRows = filteredRows.filter(row => 
        (isStructureProject ? row.system_no : row.spool_no)?.toLowerCase().includes(searchTerm) || false
      );
    }
    
    // Filter by Joint No
    if (searchJointNo.trim()) {
      const searchTerm = searchJointNo.toLowerCase().trim();
      filteredRows = filteredRows.filter(row => 
        row.joint_no?.toLowerCase().includes(searchTerm) || false
      );
    }
    
    // Filter by Report No
    if (searchReportNo.trim()) {
      const searchTerm = searchReportNo.toLowerCase().trim();
      filteredRows = filteredRows.filter(row => 
        row.report_no?.toLowerCase().includes(searchTerm) || false
      );
    }
    
    // Filter by Result
    if (searchResult !== 'All') {
      filteredRows = filteredRows.filter(row => {
        const rowResult = (row.result || '').toLowerCase();
        if (searchResult === 'accepted') return rowResult === 'accepted';
        if (searchResult === 'rejected') return rowResult === 'rejected';
        if (searchResult === 'pending') return rowResult === 'pending' || rowResult === '-' || !rowResult;
        if (searchResult === 'other') return rowResult && rowResult !== 'accepted' && rowResult !== 'rejected' && rowResult !== 'pending' && rowResult !== '-';
        return true;
      });
    }
    
    // Sort the filtered rows
    filteredRows.sort((a, b) => {
      const am = methodOrder[a.method || ''] ?? 99;
      const bm = methodOrder[b.method || ''] ?? 99;
      if (am !== bm) return am - bm;
      const aKey = `${a.line_no || ''}-${a.spool_no || ''}-${a.joint_no || ''}`;
      const bKey = `${b.line_no || ''}-${b.spool_no || ''}-${b.joint_no || ''}`;
      return aKey.localeCompare(bKey);
    });
    
    return filteredRows;
  }, [requests, rows, tests, statusByFinal, finalById, methodFilter, testsByKey, searchLineNo, searchSpoolNo, searchJointNo, searchReportNo, searchResult, selectedProject?.project_type]);

  const duplicateKeys = useMemo(() => {
    const counts = new Map<string, number>();
    const duplicateDetails = new Map<string, DisplayRow[]>();
    
    displayRows.forEach((d) => {
      const k = makeKey(d.system_no, d.line_no, d.spool_no, d.joint_no, d.method);
      counts.set(k, (counts.get(k) || 0) + 1);
      
      if (!duplicateDetails.has(k)) {
        duplicateDetails.set(k, []);
      }
      duplicateDetails.get(k)!.push(d);
    });
    
    const list = Array.from(counts.entries())
      .filter(([, c]) => c > 1)
      .map(([k, c]) => ({ 
        key: k, 
        count: c,
        details: duplicateDetails.get(k) || []
      }));
    const set = new Set(list.map((i) => i.key));
    return { list, set, details: duplicateDetails };
  }, [displayRows]);

  const [cleanupDialogOpen, setCleanupDialogOpen] = useState(false);
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<{dry_run: boolean, total_records: number, orphaned_count: number, records: any[]} | null>(null);

  const showSnackbar = (message: string, severity: 'success' | 'error' | 'info' | 'warning') => {
    setSnackbarMessage(message);
    setSnackbarSeverity(severity);
    setSnackbarOpen(true);
  };

  const handleCleanupOrphaned = async (execute: boolean = false) => {
    if (!selectedProject) return;
    setCleanupLoading(true);
    try {
      const result = await ApiService.cleanupOrphanedNDTStatusRecords(selectedProject.id, !execute);
      setCleanupResult(result);
      if (execute) {
        // Reload data after cleanup
        load();
        showSnackbar(`Cleaned up ${result.orphaned_count} orphaned records`, 'success');
      } else {
        showSnackbar(`Found ${result.orphaned_count} orphaned records (dry run)`, 'info');
      }
    } catch (error: any) {
      const errorMsg = error?.response?.data?.detail || error?.message || 'Cleanup failed';
      showSnackbar(errorMsg, 'error');
    } finally {
      setCleanupLoading(false);
    }
  };

  const rejectRates = useMemo(() => {
    console.log('Calculating reject rates...');
    console.log('Rows count:', rows?.length || 0);
    console.log('Tests count:', tests?.length || 0);
    
    const methodStats: Record<string, any> = {};
    
    // Define method categories
    const jointBasedMethods = ['FT', 'PMI'];
    const lengthBasedMethods = ['RT', 'UT', 'MPI', 'PT'];
    
    // First, process NDTTest data (most reliable source)
    (tests || []).forEach((test: NDTTest) => {
      const method = (test.method || '').toUpperCase().trim();
      if (!method) return;
      
      const isJointMethod = jointBasedMethods.includes(method);
      const isLengthMethod = lengthBasedMethods.includes(method);
      
      if (!isJointMethod && !isLengthMethod) {
        console.log(`Skipping unknown method: ${method}`);
        return;
      }
      
      const result = (test.result || '').toLowerCase();
      if (result !== 'accepted' && result !== 'rejected') {
        console.log(`Skipping test with non-final result: ${method} - ${result}`);
        return;
      }
      
      if (isJointMethod) {
        // Joint-based calculation
        if (!methodStats[method]) {
          methodStats[method] = {
            mode: 'joint',
            totalJoints: 0,
            rejectedJoints: 0,
            rejectRate: 0,
            measurement: 'joints'
          };
        }
        
        methodStats[method].totalJoints += 1;
        if (result === 'rejected') {
          methodStats[method].rejectedJoints += 1;
        }
        
        console.log(`Joint test: ${method} - result: ${result}, total: ${methodStats[method].totalJoints}, rejected: ${methodStats[method].rejectedJoints}`);
      } else if (isLengthMethod) {
        // Length-based calculation
        const testLength = test.test_length || 0;
        const rejectedLength = result === 'rejected' ? testLength : 0;
        
        if (!methodStats[method]) {
          methodStats[method] = {
            mode: 'length',
            totalLength: 0,
            rejectedLength: 0,
            rejectRate: 0,
            measurement: 'mm'
          };
        }
        
        methodStats[method].totalLength += testLength;
        methodStats[method].rejectedLength += rejectedLength;
        
        console.log(`Length test: ${method} - length: ${testLength}, rejected: ${rejectedLength}, result: ${result}`);
      }
    });
    
    // Then process NDTStatusRecord data (fallback)
    (rows || []).forEach((rec: NDTStatusRecord) => {
      const rawMethod = (rec.ndt_type || '').trim().toUpperCase();
      if (!rawMethod) return;
      
      // Handle multiple methods separated by commas/semicolons
      const methods = rawMethod.split(/[,;\/\s]+/).map(m => m.trim()).filter(m => m);
      
      methods.forEach(method => {
        const isJointMethod = jointBasedMethods.includes(method);
        const isLengthMethod = lengthBasedMethods.includes(method);
        
        if (!isJointMethod && !isLengthMethod) {
          console.log(`Skipping unknown method from status record: ${method}`);
          return;
        }
        
        const result = (rec.ndt_result || '').toLowerCase();
        if (result !== 'accepted' && result !== 'rejected') {
          console.log(`Skipping status record with non-final result: ${method} - ${result}`);
          return;
        }
        
        // Skip if we already have test data for this method (test data is more reliable)
        if (methodStats[method]) {
          console.log(`Skipping status record for ${method} - already have test data`);
          return;
        }
        
        if (isJointMethod) {
          // Joint-based calculation from status record
          if (!methodStats[method]) {
            methodStats[method] = {
              mode: 'joint',
              totalJoints: 0,
              rejectedJoints: 0,
              rejectRate: 0,
              measurement: 'joints'
            };
          }
          
          methodStats[method].totalJoints += 1;
          if (result === 'rejected') {
            methodStats[method].rejectedJoints += 1;
          }
          
          console.log(`Joint status: ${method} - result: ${result}, total: ${methodStats[method].totalJoints}, rejected: ${methodStats[method].rejectedJoints}`);
        } else if (isLengthMethod) {
          // Length-based calculation from status record
          // For structure projects, prioritize test_length, then weld_size
          const lengthValue = rec.test_length || rec.weld_size || 0;
          const rejectedLength = result === 'rejected' ? (rec.rejected_length || 0) : 0;
          
          if (!methodStats[method]) {
            methodStats[method] = {
              mode: 'length',
              totalLength: 0,
              rejectedLength: 0,
              rejectRate: 0,
              measurement: 'mm'
            };
          }
          
          methodStats[method].totalLength += lengthValue;
          methodStats[method].rejectedLength += rejectedLength;
          
          console.log(`Length status: ${method} - length: ${lengthValue}, rejected: ${rejectedLength}, result: ${result}`);
        }
      });
    });
    
    // Calculate reject rates for all methods
    Object.keys(methodStats).forEach((method) => {
      const stats = methodStats[method];
      if (stats.mode === 'joint') {
        const total = stats.totalJoints || 0;
        stats.rejectRate = total > 0 ? (stats.rejectedJoints / total) * 100 : 0;
        console.log(`Joint reject rate for ${method}: ${stats.rejectRate}% (${stats.rejectedJoints}/${stats.totalJoints})`);
      } else {
        const total = stats.totalLength || 0;
        stats.rejectRate = total > 0 ? (stats.rejectedLength / total) * 100 : 0;
        console.log(`Length reject rate for ${method}: ${stats.rejectRate}% (${stats.rejectedLength}/${stats.totalLength} mm)`);
      }
    });
    
    // Sort methods: length-based first, then joint-based
    const sortedStats: Record<string, any> = {};
    const sortedMethods = Object.keys(methodStats).sort((a, b) => {
      const aIsLength = lengthBasedMethods.includes(a);
      const bIsLength = lengthBasedMethods.includes(b);
      if (aIsLength && !bIsLength) return -1;
      if (!aIsLength && bIsLength) return 1;
      return a.localeCompare(b);
    });
    
    sortedMethods.forEach(method => {
      sortedStats[method] = methodStats[method];
    });
    
    console.log('Final reject rates:', sortedStats);
    return sortedStats;
  }, [rows, tests]);

  const downloadCSV = () => {
    if (!displayRows.length) return;

    const headers = isStructureProject 
      ? ['Block No', 'Drawing No', 'Structure Category', 'Page No', 'Joint No', 'Weld Type', 'Weld Size', 'NDT Method', 'Report No', 'Result']
      : ['System No', 'Line No', 'Spool No', 'Joint No', 'Weld Type', 'Weld Size', 'Pipe Dia', 'NDT Method', 'Report No', 'Result'];
    
    const csvContent = [
      headers.join(','),
      ...displayRows.map(row => {
        const data = isStructureProject
          ? [
              row.block_no || '',
              row.system_no || '',
              row.line_no || '',
              row.spool_no || '',
              row.joint_no || '',
              row.weld_type || '',
              row.weld_size || '',
              row.method || '',
              row.report_no || '',
              row.result || ''
            ]
          : [
              row.system_no || '',
              row.line_no || '',
              row.spool_no || '',
              row.joint_no || '',
              row.weld_type || '',
              row.weld_size || '',
              row.pipe_dia || '',
              row.method || '',
              row.report_no || '',
              row.result || ''
            ];
        return data.map(field => `"${String(field).replace(/"/g, '""')}"`).join(',');
      })
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `${isStructureProject ? 'structure' : 'pipe'}_ndt_status.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <Container maxWidth={false} sx={{ mt: 4, px: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">{isStructureProject ? 'Structure NDT Status' : 'Pipe NDT Status'}</Typography>
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
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box>
                <Typography variant="subtitle1" fontWeight="bold">Duplicate Records Detected</Typography>
                <Typography variant="body2">
                  Found {duplicateKeys.list.length} duplicate joint-method combinations. 
                  Each joint should have only one record per NDT method.
                </Typography>
                <Typography variant="caption" sx={{ mt: 1, display: 'block' }}>
                  Composite key: System-Line-Spool-Joint-Method
                </Typography>
              </Box>
              {isAdmin() && (
                <Button 
                  variant="contained" 
                  color="warning"
                  onClick={() => setCleanupDialogOpen(true)}
                >
                  Cleanup Tools
                </Button>
              )}
            </Box>
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" fontWeight="bold">Duplicate Groups:</Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
                {duplicateKeys.list.slice(0, 8).map((item, idx) => (
                  <Chip 
                    key={idx}
                    label={`${item.key} (x${item.count})`}
                    color="warning"
                    size="small"
                    variant="outlined"
                  />
                ))}
                {duplicateKeys.list.length > 8 && (
                  <Chip 
                    label={`+${duplicateKeys.list.length - 8} more`}
                    size="small"
                    variant="outlined"
                  />
                )}
              </Box>
            </Box>
          </Paper>
        </Box>
      )}

      {/* Reject Rate Summary */}
      {Object.keys(rejectRates).length > 0 && (
        <Box sx={{ mb: 2 }}>
          <Paper sx={{ p: 2, bgcolor: 'info.light' }}>
            <Typography variant="h6" gutterBottom>NDT Reject Rate Summary</Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
              {Object.entries(rejectRates).map(([method, stats]) => {
                const isJointMethod = stats.mode === 'joint';
                const totalLabel = isJointMethod
                  ? `Total Joints: ${stats.totalJoints || 0}`
                  : `Total Length: ${Number(stats.totalLength || 0).toFixed(1)} mm`;
                const rejectedLabel = isJointMethod
                  ? `Rejected: ${stats.rejectedJoints || 0} joints`
                  : `Rejected: ${Number(stats.rejectedLength || 0).toFixed(1)} mm`;
                const rateValue = Number(stats.rejectRate || 0);
                const measurementUnit = stats.measurement || (isJointMethod ? 'joints' : 'mm');

                return (
                  <Box key={method} sx={{ 
                    p: 1.5, 
                    border: '1px solid', 
                    borderColor: 'divider', 
                    borderRadius: 1,
                    minWidth: 160,
                    backgroundColor: 'background.paper'
                  }}>
                    <Typography variant="subtitle1" fontWeight="bold">{method}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {isJointMethod ? 'Joint-based' : 'Length-based'} ({measurementUnit})
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 0.5 }}>{totalLabel}</Typography>
                    <Typography variant="body2" color="error">{rejectedLabel}</Typography>
                    <Typography variant="body2" color={rateValue > 5 ? 'error' : 'success'} fontWeight="bold">
                      Reject Rate: {rateValue.toFixed(1)}%
                    </Typography>
                  </Box>
                );
              })}
            </Box>
            <Typography variant="caption" sx={{ mt: 1, display: 'block' }}>
              Reject Rate Calculation: For length-based methods (RT, UT, MPI, PT) = (Rejected Length / Total Weld Length) × 100%
              <br />
              For joint-based methods (PMI, FT) = (Rejected Joints / Total Joints) × 100%
            </Typography>
          </Paper>
        </Box>
      )}
      
      <Paper>
        {/* Search Filters */}
        <Box sx={{ px: 2, py: 2, borderBottom: '1px solid #e0e0e0' }}>
          <Typography variant="subtitle1" gutterBottom>Search Filters</Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={2.4}>
              <TextField
                fullWidth
                size="small"
                label={isStructureProject ? "Structure Category" : "Line No"}
                value={searchLineNo}
                onChange={(e) => { setSearchLineNo(e.target.value); setPage(0); }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search fontSize="small" />
                    </InputAdornment>
                  ),
                  endAdornment: searchLineNo && (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => { setSearchLineNo(''); setPage(0); }}>
                        <Clear fontSize="small" />
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
                placeholder={isStructureProject ? "Search Structure Category" : "Search Line No"}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <TextField
                fullWidth
                size="small"
                label={isStructureProject ? "Drawing No" : "Spool No"}
                value={searchSpoolNo}
                onChange={(e) => { setSearchSpoolNo(e.target.value); setPage(0); }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search fontSize="small" />
                    </InputAdornment>
                  ),
                  endAdornment: searchSpoolNo && (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => { setSearchSpoolNo(''); setPage(0); }}>
                        <Clear fontSize="small" />
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
                placeholder={isStructureProject ? "Search Drawing No" : "Search Spool No"}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <TextField
                fullWidth
                size="small"
                label="Joint No"
                value={searchJointNo}
                onChange={(e) => { setSearchJointNo(e.target.value); setPage(0); }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search fontSize="small" />
                    </InputAdornment>
                  ),
                  endAdornment: searchJointNo && (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => { setSearchJointNo(''); setPage(0); }}>
                        <Clear fontSize="small" />
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
                placeholder="Search Joint No"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <TextField
                fullWidth
                size="small"
                label="Report No"
                value={searchReportNo}
                onChange={(e) => { setSearchReportNo(e.target.value); setPage(0); }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search fontSize="small" />
                    </InputAdornment>
                  ),
                  endAdornment: searchReportNo && (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => { setSearchReportNo(''); setPage(0); }}>
                        <Clear fontSize="small" />
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
                placeholder="Search Report No"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <TextField
                select
                fullWidth
                size="small"
                label="Result"
                value={searchResult}
                onChange={(e) => { setSearchResult(e.target.value); setPage(0); }}
              >
                <MenuItem value="All">All Results</MenuItem>
                <MenuItem value="accepted">Accepted</MenuItem>
                <MenuItem value="rejected">Rejected</MenuItem>
                <MenuItem value="pending">Pending</MenuItem>
                <MenuItem value="other">Other</MenuItem>
              </TextField>
            </Grid>
          </Grid>
        </Box>
        
        {/* Method Filter */}
        <Box sx={{ px: 2, py: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="subtitle1" sx={{ mr: 2 }}>Method:</Typography>
          <Button variant={methodFilter === 'All' ? 'contained' : 'outlined'} size="small" onClick={() => { setMethodFilter('All'); setPage(0); }}>All</Button>
          {requestedMethods.map((m: string) => (
            <Button key={m} variant={methodFilter === m ? 'contained' : 'outlined'} size="small" onClick={() => { setMethodFilter(m); setPage(0); }}>{m}</Button>
          ))}
          <Box sx={{ flex: 1 }} />
          <Button variant="outlined" onClick={load} disabled={loading}>Refresh</Button>
          <Button variant="outlined" startIcon={<Download />} onClick={downloadCSV} disabled={loading || displayRows.length === 0} sx={{ ml: 1 }}>Export CSV</Button>
        </Box>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox" />
              <TableCell><strong>{isStructureProject ? 'Drawing No' : 'System No'}</strong></TableCell>
              <TableCell><strong>{isStructureProject ? 'Structure Category' : 'Line No'}</strong></TableCell>
              <TableCell><strong>{isStructureProject ? 'Page No' : 'Spool No'}</strong></TableCell>
              <TableCell><strong>Joint No</strong></TableCell>
              <TableCell><strong>Block No</strong></TableCell>
              <TableCell><strong>Weld Type</strong></TableCell>
              <TableCell><strong>Inspection Category</strong></TableCell>
              <TableCell><strong>Welder No</strong></TableCell>
              <TableCell><strong>Weld Site</strong></TableCell>
              <TableCell><strong>Weld Length</strong></TableCell>
              <TableCell><strong>Test Length</strong></TableCell>
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
              const rowKey = `${makeKey(d.system_no, d.line_no, d.spool_no, d.joint_no, d.method)}-${d.final_id}-${idx}`;
              return (
                <TableRow key={rowKey} selected={selectedKeys.includes(rowKey)}>
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={selectedKeys.includes(rowKey)}
                      onChange={() => {
                        setSelectedKeys(prev =>
                          prev.includes(rowKey)
                            ? prev.filter(key => key !== rowKey)
                            : [...prev, rowKey]
                        );
                      }}
                    />
                  </TableCell>
                  <TableCell>{d.system_no || '-'}</TableCell>
                  <TableCell>{d.line_no || '-'}</TableCell>
                  <TableCell>{d.spool_no || '-'}</TableCell>
                  <TableCell>{d.joint_no || '-'}</TableCell>
                  <TableCell>{d.block_no || '-'}</TableCell>
                  <TableCell>{d.weld_type || '-'}</TableCell>
                  <TableCell>{finalById[d.final_id]?.inspection_category || 'type-I'}</TableCell>
                  <TableCell>{d.welder_no || r?.welder_no || '-'}</TableCell>
                  <TableCell>{d.weld_site || '-'}</TableCell>
                  <TableCell>{d.weld_size ?? '-'}</TableCell>
                  <TableCell>{tk?.test_length ?? '-'}</TableCell>
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
                      const allowEdit = canEdit();
                      const allowDelete = canDelete();
                      return (
                        <Box>
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={() => {
                              const group =
                                selectedKeys.includes(rowKey) && selectedKeys.length > 0
                                  ? selectedKeys
                                  : [rowKey];
                              ensureEdit(d.final_id, d.method || '', group, rowKey);
                            }}
                            disabled={!allowEdit}
                          >
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
        <DialogTitle>Edit {isStructureProject ? 'Structure NDT' : 'NDT'} Status</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}><TextField fullWidth label={isStructureProject ? 'Drawing No' : 'System No'} value={editRow?.system_no || '-'} disabled /></Grid>
            <Grid item xs={12} sm={6}><TextField fullWidth label={isStructureProject ? 'Structure Category' : 'Line No'} value={editRow?.line_no || '-'} disabled /></Grid>
            <Grid item xs={12} sm={6}><TextField fullWidth label={isStructureProject ? 'Page No' : 'Spool No'} value={editRow?.spool_no || '-'} disabled /></Grid>
            <Grid item xs={12} sm={6}><TextField fullWidth label="Joint No" value={editRow?.joint_no || '-'} disabled /></Grid>
            <Grid item xs={12} sm={6}><TextField fullWidth label="Weld Type" value={editRow?.weld_type || '-'} disabled /></Grid>
            <Grid item xs={12} sm={6}><TextField select fullWidth label="Weld Site" value={editForm.weld_site || ''} onChange={e => setEditForm({ ...editForm, weld_site: e.target.value })}><MenuItem value="shop weld">shop weld</MenuItem><MenuItem value="float weld">float weld</MenuItem></TextField></Grid>
            <Grid item xs={12} sm={6}><TextField fullWidth type="number" label="Weld Length" value={editForm.weld_size as any || ''} onChange={e => setEditForm({ ...editForm, weld_size: Number(e.target.value) })} /></Grid>
            <Grid item xs={12} sm={6}><TextField fullWidth type="number" label="Test Length" value={editForm.test_length as any || ''} onChange={e => setEditForm({ ...editForm, test_length: Number(e.target.value) })} /></Grid>
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

      {/* Cleanup Dialog */}
      <Dialog open={cleanupDialogOpen} onClose={() => setCleanupDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>NDT Data Cleanup Tools</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle1" gutterBottom>Orphaned Record Cleanup</Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              Clean up NDT status records that are invalid because they:
            </Typography>
            <ul style={{ marginLeft: '20px', marginBottom: '16px' }}>
              <li>Have no corresponding final inspection</li>
              <li>Have final inspection that is not accepted</li>
              <li>Have no corresponding NDT request</li>
              <li>Missing required joint identifiers</li>
            </ul>
            
            {cleanupResult && (
              <Paper sx={{ p: 2, mb: 2, bgcolor: cleanupResult.dry_run ? 'info.light' : 'success.light' }}>
                <Typography variant="subtitle2">
                  {cleanupResult.dry_run ? 'Dry Run Results' : 'Cleanup Completed'}
                </Typography>
                <Typography variant="body2">
                  Total records: {cleanupResult.total_records}
                </Typography>
                <Typography variant="body2" color={cleanupResult.orphaned_count > 0 ? 'error' : 'success'}>
                  Orphaned records found: {cleanupResult.orphaned_count}
                </Typography>
                {cleanupResult.orphaned_count > 0 && (
                  <Box sx={{ mt: 1 }}>
                    <Typography variant="caption" display="block">Affected records:</Typography>
                    {cleanupResult.records.slice(0, 5).map((record, idx) => (
                      <Typography key={idx} variant="caption" display="block">
                        • {record.key}: {record.reason}
                      </Typography>
                    ))}
                    {cleanupResult.records.length > 5 && (
                      <Typography variant="caption" display="block">
                        ... and {cleanupResult.records.length - 5} more
                      </Typography>
                    )}
                  </Box>
                )}
              </Paper>
            )}

            <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
              <Button 
                variant="outlined" 
                onClick={() => handleCleanupOrphaned(true)}
                disabled={cleanupLoading}
              >
                Check for Orphaned Records (Dry Run)
              </Button>
              <Button 
                variant="contained" 
                color="error"
                onClick={() => handleCleanupOrphaned(false)}
                disabled={cleanupLoading || (cleanupResult ? cleanupResult.orphaned_count === 0 : false)}
              >
                Execute Cleanup
              </Button>
            </Box>

            <Box sx={{ mt: 4, pt: 2, borderTop: '1px solid #ddd' }}>
              <Typography variant="subtitle1" gutterBottom>Migration Script</Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                For more comprehensive cleanup including duplicate detection and data validation, 
                run the migration script from the backend:
              </Typography>
              <Paper sx={{ p: 2, bgcolor: 'grey.100', fontFamily: 'monospace', fontSize: '0.875rem' }}>
                cd backend<br />
                python migrate_ndt_validation.py --help<br />
                python migrate_ndt_validation.py --execute
              </Paper>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setCleanupDialogOpen(false);
            setCleanupResult(null);
          }}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar 
        open={snackbarOpen} 
        autoHideDuration={6000} 
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert 
          onClose={() => setSnackbarOpen(false)} 
          severity={snackbarSeverity}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default NDTStatus;
