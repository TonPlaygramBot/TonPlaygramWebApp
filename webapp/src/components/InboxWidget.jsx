import { useEffect, useState } from 'react';
import LoginOptions from './LoginOptions.jsx';
import { getTelegramId } from '../utils/telegram.js';
import { listFriends, getMessages, sendMessage, markInboxRead } from '../utils/api.js';

export default function InboxWidget() {
  let telegramId;
  try {
    telegramId = getTelegramId();
  } catch (err) {
    return <LoginOptions />;
  }

  const [friends, setFriends] = useState([]);
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');

  useEffect(() => {
    listFriends(telegramId).then(setFriends);
  }, [telegramId]);

  useEffect(() => {
    if (selected) {
      getMessages(telegramId, selected.telegramId).then((msgs) => {
        setMessages(msgs);
        markInboxRead(telegramId);
      });
    }
  }, [selected, telegramId]);

  async function handleSend() {
    if (!text || !selected) return;
    await sendMessage(telegramId, selected.telegramId, text);
    setText('');
    const msgs = await getMessages(telegramId, selected.telegramId);
    setMessages(msgs);
    markInboxRead(telegramId);
  }

  return (
    <div className="p-2 border border-border rounded bg-surface space-y-2">
      <h3 className="font-semibold">Messages</h3>
      <div className="flex space-x-2 text-sm">
        <div className="w-1/3 space-y-1">
          {friends.map((f) => (
            <div
              key={f.telegramId}
              className={`p-1 border border-border rounded cursor-pointer ${selected?.telegramId === f.telegramId ? 'bg-accent' : ''}`}
              onClick={() => setSelected(f)}
            >
              {f.nickname || `${f.firstName} ${f.lastName}`.trim() || 'User'}
            </div>
          ))}
        </div>
        <div className="flex-1 space-y-1">
          {selected ? (
            <>
              <div className="h-32 overflow-y-auto border border-border rounded p-1 space-y-1">
                {messages.map((m, idx) => (
                  <div key={idx} className={`${m.from === telegramId ? 'text-right' : 'text-left'}`}>{m.text}</div>
                ))}
              </div>
              <div className="flex space-x-1">
                <input
                  type="text"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  className="flex-1 border border-border rounded px-1 py-0.5 bg-surface"
                />
                <button onClick={handleSend} className="px-1 py-0.5 bg-primary hover:bg-primary-hover rounded">
                  Send
                </button>
              </div>
            </>
          ) : (
            <p>Select a friend</p>
          )}
        </div>
      </div>
    </div>
  );
}
