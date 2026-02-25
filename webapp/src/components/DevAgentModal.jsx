import { useState } from 'react';
import { createPortal } from 'react-dom';
import { FiCode, FiSend, FiX } from 'react-icons/fi';
import { devAgentChat } from '../utils/api.js';

export default function DevAgentModal({ open, onClose }) {
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState('');
  const [citations, setCitations] = useState([]);
  const [mode, setMode] = useState('');
  const [error, setError] = useState('');

  const handleSend = async () => {
    if (!message.trim() || loading) return;
    setLoading(true);
    setError('');
    const response = await devAgentChat(message.trim());
    if (response?.error) {
      setError(response.error);
      setLoading(false);
      return;
    }
    setAnswer(response?.answer || 'No response.');
    setCitations(Array.isArray(response?.citations) ? response.citations : []);
    setMode(response?.mode || 'unknown');
    setLoading(false);
  };

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 bg-black/70 z-[90] flex items-end sm:items-center justify-center">
      <div className="w-full sm:max-w-2xl bg-surface border border-border rounded-t-2xl sm:rounded-2xl p-4 max-h-[88vh] overflow-auto">
        <div className="flex items-center justify-between mb-3">
          <div className="inline-flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-primary/20 border border-primary/40 inline-flex items-center justify-center">
              <FiCode className="w-4 h-4 text-primary" />
            </span>
            <div>
              <p className="text-white font-semibold">Dev Coding Agent</p>
              <p className="text-[11px] text-subtext">Fast mode · uses existing backend connections</p>
            </div>
          </div>
          <button onClick={onClose} className="text-subtext hover:text-white">
            <FiX className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-2">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            placeholder="Ask about code, endpoint flow, or where logic lives…"
            className="w-full rounded-lg border border-border bg-background/70 p-2 text-sm text-white"
          />
          <button
            onClick={handleSend}
            disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 bg-primary hover:bg-primary-hover rounded text-background font-semibold disabled:opacity-60"
          >
            <FiSend className="w-4 h-4" />
            {loading ? 'Thinking…' : 'Ask Dev Agent'}
          </button>
        </div>

        {error && <p className="mt-3 text-sm text-red-300">{error}</p>}

        {answer && (
          <div className="mt-4 rounded-lg border border-border bg-background/60 p-3 space-y-2">
            <p className="text-[11px] uppercase tracking-wide text-subtext">Response ({mode})</p>
            <pre className="whitespace-pre-wrap text-sm text-white font-sans">{answer}</pre>
            {citations.length > 0 && (
              <div>
                <p className="text-[11px] uppercase tracking-wide text-subtext mb-1">Citations</p>
                <ul className="text-xs text-subtext space-y-1">
                  {citations.map((file) => (
                    <li key={file}>{file}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
