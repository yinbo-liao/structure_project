import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { User, Project, AuthContextType } from '../types';
import ApiService from '../services/api';
import PasswordChangeDialog from '../components/Auth/PasswordChangeDialog';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [showPasswordChangeDialog, setShowPasswordChangeDialog] = useState(false);

  useEffect(() => {
    // Check for stored token and validate on app start
    const initializeAuth = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const response = await ApiService.verifyToken();
          if (response.valid && response.user) {
            setUser(response.user);
          }
        } catch (error) {
          console.error('Token verification failed:', error);
          localStorage.removeItem('token');
        }
      }
      setLoading(false);
    };

    initializeAuth();
  }, []);

  useEffect(() => {
    // Load selected project from localStorage
    const storedProject = localStorage.getItem('selectedProject');
    if (storedProject && user) {
      try {
        const project = JSON.parse(storedProject);
        // Verify user has access to this project
        const hasAccess = user.assigned_projects.some(p => p.id === project.id) || user.role === 'admin';
        if (hasAccess) {
          setSelectedProject(project);
        } else {
          localStorage.removeItem('selectedProject');
        }
      } catch (error) {
        console.error('Failed to parse stored project:', error);
        localStorage.removeItem('selectedProject');
      }
    }
  }, [user]);

  const login = async (email: string, password: string): Promise<void> => {
    try {
      const response = await ApiService.login({ username: email, password });
      const { access_token, user: userData } = response;
      
      localStorage.setItem('token', access_token);
      setUser(userData);
      
      // Clear any existing project selection
      setSelectedProject(null);
      localStorage.removeItem('selectedProject');
      
      // Check if password change is required
      if (userData.password_change_required) {
        setShowPasswordChangeDialog(true);
      }
      
    } catch (error: any) {
      throw new Error(error.response?.data?.detail || 'Login failed');
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('selectedProject');
    setUser(null);
    setSelectedProject(null);
  };

  const updateSelectedProject = (project: Project | null) => {
    setSelectedProject(project);
    if (project) {
      localStorage.setItem('selectedProject', JSON.stringify(project));
    } else {
      localStorage.removeItem('selectedProject');
    }
  };

  const canEdit = (): boolean => {
    if (!user) return false;
    return user.role === 'admin' || user.role === 'inspector';
  };

  const canDelete = (): boolean => {
    if (!user) return false;
    return user.role === 'admin';
  };

  const isAdmin = (): boolean => {
    if (!user) return false;
    return user.role === 'admin';
  };

  const handlePasswordChangeSuccess = () => {
    setShowPasswordChangeDialog(false);
    // Refresh user data to update password_change_required flag
    ApiService.getCurrentUser().then(updatedUser => {
      setUser(updatedUser);
    });
  };

  const value: AuthContextType = {
    user,
    login,
    logout,
    loading,
    selectedProject,
    setSelectedProject: updateSelectedProject,
    canEdit,
    canDelete,
    isAdmin,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
      <PasswordChangeDialog
        open={showPasswordChangeDialog}
        onClose={() => setShowPasswordChangeDialog(false)}
        onSuccess={handlePasswordChangeSuccess}
      />
    </AuthContext.Provider>
  );
};
