import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Container,
  Paper,
  LinearProgress,
  Chip,
  IconButton,
  Tooltip,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody
} from '@mui/material';
import {
  Engineering,
  Inventory,
  Assignment,
  Checklist,
  Assessment,
  RequestQuote,
  TrendingUp,
  AutoAwesome,
  Refresh
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { ProjectSummary } from '../../types';
import ApiService from '../../services/api';

// Utility function to format percentages with 2 decimal places
const formatPercentage = (value: number, decimals: number = 2): string => {
  return value.toFixed(decimals);
};

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  color: 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info';
  trend?: number;
}

const KPICard: React.FC<KPICardProps> = ({ title, value, subtitle, icon, color, trend }) => {
  return (
    <Card sx={{ height: '100%', position: 'relative' }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Box sx={{ color: `${color}.main` }}>
            {icon}
          </Box>
          {trend !== undefined && (
            <Chip
              size="small"
              label={`${trend > 0 ? '+' : ''}${formatPercentage(trend)}%`}
              color={trend > 0 ? 'success' : trend < 0 ? 'error' : 'default'}
              variant="outlined"
            />
          )}
        </Box>
        <Typography variant="h4" component="div" fontWeight="bold" gutterBottom>
          {value}
        </Typography>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          {title}
        </Typography>
        {subtitle && (
          <Typography variant="caption" color="text.secondary">
            {subtitle}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
};

const Dashboard: React.FC = () => {
  const { selectedProject } = useAuth();
  const [summary, setSummary] = useState<ProjectSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  useEffect(() => {
    if (selectedProject) {
      fetchProjectSummary();
    }
  }, [selectedProject]);

  useEffect(() => {
    if (!selectedProject) return;
    const id = setInterval(() => {
      fetchProjectSummary();
    }, 10000);
    return () => clearInterval(id);
  }, [selectedProject]);

  const fetchProjectSummary = async () => {
    if (!selectedProject) return;

    try {
      setLoading(true);
      const data = await ApiService.getProjectSummary(selectedProject.id);
      setSummary(data);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error fetching project summary:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    fetchProjectSummary();
  };

  if (!selectedProject) {
    return (
      <Container maxWidth="lg">
        <Box sx={{ textAlign: 'center', mt: 8 }}>
          <Engineering sx={{ fontSize: 80, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" gutterBottom>
            No Project Selected
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Please select a project to view the dashboard.
          </Typography>
        </Box>
      </Container>
    );
  }

  if (loading && !summary) {
    return (
      <Container maxWidth="lg">
        <Box sx={{ mt: 4 }}>
          <LinearProgress />
          <Typography variant="body2" sx={{ mt: 2, textAlign: 'center' }}>
            Loading dashboard...
          </Typography>
        </Box>
      </Container>
    );
  }

  const fitupProgress = summary ? (summary.fitup_done / summary.total_joints) * 100 : 0;
  const finalProgress = summary ? (summary.final_done / summary.total_joints) * 100 : 0;

  return (
    <Container maxWidth="xl">
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Box>
            <Typography variant="h4" component="h1" gutterBottom>
              Project Dashboard
            </Typography>
            <Typography variant="subtitle1" color="text.secondary">
              {selectedProject.name} ({selectedProject.code})
            </Typography>
          </Box>
          <Tooltip title="Refresh Dashboard">
            <IconButton onClick={handleRefresh} disabled={loading}>
              <Refresh />
            </IconButton>
          </Tooltip>
        </Box>
        
        <Typography variant="caption" color="text.secondary">
          Last updated: {lastUpdated.toLocaleString()}
        </Typography>
      </Box>

      {/* Key Performance Indicators - Optimized for PC */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3} lg={2.4}>
          <KPICard
            title="Total Joints"
            value={summary?.total_joints || 0}
            icon={<Assignment sx={{ fontSize: 36 }} />}
            color="primary"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3} lg={2.4}>
          <KPICard
            title="Fit-up Done"
            value={summary?.fitup_done || 0}
            subtitle={`${formatPercentage(fitupProgress)}%`}
            icon={<Assignment sx={{ fontSize: 36 }} />}
            color="success"
            trend={fitupProgress}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3} lg={2.4}>
          <KPICard
            title="Final Done"
            value={summary?.final_done || 0}
            subtitle={`${formatPercentage(finalProgress)}%`}
            icon={<Checklist sx={{ fontSize: 36 }} />}
            color="info"
            trend={finalProgress}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3} lg={2.4}>
          <KPICard
            title="Material Used"
            value={summary?.material_used || 0}
            subtitle={`${summary?.material_inspected || 0} inspected`}
            icon={<Inventory sx={{ fontSize: 36 }} />}
            color="warning"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3} lg={2.4}>
          <KPICard
            title="NDT Requests"
            value={summary?.ndt_requests_total || 0}
            subtitle={`${summary?.ndt_requests_pending || 0} pending`}
            icon={<RequestQuote sx={{ fontSize: 36 }} />}
            color="secondary"
          />
        </Grid>
      </Grid>

      {/* Progress Overview - Side by side for PC */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Typography variant="h6" gutterBottom>
              Project Progress Overview
            </Typography>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Box sx={{ mb: 3 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      Fit-up Progress
                    </Typography>
                    <Typography variant="body2" fontWeight="bold">
                      {formatPercentage(fitupProgress)}%
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={fitupProgress}
                    color="primary"
                    sx={{ height: 10, borderRadius: 5 }}
                  />
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                    {summary?.fitup_done || 0} of {summary?.total_joints || 0} joints
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} md={6}>
                <Box sx={{ mb: 3 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      Final Inspection Progress
                    </Typography>
                    <Typography variant="body2" fontWeight="bold">
                      {formatPercentage(finalProgress)}%
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={finalProgress}
                    color="secondary"
                    sx={{ height: 10, borderRadius: 5 }}
                  />
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                    {summary?.final_done || 0} of {summary?.total_joints || 0} joints
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} md={6}>
                <Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      Material Inspection
                    </Typography>
                    <Typography variant="body2" fontWeight="bold">
                      {summary?.material_inspected || 0} / {summary?.material_used || 0}
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={summary?.material_used ? ((summary?.material_inspected || 0) / summary.material_used) * 100 : 0}
                    color="warning"
                    sx={{ height: 10, borderRadius: 5 }}
                  />
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                    {summary?.material_pending_inspection || 0} pending inspection
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} md={6}>
                <Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      NDT Completion
                    </Typography>
                    <Typography variant="body2" fontWeight="bold">
                      {summary?.ndt_done || 0} / {summary?.ndt_requests_total || 0}
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={summary?.ndt_requests_total ? ((summary?.ndt_done || 0) / summary.ndt_requests_total) * 100 : 0}
                    color="info"
                    sx={{ height: 10, borderRadius: 5 }}
                  />
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                    {summary?.ndt_outstanding || 0} outstanding
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </Paper>
        </Grid>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Typography variant="h6" gutterBottom>
              Quick Stats
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Material Rejected
                </Typography>
                <Typography variant="h5" color="error.main" fontWeight="bold">
                  {summary?.material_rejected || 0}
                </Typography>
              </Box>
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Missing from Fit-up
                </Typography>
                <Typography variant="h5" color="warning.main" fontWeight="bold">
                  {summary?.material_missing_from_fitup || 0}
                </Typography>
              </Box>
              <Box>
                <Typography variant="body2" color="text.secondary">
                  NDT Approved
                </Typography>
                <Typography variant="h5" color="success.main" fontWeight="bold">
                  {summary?.ndt_requests_approved || 0}
                </Typography>
              </Box>
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Project Type
                </Typography>
                <Typography variant="h6" color="primary.main" fontWeight="bold">
                  {selectedProject?.project_type === 'structure' ? 'Structure' : 'Pipe'}
                </Typography>
              </Box>
            </Box>
          </Paper>
        </Grid>
      </Grid>

      {/* Detailed Statistics - Optimized for PC with 2x2 grid */}
      <Grid container spacing={3}>
        {/* Material Management */}
        <Grid item xs={12} lg={6}>
          <Card sx={{ height: '100%', boxShadow: 2 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                <Inventory sx={{ mr: 1.5, color: 'warning.main', fontSize: 28 }} />
                <Typography variant="h6" fontWeight="600">
                  Material Management
                </Typography>
              </Box>
              <Grid container spacing={3}>
                <Grid item xs={6} sm={3}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Used
                    </Typography>
                    <Typography variant="h4" fontWeight="bold" color="warning.main">
                      {summary?.material_used || 0}
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Inspected
                    </Typography>
                    <Typography variant="h4" fontWeight="bold" color="success.main">
                      {summary?.material_inspected || 0}
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Pending
                    </Typography>
                    <Typography variant="h4" fontWeight="bold" color="error.main">
                      {summary?.material_pending_inspection || 0}
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Rejected
                    </Typography>
                    <Typography variant="h4" fontWeight="bold" color="error.main">
                      {summary?.material_rejected || 0}
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12}>
                  <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      Missing from Fit-up: <Typography component="span" variant="body2" fontWeight="bold" color="warning.main">{summary?.material_missing_from_fitup || 0}</Typography>
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* NDT Requests */}
        <Grid item xs={12} lg={6}>
          <Card sx={{ height: '100%', boxShadow: 2 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                <RequestQuote sx={{ mr: 1.5, color: 'info.main', fontSize: 28 }} />
                <Typography variant="h6" fontWeight="600">
                  NDT Management
                </Typography>
              </Box>
              <Grid container spacing={3}>
                <Grid item xs={6} sm={3}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Total
                    </Typography>
                    <Typography variant="h4" fontWeight="bold" color="info.main">
                      {summary?.ndt_requests_total || 0}
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Pending
                    </Typography>
                    <Typography variant="h4" fontWeight="bold" color="warning.main">
                      {summary?.ndt_requests_pending || 0}
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Approved
                    </Typography>
                    <Typography variant="h4" fontWeight="bold" color="success.main">
                      {summary?.ndt_requests_approved || 0}
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Done
                    </Typography>
                    <Typography variant="h4" fontWeight="bold" color="primary.main">
                      {summary?.ndt_done || 0}
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12}>
                  <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      Outstanding: <Typography component="span" variant="body2" fontWeight="bold" color="warning.main">{summary?.ndt_outstanding || 0}</Typography>
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Weld Quality */}
        <Grid item xs={12} lg={6}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <TrendingUp sx={{ mr: 1, color: 'success.main' }} />
                <Typography variant="h6">
                  Weld Quality
                </Typography>
              </Box>
              <Grid container spacing={2}>
                {(() => {
                  const src = summary?.ndt_weld_lengths_by_method || {} as any;
                  const calc = (methods: string[]) => {
                    const tested = methods.reduce((s, m) => s + (src[m]?.tested_mm ?? ((src[m]?.accepted_mm || 0) + (src[m]?.rejected_mm || 0))), 0);
                    const rej = methods.reduce((s, m) => s + ((src[m]?.rejected_mm) || 0), 0);
                    const acc = Math.max(tested - rej, 0);
                    const rate = tested > 0 ? (acc / tested) * 100 : 0;
                    return { acc, rej, tested, rate };
                  };
                  const g1 = calc(['RT','UT']);
                  const g2 = calc(['PT','MPI']);
                  return (
                    <>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="body2" color="text.secondary">
                          RT/UT Accept Length
                        </Typography>
                        <Typography variant="h5" fontWeight="bold" color="success.main">
                          {g1.acc.toFixed(1)} mm
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Total test length (mm): {g1.tested.toFixed(1)}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                          RT/UT Reject Length
                        </Typography>
                        <Typography variant="h6" fontWeight="bold" color="error.main">
                          {g1.rej.toFixed(1)} mm
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                          RT/UT Success Rate
                        </Typography>
                        <Typography variant="h5" fontWeight="bold" color="primary">
                          {formatPercentage(g1.rate)}%
                        </Typography>
                        <LinearProgress
                          variant="determinate"
                          value={g1.rate}
                          color={g1.rate >= 95 ? 'success' : g1.rate >= 90 ? 'warning' : 'error'}
                          sx={{ mt: 1, height: 8, borderRadius: 4 }}
                        />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="body2" color="text.secondary">
                          PT/MPI Accept Length
                        </Typography>
                        <Typography variant="h5" fontWeight="bold" color="success.main">
                          {g2.acc.toFixed(1)} mm
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Total test length (mm): {g2.tested.toFixed(1)}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                          PT/MPI Reject Length
                        </Typography>
                        <Typography variant="h6" fontWeight="bold" color="error.main">
                          {g2.rej.toFixed(1)} mm
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                          PT/MPI Success Rate
                        </Typography>
                        <Typography variant="h5" fontWeight="bold" color="primary">
                          {formatPercentage(g2.rate)}%
                        </Typography>
                        <LinearProgress
                          variant="determinate"
                          value={g2.rate}
                          color={g2.rate >= 95 ? 'success' : g2.rate >= 90 ? 'warning' : 'error'}
                          sx={{ mt: 1, height: 8, borderRadius: 4 }}
                        />
                      </Grid>
                    </>
                  );
                })()}
              </Grid>

              <Box sx={{ mt: 3 }}>
                <Typography variant="subtitle1" sx={{ mb: 1 }}>
                  Weld Quality Summary (Grouped)
                </Typography>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell><strong>Group</strong></TableCell>
                      <TableCell align="right"><strong>Total test length (mm)</strong></TableCell>
                      <TableCell align="right"><strong>Rejected (mm)</strong></TableCell>
                      <TableCell align="right"><strong>Total (mm)</strong></TableCell>
                      <TableCell align="right"><strong>Reject Rate</strong></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(() => {
                      const src = summary?.ndt_weld_lengths_by_method || {} as any;
                      const calc = (methods: string[]) => {
                        const tested = methods.reduce((s, m) => s + (src[m]?.tested_mm ?? ((src[m]?.accepted_mm || 0) + (src[m]?.rejected_mm || 0))), 0);
                        const rej = methods.reduce((s, m) => s + ((src[m]?.rejected_mm) || 0), 0);
                        const tot = tested;
                        const rate = tot > 0 ? (rej / tot) * 100 : 0;
                        return { tested, rej, tot, rate };
                      };
                      const g1 = calc(['RT','UT']);
                      const g2 = calc(['PT','MPI']);
                      return (
                        <>
                          <TableRow>
                            <TableCell>RT + UT</TableCell>
                            <TableCell align="right">{g1.tested.toFixed(1)}</TableCell>
                            <TableCell align="right">{g1.rej.toFixed(1)}</TableCell>
                            <TableCell align="right">{g1.tot.toFixed(1)}</TableCell>
                            <TableCell align="right">{formatPercentage(g1.rate)}%</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>PT + MPI</TableCell>
                            <TableCell align="right">{g2.tested.toFixed(1)}</TableCell>
                            <TableCell align="right">{g2.rej.toFixed(1)}</TableCell>
                            <TableCell align="right">{g2.tot.toFixed(1)}</TableCell>
                            <TableCell align="right">{formatPercentage(g2.rate)}%</TableCell>
                          </TableRow>
                        </>
                      );
                    })()}
                  </TableBody>
                </Table>
              </Box>

              

              <Box sx={{ mt: 4 }}>
                <Typography variant="subtitle1" sx={{ mb: 1 }}>
                  FT & PMI Results (by joints)
                </Typography>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell><strong>Method</strong></TableCell>
                      <TableCell align="right"><strong>Accepted (joints)</strong></TableCell>
                      <TableCell align="right"><strong>Rejected (joints)</strong></TableCell>
                      <TableCell align="right"><strong>Reject Rate</strong></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(['FT', 'PMI'] as const).map((m) => {
                      const counts = summary?.ndt_joint_counts_by_method?.[m];
                      const acc = counts?.accepted_joints || 0;
                      const rej = counts?.rejected_joints || 0;
                      const tot = acc + rej;
                      const rate = tot > 0 ? (rej / tot) * 100 : 0;
                      return (
                        <TableRow key={m}>
                          <TableCell>{m}</TableCell>
                          <TableCell align="right">{acc}</TableCell>
                          <TableCell align="right">{rej}</TableCell>
                          <TableCell align="right">{formatPercentage(rate)}%</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Welder Performance */}
        <Grid item xs={12} lg={6}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Assessment sx={{ mr: 1, color: 'secondary.main' }} />
                <Typography variant="h6">
                  Welder Performance (Top 10 Reject Rate)
                </Typography>
              </Box>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell><strong>Welder</strong></TableCell>
                    <TableCell align="right"><strong>Tested (mm)</strong></TableCell>
                    <TableCell align="right"><strong>Rejected (mm)</strong></TableCell>
                    <TableCell align="right"><strong>Reject Rate</strong></TableCell>
                    <TableCell align="right"><strong>Status</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {summary?.welder_performance_top10?.map((w) => (
                    <TableRow key={w.welder_no}>
                      <TableCell>{w.welder_no}</TableCell>
                      <TableCell align="right">{(w.total_mm || 0).toFixed(1)}</TableCell>
                      <TableCell align="right">{(w.rejected_mm || 0).toFixed(1)}</TableCell>
                      <TableCell align="right">{formatPercentage(w.reject_rate)}%</TableCell>
                      <TableCell align="right">
                        {w.retrain ? (
                          <Chip label="Retrain" color="error" size="small" />
                        ) : (
                          <Chip label="OK" color="success" size="small" />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!summary?.welder_performance_top10 || summary.welder_performance_top10.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={5}>
                        <Typography variant="body2" color="text.secondary" textAlign="center">No welder data available</Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* AI Insights Section */}
      <Box sx={{ mt: 4 }}>
        <Paper sx={{ p: 3, bgcolor: 'primary.light', color: 'primary.contrastText' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <AutoAwesome sx={{ mr: 1 }} />
            <Typography variant="h6">
              AI Insights & Recommendations
            </Typography>
          </Box>
          <Typography variant="body2">
            Real-time analysis of project performance with automated insights and recommendations for improvement.
          </Typography>
          <Typography variant="caption" sx={{ opacity: 0.8 }}>
            This feature will be available with Qwen AI integration.
          </Typography>
        </Paper>
      </Box>
    </Container>
  );
};

export default Dashboard;
