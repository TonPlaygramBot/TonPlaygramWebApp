import { useEffect, useState } from 'react';
import useTelegramBackButton from '../hooks/useTelegramBackButton.js';
import LoginOptions from '../components/LoginOptions.jsx';
import { getTelegramId } from '../utils/telegram.js';
import { getMessages, sendMessage, listFriends, markInboxRead } from '../utils/api.js';

export default function Messages() {
  useTelegramBackButton();
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
    markInboxRead(telegramId);
  }, [telegramId]);

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
    <div className="p-4 space-y-4 text-text">
      <h2 className="text-xl font-bold">Inbox</h2>
      <div className="flex space-x-4">
        <div className="w-1/3 space-y-2">
          {friends.map((f) => (
            <div
              key={f.telegramId}
              className={`p-2 border border-border rounded cursor-pointer ${selected?.telegramId === f.telegramId ? 'bg-accent' : ''}`}
              onClick={() => setSelected(f)}
            >
              {f.nickname || `${f.firstName} ${f.lastName}`.trim() || 'User'}
            </div>
          ))}
        </div>
        <div className="flex-1 space-y-2">
          {selected ? (
            <>
              <div className="h-64 overflow-y-auto border border-border rounded p-2 space-y-1">
                {messages.map((m, idx) => (
                  <div key={idx} className={`${m.from === telegramId ? 'text-right' : 'text-left'}`}>{m.text}</div>
                ))}
              </div>
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  className="flex-1 border border-border rounded px-2 py-1 bg-surface"
                />
                <button
                  onClick={handleSend}
                  className="px-2 py-1 bg-primary hover:bg-primary-hover rounded"
                >
                  Send
                </button>
              </div>
            </>
          ) : (
            <p>Select a friend to chat</p>
          )}
        </div>
      </div>
    </div>
  );
}
