import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import Dashboard from './Dashboard';
import ApiService from '../../services/api';

// Mock the API service
jest.mock('../../services/api', () => ({
  getProjectSummary: jest.fn(),
}));

// Mock the AuthContext
jest.mock('../../contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));

import { useAuth } from '../../contexts/AuthContext';

// Mock data
const mockProject = {
  id: 1,
  name: 'Test Project',
  code: 'TP001',
  description: 'Test project description',
  owner_id: 1,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  assigned_users: [],
  owner: {
    id: 1,
    email: 'admin@test.com',
    full_name: 'Admin User',
    role: 'admin' as const,
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    assigned_projects: [],
    owned_projects: [],
  },
};

const mockSummary = {
  project_id: 1,
  project_name: 'Test Project',
  total_joints: 100,
  fitup_done: 75,
  final_done: 50,
  material_used: 500,
  material_missing_from_fitup: 25,
  material_pending_inspection: 15,
  material_inspected: 460,
  material_rejected: 10,
  ndt_requests_total: 30,
  ndt_requests_pending: 10,
  ndt_requests_approved: 20,
  weld_accept_length_total: 45.5,
  weld_reject_length_total: 4.5,
  ndt_success_rates: {
    'UT': 95,
    'RT': 92,
    'PT': 98,
    'MT': 96,
  },
  fitup_outstanding: 25,
  final_outstanding: 50,
  ndt_done: 25,
  ndt_outstanding: 5,
  wps_total: 10,
  wps_active: 8,
  welder_total: 15,
  welder_active: 12,
};

const mockUser = {
  id: 1,
  email: 'test@example.com',
  full_name: 'Test User',
  role: 'inspector' as const,
  is_active: true,
  created_at: '2024-01-01T00:00:00Z',
  assigned_projects: [mockProject],
  owned_projects: [],
};

describe('Dashboard Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: jest.fn(() => null),
        setItem: jest.fn(),
        removeItem: jest.fn(),
      },
      writable: true,
    });
  });

  test('renders loading state when no project selected', () => {
    // Mock useAuth to return no selected project
    (useAuth as jest.Mock).mockReturnValue({
      user: mockUser,
      selectedProject: null,
      loading: false,
    });

    render(<Dashboard />);

    expect(screen.getByText('No Project Selected')).toBeInTheDocument();
    expect(screen.getByText('Please select a project to view the dashboard.')).toBeInTheDocument();
  });

  test('renders dashboard with project data', async () => {
    // Mock useAuth to return a selected project
    (useAuth as jest.Mock).mockReturnValue({
      user: mockUser,
      selectedProject: mockProject,
      loading: false,
    });

    (ApiService.getProjectSummary as jest.Mock).mockResolvedValue(mockSummary);

    render(<Dashboard />);

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText('Project Dashboard')).toBeInTheDocument();
    });

    // Check project info
    expect(screen.getByText('Test Project (TP001)')).toBeInTheDocument();

    // Check KPI cards - use more specific queries
    expect(screen.getByText('Total Joints')).toBeInTheDocument();
    expect(screen.getByText('Fit-up Completed')).toBeInTheDocument();
    expect(screen.getByText('Final Inspection')).toBeInTheDocument();
    // KPI cards rendered

    // Check progress cards
    expect(screen.getByText('Fit-up Progress')).toBeInTheDocument();
    expect(screen.getByText('Final Inspection Progress')).toBeInTheDocument();

    // Check detailed statistics sections
    expect(screen.getByText('Material Management')).toBeInTheDocument();
    expect(screen.getByText('NDT Requests')).toBeInTheDocument();
    expect(screen.getByText('Weld Quality')).toBeInTheDocument();

    // Check grouped weld quality summary
    expect(screen.getByText('RT + UT')).toBeInTheDocument();
  });

  test('handles API errors gracefully', async () => {
    // Mock useAuth to return a selected project
    (useAuth as jest.Mock).mockReturnValue({
      user: mockUser,
      selectedProject: mockProject,
      loading: false,
    });

    (ApiService.getProjectSummary as jest.Mock).mockRejectedValue(new Error('API Error'));

    render(<Dashboard />);

    // Should still render the dashboard structure
    await waitFor(() => {
      expect(screen.getByText('Project Dashboard')).toBeInTheDocument();
    });

    // Dashboard should render with default values when API fails
    expect(screen.getByText('Test Project (TP001)')).toBeInTheDocument();
  });

  test('refresh button triggers data reload', async () => {
    // Mock useAuth to return a selected project
    (useAuth as jest.Mock).mockReturnValue({
      user: mockUser,
      selectedProject: mockProject,
      loading: false,
    });

    (ApiService.getProjectSummary as jest.Mock).mockResolvedValue(mockSummary);

    render(<Dashboard />);

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText('Project Dashboard')).toBeInTheDocument();
    });

    // Click refresh button
    const refreshButton = screen.getByRole('button', { name: /refresh dashboard/i });
    fireEvent.click(refreshButton);

    // Should call API again
    expect(ApiService.getProjectSummary).toHaveBeenCalledTimes(2);
  });

  test('renders AI insights section', async () => {
    // Mock useAuth to return a selected project
    (useAuth as jest.Mock).mockReturnValue({
      user: mockUser,
      selectedProject: mockProject,
      loading: false,
    });

    (ApiService.getProjectSummary as jest.Mock).mockResolvedValue(mockSummary);

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('AI Insights & Recommendations')).toBeInTheDocument();
    });

    expect(screen.getByText('Real-time analysis of project performance with automated insights and recommendations for improvement.')).toBeInTheDocument();
  });
});
