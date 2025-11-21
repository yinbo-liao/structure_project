import React, { useEffect, useState } from 'react';
import { Container, Typography, Box, Paper, FormControl, InputLabel, Select, MenuItem, Alert } from '@mui/material';
import { useAuth } from '../../contexts/AuthContext';
import ApiService from '../../services/api';

const AuditLogs: React.FC = () => {
  const { user } = useAuth();
  const [dates, setDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [content, setContent] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadDates = async () => {
      try {
        const ds = await ApiService.getAuditLogDates();
        setDates(ds);
        if (ds.length > 0) {
          setSelectedDate(ds[ds.length - 1]);
        }
      } catch (e: any) {
        setError('Failed to load audit log dates');
      }
    };
    loadDates();
  }, []);

  useEffect(() => {
    const loadContent = async () => {
      if (!selectedDate) { setContent(''); return; }
      try {
        const text = await ApiService.getAuditLogByDate(selectedDate);
        setContent(text || '');
      } catch (e: any) {
        setError('Failed to load audit log');
      }
    };
    loadContent();
  }, [selectedDate]);

  if (!user || user.role !== 'admin') {
    return (
      <Container>
        <Alert severity="warning">Access restricted to admin users.</Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" gutterBottom>Audit Logs</Typography>
      <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
        Deleted changes grouped per day and entity. Latest day selected by default.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
      )}

      <Box sx={{ mb: 2 }}>
        <FormControl fullWidth>
          <InputLabel>Date</InputLabel>
          <Select
            label="Date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(String(e.target.value))}
          >
            {dates.map(d => (
              <MenuItem key={d} value={d}>{d}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      <Paper sx={{ p: 2 }}>
        <Box component="pre" sx={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '0.85rem' }}>
          {content || 'No entries'}
        </Box>
      </Paper>
    </Container>
  );
};

export default AuditLogs;