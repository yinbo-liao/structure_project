import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Fab,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { Chat, Close, Search, Send } from '@mui/icons-material';
import ApiService from '../../services/api';
import {
  AIAssistantMetrics,
  AICitation,
  AIFinding,
  AIQualityScan,
  AISeverity,
} from '../../types';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  citations?: AICitation[];
  findings?: AIFinding[];
}

const GREETING: ChatMessage = {
  role: 'assistant',
  content:
    'Hi! I am your Project AI Assistant. Ask about joints, welders, WPS, drawings, or NDT records, or ask me to check for typos and mismatches.',
};

function getErrorMessage(error: unknown): string {
  const detail = (error as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((item) => (item as { msg?: string })?.msg ?? String(item))
      .join('; ');
  }
  return (error as Error)?.message || 'Sorry, I could not reach the assistant.';
}

function readStoredConversation(key: string): number | null {
  try {
    const value = localStorage.getItem(key);
    const parsed = value ? Number(value) : NaN;
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  } catch {
    return null;
  }
}

function writeStoredConversation(key: string, conversationId: number | null): void {
  try {
    if (conversationId) {
      localStorage.setItem(key, String(conversationId));
    } else {
      localStorage.removeItem(key);
    }
  } catch {
    // Storage may be unavailable (private mode); the chat still works.
  }
}

const severityColor = (severity: AISeverity): 'error' | 'warning' | 'default' =>
  severity === 'high' ? 'error' : severity === 'medium' ? 'warning' : 'default';

export default function ProjectChatAgent({
  projectId,
}: {
  projectId: number;
  projectSummaryData?: unknown;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [metrics, setMetrics] = useState<AIAssistantMetrics | null>(null);
  const [dialogFindings, setDialogFindings] = useState<AIFinding[] | null>(null);
  const [dialogTitle, setDialogTitle] = useState('Data quality findings');
  const [severityFilter, setSeverityFilter] = useState<'all' | AISeverity>('all');
  const [scan, setScan] = useState<AIQualityScan | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const messagesEndRef = useRef<null | HTMLDivElement>(null);
  const sendingRef = useRef(false);
  const storageKey = `ai-conversation-${projectId}`;

  useEffect(() => {
    setIsOpen(false);
    setConversationId(null);
    setMessages([GREETING]);
    setMetrics(null);
    setScan(null);
    setScanError(null);
    setDialogFindings(null);
  }, [projectId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!isOpen || conversationId) return;
    const stored = readStoredConversation(storageKey);
    if (!stored) return;
    let cancelled = false;
    ApiService.getConversation(projectId, stored)
      .then((detail) => {
        if (cancelled) return;
        setConversationId(detail.id);
        if (detail.messages.length > 0) {
          setMessages(detail.messages.map((message) => ({
            role: message.role,
            content: message.content,
            citations: message.citations || [],
            findings: message.findings || [],
          })));
        }
      })
      .catch(() => {
        if (!cancelled) {
          writeStoredConversation(storageKey, null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, conversationId, projectId, storageKey]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || !projectId || sendingRef.current) return;

    sendingRef.current = true;
    setLoading(true);
    setInput('');
    setMessages((previous) => [...previous, { role: 'user', content: text }]);

    try {
      const response = await ApiService.sendAssistantMessage(projectId, text, conversationId);
      setConversationId(response.conversation_id);
      writeStoredConversation(storageKey, response.conversation_id);
      setMetrics(response.metrics);
      setMessages((previous) => [
        ...previous,
        {
          role: 'assistant',
          content: response.message?.content || 'No response received.',
          citations: response.citations || [],
          findings: response.findings || [],
        },
      ]);
    } catch (error) {
      const status = (error as { response?: { status?: number } })?.response?.status;
      if (status === 404 && conversationId) {
        setConversationId(null);
        writeStoredConversation(storageKey, null);
      }
      setMessages((previous) => [
        ...previous,
        { role: 'assistant', content: getErrorMessage(error) },
      ]);
    } finally {
      sendingRef.current = false;
      setLoading(false);
    }
  };

  const handleScan = async () => {
    if (!projectId || scanning) return;
    setScanning(true);
    setScanError(null);
    try {
      const result = await ApiService.scanDataQuality(projectId, { limit: 200 });
      setScan(result);
      setDialogTitle(`Data quality scan (${result.total_findings} findings)`);
      setDialogFindings(result.findings);
      setSeverityFilter('all');
    } catch (error) {
      setScanError(getErrorMessage(error));
    } finally {
      setScanning(false);
    }
  };

  const filteredFindings = (dialogFindings || []).filter(
    (finding) => severityFilter === 'all' || finding.severity === severityFilter
  );

  return (
    <>
      <Fab
        color="primary"
        aria-label={isOpen ? 'Close AI assistant' : 'Open AI assistant'}
        onClick={() => setIsOpen((open) => !open)}
        sx={{ position: 'fixed', bottom: 24, right: 24, zIndex: 1000 }}
      >
        {isOpen ? <Close /> : <Chat />}
      </Fab>

      {isOpen && (
        <Paper
          elevation={6}
          sx={{
            position: 'fixed', bottom: 90, right: 24, zIndex: 1000,
            width: { xs: 'calc(100vw - 48px)', sm: 380 }, height: 540,
            maxHeight: 'calc(100vh - 120px)',
            display: 'flex', flexDirection: 'column',
            overflow: 'hidden', borderRadius: 2,
          }}
        >
          <Box sx={{ bgcolor: 'primary.main', color: 'white', p: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="h6" fontSize="1rem" sx={{ flex: 1 }}>
              Project AI Assistant
            </Typography>
            <Button
              size="small"
              color="inherit"
              startIcon={scanning ? <CircularProgress size={14} color="inherit" /> : <Search />}
              onClick={handleScan}
              disabled={scanning || loading}
              aria-label="Scan records for typos and mismatches"
            >
              Scan
            </Button>
          </Box>

          {scan && (
            <Alert
              severity={scan.by_severity.high > 0 ? 'warning' : 'success'}
              sx={{ borderRadius: 0 }}
              action={
                scan.findings.length > 0 ? (
                  <Button
                    color="inherit"
                    size="small"
                    onClick={() => {
                      setDialogTitle(`Data quality scan (${scan.total_findings} findings)`);
                      setDialogFindings(scan.findings);
                      setSeverityFilter('all');
                    }}
                  >
                    View
                  </Button>
                ) : undefined
              }
            >
              Scan: {scan.by_severity.high} high, {scan.by_severity.medium} medium, {scan.by_severity.low} low
            </Alert>
          )}
          {scanError && <Alert severity="error" sx={{ borderRadius: 0 }}>{scanError}</Alert>}

          {metrics && (metrics.fallback || metrics.degraded) && (
            <Alert severity="info" sx={{ borderRadius: 0 }}>
              AI is running without a live model; answers use deterministic record checks.
            </Alert>
          )}

          <Box sx={{ flex: 1, overflowY: 'auto', p: 2, display: 'flex', flexDirection: 'column', gap: 1, bgcolor: '#f5f5f5' }}>
            {messages.map((message, index) => (
              <Box
                key={`${message.role}-${index}`}
                sx={{ alignSelf: message.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%' }}
              >
                <Paper
                  sx={{
                    p: 1.5,
                    bgcolor: message.role === 'user' ? 'primary.light' : 'white',
                    color: message.role === 'user' ? 'white' : 'text.primary',
                    borderRadius: 2,
                  }}
                >
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{message.content}</Typography>
                </Paper>
                {!!message.citations?.length && (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                    {message.citations.map((citation) => (
                      <Tooltip key={citation.citation_id} title={citation.excerpt || citation.citation_id}>
                        <Chip size="small" variant="outlined" label={citation.label} />
                      </Tooltip>
                    ))}
                  </Box>
                )}
                {!!message.findings?.length && (
                  <Chip
                    size="small"
                    color="warning"
                    sx={{ mt: 0.5 }}
                    label={`${message.findings.length} finding${message.findings.length === 1 ? '' : 's'}`}
                    onClick={() => {
                      setDialogTitle('Assistant findings');
                      setDialogFindings(message.findings || []);
                      setSeverityFilter('all');
                    }}
                  />
                )}
              </Box>
            ))}
            {loading && <CircularProgress size={20} sx={{ alignSelf: 'flex-start', ml: 1 }} />}
            <div ref={messagesEndRef} />
          </Box>

          <Box sx={{ p: 1, bgcolor: 'white', borderTop: '1px solid #e0e0e0', display: 'flex', alignItems: 'center' }}>
            <TextField
              fullWidth
              size="small"
              variant="outlined"
              placeholder="Ask about this project..."
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  handleSend();
                }
              }}
              inputProps={{ 'aria-label': 'Message the project assistant' }}
            />
            <IconButton
              color="primary"
              onClick={handleSend}
              disabled={loading || !input.trim()}
              aria-label="Send message"
            >
              <Send />
            </IconButton>
          </Box>
        </Paper>
      )}

      <Dialog open={!!dialogFindings} onClose={() => setDialogFindings(null)} maxWidth="md" fullWidth>
        <DialogTitle>{dialogTitle}</DialogTitle>
        <DialogContent dividers>
          <FormControl size="small" sx={{ mb: 2, minWidth: 160 }}>
            <InputLabel id="finding-severity-label">Severity</InputLabel>
            <Select
              labelId="finding-severity-label"
              label="Severity"
              value={severityFilter}
              onChange={(event) => setSeverityFilter(event.target.value as 'all' | AISeverity)}
            >
              <MenuItem value="all">All</MenuItem>
              <MenuItem value="high">High</MenuItem>
              <MenuItem value="medium">Medium</MenuItem>
              <MenuItem value="low">Low</MenuItem>
            </Select>
          </FormControl>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Severity</TableCell>
                <TableCell>Record</TableCell>
                <TableCell>Field</TableCell>
                <TableCell>Value</TableCell>
                <TableCell>Suggestion</TableCell>
                <TableCell align="right">Confidence</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredFindings.map((finding) => (
                <TableRow key={finding.id}>
                  <TableCell>
                    <Chip size="small" color={severityColor(finding.severity)} label={finding.severity} />
                  </TableCell>
                  <TableCell>{finding.entity} #{finding.record_id}</TableCell>
                  <TableCell>{finding.field}</TableCell>
                  <TableCell>{finding.value || '—'}</TableCell>
                  <TableCell>{finding.suggestion || '—'}</TableCell>
                  <TableCell align="right">{Math.round((finding.confidence || 0) * 100)}%</TableCell>
                </TableRow>
              ))}
              {filteredFindings.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} align="center">No findings at this severity.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogFindings(null)}>Close</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
