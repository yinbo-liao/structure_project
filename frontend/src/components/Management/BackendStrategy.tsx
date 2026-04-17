import React, { useEffect, useState } from 'react';
import {
  Container,
  Typography,
  Box,
  Paper,
  Alert,
  Grid,
  TextField,
  Button,
  Chip,
  CircularProgress,
  Divider
} from '@mui/material';
import { useAuth } from '../../contexts/AuthContext';
import ApiService from '../../services/api';
import {
  AIStrategyCapability,
  AIImplementationStrategyResponse
} from '../../types';

const splitLines = (value: string): string[] =>
  value
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);

const BackendStrategy: React.FC = () => {
  const { user } = useAuth();
  const [capabilities, setCapabilities] = useState<AIStrategyCapability[]>([]);
  const [plan, setPlan] = useState<AIImplementationStrategyResponse | null>(null);
  const [loadingCapabilities, setLoadingCapabilities] = useState(false);
  const [generatingPlan, setGeneratingPlan] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    focus_area: 'Structure Inspection Intelligence',
    desired_outputs: 'capability manifest\nimplementation roadmap\nbackend file plan',
    target_files: 'app/routes/ai.py\napp/routes/structure_inspections.py\napp/services/backend_strategy_service.py',
    constraints: 'reuse existing auth\nkeep FastAPI response schemas typed'
  });

  useEffect(() => {
    const loadCapabilities = async () => {
      try {
        setLoadingCapabilities(true);
        setError(null);
        const data = await ApiService.getAIStrategyCapabilities();
        setCapabilities(data);
      } catch (e: any) {
        setError(e?.response?.data?.detail || 'Failed to load backend strategy capabilities');
      } finally {
        setLoadingCapabilities(false);
      }
    };
    loadCapabilities();
  }, []);

  const handleGeneratePlan = async () => {
    try {
      setGeneratingPlan(true);
      setError(null);
      const response = await ApiService.getAIImplementationPlan({
        focus_area: form.focus_area.trim() || 'Backend Capability Strategy',
        desired_outputs: splitLines(form.desired_outputs),
        target_files: splitLines(form.target_files),
        constraints: splitLines(form.constraints)
      });
      setPlan(response);
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Failed to generate implementation plan');
    } finally {
      setGeneratingPlan(false);
    }
  };

  if (!user || user.role !== 'admin') {
    return (
      <Container>
        <Alert severity="warning">Access restricted to admin users.</Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" gutterBottom>
        Backend Strategy
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        View backend capability strategy and generate a local implementation plan from the new backend endpoints.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        <Grid item xs={12} lg={5}>
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Generate Implementation Plan
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Focus Area"
                  value={form.focus_area}
                  onChange={(e) => setForm((prev) => ({ ...prev, focus_area: e.target.value }))}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  minRows={4}
                  label="Desired Outputs"
                  helperText="One item per line"
                  value={form.desired_outputs}
                  onChange={(e) => setForm((prev) => ({ ...prev, desired_outputs: e.target.value }))}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  minRows={4}
                  label="Target Files"
                  helperText="One file per line"
                  value={form.target_files}
                  onChange={(e) => setForm((prev) => ({ ...prev, target_files: e.target.value }))}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  minRows={3}
                  label="Constraints"
                  helperText="One constraint per line"
                  value={form.constraints}
                  onChange={(e) => setForm((prev) => ({ ...prev, constraints: e.target.value }))}
                />
              </Grid>
              <Grid item xs={12}>
                <Button
                  variant="contained"
                  onClick={handleGeneratePlan}
                  disabled={generatingPlan}
                >
                  {generatingPlan ? 'Generating...' : 'Generate Plan'}
                </Button>
              </Grid>
            </Grid>
          </Paper>

          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Capability Catalog
            </Typography>
            {loadingCapabilities ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
              </Box>
            ) : (
              <Grid container spacing={2}>
                {capabilities.map((capability) => (
                  <Grid item xs={12} key={capability.key}>
                    <Paper variant="outlined" sx={{ p: 2 }}>
                      <Typography variant="subtitle1" fontWeight={600}>
                        {capability.title}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        {capability.summary}
                      </Typography>
                      <Typography variant="body2" sx={{ mb: 1 }}>
                        {capability.backend_support}
                      </Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1 }}>
                        {capability.deliverables.map((item) => (
                          <Chip key={item} label={item} size="small" color="primary" variant="outlined" />
                        ))}
                      </Box>
                      <Typography variant="caption" color="text.secondary">
                        Suggested files: {capability.suggested_files.join(', ')}
                      </Typography>
                    </Paper>
                  </Grid>
                ))}
              </Grid>
            )}
          </Paper>
        </Grid>

        <Grid item xs={12} lg={7}>
          <Paper sx={{ p: 3, minHeight: 600 }}>
            <Typography variant="h6" gutterBottom>
              Generated Plan
            </Typography>
            {!plan ? (
              <Alert severity="info">Generate a plan to view the backend implementation roadmap.</Alert>
            ) : (
              <Box>
                <Typography variant="h5" gutterBottom>{plan.title}</Typography>
                <Typography variant="body1" sx={{ mb: 2 }}>{plan.overview}</Typography>

                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle1" fontWeight={600}>Desired Outputs</Typography>
                <Box component="ul" sx={{ mt: 1, mb: 2 }}>
                  {plan.desired_outputs.map((item) => (
                    <li key={item}><Typography variant="body2">{item}</Typography></li>
                  ))}
                </Box>

                <Typography variant="subtitle1" fontWeight={600}>Constraints</Typography>
                <Box component="ul" sx={{ mt: 1, mb: 2 }}>
                  {plan.constraints.map((item) => (
                    <li key={item}><Typography variant="body2">{item}</Typography></li>
                  ))}
                </Box>

                <Typography variant="subtitle1" fontWeight={600}>Implementation Steps</Typography>
                <Box component="ol" sx={{ mt: 1, mb: 2 }}>
                  {plan.implementation_steps.map((item) => (
                    <li key={item}><Typography variant="body2">{item}</Typography></li>
                  ))}
                </Box>

                <Typography variant="subtitle1" fontWeight={600}>Backend File Plan</Typography>
                <Grid container spacing={2} sx={{ mt: 1 }}>
                  {plan.backend_file_plan.map((item) => (
                    <Grid item xs={12} md={6} key={item.file}>
                      <Paper variant="outlined" sx={{ p: 2 }}>
                        <Typography variant="body2" fontWeight={600}>{item.file}</Typography>
                        <Typography variant="body2" color="text.secondary">{item.purpose}</Typography>
                      </Paper>
                    </Grid>
                  ))}
                </Grid>

                <Typography variant="subtitle1" fontWeight={600} sx={{ mt: 3 }}>Target Files</Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
                  {plan.target_files.map((item) => (
                    <Chip key={item} label={item} size="small" />
                  ))}
                </Box>
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
};

export default BackendStrategy;
