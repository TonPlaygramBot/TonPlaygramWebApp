import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import ReactMarkdown from 'react-markdown';
import { FiCpu, FiRefreshCw, FiSend, FiX } from 'react-icons/fi';
import { askDevAssistant, getDevAssistantStats } from '../utils/api.js';

export default function DevAssistantModal({ open, onClose, accountId }) {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content:
        'Hi! I can answer developer-only questions about this webapp. Ask me about components, routes, APIs, or how to test specific game flows.'
    }
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    if (open) {
      refreshStats();
    }
  }, [open, accountId]);

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, error]);

  if (!open) return null;

  const refreshStats = async () => {
    if (!accountId) return;
    setStatsLoading(true);
    const res = await getDevAssistantStats(accountId);
    if (!res.error) {
      setStats(res);
      setError('');
    } else {
      setError(res.error);
    }
    setStatsLoading(false);
  };

  const handleSend = async () => {
    if (!input.trim() || sending) return;
    if (!accountId) {
      setError('Dev account required to use the assistant.');
      return;
    }
    const question = input.trim();
    const nextMessages = [...messages, { role: 'user', content: question }];
    setMessages(nextMessages);
    setInput('');
    setSending(true);
    setError('');

    const res = await askDevAssistant(question, accountId);
    if (res.error) {
      setError(res.error);
      setSending(false);
      return;
    }
    const assistantContent = res.answer || 'No answer returned.';
    setMessages([
      ...nextMessages,
      {
        role: 'assistant',
        content: assistantContent,
        sources: res.sources || []
      }
    ]);
    setStats(res.index || stats);
    setSending(false);
  };

  const renderSources = (sources = []) => {
    if (!Array.isArray(sources) || sources.length === 0) return null;
    return (
      <div className="flex flex-wrap gap-2 mt-2 text-[11px] text-subtext">
        {sources.map((src) => (
          <span
            key={`${src.path}-${src.score}`}
            className="px-2 py-1 rounded-full bg-surface/70 border border-border"
          >
            {src.path}
          </span>
        ))}
      </div>
    );
  };

  return createPortal(
    <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex items-center justify-center p-4">
      <div className="bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-4xl h-full max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div>
            <p className="font-semibold">Dev Assistant</p>
            <p className="text-xs text-subtext">Private, repo-aware helper for TonPlaygram developers.</p>
          </div>
          <div className="flex items-center gap-3 text-xs text-subtext">
            <div className="flex items-center gap-1">
              <FiCpu className="w-4 h-4" />
              <span>
                {stats
                  ? `${stats.files || 0} files indexed`
                  : 'Loading index…'}
              </span>
            </div>
            <button
              className="inline-flex items-center gap-1 px-2 py-1 rounded bg-background hover:bg-background/80 border border-border"
              onClick={refreshStats}
              disabled={statsLoading || !accountId}
            >
              <FiRefreshCw className={`w-4 h-4 ${statsLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={onClose}
              className="px-3 py-1 bg-primary hover:bg-primary-hover text-background rounded flex items-center gap-2"
            >
              <FiX />
              Close
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-surface/60">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`p-3 rounded-xl border ${
                msg.role === 'assistant'
                  ? 'bg-background/90 border-border'
                  : 'bg-primary/10 border-primary/40'
              }`}
            >
              <div className="text-[11px] uppercase font-semibold text-subtext mb-1">
                {msg.role === 'assistant' ? 'Assistant' : 'You'}
              </div>
              <ReactMarkdown className="prose prose-invert text-sm max-w-none">
                {msg.content}
              </ReactMarkdown>
              {renderSources(msg.sources)}
            </div>
          ))}
          {error && (
            <div className="p-3 rounded-xl border border-red-500 bg-red-500/10 text-red-200 text-sm">
              {error}
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="p-4 border-t border-border space-y-2 bg-surface">
          <div className="flex items-center justify-between text-xs text-subtext">
            <span>
              Ask about game test flows, API contracts, or component entry points. Shift+Enter adds a newline.
            </span>
            {stats?.totalBytes && (
              <span className="text-[11px]">Indexed size: {(stats.totalBytes / 1024 / 1024).toFixed(1)} MB</span>
            )}
          </div>
          <div className="flex gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={accountId ? 'Ask anything about the codebase…' : 'Dev account required'}
              className="flex-1 border border-border rounded-lg p-3 bg-background/90 text-sm text-text min-h-[80px]"
            />
            <button
              onClick={handleSend}
              disabled={sending || !input.trim() || !accountId}
              className="px-4 py-2 bg-primary hover:bg-primary-hover text-background rounded-lg flex items-center gap-2 h-[80px]"
            >
              <FiSend />
              {sending ? 'Sending…' : 'Send'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
