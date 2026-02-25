import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  FiActivity,
  FiCode,
  FiSend,
  FiWifi,
  FiWifiOff,
  FiX,
  FiZap
} from 'react-icons/fi';
import { devAgentChat, getDevAgentStatus } from '../utils/api.js';

const QUICK_ACTION_PRESETS = [
  {
    key: 'explain',
    label: 'Explain module',
    prompt: 'Explain MyAccount dev panel flow and where Dev Agent is wired.'
  },
  {
    key: 'find_bug',
    label: 'Find risky bug',
    prompt: 'Find likely failure points for Dev Agent responses and suggest a patch.'
  },
  {
    key: 'api_map',
    label: 'Map API flow',
    prompt: 'Map /api/dev-agent/chat request flow from frontend to backend.'
  },
  {
    key: 'ui_plan',
    label: 'UI improvement plan',
    prompt: 'Give a mobile portrait UX improvement plan for this Dev Agent modal.'
  }
];

export default function DevAgentModal({ open, onClose }) {
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState('unknown');
  const [gptConnected, setGptConnected] = useState(false);
  const [history, setHistory] = useState([]);
  const [citations, setCitations] = useState([]);
  const [selectedAction, setSelectedAction] = useState('');

  const canSend = useMemo(() => message.trim().length > 0 && !loading, [message, loading]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    async function loadStatus() {
      setStatusLoading(true);
      const data = await getDevAgentStatus();
      if (cancelled) return;
      if (data?.error) {
        setError(data.error);
      } else {
        setGptConnected(Boolean(data?.gptConnected));
      }
      setStatusLoading(false);
    }
    loadStatus();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const pushHistory = (role, content, extra = {}) => {
    setHistory((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        role,
        content,
        mode: extra.mode || '',
        citations: extra.citations || []
      }
    ]);
  };

  const usePreset = (preset) => {
    setSelectedAction(preset.key);
    setMessage(preset.prompt);
  };

  const handleSend = async () => {
    const trimmed = message.trim();
    if (!trimmed || loading) return;

    setLoading(true);
    setError('');
    pushHistory('user', trimmed);

    const response = await devAgentChat(trimmed, selectedAction || undefined);
    if (response?.error) {
      setError(response.error);
      setLoading(false);
      return;
    }

    const answer = response?.answer || 'No response returned.';
    const nextCitations = Array.isArray(response?.citations) ? response.citations : [];
    setMode(response?.mode || 'unknown');
    setGptConnected(Boolean(response?.gptConnected));
    setCitations(nextCitations);
    pushHistory('assistant', answer, {
      mode: response?.mode || 'unknown',
      citations: nextCitations
    });

    setLoading(false);
    setMessage('');
  };

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 bg-black/70 z-[90] flex items-end sm:items-center justify-center">
      <div className="w-full sm:max-w-3xl bg-surface border border-border rounded-t-2xl sm:rounded-2xl p-4 max-h-[90vh] overflow-auto">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="inline-flex items-start gap-2">
            <span className="w-8 h-8 rounded-lg bg-primary/20 border border-primary/40 inline-flex items-center justify-center mt-0.5">
              <FiCode className="w-4 h-4 text-primary" />
            </span>
            <div>
              <p className="text-white font-semibold">Dev Coding Agent · Admin Panel</p>
              <p className="text-[11px] text-subtext">Mobile-first live assistant using existing backend API flow</p>
            </div>
          </div>
          <button onClick={onClose} className="text-subtext hover:text-white">
            <FiX className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
          <div className="rounded-lg border border-border bg-background/60 px-3 py-2">
            <p className="text-[10px] uppercase text-subtext tracking-wide">Connection</p>
            <div className="mt-1 inline-flex items-center gap-2 text-sm font-semibold text-white">
              {gptConnected ? <FiWifi className="text-green-400" /> : <FiWifiOff className="text-yellow-300" />}
              {statusLoading ? 'Checking…' : gptConnected ? 'GPT Connected' : 'Fallback Active'}
            </div>
          </div>
          <div className="rounded-lg border border-border bg-background/60 px-3 py-2">
            <p className="text-[10px] uppercase text-subtext tracking-wide">Last mode</p>
            <p className="mt-1 text-sm font-semibold text-white">{mode}</p>
          </div>
          <div className="rounded-lg border border-border bg-background/60 px-3 py-2">
            <p className="text-[10px] uppercase text-subtext tracking-wide">Messages</p>
            <p className="mt-1 text-sm font-semibold text-white">{history.length}</p>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-background/50 p-2 mb-3">
          <p className="text-[11px] uppercase tracking-wide text-subtext mb-2 inline-flex items-center gap-1">
            <FiZap className="w-3 h-3" /> Quick actions
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {QUICK_ACTION_PRESETS.map((preset) => (
              <button
                key={preset.key}
                onClick={() => usePreset(preset)}
                className={`px-2 py-1.5 rounded text-xs border transition ${
                  selectedAction === preset.key
                    ? 'bg-primary text-background border-primary'
                    : 'bg-background/70 text-white border-border hover:border-primary/50'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            placeholder="Ask about bugfix, architecture, endpoint flow, or request a patch plan…"
            className="w-full rounded-lg border border-border bg-background/70 p-2 text-sm text-white"
          />
          <button
            onClick={handleSend}
            disabled={!canSend}
            className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 bg-primary hover:bg-primary-hover rounded text-background font-semibold disabled:opacity-60"
          >
            <FiSend className="w-4 h-4" />
            {loading ? 'Thinking…' : 'Send to Dev Agent'}
          </button>
        </div>

        {error && <p className="mt-3 text-sm text-red-300">{error}</p>}

        <div className="mt-4 rounded-lg border border-border bg-background/60 p-3">
          <p className="text-[11px] uppercase tracking-wide text-subtext mb-2 inline-flex items-center gap-1">
            <FiActivity className="w-3 h-3" /> Conversation
          </p>
          {history.length === 0 ? (
            <p className="text-sm text-subtext">No messages yet. Use a quick action or type your request.</p>
          ) : (
            <div className="space-y-2">
              {history.map((item) => (
                <div
                  key={item.id}
                  className={`rounded-lg border px-3 py-2 ${
                    item.role === 'user'
                      ? 'border-primary/50 bg-primary/10'
                      : 'border-border bg-background/70'
                  }`}
                >
                  <p className="text-[10px] uppercase tracking-wide text-subtext mb-1">
                    {item.role === 'user' ? 'You' : `Agent (${item.mode || mode})`}
                  </p>
                  <pre className="whitespace-pre-wrap text-sm text-white font-sans">{item.content}</pre>
                  {item.role === 'assistant' && item.citations?.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-border">
                      <p className="text-[10px] uppercase tracking-wide text-subtext mb-1">Citations</p>
                      <ul className="text-xs text-subtext space-y-0.5">
                        {item.citations.map((file) => (
                          <li key={`${item.id}-${file}`}>{file}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {citations.length > 0 && (
          <div className="mt-3 text-xs text-subtext">
            Latest matched files: {citations.join(' • ')}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
