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
  AccountTree
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { ProjectSummary } from '../../types';
import ApiService from '../../services/api';

const drawerWidth = 280;

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
      path: '/master-joint-list',
      roles: ['admin', 'inspector', 'visitor']
    },
    {
      text: 'Material Register',
      icon: <Inventory />,
      path: '/material-register',
      roles: ['admin', 'inspector', 'visitor']
    },
    {
      text: 'Fit-up Inspection',
      icon: <Assignment />,
      path: '/fitup-inspection',
      roles: ['admin', 'inspector', 'visitor']
    },
    {
      text: 'Final Inspection',
      icon: <Checklist />,
      path: '/final-inspection',
      roles: ['admin', 'inspector', 'visitor']
    },
    {
      text: 'NDT Requests',
      icon: <RequestQuote />,
      path: '/ndt-requests',
      roles: ['admin', 'inspector', 'visitor']
    },
    {
      text: 'NDT Status',
      icon: <Checklist />,
      path: '/ndt-status',
      roles: ['admin', 'inspector', 'visitor']
    },
    {
      text: 'WPS Register',
      icon: <Settings />,
      path: '/wps-register',
      roles: ['admin', 'inspector', 'visitor']
    },
    {
      text: 'Welder Register',
      icon: <Engineering />,
      path: '/welder-register',
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
    }
    ,{
      text: 'Audit Logs',
      icon: <Assignment />,
      path: '/audit-logs',
      roles: ['admin']
    }
  ];

  const filteredNavigationItems = navigationItems.filter(item => 
    user?.role && item.roles.includes(user.role)
  );

  const drawer = (
    <div>
      <Toolbar sx={{ borderBottom: '1px solid #e0e0e0' }}>
        <Box display="flex" alignItems="center" width="100%">
          <Engineering sx={{ color: 'primary.main', mr: 1 }} />
          <Box>
            <Typography variant="h6" noWrap>
              MPDMS
            </Typography>
            <Typography variant="caption" color="textSecondary">
              Multi-Project Data Management
            </Typography>
          </Box>
        </Box>
      </Toolbar>

      {/* Selected Project Info */}
      {selectedProject && summary && (
        <Box sx={{ p: 2, bgcolor: 'primary.light', color: 'primary.contrastText' }}>
          <Typography variant="subtitle2" gutterBottom>
            Selected Project
          </Typography>
          <Typography variant="body2" fontWeight="medium">
            {selectedProject.name}
          </Typography>
          <Typography variant="caption" sx={{ opacity: 0.8 }}>
            {selectedProject.code}
          </Typography>
          <Box mt={1}>
            <Typography variant="caption" display="block">
              Joints: {summary.fitup_done}/{summary.total_joints}
            </Typography>
            <Typography variant="caption" display="block">
              Progress: {Math.round((summary.fitup_done / summary.total_joints) * 100)}%
            </Typography>
          </Box>
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
                primaryTypographyProps={{ fontSize: '0.9rem' }}
              />
            </ListItemButton>
          </ListItem>
        ))}
      </List>

      <Box sx={{ mt: 'auto', p: 2 }}>
        <Divider sx={{ mb: 2 }} />
        <Typography variant="caption" color="textSecondary" align="center" display="block">
          MPDMS v3.0 - Multi-Project Data Management System
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
          p: 3,
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          minHeight: '100vh',
          bgcolor: 'background.default'
        }}
      >
        <Toolbar />
        {children}
      </Box>
    </Box>
  );
};

export default Layout;