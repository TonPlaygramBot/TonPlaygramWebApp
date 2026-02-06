import { useEffect, useMemo, useState } from 'react';
import {
  FaArchive,
  FaBookmark,
  FaFlag,
  FaImage,
  FaMicrophone,
  FaPaperPlane,
  FaTrash,
  FaVideo,
  FaVolumeMute
} from 'react-icons/fa';
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
  const [search, setSearch] = useState('');
  const [activeFolder, setActiveFolder] = useState('inbox');
  const [actionNote, setActionNote] = useState('');
  const [clipFile, setClipFile] = useState(null);

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

  function handleQuickAction(label) {
    setActionNote(`${label} queued`);
    setTimeout(() => setActionNote(''), 2000);
  }

  const filteredFriends = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return friends;
    return friends.filter((friend) => {
      const label = friend.nickname ||
        `${friend.firstName || ''} ${friend.lastName || ''}`.trim() ||
        'User';
      return label.toLowerCase().includes(term);
    });
  }, [friends, search]);

  return (
    <div className="p-4 space-y-6 text-text">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-subtext">
            Squad Messages
          </p>
          <h2 className="text-2xl font-bold text-white">Messages</h2>
          <p className="text-sm text-subtext">
            Keep your team synced with quick chat, clips, and match invites.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search squadmates..."
            className="rounded-full border border-border bg-surface px-4 py-2 text-sm text-white focus:outline-none"
          />
          <button className="rounded-full border border-border px-4 py-2 text-sm text-white">
            New Chat
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_2fr]">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {['inbox', 'requests', 'archived', 'saved', 'trash'].map((folder) => (
              <button
                key={folder}
                onClick={() => setActiveFolder(folder)}
                className={`rounded-full px-3 py-1 text-[11px] uppercase tracking-wide ${
                  activeFolder === folder
                    ? 'bg-primary text-background'
                    : 'border border-border text-subtext'
                }`}
              >
                {folder}
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-white">Active Squad</p>
            <span className="text-xs text-subtext">
              {filteredFriends.length} online
            </span>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 lg:grid lg:gap-3 lg:overflow-visible">
            {filteredFriends.map((f) => {
              const label =
                f.nickname ||
                `${f.firstName || ''} ${f.lastName || ''}`.trim() ||
                'User';
              return (
                <button
                  key={f.telegramId}
                  onClick={() => setSelected(f)}
                  className={`min-w-[160px] flex-1 rounded-xl border p-3 text-left ${
                    selected?.telegramId === f.telegramId
                      ? 'border-primary bg-primary/10'
                      : 'border-border bg-surface'
                  }`}
                >
                  <p className="text-sm font-semibold text-white">{label}</p>
                  <p className="text-xs text-subtext">
                    Ready for a match
                  </p>
                </button>
              );
            })}
            {filteredFriends.length === 0 && (
              <div className="rounded-xl border border-border bg-surface p-4 text-xs text-subtext">
                No friends found. Invite squadmates to start chatting.
              </div>
            )}
          </div>
          <div className="rounded-xl border border-border bg-surface/60 p-3 space-y-2">
            <p className="text-xs uppercase tracking-[0.25em] text-subtext">
              Messaging Tools
            </p>
            <div className="flex flex-wrap gap-2">
              {['Send', 'Receive', 'Archive', 'Delete', 'Save', 'Mute', 'Report'].map(
                (label) => (
                  <button
                    key={label}
                    onClick={() => handleQuickAction(label)}
                    className="rounded-full border border-border px-3 py-1 text-xs text-white"
                  >
                    {label}
                  </button>
                )
              )}
            </div>
            {actionNote && (
              <p className="text-[11px] text-subtext">{actionNote}</p>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-surface/90 p-4 space-y-4">
          {selected ? (
            <>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-white">
                    {selected.nickname ||
                      `${selected.firstName || ''} ${selected.lastName || ''}`.trim() ||
                      'User'}
                  </p>
                  <p className="text-xs text-subtext">
                    Matchmaking · Squad chat · Direct messages
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => handleQuickAction('Archive')}
                    className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-[11px] text-white"
                  >
                    <FaArchive /> Archive
                  </button>
                  <button
                    onClick={() => handleQuickAction('Save')}
                    className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-[11px] text-white"
                  >
                    <FaBookmark /> Save
                  </button>
                  <button
                    onClick={() => handleQuickAction('Delete')}
                    className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-[11px] text-white"
                  >
                    <FaTrash /> Delete
                  </button>
                  <button
                    onClick={() => handleQuickAction('Mute')}
                    className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-[11px] text-white"
                  >
                    <FaVolumeMute /> Mute
                  </button>
                </div>
              </div>
              <div className="h-[320px] overflow-y-auto rounded-xl border border-border bg-background/60 p-3 space-y-3">
                {messages.map((m, idx) => (
                  <div
                    key={idx}
                    className={`flex ${m.from === telegramId ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                        m.from === telegramId
                          ? 'bg-primary text-background'
                          : 'bg-surface text-white border border-border'
                      }`}
                    >
                      {m.text}
                    </div>
                  </div>
                ))}
                {messages.length === 0 && (
                  <div className="text-center text-xs text-subtext">
                    Start the conversation with a quick hello.
                  </div>
                )}
              </div>
              <div className="rounded-xl border border-border bg-background/60 p-3 space-y-3">
                <div className="flex flex-wrap gap-2 text-xs text-subtext">
                  <span className="rounded-full border border-border px-3 py-1">
                    Delivery: Instant
                  </span>
                  <span className="rounded-full border border-border px-3 py-1">
                    Status: Encrypted
                  </span>
                  <span className="rounded-full border border-border px-3 py-1">
                    Save: Auto
                  </span>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    type="text"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    className="flex-1 rounded-full border border-border bg-background/60 px-3 py-2 text-sm text-white focus:outline-none"
                    placeholder="Type a message..."
                  />
                  <button
                    onClick={handleSend}
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-background"
                  >
                    <FaPaperPlane /> Send
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs text-white cursor-pointer">
                    <FaImage />
                    Photo
                    <input type="file" accept="image/*" className="hidden" />
                  </label>
                  <label className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs text-white cursor-pointer">
                    <FaVideo />
                    Clip
                    <input
                      type="file"
                      accept="video/*"
                      className="hidden"
                      onChange={(event) => setClipFile(event.target.files?.[0] || null)}
                    />
                  </label>
                  <button
                    onClick={() => handleQuickAction('Voice')}
                    className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs text-white"
                  >
                    <FaMicrophone /> Voice
                  </button>
                  <button
                    onClick={() => handleQuickAction('Report')}
                    className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs text-white"
                  >
                    <FaFlag /> Report
                  </button>
                  <button
                    onClick={() => handleQuickAction('Archive')}
                    className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs text-white"
                  >
                    <FaArchive /> Archive
                  </button>
                </div>
                {clipFile && (
                  <p className="text-[11px] text-subtext">
                    Selected clip: {clipFile.name}
                  </p>
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 text-center text-subtext min-h-[320px]">
              <p className="text-sm font-semibold text-white">
                Pick a squadmate to start chatting
              </p>
              <p className="text-xs">
                Your latest conversations will appear here once you open a chat.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
