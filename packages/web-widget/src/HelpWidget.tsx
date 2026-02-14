import React, { useMemo, useState } from 'react';

interface Citation {
  title: string;
  slug: string;
  sectionId: string;
  url: string;
}

interface ChatReply {
  answer: string;
  citations: Citation[];
}

export function HelpWidget({ apiBaseUrl }: { apiBaseUrl: string }): JSX.Element {
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [reply, setReply] = useState<ChatReply | null>(null);

  const disabled = useMemo(() => loading || !message.trim(), [loading, message]);

  async function send(): Promise<void> {
    setLoading(true);
    try {
      const res = await fetch(`${apiBaseUrl}/v1/user-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message })
      });
      const data = (await res.json()) as ChatReply;
      setReply(data);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 420, border: '1px solid #ddd', borderRadius: 12, padding: 12 }}>
      <h3>Platform Help</h3>
      <p>Ask about rules, matchmaking, coins/points, reporting, or troubleshooting.</p>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={4}
        style={{ width: '100%', marginBottom: 8 }}
        placeholder="Type your question in any language. I will answer in English."
      />
      <button disabled={disabled} onClick={() => void send()}>
        {loading ? 'Loading...' : 'Ask Help Agent'}
      </button>

      {reply ? (
        <div style={{ marginTop: 12 }}>
          <strong>Answer</strong>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{reply.answer}</pre>
          <strong>Sources</strong>
          <ul>
            {reply.citations.map((cite) => (
              <li key={`${cite.slug}-${cite.sectionId}`}>
                {cite.title} — {cite.url}#{cite.sectionId}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
