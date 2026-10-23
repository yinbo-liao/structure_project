import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ProjectChatAgent from './ProjectChatAgent';
import ApiService from '../../services/api';

jest.mock('../../services/api', () => ({
  __esModule: true,
  default: {
    sendAssistantMessage: jest.fn(),
    getConversation: jest.fn(),
    scanDataQuality: jest.fn(),
  },
}));

const finding = {
  id: 'final:5:welder_no',
  check: 'typo',
  severity: 'medium' as const,
  entity: 'final_inspection',
  record_id: 5,
  field: 'welder_no',
  value: 'W-10O',
  expected: 'W-100',
  confidence: 0.91,
  message: "welder_no 'W-10O' not found in welder register",
  suggestion: 'W-100',
};

const chatResponse = {
  conversation_id: 12,
  message: { role: 'assistant' as const, content: 'Found issues in [final:5].' },
  citations: [{
    citation_id: 'final:5',
    entity: 'final_inspection',
    record_id: 5,
    label: 'Final inspection 5 / joint J-101',
    score: 0.9,
    excerpt: 'welder=W-10O',
  }],
  findings: [finding, { ...finding, id: 'final:5:wps_no', field: 'wps_no', value: 'WPS-1O0', suggestion: 'WPS-100' }],
  tool_runs: [{ name: 'scan_data_quality', ok: true, duration_ms: 12 }],
  metrics: { model: 'deepseek-flash', iterations: 2, tokens: 100, cost_usd: null, fallback: true, degraded: true },
  verified: true,
  warnings: ['AI_KEY_NOT_CONFIGURED'],
};

const openChat = () => {
  fireEvent.click(screen.getByRole('button', { name: /open ai assistant/i }));
  return screen.getByLabelText('Message the project assistant');
};

describe('ProjectChatAgent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    window.HTMLElement.prototype.scrollIntoView = jest.fn();
  });

  test('sends a message and renders citations, findings, and fallback banner', async () => {
    (ApiService.sendAssistantMessage as jest.Mock).mockResolvedValue(chatResponse);

    render(<ProjectChatAgent projectId={1} />);
    const input = openChat();
    fireEvent.change(input, { target: { value: 'Check welder numbers' } });
    fireEvent.click(screen.getByRole('button', { name: /send message/i }));

    expect(await screen.findByText('Found issues in [final:5].')).toBeInTheDocument();
    expect(ApiService.sendAssistantMessage).toHaveBeenCalledWith(1, 'Check welder numbers', null);
    expect(screen.getByText('Final inspection 5 / joint J-101')).toBeInTheDocument();
    expect(screen.getByText('2 findings')).toBeInTheDocument();
    expect(screen.getByText(/answers use deterministic record checks/i)).toBeInTheDocument();
    expect(localStorage.getItem('ai-conversation-1')).toBe('12');
  });

  test('sends on Enter and ignores duplicate submits while sending', async () => {
    let resolveResponse: (value: unknown) => void = () => undefined;
    (ApiService.sendAssistantMessage as jest.Mock).mockImplementation(
      () => new Promise((resolve) => { resolveResponse = resolve; })
    );

    render(<ProjectChatAgent projectId={1} />);
    const input = openChat();
    fireEvent.change(input, { target: { value: 'Any typos?' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.click(screen.getByRole('button', { name: /send message/i }));

    expect(ApiService.sendAssistantMessage).toHaveBeenCalledTimes(1);
    resolveResponse(chatResponse);
    await waitFor(() => {
      expect(screen.getByText('Found issues in [final:5].')).toBeInTheDocument();
    });
  });

  test('loads the stored conversation when the panel opens', async () => {
    localStorage.setItem('ai-conversation-1', '12');
    (ApiService.getConversation as jest.Mock).mockResolvedValue({
      id: 12,
      project_id: 1,
      title: 'Check welders',
      summary: '',
      created_at: null,
      updated_at: null,
      messages: [
        { id: 1, role: 'user', content: 'Earlier question', citations: [], findings: [], tool_runs: [], tokens: 0, created_at: null },
        { id: 2, role: 'assistant', content: 'Earlier answer', citations: [], findings: [], tool_runs: [], tokens: 0, created_at: null },
      ],
    });

    render(<ProjectChatAgent projectId={1} />);
    openChat();

    expect(await screen.findByText('Earlier answer')).toBeInTheDocument();
    expect(ApiService.getConversation).toHaveBeenCalledWith(1, 12);
  });

  test('clears a stale stored conversation after a 404', async () => {
    localStorage.setItem('ai-conversation-1', '12');
    (ApiService.getConversation as jest.Mock).mockResolvedValue({
      id: 12,
      project_id: 1,
      title: 'Old chat',
      summary: '',
      created_at: null,
      updated_at: null,
      messages: [
        { id: 1, role: 'assistant', content: 'Loaded history', citations: [], findings: [], tool_runs: [], tokens: 0, created_at: null },
      ],
    });
    (ApiService.sendAssistantMessage as jest.Mock).mockRejectedValue({
      response: { status: 404, data: { detail: 'Conversation not found' } },
    });

    render(<ProjectChatAgent projectId={1} />);
    const input = openChat();
    expect(await screen.findByText('Loaded history')).toBeInTheDocument();
    fireEvent.change(input, { target: { value: 'Are you still there?' } });
    fireEvent.click(screen.getByRole('button', { name: /send message/i }));

    expect(await screen.findByText('Conversation not found')).toBeInTheDocument();
    expect(ApiService.sendAssistantMessage).toHaveBeenCalledWith(1, 'Are you still there?', 12);
    expect(localStorage.getItem('ai-conversation-1')).toBeNull();
  });

  test('opens the findings dialog from the findings chip', async () => {
    (ApiService.sendAssistantMessage as jest.Mock).mockResolvedValue(chatResponse);

    render(<ProjectChatAgent projectId={1} />);
    const input = openChat();
    fireEvent.change(input, { target: { value: 'Check welder numbers' } });
    fireEvent.click(screen.getByRole('button', { name: /send message/i }));

    fireEvent.click(await screen.findByText('2 findings'));
    expect(await screen.findByText('Assistant findings')).toBeInTheDocument();
    expect(screen.getByText('W-10O')).toBeInTheDocument();
    expect(screen.getByText('WPS-1O0')).toBeInTheDocument();
  });

  test('runs the deterministic scan from the header action', async () => {
    (ApiService.scanDataQuality as jest.Mock).mockResolvedValue({
      project_id: 1,
      generated_at: '2026-10-24T00:00:00Z',
      read_only: true,
      records_scanned: 10,
      scanned: { final_inspection: 1 },
      truncated: false,
      duration_ms: 8,
      total_findings: 2,
      by_severity: { high: 1, medium: 1, low: 0 },
      by_check: { typo: 2 },
      findings: [finding, { ...finding, id: 'wps:1', severity: 'high', entity: 'wps_register' }],
    });

    render(<ProjectChatAgent projectId={1} />);
    openChat();
    fireEvent.click(screen.getByRole('button', { name: /scan records for typos and mismatches/i }));

    expect(await screen.findByText('Scan: 1 high, 1 medium, 0 low')).toBeInTheDocument();
    expect(ApiService.scanDataQuality).toHaveBeenCalledWith(1, { limit: 200 });
    expect(await screen.findByText('Data quality scan (2 findings)')).toBeInTheDocument();
  });
});
