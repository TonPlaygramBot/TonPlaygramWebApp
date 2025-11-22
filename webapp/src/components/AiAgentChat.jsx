import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AiOutlineClose, AiOutlineSend } from 'react-icons/ai';
import LoginOptions from './LoginOptions.jsx';
import { askAiAgent } from '../utils/api.js';
import { getTelegramId } from '../utils/telegram.js';

const QUICK_PROMPTS = [
  'Çfarë është TonPlaygram dhe si funksionon?',
  'Si të rris shpejtësinë e mining?',
  'Çfarë transaksionesh shihen në wallet?',
  'Cilat janë hapat për të nisur një ndeshje me miqtë?'
];

const CONTEXT_SNIPPET =
  'TonPlaygram ofron mining ditor, lojëra si Pool Royale, Goal Rush dhe Free Kick, ku fitimet llogariten me stake të paracaktuara. Balancat TPC ruhen off-chain brenda aplikacionit. Referral pages japin bonuse dhe çdo përdorues ka profile me foto dhe bio.';

export default function AiAgentChat({ open, onClose }) {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content:
        'Përshëndetje! Jam TonPlaygram AI Service Desk. Bëj pyetje për mining, lojërat, wallet apo çdo informacion tjetër rreth platformës.'
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [telegramId, setTelegramId] = useState(null);
  const chatRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setError('');
    setLoading(false);
    setInput('');
    try {
      setTelegramId(getTelegramId());
    } catch (err) {
      setTelegramId(null);
    }
  }, [open]);

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  const history = useMemo(
    () =>
      messages.map(({ role, content }) => ({
        role,
        content
      })),
    [messages]
  );

  async function handleSend(customText) {
    const text = (customText ?? input).trim();
    if (!text || loading) return;

    setMessages((prev) => [...prev, { role: 'user', content: text }]);
    setInput('');
    setLoading(true);
    setError('');

    const res = await askAiAgent({
      telegramId,
      message: text,
      history,
      context: CONTEXT_SNIPPET
    });

    setLoading(false);
    if (res?.error) {
      setError(res.error);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Nuk arrita të marr përgjigje. Provo përsëri pas pak.'
        }
      ]);
      return;
    }
    if (res?.reply) {
      setMessages((prev) => [...prev, { role: 'assistant', content: res.reply }]);
    }
  }

  if (!open) return null;

  if (!telegramId) {
    return createPortal(
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
        <div className="bg-surface border border-border rounded-2xl shadow-xl w-full max-w-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-white">TonPlaygram AI</h3>
            <button
              onClick={onClose}
              className="text-subtext hover:text-white transition"
              aria-label="Mbyll"
            >
              <AiOutlineClose className="w-5 h-5" />
            </button>
          </div>
          <p className="text-sm text-subtext mb-3">
            Hyr me Telegram për të biseduar me AI Agent dhe për të marrë suport të personalizuar.
          </p>
          <LoginOptions />
        </div>
      </div>,
      document.body
    );
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true">
      <div className="bg-surface border border-border rounded-2xl shadow-xl w-full max-w-lg flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div>
            <p className="text-xs text-primary font-semibold">TonPlaygram AI Agent</p>
            <h3 className="text-lg font-bold text-white">Service Desk</h3>
          </div>
          <button
            onClick={onClose}
            className="text-subtext hover:text-white transition"
            aria-label="Mbyll"
          >
            <AiOutlineClose className="w-5 h-5" />
          </button>
        </div>
        <div className="px-4 pt-3 space-y-2 text-xs text-subtext">
          <p>Pyet për informacion rreth lojërave, mining, wallet ose referall dhe merr përgjigje të azhurnuara.</p>
          <div className="flex flex-wrap gap-2">
            {QUICK_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                className="px-2 py-1 rounded-full border border-border bg-background/60 hover:border-primary text-[11px]"
                onClick={() => handleSend(prompt)}
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-hidden mt-3">
          <div
            ref={chatRef}
            className="h-80 overflow-y-auto px-4 space-y-3 pb-3"
          >
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`rounded-2xl px-3 py-2 max-w-[85%] text-sm whitespace-pre-wrap leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-primary text-black'
                      : 'bg-background border border-border text-white'
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="text-xs text-subtext">AI po shkruan…</div>
            )}
          </div>
        </div>
        {error && <p className="text-xs text-red-400 px-4">{error}</p>}
        <div className="p-4 border-t border-border flex items-center space-x-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSend();
            }}
            placeholder="Shkruaj pyetjen tënde..."
            className="flex-1 bg-background border border-border rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-primary"
          />
          <button
            onClick={() => handleSend()}
            className="p-2 rounded-full bg-primary text-black hover:bg-primary-hover disabled:opacity-60"
            disabled={loading}
            aria-label="Dërgo"
          >
            <AiOutlineSend className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
