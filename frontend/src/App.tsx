import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout/Layout';
import Login from './components/Auth/Login';
import ProjectSelection from './components/ProjectSelection/ProjectSelection';
import Dashboard from './components/Dashboard/Dashboard';
import MaterialRegister from './components/Inspection/MaterialRegister';
import StructureFitUpInspection from './components/Inspection/StructureFitUpInspection';
import StructureFinalInspection from './components/Inspection/StructureFinalInspection';
import NDTRequests from './components/Inspection/NDTRequests';
import NDTStatus from './components/Inspection/NDTStatus';
import MasterJointList from './components/Inspection/masterjointlist';
import WPSRegister from './components/Inspection/WPSRegister';
import WelderRegister from './components/Inspection/WelderRegister';
import UserManagement from './components/Management/UserManagement';
import ProjectManagement from './components/Management/ProjectManagement';
import AuditLogs from './components/Management/AuditLogs';
import LoadingScreen from './components/Common/LoadingScreen';

// Create Material-UI theme
const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
    background: {
      default: '#f5f5f5',
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
        },
      },
    },
  },
});

// Protected Route Component
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

// Project Required Route Component
const ProjectRequiredRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { selectedProject, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!selectedProject) {
    return <Navigate to="/projects" replace />;
  }

  return <>{children}</>;
};

const AppContent: React.FC = () => {
  return (
    <Router>
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<Login />} />
        
        {/* Protected Routes */}
        <Route path="/" element={
          <ProtectedRoute>
            <Layout>
              <Navigate to="/projects" replace />
            </Layout>
          </ProtectedRoute>
        } />
        
        <Route path="/projects" element={
          <ProtectedRoute>
            <Layout>
              <ProjectSelection />
            </Layout>
          </ProtectedRoute>
        } />
        
        <Route path="/dashboard" element={
          <ProtectedRoute>
            <Layout>
              <ProjectRequiredRoute>
                <Dashboard />
              </ProjectRequiredRoute>
            </Layout>
          </ProtectedRoute>
        } />
        
        {/* Inspection Routes - Legacy (for backward compatibility) */}
        <Route path="/material-register" element={
          <ProtectedRoute>
            <Layout>
              <ProjectRequiredRoute>
                <MaterialRegister />
              </ProjectRequiredRoute>
            </Layout>
          </ProtectedRoute>
        } />
        
        {/* Structure Project Routes */}
        <Route path="/structureproject/dashboard" element={
          <ProtectedRoute>
            <Layout>
              <ProjectRequiredRoute>
                <Dashboard />
              </ProjectRequiredRoute>
            </Layout>
          </ProtectedRoute>
        } />
        
        <Route path="/structureproject/material-register" element={
          <ProtectedRoute>
            <Layout>
              <ProjectRequiredRoute>
                <MaterialRegister />
              </ProjectRequiredRoute>
            </Layout>
          </ProtectedRoute>
        } />
        
        <Route path="/structureproject/fitup-inspection" element={
          <ProtectedRoute>
            <Layout>
              <ProjectRequiredRoute>
                <StructureFitUpInspection />
              </ProjectRequiredRoute>
            </Layout>
          </ProtectedRoute>
        } />

        <Route path="/structureproject/master-joint-list" element={
          <ProtectedRoute>
            <Layout>
              <ProjectRequiredRoute>
                <MasterJointList />
              </ProjectRequiredRoute>
            </Layout>
          </ProtectedRoute>
        } />
        
        <Route path="/structureproject/final-inspection" element={
          <ProtectedRoute>
            <Layout>
              <ProjectRequiredRoute>
                <StructureFinalInspection />
              </ProjectRequiredRoute>
            </Layout>
          </ProtectedRoute>
        } />
        
        <Route path="/structureproject/ndt-requests" element={
          <ProtectedRoute>
            <Layout>
              <ProjectRequiredRoute>
                <NDTRequests />
              </ProjectRequiredRoute>
            </Layout>
          </ProtectedRoute>
        } />

        <Route path="/structureproject/ndt-status" element={
          <ProtectedRoute>
            <Layout>
              <ProjectRequiredRoute>
                <NDTStatus />
              </ProjectRequiredRoute>
            </Layout>
          </ProtectedRoute>
        } />

        <Route path="/structureproject/wps-register" element={
          <ProtectedRoute>
            <Layout>
              <ProjectRequiredRoute>
                <WPSRegister />
              </ProjectRequiredRoute>
            </Layout>
          </ProtectedRoute>
        } />

        <Route path="/structureproject/welder-register" element={
          <ProtectedRoute>
            <Layout>
              <ProjectRequiredRoute>
                <WelderRegister />
              </ProjectRequiredRoute>
            </Layout>
          </ProtectedRoute>
        } />
        
        {/* Management Routes - Admin Only */}
        <Route path="/user-management" element={
          <ProtectedRoute>
            <Layout>
              <UserManagement />
            </Layout>
          </ProtectedRoute>
        } />
        
        <Route path="/project-management" element={
          <ProtectedRoute>
            <Layout>
              <ProjectManagement />
            </Layout>
          </ProtectedRoute>
        } />
        
        <Route path="/audit-logs" element={
          <ProtectedRoute>
            <Layout>
              <AuditLogs />
            </Layout>
          </ProtectedRoute>
        } />
        
        {/* Catch all route */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
};

const App: React.FC = () => {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;
