import React, { useState } from 'react';
import {
  AppBar,
  Box,
  CssBaseline,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  Badge,
  Menu,
  MenuItem,
  Avatar,
  Divider,
  Button
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard,
  Engineering,
  Inventory,
  Assignment,
  Checklist,
  RequestQuote,
  Settings,
  Person,
  ExitToApp,
  VpnKey,
  AccountTree,
  AutoAwesome
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { ProjectSummary } from '../../types';
import ApiService from '../../services/api';

const drawerWidth = 340;

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user, logout, selectedProject } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [summary, setSummary] = useState<ProjectSummary | null>(null);

  React.useEffect(() => {
    if (selectedProject) {
      fetchProjectSummary();
    }
  }, [selectedProject]);

  const fetchProjectSummary = async () => {
    if (!selectedProject) return;
    try {
      const data = await ApiService.getProjectSummary(selectedProject.id);
      setSummary(data);
    } catch (error) {
      console.error('Failed to fetch project summary:', error);
    }
  };

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    logout();
    handleMenuClose();
    navigate('/login');
  };

  const handleChangePassword = () => {
    handleMenuClose();
    // TODO: Implement change password dialog
  };

  const navigationItems = [
    {
      text: 'Dashboard',
      icon: <Dashboard />,
      path: '/projects',
      roles: ['admin', 'inspector', 'visitor']
    },
    {
      text: 'Master Joint List',
      icon: <Assignment />,
      path: '/structureproject/master-joint-list',
      roles: ['admin', 'inspector', 'visitor']
    },
    {
      text: 'Material Register',
      icon: <Inventory />,
      path: '/structureproject/material-register',
      roles: ['admin', 'inspector', 'visitor']
    },
    {
      text: 'Fit-up Inspection',
      icon: <Assignment />,
      path: '/structureproject/fitup-inspection',
      roles: ['admin', 'inspector', 'visitor']
    },
    {
      text: 'Final Inspection',
      icon: <Checklist />,
      path: '/structureproject/final-inspection',
      roles: ['admin', 'inspector', 'visitor']
    },
    {
      text: 'NDT Requests',
      icon: <RequestQuote />,
      path: '/structureproject/ndt-requests',
      roles: ['admin', 'inspector', 'visitor']
    },
    {
      text: 'NDT Status',
      icon: <Checklist />,
      path: '/structureproject/ndt-status',
      roles: ['admin', 'inspector', 'visitor']
    },
    {
      text: 'WPS Register',
      icon: <Settings />,
      path: '/structureproject/wps-register',
      roles: ['admin', 'inspector', 'visitor']
    },
    {
      text: 'Welder Register',
      icon: <Engineering />,
      path: '/structureproject/welder-register',
      roles: ['admin', 'inspector', 'visitor']
    },
    {
      text: 'User Management',
      icon: <Person />,
      path: '/user-management',
      roles: ['admin']
    },
    {
      text: 'Project Management',
      icon: <AccountTree />,
      path: '/project-management',
      roles: ['admin']
    },
    {
      text: 'Audit Logs',
      icon: <Assignment />,
      path: '/audit-logs',
      roles: ['admin']
    },
    {
      text: 'Backend Strategy',
      icon: <AutoAwesome />,
      path: '/backend-strategy',
      roles: ['admin']
    }
  ];

  const filteredNavigationItems = navigationItems.filter(item => 
    user?.role && item.roles.includes(user.role)
  );

  const drawer = (
    <div>
      <Toolbar sx={{ borderBottom: '1px solid #e0e0e0', minHeight: '80px' }}>
        <Box display="flex" alignItems="center" width="100%">
          <Engineering sx={{ color: 'primary.main', mr: 2, fontSize: 32 }} />
          <Box>
            <Typography variant="h5" noWrap fontWeight="bold">
              MPDMS
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Multi-Project Data Management System
            </Typography>
          </Box>
        </Box>
      </Toolbar>

      {/* Selected Project Info - Always visible when project selected */}
      {selectedProject && (
        <Box sx={{ p: 2.5, bgcolor: 'primary.light', color: 'primary.contrastText', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <Typography variant="subtitle1" fontWeight="medium" gutterBottom>
            {selectedProject.name}
          </Typography>
          <Typography variant="body2" sx={{ opacity: 0.9, mb: 1 }}>
            {selectedProject.code} • Structure
          </Typography>
          {summary && (
            <Box sx={{ mt: 1.5 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="caption" sx={{ opacity: 0.8 }}>
                  Progress
                </Typography>
                <Typography variant="caption" fontWeight="medium">
                  {Math.round((summary.fitup_done / summary.total_joints) * 100)}%
                </Typography>
              </Box>
              <Box sx={{ width: '100%', height: 6, bgcolor: 'rgba(255,255,255,0.2)', borderRadius: 3, overflow: 'hidden' }}>
                <Box sx={{ 
                  width: `${Math.round((summary.fitup_done / summary.total_joints) * 100)}%`, 
                  height: '100%', 
                  bgcolor: 'white',
                  borderRadius: 3
                }} />
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
                <Typography variant="caption" sx={{ opacity: 0.8 }}>
                  Joints: {summary.fitup_done}/{summary.total_joints}
                </Typography>
                <Typography variant="caption" sx={{ opacity: 0.8 }}>
                  Final: {summary.final_done}
                </Typography>
              </Box>
            </Box>
          )}
        </Box>
      )}

      <List sx={{ pt: 1 }}>
        {filteredNavigationItems.map((item) => (
          <ListItem key={item.text} disablePadding>
            <ListItemButton
              selected={location.pathname === item.path}
              onClick={() => {
                navigate(item.path);
                if (mobileOpen) {
                  setMobileOpen(false);
                }
              }}
              sx={{
                mx: 1,
                borderRadius: 1,
                '&.Mui-selected': {
                  bgcolor: 'primary.main',
                  color: 'white',
                  '&:hover': {
                    bgcolor: 'primary.dark',
                  },
                  '& .MuiListItemIcon-root': {
                    color: 'white',
                  },
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: 40 }}>
                {item.icon}
              </ListItemIcon>
              <ListItemText 
                primary={item.text} 
                primaryTypographyProps={{ fontSize: '1rem', fontWeight: 500 }}
              />
            </ListItemButton>
          </ListItem>
        ))}
      </List>

        <Box sx={{ mt: 'auto', p: 2.5, borderTop: '1px solid #e0e0e0' }}>
        <Typography variant="caption" color="textSecondary" align="center" display="block" sx={{ mb: 0.5 }}>
          MPDMS v3.0
        </Typography>
        <Typography variant="caption" color="textSecondary" align="center" display="block" sx={{ fontSize: '0.7rem', opacity: 0.7 }}>
          Pipe & Structure Fabrication Data Management
        </Typography>
      </Box>
    </div>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />
      <AppBar
        position="fixed"
        sx={{
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          ml: { sm: `${drawerWidth}px` },
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { sm: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            {selectedProject ? `${selectedProject.name} - MPDMS` : 'MPDMS'}
          </Typography>

          <Box display="flex" alignItems="center">
            <Button
              color="inherit"
              onClick={handleMenuOpen}
              sx={{ textTransform: 'none' }}
            >
              <Avatar sx={{ width: 32, height: 32, mr: 1, bgcolor: 'secondary.main' }}>
                {user?.full_name?.[0] || user?.email[0]?.toUpperCase()}
              </Avatar>
              <Box textAlign="left">
                <Typography variant="body2">
                  {user?.full_name || user?.email}
                </Typography>
                <Typography variant="caption" sx={{ opacity: 0.8 }}>
                  {user?.role}
                </Typography>
              </Box>
            </Button>
          </Box>

          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleMenuClose}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          >
            <MenuItem onClick={handleMenuClose}>
              <ListItemIcon>
                <Person fontSize="small" />
              </ListItemIcon>
              Profile
            </MenuItem>
            <MenuItem onClick={handleChangePassword}>
              <ListItemIcon>
                <VpnKey fontSize="small" />
              </ListItemIcon>
              Change Password
            </MenuItem>
            <Divider />
            <MenuItem onClick={handleLogout}>
              <ListItemIcon>
                <ExitToApp fontSize="small" />
              </ListItemIcon>
              Logout
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      <Box
        component="nav"
        sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true,
          }}
          sx={{
            display: { xs: 'block', sm: 'none' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', sm: 'block' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 4,
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          minHeight: '100vh',
          bgcolor: 'background.default',
          maxWidth: '100%',
          overflowX: 'auto'
        }}
      >
        <Toolbar />
        {children}
      </Box>
    </Box>
  );
};

export default Layout;
