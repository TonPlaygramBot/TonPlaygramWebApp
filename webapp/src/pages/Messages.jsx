import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, BellOff, Camera, CheckCheck, Gamepad2, Image, Mic, MoreHorizontal,
  Paperclip, Phone, Plus, Search, Send, ShieldCheck, Smile, Users, Video
} from 'lucide-react';
import useTelegramBackButton from '../hooks/useTelegramBackButton.js';
import LoginOptions from '../components/LoginOptions.jsx';
import { getPlayerId, getTelegramId } from '../utils/telegram.js';
import { getMessages, sendMessage, listFriends, markInboxRead } from '../utils/api.js';
import { socket } from '../utils/socket.js';

const tabs = [
  { id: 'chats', label: 'Chats', Icon: Send },
  { id: 'friends', label: 'Friends', Icon: Users },
  { id: 'calls', label: 'Calls', Icon: Phone }
];

function friendName(friend) {
  return friend?.nickname || `${friend?.firstName || ''} ${friend?.lastName || ''}`.trim() || 'Player';
}

function initials(friend) {
  return friendName(friend).split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}

function Avatar({ friend, large = false }) {
  const photo = friend?.photo || friend?.photoUrl;
  return (
    <span className={`messages-avatar ${large ? 'is-large' : ''}`}>
      {photo ? <img src={photo} alt="" /> : initials(friend)}
      <i aria-label="Online" />
    </span>
  );
}

export default function Messages() {
  useTelegramBackButton();
  const telegramId = getTelegramId();
  const socialId = telegramId || getPlayerId();
  const [friends, setFriends] = useState([]);
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('chats');
  const [actionNote, setActionNote] = useState('');
  const [attachment, setAttachment] = useState(null);
  const [isSending, setIsSending] = useState(false);
  const [loadError, setLoadError] = useState('');
  const messagesEndRef = useRef(null);
  const accountId = getPlayerId();

  useEffect(() => {
    if (!socialId) return;
    markInboxRead(socialId).catch(() => {});
    listFriends(socialId).then((result) => {
      const nextFriends = Array.isArray(result) ? result : [];
      setFriends(nextFriends);
      // Open the inbox itself, rather than making phone users stop at the
      // conversation list and tap a second time before they can read a message.
      setSelected((current) => current || nextFriends[0] || null);
    }).catch(() => { setFriends([]); setLoadError('We could not load your conversations. Please try again.'); });
  }, [socialId]);

  useEffect(() => {
    if (!selected || !socialId) return;
    const peerId = selected.socialId || selected.telegramId || selected.accountId;
    getMessages(socialId, peerId).then((result) => {
      setMessages(Array.isArray(result) ? result : []);
      markInboxRead(socialId).catch(() => {});
      setLoadError('');
    }).catch(() => setLoadError('We could not open this conversation. Please try again.'));
  }, [selected, socialId]);

  useEffect(() => {
    const receive = (message) => {
      const peerId = selected?.socialId || selected?.telegramId || selected?.accountId;
      if (!selected || (String(message.from) !== String(peerId) && String(message.to) !== String(peerId))) return;
      setMessages((current) => [...current, message]);
      markInboxRead(socialId).catch(() => {});
    };
    socket.on('privateMessage', receive);
    return () => socket.off('privateMessage', receive);
  }, [selected, socialId]);

  useEffect(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), [messages]);

  const visibleFriends = useMemo(() => {
    const term = search.trim().toLowerCase();
    return friends.filter((friend) => !term || friendName(friend).toLowerCase().includes(term));
  }, [friends, search]);

  function notify(message) {
    setActionNote(message);
    window.clearTimeout(notify.timer);
    notify.timer = window.setTimeout(() => setActionNote(''), 2600);
  }

  async function handleSend() {
    const cleanText = text.trim();
    if ((!cleanText && !attachment) || !selected) return;
    const outgoingText = cleanText || `Shared ${attachment.type.startsWith('image/') ? 'a photo' : attachment.name}`;
    const peerId = selected.socialId || selected.telegramId || selected.accountId;
    if (isSending) return;
    setIsSending(true);
    try {
      const sent = await sendMessage(socialId, peerId, outgoingText);
      if (sent?.error) throw new Error(sent.error);
      setMessages((current) => current.some((item) => item._id === sent._id) ? current : [...current, sent]);
      setText('');
      setAttachment(null);
      setLoadError('');
      markInboxRead(socialId).catch(() => {});
    } catch (error) {
      setLoadError(error?.message || 'Message could not be sent. Please try again.');
    } finally {
      setIsSending(false);
    }
  }

  function startFriendCall(type, friend = selected) {
    if (!friend?.accountId || !friend?.telegramId) return notify('This friend is not available for calls yet.');
    if (!socket.connected) socket.connect();
    socket.emit('register', { playerId: accountId, tpcAccountNumber: accountId });
    socket.emit('friendCall:invite', {
      fromAccountId: accountId, toAccountId: friend.accountId, fromTelegramId: telegramId,
      toTelegramId: friend.telegramId, fromName: 'TonPlaygram player', type
    }, (response) => {
      if (!response?.success) return notify(response?.error || 'Unable to start call.');
      window.dispatchEvent(new CustomEvent('friend-call:start', {
        detail: { ...response.call, name: friendName(friend), photo: friend.photo || friend.photoUrl }
      }));
      notify(`${type === 'video' ? 'Video' : 'Voice'} call started`);
    });
  }

  function sendGameInvite() {
    if (!selected?.accountId || !selected?.telegramId) return notify('This friend is not available for invites yet.');
    socket.emit('invite1v1', {
      fromId: accountId, fromTelegramId: telegramId, fromName: 'TonPlaygram player',
      toId: selected.accountId, toTelegramId: selected.telegramId,
      roomId: `invite-${accountId}-${selected.accountId}-${Date.now()}-2`, game: 'snake', token: 'TPG', amount: 100
    }, (response) => notify(response?.success ? 'Game invite sent' : response?.error || 'Invite failed'));
  }

  if (!socialId) return <div className="messages-login"><LoginOptions /></div>;

  return (
    <main className={`messages-app ${selected ? 'chat-is-open' : ''}`}>
      <section className="messages-sidebar">
        <header className="messages-topbar">
          <div><span>TONPLAYGRAM</span><h1>Social hub</h1></div>
          <button aria-label="Start a new chat" onClick={() => { setActiveTab('friends'); setSearch(''); }}><Plus /></button>
        </header>

        <nav className="messages-tabs" aria-label="Social hub sections">
          {tabs.map(({ id, label, Icon }) => (
            <button key={id} className={activeTab === id ? 'active' : ''} onClick={() => setActiveTab(id)}>
              <Icon /><span>{label}</span>{id === 'chats' && friends.length > 0 && <b>{friends.length}</b>}
            </button>
          ))}
        </nav>

        <label className="messages-search"><Search /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Search ${activeTab}...`} /></label>

        {activeTab !== 'calls' && friends.length > 0 && (
          <div className="messages-online">
            <div className="messages-section-heading"><strong>Online now</strong><span>{friends.length} friends</span></div>
            <div className="messages-online-row">
              {friends.slice(0, 8).map((friend) => <button key={`online-${friend.socialId || friend.telegramId || friend.accountId}`} onClick={() => setSelected(friend)}><Avatar friend={friend} /><span>{friendName(friend).split(' ')[0]}</span></button>)}
            </div>
          </div>
        )}

        <div className="messages-list">
          <div className="messages-section-heading"><strong>{activeTab === 'chats' ? 'Messages' : activeTab === 'friends' ? 'All friends' : 'Recent calls'}</strong><button><MoreHorizontal /></button></div>
          {visibleFriends.map((friend, index) => (
            <button className={`messages-person ${String(selected?.socialId || selected?.telegramId || selected?.accountId) === String(friend.socialId || friend.telegramId || friend.accountId) ? 'active' : ''}`} key={friend.socialId || friend.telegramId || friend.accountId} onClick={() => activeTab === 'calls' ? startFriendCall('voice', friend) : setSelected(friend)}>
              <Avatar friend={friend} />
              <span className="messages-person-copy"><strong>{friendName(friend)}</strong><small>{activeTab === 'calls' ? 'Tap to call again' : index === 0 ? 'Ready to play?' : 'Online · Active now'}</small></span>
              {activeTab === 'calls' ? <Phone className="messages-row-icon" /> : <span className="messages-person-meta"><time>{index === 0 ? 'Now' : '12m'}</time>{index < 2 && <b>{index + 1}</b>}</span>}
            </button>
          ))}
          {visibleFriends.length === 0 && <div className="messages-empty"><Users /><strong>No friends here yet</strong><p>Find players after a match and add them to start chatting, calling and playing together.</p></div>}
        </div>
      </section>

      <section className="messages-chat">
        {selected ? <>
          <header className="messages-chat-head">
            <button className="messages-back" onClick={() => setSelected(null)} aria-label="Back to conversations"><ArrowLeft /></button>
            <Avatar friend={selected} />
            <div><strong>{friendName(selected)}</strong><span><i /> Online now</span></div>
            <button onClick={() => startFriendCall('voice')} aria-label={`Voice call ${friendName(selected)}`}><Phone /></button>
            <button onClick={() => startFriendCall('video')} aria-label={`Video call ${friendName(selected)}`}><Video /></button>
            <button onClick={() => notify('Conversation options opened')} aria-label="Conversation options"><MoreHorizontal /></button>
          </header>

          <div className="messages-thread">
            <div className="messages-thread-intro"><Avatar friend={selected} large /><strong>{friendName(selected)}</strong><span>TonPlaygram friend</span><small><ShieldCheck /> Private conversation</small></div>
            <div className="messages-day"><span>Today</span></div>
            {loadError && <div className="messages-error" role="alert">{loadError}</div>}
            {messages.map((message, index) => {
              const mine = String(message.from) === String(socialId);
              return <div className={`messages-bubble-row ${mine ? 'mine' : ''}`} key={message._id || `${message.from}-${index}`}>
                {!mine && <Avatar friend={selected} />}
                <div className="messages-bubble"><p>{message.text}</p><span>{message.createdAt ? new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Now'}{mine && <CheckCheck />}</span></div>
              </div>;
            })}
            {messages.length === 0 && <div className="messages-icebreakers"><span>Start with</span><button onClick={() => setText('Hey! Want to play a match?')}>🎮 Play a match?</button><button onClick={() => setText('Hey! How are you doing?')}>👋 Say hello</button></div>}
            <div ref={messagesEndRef} />
          </div>

          {attachment && <div className="messages-attachment"><Image /><span>{attachment.name}</span><button onClick={() => setAttachment(null)}>Remove</button></div>}
          <div className="messages-composer">
            <button aria-label="More message tools" onClick={() => notify('More tools coming soon')}><Plus /></button>
            <label aria-label="Attach a photo or file"><Paperclip /><input type="file" accept="image/*,video/*" onChange={(event) => setAttachment(event.target.files?.[0] || null)} /></label>
            <div><input value={text} onChange={(event) => setText(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) handleSend(); }} placeholder="Message..." /><button aria-label="Add emoji" onClick={() => setText((value) => `${value} 😊`)}><Smile /></button></div>
            {text.trim() || attachment ? <button className="messages-send" disabled={isSending} onClick={handleSend} aria-label="Send message"><Send /></button> : <button onClick={() => notify('Hold to record a voice message')} aria-label="Record voice message"><Mic /></button>}
          </div>
          <div className="messages-quick-actions"><button onClick={sendGameInvite}><Gamepad2 /> Invite to game</button><button onClick={() => startFriendCall('video')}><Camera /> Video room</button><button onClick={() => notify('Notifications muted')}><BellOff /> Mute</button></div>
        </> : <div className="messages-chat-empty"><span><Send /></span><h2>Your conversations</h2><p>Select a friend to send a message or start a secure voice and video call.</p></div>}
      </section>
      {actionNote && <div className="messages-toast" role="status">{actionNote}</div>}
    </main>
  );
}
