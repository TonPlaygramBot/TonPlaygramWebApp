import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, Bell, BellOff, Camera, CheckCheck, Download, FileText, Gamepad2, Image, Mic, MoreHorizontal,
  Paperclip, Phone, Plus, Search, Send, ShieldCheck, Smile, Trophy, Users, Video, X
} from 'lucide-react';
import useTelegramBackButton from '../hooks/useTelegramBackButton.js';
import LoginOptions from '../components/LoginOptions.jsx';
import { getPlayerId, getTelegramId } from '../utils/telegram.js';
import {
  API_BASE_URL, acceptFriendRequest, getMessages, listFriendRequests, sendMessage,
  listFriends, markInboxRead, rejectFriendRequest
} from '../utils/api.js';
import { socket } from '../utils/socket.js';
import LeaderboardCard from '../components/LeaderboardCard.jsx';
import gamesCatalog from '../config/gamesCatalog.js';

const tabs = [
  { id: 'chats', label: 'Chats', Icon: Send },
  { id: 'friends', label: 'Friends', Icon: Users },
  { id: 'notifications', label: 'Alerts', Icon: Bell },
  { id: 'calls', label: 'Calls', Icon: Phone },
  { id: 'leaderboard', label: 'Ranks', Icon: Trophy }
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
  const [friendRequests, setFriendRequests] = useState([]);
  const [requestAction, setRequestAction] = useState('');
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('chats');
  const [actionNote, setActionNote] = useState('');
  const [attachment, setAttachment] = useState(null);
  const [isSending, setIsSending] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteGame, setInviteGame] = useState('snake');
  const [inviteMode, setInviteMode] = useState('1v1');
  const [groupFriendIds, setGroupFriendIds] = useState([]);
  const [loadError, setLoadError] = useState('');
  const messagesEndRef = useRef(null);
  const messagesThreadRef = useRef(null);
  const accountId = getPlayerId();

  const loadSocial = () => {
    if (!socialId) return Promise.resolve();
    return Promise.all([
      listFriends(socialId).then((result) => setFriends(Array.isArray(result) ? result : [])),
      listFriendRequests(socialId).then((result) => setFriendRequests(Array.isArray(result) ? result : result?.requests || []))
    ]);
  };

  useEffect(() => {
    if (!socialId) return;
    markInboxRead(socialId).catch(() => {});
    loadSocial().catch(() => { setFriends([]); setFriendRequests([]); setLoadError('We could not load your conversations. Please try again.'); });
  }, [socialId]);

  useEffect(() => {
    const refresh = () => loadSocial().catch(() => {});
    socket.on('friendRequest', refresh);
    socket.on('friendRequestAccepted', refresh);
    window.addEventListener('friend-request:push', refresh);
    return () => {
      socket.off('friendRequest', refresh);
      socket.off('friendRequestAccepted', refresh);
      window.removeEventListener('friend-request:push', refresh);
    };
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

  useEffect(() => {
    const thread = messagesThreadRef.current;
    if (!thread) return;
    // scrollIntoView can scroll Layout's viewport as well as this nested panel.
    // Telegram's WebView then leaves the fixed-height chat outside the visible
    // viewport, which looks like a black page after sending a message.
    thread.scrollTo({ top: thread.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const visibleFriends = useMemo(() => {
    const term = search.trim().toLowerCase();
    return friends.filter((friend) => !term || friendName(friend).toLowerCase().includes(term));
  }, [friends, search]);
  const incomingRequests = useMemo(() => friendRequests.filter((request) =>
    ![request.fromId, request.fromTelegramId, request.fromAccountId].some((id) => String(id) === String(socialId))
  ), [friendRequests, socialId]);

  async function respondToRequest(request, action) {
    const requestId = request.requestId || request._id;
    if (!requestId || requestAction) return;
    setRequestAction(`${requestId}:${action}`);
    try {
      if (action === 'accept') await acceptFriendRequest(requestId);
      else await rejectFriendRequest(requestId);
      await loadSocial();
      notify(action === 'accept' ? 'Friend request accepted' : 'Friend request rejected');
    } catch (error) {
      notify(error?.message || 'Could not update this request.');
    } finally {
      setRequestAction('');
    }
  }

  function hideRequest(request) {
    const requestId = request.requestId || request._id;
    setFriendRequests((current) => current.filter((item) => (item.requestId || item._id) !== requestId));
  }

  function FriendRequestCard({ request }) {
    const requestId = request.requestId || request._id;
    const busy = requestAction.startsWith(`${requestId}:`);
    return <article className="messages-friend-request">
      <Avatar friend={{ nickname: request.fromName, photo: request.fromPhoto }} />
      <span><strong>{request.fromName || 'TonPlaygram player'}</strong><small>wants to be your friend</small></span>
      <div>
        <button disabled={busy} onClick={() => respondToRequest(request, 'accept')}>Accept</button>
        <button disabled={busy} onClick={() => respondToRequest(request, 'reject')}>Reject</button>
        <button disabled={busy} onClick={() => hideRequest(request)}>Hide</button>
      </div>
    </article>;
  }

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
      const sent = await sendMessage(socialId, peerId, outgoingText, attachment);
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
    const selectedId = String(selected.accountId);
    const groupFriends = friends.filter((friend) => groupFriendIds.includes(String(friend.accountId)) || String(friend.accountId) === selectedId);
    const targets = inviteMode === 'group' ? groupFriends : [selected];
    if (inviteMode === 'group' && targets.length < 2) return notify('Select at least two friends for a group invite.');
    const roomId = `invite-${accountId}-${Date.now()}-${inviteMode === 'group' ? targets.length + 1 : 2}`;
    const common = {
      fromId: accountId, fromTelegramId: telegramId, fromName: 'TonPlaygram player',
      roomId, game: inviteGame, token: 'TPG', amount: 100
    };
    const event = inviteMode === 'group' ? 'inviteGroup' : 'invite1v1';
    const payload = inviteMode === 'group'
      ? { ...common, toIds: targets.map((friend) => friend.accountId), telegramIds: targets.map((friend) => friend.telegramId), opponentNames: targets.map(friendName) }
      : { ...common, toId: selected.accountId, toTelegramId: selected.telegramId };
    socket.emit(event, payload, (response) => {
      notify(response?.success ? `${inviteMode === 'group' ? 'Group' : '1v1'} game invite sent` : response?.error || 'Invite failed');
      if (response?.success) setInviteOpen(false);
    });
  }

  function attachmentUrl(url) { return `${API_BASE_URL}${url}`; }

  function attachmentDownloadUrl(file) {
    const separator = file.url.includes('?') ? '&' : '?';
    return `${attachmentUrl(file.url)}${separator}download=1&name=${encodeURIComponent(file.name || 'download')}`;
  }

  function MessageAttachment({ item }) {
    if (!item) return null;
    // Accept JSON attachment descriptors written during deployments that used
    // the legacy String schema, while all new messages use the object shape.
    let file = item;
    if (typeof item === 'string') {
      try { file = JSON.parse(item); } catch { return null; }
    }
    if (!file?.url) return null;
    const url = attachmentUrl(file.url);
    const downloadUrl = attachmentDownloadUrl(file);
    if (file.type?.startsWith('image/')) return <div className="messages-bubble-media"><img className="messages-bubble-image" src={url} alt={file.name} /><a href={downloadUrl} download={file.name}><Download /> Download photo</a></div>;
    if (file.type?.startsWith('video/')) return <div className="messages-bubble-media"><video className="messages-bubble-video" src={url} controls playsInline preload="metadata" /><a href={downloadUrl} download={file.name}><Download /> Download video</a></div>;
    return <a className="messages-bubble-file" href={downloadUrl} download={file.name}><FileText /><span><strong>{file.name}</strong><small>{Math.max(1, Math.round(file.size / 1024))} KB · Original file</small></span><Download /></a>;
  }

  if (!socialId) return <div className="messages-login"><LoginOptions /></div>;

  return (
    <main className={`messages-app social-page app-theme-page ${selected ? 'chat-is-open' : ''}`}>
      <section className="messages-sidebar">
        <header className="messages-topbar">
          <div><span>TONPLAYGRAM</span><h1>Social hub</h1><p>Your people, all in one place</p></div>
          <button aria-label="Start a new chat" onClick={() => { setActiveTab('friends'); setSearch(''); }}><Plus /></button>
        </header>

        <div className="messages-overview" aria-label="Social overview">
          <span><b>{friends.length}</b> Friends</span>
          <span><b>{friends.length}</b> Online</span>
          <span><b>{incomingRequests.length}</b> Requests</span>
        </div>

        <nav className="messages-tabs" aria-label="Social hub sections">
          {tabs.map(({ id, label, Icon }) => (
            <button key={id} className={activeTab === id ? 'active' : ''} onClick={() => setActiveTab(id)}>
              <Icon /><span>{label}</span>{id === 'chats' && friends.length > 0 && <b>{friends.length}</b>}
            </button>
          ))}
        </nav>

        {activeTab === 'leaderboard' ? (
          <div className="messages-leaderboard">
            <LeaderboardCard />
          </div>
        ) : <>
        <label className="messages-search"><Search /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Search ${activeTab}...`} /></label>

        {activeTab !== 'calls' && activeTab !== 'notifications' && friends.length > 0 && (
          <div className="messages-online">
            <div className="messages-section-heading"><strong>Online now</strong><span>{friends.length} friends</span></div>
            <div className="messages-online-row">
              {friends.slice(0, 8).map((friend) => <button key={`online-${friend.socialId || friend.telegramId || friend.accountId}`} onClick={() => setSelected(friend)}><Avatar friend={friend} /><span>{friendName(friend).split(' ')[0]}</span></button>)}
            </div>
          </div>
        )}

        <div className="messages-list">
          <div className="messages-section-heading"><strong>{activeTab === 'chats' ? 'Messages' : activeTab === 'friends' ? 'All friends' : activeTab === 'notifications' ? 'Notifications' : 'Recent calls'}</strong><button aria-label="More options"><MoreHorizontal /></button></div>
          {activeTab === 'notifications' && <div className="messages-alerts">
            {incomingRequests.map((request) => <FriendRequestCard key={`notice-request-${request.requestId || request._id}`} request={request} />)}
            {friends.slice(0, 3).map((friend, index) => <button key={`alert-${friend.socialId || friend.telegramId || friend.accountId}`} onClick={() => { setSelected(friend); setActiveTab('chats'); }}>
              <span className={`messages-alert-icon ${index === 1 ? 'violet' : ''}`}>{index === 1 ? <Gamepad2 /> : <Bell />}</span>
              <span><strong>{index === 1 ? 'Game night is starting' : `${friendName(friend)} is online`}</strong><small>{index === 1 ? 'Invite your squad and jump into a match.' : 'Say hello or start a quick call.'}</small><time>{index === 0 ? 'Just now' : `${index + 2}m ago`}</time></span>
            </button>)}
            {friends.length === 0 && <div className="messages-empty"><Bell /><strong>You’re all caught up</strong><p>Friend requests, messages, calls and game invites will appear here.</p></div>}
          </div>}
          {activeTab !== 'notifications' && <>
          {activeTab === 'friends' && incomingRequests.map((request) => <FriendRequestCard key={`friend-request-${request.requestId || request._id}`} request={request} />)}
          {visibleFriends.map((friend, index) => (
            <button className={`messages-person ${String(selected?.socialId || selected?.telegramId || selected?.accountId) === String(friend.socialId || friend.telegramId || friend.accountId) ? 'active' : ''}`} key={friend.socialId || friend.telegramId || friend.accountId} onClick={() => activeTab === 'calls' ? startFriendCall('voice', friend) : setSelected(friend)}>
              <Avatar friend={friend} />
              <span className="messages-person-copy"><strong>{friendName(friend)}</strong><small>{activeTab === 'calls' ? 'Tap to call again' : index === 0 ? 'Ready to play?' : 'Online · Active now'}</small></span>
              {activeTab === 'calls' ? <Phone className="messages-row-icon" /> : <span className="messages-person-meta"><time>{index === 0 ? 'Now' : '12m'}</time>{index < 2 && <b>{index + 1}</b>}</span>}
            </button>
          ))}
          {visibleFriends.length === 0 && <div className="messages-empty"><Users /><strong>No friends here yet</strong><p>Find players after a match and add them to start chatting, calling and playing together.</p></div>}
          </>}
        </div>
        </>}
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

          <div className="messages-thread" ref={messagesThreadRef}>
            <div className="messages-thread-intro"><Avatar friend={selected} large /><strong>{friendName(selected)}</strong><span>TonPlaygram friend</span><small><ShieldCheck /> Private conversation</small></div>
            <div className="messages-day"><span>Today</span></div>
            {loadError && <div className="messages-error" role="alert">{loadError}</div>}
            {messages.map((message, index) => {
              const mine = String(message.from) === String(socialId);
              return <div className={`messages-bubble-row ${mine ? 'mine' : ''}`} key={message._id || `${message.from}-${index}`}>
                {!mine && <Avatar friend={selected} />}
                <div className="messages-bubble"><MessageAttachment item={message.attachment} /><p>{message.text}</p><span>{message.createdAt ? new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Now'}{mine && <CheckCheck />}</span></div>
              </div>;
            })}
            {messages.length === 0 && <div className="messages-icebreakers"><span>Start with</span><button onClick={() => setText('Hey! Want to play a match?')}>🎮 Play a match?</button><button onClick={() => setText('Hey! How are you doing?')}>👋 Say hello</button></div>}
            <div ref={messagesEndRef} />
          </div>

          {attachment && <div className="messages-attachment"><Image /><span>{attachment.name}</span><button onClick={() => setAttachment(null)}>Remove</button></div>}
          <div className="messages-composer">
            <button aria-label="More message tools" onClick={() => notify('More tools coming soon')}><Plus /></button>
            <label aria-label="Attach a photo, video, PDF or document"><Paperclip /><input type="file" accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar,.7z,.heic,.heif,.mkv,.avi,.mov,.webm,.m4v" onChange={(event) => setAttachment(event.target.files?.[0] || null)} /></label>
            <div><input value={text} onChange={(event) => setText(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) handleSend(); }} placeholder="Message..." /><button aria-label="Add emoji" onClick={() => setText((value) => `${value} 😊`)}><Smile /></button></div>
            {text.trim() || attachment ? <button className="messages-send" disabled={isSending} onClick={handleSend} aria-label="Send message"><Send /></button> : <button onClick={() => notify('Hold to record a voice message')} aria-label="Record voice message"><Mic /></button>}
          </div>
          <div className="messages-quick-actions"><button onClick={() => { setGroupFriendIds([String(selected.accountId)]); setInviteOpen(true); }}><Gamepad2 /> Invite to game</button><button onClick={() => startFriendCall('video')}><Camera /> Video room</button><button onClick={() => notify('Notifications muted')}><BellOff /> Mute</button></div>
        </> : <div className="messages-chat-empty"><span><Send /></span><h2>Your conversations</h2><p>Select a friend to send a message or start a secure voice and video call.</p></div>}
      </section>
      {actionNote && <div className="messages-toast" role="status">{actionNote}</div>}
      {inviteOpen && <div className="messages-invite-backdrop" role="dialog" aria-modal="true" aria-label="Create game invite"><section className="messages-invite-sheet">
        <header><div><small>PLAY TOGETHER</small><h2>Choose a game</h2></div><button onClick={() => setInviteOpen(false)} aria-label="Close"><X /></button></header>
        <label className="messages-invite-field"><span>Game</span><select value={inviteGame} onChange={(event) => setInviteGame(event.target.value)}>{gamesCatalog.map((game) => <option key={game.slug} value={game.slug}>{game.name}</option>)}</select></label>
        <fieldset><legend>Invite type</legend><button className={inviteMode === '1v1' ? 'active' : ''} onClick={() => setInviteMode('1v1')}><Gamepad2 /><span><strong>1v1</strong><small>Challenge {friendName(selected)}</small></span></button><button className={inviteMode === 'group' ? 'active' : ''} onClick={() => setInviteMode('group')}><Users /><span><strong>Group</strong><small>Invite two or more friends</small></span></button></fieldset>
        {inviteMode === 'group' && <div className="messages-invite-friends"><strong>Select friends</strong>{friends.map((friend) => { const id = String(friend.accountId); const checked = groupFriendIds.includes(id) || id === String(selected.accountId); return <label key={id}><input type="checkbox" checked={checked} disabled={id === String(selected.accountId)} onChange={() => setGroupFriendIds((ids) => ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id])} /><Avatar friend={friend} /><span>{friendName(friend)}</span></label>; })}</div>}
        <button className="messages-invite-send" onClick={sendGameInvite}><Send /> Send {inviteMode === 'group' ? 'group' : '1v1'} invite</button>
      </section></div>}
    </main>
  );
}
