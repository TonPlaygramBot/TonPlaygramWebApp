import './messages.css';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDownLeft, ArrowLeft, ArrowUpRight, Bell, Check, ChevronRight, Clock3, Download,
  FileText, Gamepad2, LockKeyhole, MoreHorizontal, Paperclip, Phone, Pin, Plus, Reply,
  Search, Send, ShieldCheck, Smile, Trash2, Trophy, Users, Video, X
} from 'lucide-react';
import useTelegramBackButton from '../hooks/useTelegramBackButton.js';
import LinkGoogleButton from '../components/LinkGoogleButton.jsx';
import { getPlayerId, getTelegramId } from '../utils/telegram.js';
import { acceptFriendRequest, listFriendRequests, listFriends, markInboxRead, rejectFriendRequest } from '../utils/api.js';
import { socket } from '../utils/socket.js';
import LeaderboardCard from '../components/LeaderboardCard.jsx';
import { inviteGamesCatalog } from '../config/gamesCatalog.js';
import {
  acceptPeerKeyChange, clearSecureConversation, decryptMessages, deleteSecureMessage,
  initializeSecureMessaging, loadMessages, prepareConversation, releaseMessageAttachments, resetConversationDeviceKey, sendSecureMessage
} from '../utils/secureMessages.js';
import {
  belongsToConversation, clearLocalCalls, isMessageAlive, listLocalCalls, mergeMessages,
  readHubPreferences, recordLocalCall, saveHubPreferences, updateLocalCall
} from '../utils/socialHubState.js';
import './social-hub.css';

const TABS = [
  { id: 'chats', label: 'Chats', Icon: Send }, { id: 'friends', label: 'Friends', Icon: Users },
  { id: 'notifications', label: 'Requests', Icon: Bell }, { id: 'calls', label: 'Calls', Icon: Phone },
  { id: 'leaderboard', label: 'Ranks', Icon: Trophy }
];
const TIMERS = [{ value: 0, label: 'Off', detail: 'Keep until you delete' }, { value: 3600, label: '1 hour', detail: 'From the moment you send' }, { value: 86400, label: '24 hours', detail: 'From the moment you send' }, { value: 604800, label: '7 days', detail: 'From the moment you send' }];
const EMOJI = ['😀', '😊', '😂', '❤️', '🔥', '🎮', '🏆', '👏', '👍', '👋', '🎉', '💪', '😎', '🤝', '⚡', '🙏'];
const MAX_ATTACHMENT = 2 * 1024 * 1024;
const peerIdOf = friend => String(friend?.accountId || friend?.socialId || friend?.telegramId || '');
const friendName = friend => friend?.nickname || `${friend?.firstName || ''} ${friend?.lastName || ''}`.trim() || 'Player';
const formatTime = date => new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const isAuthError = error => error?.code === 'SIGN_IN_REQUIRED' || error?.status === 401 || /unauthorized|sign.in|authentication|session.*expired/i.test(error?.message || error?.error || '');
function checked(result) { if (result?.error) throw Object.assign(new Error(result.error), { status: result.status }); return result; }

function Avatar({ friend, large = false }) {
  const photo = friend?.photo || friend?.photoUrl;
  return <span className={`hub-avatar ${large ? 'large' : ''}`}>{photo ? <img src={photo} alt="" /> : friendName(friend).split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase()}</span>;
}

function Sheet({ title, children, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    const root = ref.current;
    root?.querySelector('button')?.focus();
    const trap = event => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); }
      if (event.key !== 'Tab') return;
      const items = [...root.querySelectorAll('button:not(:disabled),input:not(:disabled),select,a[href],textarea')];
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    root?.addEventListener('keydown', trap);
    return () => { root?.removeEventListener('keydown', trap); previous?.focus?.(); };
  }, []);
  return <div className="hub-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}><section ref={ref} className="hub-sheet" role="dialog" aria-modal="true" aria-label={title}><header><h2>{title}</h2><button className="hub-icon" onClick={onClose} aria-label="Close dialog"><X /></button></header>{children}</section></div>;
}

function MessageAttachment({ attachment }) {
  if (!attachment?.url?.startsWith('blob:')) return attachment ? <small className="hub-legacy">Attachment unavailable on this device</small> : null;
  const file = attachment;
  return <div className="hub-file">
    {file.type?.startsWith('image/') && <img src={file.url} alt={file.name || 'Shared image'} loading="lazy" />}
    {file.type?.startsWith('video/') && <video src={file.url} controls playsInline preload="metadata" />}
    <a href={file.url} download={file.name || 'attachment'}><FileText /><span>{file.name}<small>{Math.max(1, Math.round(file.size / 1024))} KB</small></span><Download /></a>
  </div>;
}

export default function Messages() {
  useTelegramBackButton();
  const [, refreshIdentity] = useState(0);
  const telegramId = getTelegramId();
  const accountId = getPlayerId();
  const socialId = telegramId || accountId;
  const [friends, setFriends] = useState([]);
  const [friendRequests, setFriendRequests] = useState([]);
  const [requestAction, setRequestAction] = useState('');
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);
  const messagesRef = useRef([]);
  const [text, setText] = useState('');
  const [attachment, setAttachment] = useState(null);
  const [replyTo, setReplyTo] = useState(null);
  const [search, setSearch] = useState('');
  const [messageSearch, setMessageSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('chats');
  const [note, setNote] = useState('');
  const [listError, setListError] = useState('');
  const [setupError, setSetupError] = useState('');
  const socialGeneration = useRef(0);
  const [error, setError] = useState('');
  const [authRequired, setAuthRequired] = useState(false);
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [busy, setBusy] = useState(false);
  const [context, setContext] = useState(null);
  const contextRef = useRef(null);
  const generation = useRef(0);
  const deletedIds = useRef(new Set());
  const clearedBefore = useRef(0);
  const [reload, setReload] = useState(0);
  const [hasEarlier, setHasEarlier] = useState(false);
  const nextCursor = useRef(null);
  const [sheet, setSheet] = useState(null);
  const [targetMessage, setTargetMessage] = useState(null);
  const [trustConfirmed, setTrustConfirmed] = useState(false);
  const [resetConfirmed, setResetConfirmed] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [preferences, setPreferences] = useState(() => readHubPreferences(accountId || socialId));
  const [calls, setCalls] = useState(() => listLocalCalls(accountId || socialId));
  const [inviteGame, setInviteGame] = useState('snake');
  const [inviteMode, setInviteMode] = useState('1v1');
  const [groupFriendIds, setGroupFriendIds] = useState([]);
  const threadRef = useRef(null);
  const fileRef = useRef(null);
  const toastTimer = useRef(null);
  const selfStorageId = accountId || socialId;
  const selectedId = peerIdOf(selected);
  const ttlSeconds = Number(preferences.timers[selectedId]) || 0;
  const timerLabel = TIMERS.find(timer => timer.value === ttlSeconds)?.label || 'Off';

  const notify = useCallback(message => {
    setNote(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setNote(''), 3500);
  }, []);
  const updateMessages = useCallback(next => {
    const previous = messagesRef.current;
    const candidate = typeof next === 'function' ? next(previous) : next;
    const result = candidate.filter(message => !deletedIds.current.has(String(message._id)) && isMessageAlive(message) && Date.parse(message.createdAt) > clearedBefore.current);
    releaseMessageAttachments(candidate.filter(message => !result.includes(message)));
    const urls = new Set(result.map(item => item.attachment?.url).filter(Boolean));
    releaseMessageAttachments(previous.filter(item => item.attachment?.url && !urls.has(item.attachment.url)));
    messagesRef.current = result;
    setMessages(result);
  }, []);
  const appendMessages = useCallback(records => {
    const merged = mergeMessages(messagesRef.current, records, Date.now(), deletedIds.current);
    releaseMessageAttachments(records.filter(record => !merged.includes(record)));
    updateMessages(merged);
  }, [updateMessages]);
  const report = useCallback(cause => {
    if (isAuthError(cause)) {
      generation.current++; contextRef.current = null; setContext(null); updateMessages([]); setText(''); setAttachment(null); setReplyTo(null); setTargetMessage(null); setSheet(null); setSelected(null); setAuthRequired(true);
    }
    const message = cause?.message || 'This action could not be completed. Try again.';
    setError(message);
    notify(message);
  }, [notify, updateMessages]);

  const loadSocial = useCallback(async () => {
    if (!socialId) { setSocialLoading(false); setAuthRequired(true); return; }
    const version = ++socialGeneration.current;
    setSocialLoading(true);
    try {
      const [people, requests] = await Promise.all([listFriends(socialId), listFriendRequests(socialId)]);
      checked(people); checked(requests);
      if (version !== socialGeneration.current) return;
      setFriends(Array.isArray(people) ? people : []);
      setFriendRequests(Array.isArray(requests) ? requests : requests?.requests || []);
      setListError('');
      try {
        const setup = await initializeSecureMessaging(socialId);
        if (version !== socialGeneration.current) return;
        setSetupError(setup.securityReason === 'DEVICE_KEY_UNAVAILABLE' ? 'This browser needs a device key. Open a conversation to review your key options.' : '');
      } catch (cause) {
        if (version !== socialGeneration.current) return;
        setSetupError(cause?.message || 'Encrypted messaging setup could not finish.');
        if (isAuthError(cause)) report(cause);
      }
    } catch (cause) {
      if (version !== socialGeneration.current) return;
      setListError(cause?.message || 'Could not load your friends.');
      if (isAuthError(cause)) report(cause);
    } finally { if (version === socialGeneration.current) setSocialLoading(false); }
  }, [socialId, report]);

  useEffect(() => { loadSocial(); }, [loadSocial]);
  useEffect(() => {
    const refresh = () => loadSocial();
    socket.on('friendRequest', refresh); socket.on('friendRequestAccepted', refresh);
    window.addEventListener('friend-request:push', refresh);
    return () => { socket.off('friendRequest', refresh); socket.off('friendRequestAccepted', refresh); window.removeEventListener('friend-request:push', refresh); };
  }, [loadSocial]);
  useEffect(() => { setPreferences(readHubPreferences(selfStorageId)); setCalls(listLocalCalls(selfStorageId)); }, [selfStorageId]);
  function updatePreferences(updater) {
    setPreferences(current => { const next = updater(current); saveHubPreferences(selfStorageId, next); return next; });
  }
  useEffect(() => {
    const identityChanged = event => {
      if (event.type === 'storage' && !['accountId', 'googleId', null].includes(event.key)) return;
      generation.current++; contextRef.current = null; setContext(null); updateMessages([]); setText(''); setAttachment(null); setReplyTo(null); setTargetMessage(null); setSheet(null);
      refreshIdentity(value => value + 1); setReload(value => value + 1); setAuthRequired(false); loadSocial();
    };
    window.addEventListener('accountUpdated', identityChanged); window.addEventListener('storage', identityChanged); window.addEventListener('social-auth-changed', identityChanged);
    return () => { window.removeEventListener('accountUpdated', identityChanged); window.removeEventListener('storage', identityChanged); window.removeEventListener('social-auth-changed', identityChanged); };
  }, [loadSocial, updateMessages]);
  useEffect(() => {
    const refresh = () => setCalls(listLocalCalls(selfStorageId));
    window.addEventListener('social-hub:calls-changed', refresh); window.addEventListener('storage', refresh);
    const incoming = call => recordLocalCall(selfStorageId, call, { direction: 'incoming' });
    const accepted = ({ roomId }) => updateLocalCall(selfStorageId, roomId, 'connected');
    const ended = ({ roomId, reason }) => updateLocalCall(selfStorageId, roomId, reason === 'declined' ? 'declined' : 'ended');
    socket.on('friendCall:incoming', incoming); socket.on('friendCall:accepted', accepted); socket.on('friendCall:ended', ended);
    return () => { window.removeEventListener('social-hub:calls-changed', refresh); window.removeEventListener('storage', refresh); socket.off('friendCall:incoming', incoming); socket.off('friendCall:accepted', accepted); socket.off('friendCall:ended', ended); };
  }, [selfStorageId]);

  useEffect(() => {
    const version = ++generation.current;
    let stopped = false;
    contextRef.current = null; setContext(null); clearedBefore.current = 0; deletedIds.current = new Set(); updateMessages([]);
    setText(''); setAttachment(null); setReplyTo(null); setMessageSearch(''); setSearchOpen(false); setEmojiOpen(false);
    setError(''); setSending(false); setBusy(false); setSheet(null); setHasEarlier(false); nextCursor.current = null;
    if (!selectedId || !socialId) { setLoading(false); return; }
    setLoading(true);
    (async () => {
      try {
        const next = await prepareConversation(socialId, selectedId);
        if (stopped || version !== generation.current) return;
        contextRef.current = next; setContext(next);
        const records = await loadMessages(next, { limit: 50 });
        if (stopped || version !== generation.current) { releaseMessageAttachments(records); return; }
        appendMessages(records);
        setHasEarlier(records.hasMore ?? records.length >= 50); nextCursor.current = records.nextCursor || records[0]?._id || null;
        markInboxRead(socialId).catch(() => {});
      } catch (cause) { if (!stopped && version === generation.current) report(cause); }
      finally { if (!stopped && version === generation.current) setLoading(false); }
    })();
    return () => { stopped = true; };
  }, [selectedId, socialId, reload, updateMessages, appendMessages, report]);

  useEffect(() => {
    const receive = async record => {
      const ctx = contextRef.current, version = generation.current;
      if (!belongsToConversation(record, ctx)) return;
      try {
        const records = await decryptMessages(ctx, [record]);
        if (version !== generation.current) { releaseMessageAttachments(records); return; }
        appendMessages(records);
        markInboxRead(socialId).catch(() => {});
      } catch (cause) { if (version === generation.current) report(cause); }
    };
    const remove = event => {
      if (!belongsToConversation(event, contextRef.current)) return;
      deletedIds.current.add(String(event.id));
      updateMessages(current => current.filter(message => String(message._id) !== String(event.id)));
      setReplyTo(current => current?.id === event.id ? null : current);
      setTargetMessage(current => current?._id === event.id ? null : current);
    };
    const cleared = ({ withId, cutoffAt }) => {
      if (String(withId) !== String(contextRef.current?.peerId)) return;
      const cutoff = Date.parse(cutoffAt);
      if (!Number.isFinite(cutoff)) return;
      clearedBefore.current = Math.max(clearedBefore.current, cutoff);
      messagesRef.current.filter(message => Date.parse(message.createdAt) <= cutoff).forEach(message => deletedIds.current.add(String(message._id)));
      updateMessages(current => current.filter(message => Date.parse(message.createdAt) > cutoff)); setReplyTo(null); setTargetMessage(null);
    };
    const refresh = () => { if (contextRef.current) setReload(value => value + 1); };
    const requireAuth = () => { generation.current++; contextRef.current = null; setContext(null); updateMessages([]); setText(''); setAttachment(null); setReplyTo(null); setTargetMessage(null); setSheet(null); setSelected(null); setAuthRequired(true); };
    socket.on('social:authentication-required', requireAuth);
    socket.on('privateMessage', receive); socket.on('privateMessage:deleted', remove); socket.on('privateMessage:cleared', cleared); socket.on('connect', refresh);
    return () => { socket.off('social:authentication-required', requireAuth); socket.off('privateMessage', receive); socket.off('privateMessage:deleted', remove); socket.off('privateMessage:cleared', cleared); socket.off('connect', refresh); };
  }, [socialId, updateMessages, appendMessages, report]);

  useEffect(() => {
    const expire = () => {
      const alive = messagesRef.current.filter(message => isMessageAlive(message));
      if (alive.length !== messagesRef.current.length) updateMessages(alive);
      setReplyTo(current => current && current.expiresAt && !isMessageAlive(current) ? null : current);
      setTargetMessage(current => current && !isMessageAlive(current) ? null : current);
    };
    const timer = setInterval(expire, 1000);
    document.addEventListener('visibilitychange', expire);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', expire); };
  }, [updateMessages]);
  useEffect(() => () => { generation.current++; socialGeneration.current++; clearTimeout(toastTimer.current); releaseMessageAttachments(messagesRef.current); }, []);
  useEffect(() => { threadRef.current?.scrollTo?.({ top: threadRef.current.scrollHeight, behavior: 'smooth' }); }, [messages.length, selectedId]);

  const visibleFriends = useMemo(() => [...friends].filter(friend => friendName(friend).toLowerCase().includes(search.trim().toLowerCase())).sort((a, b) => Number(preferences.pins.includes(peerIdOf(b))) - Number(preferences.pins.includes(peerIdOf(a)))), [friends, search, preferences.pins]);
  const incomingRequests = friendRequests.filter(request => ![request.fromId, request.fromTelegramId, request.fromAccountId].some(id => id != null && [String(socialId), String(accountId)].includes(String(id))));
  const filteredMessages = messages.filter(message => !messageSearch.trim() || `${message.text || ''} ${message.attachment?.name || ''}`.toLowerCase().includes(messageSearch.trim().toLowerCase()));
  const visibleCalls = calls.filter(call => call.name.toLowerCase().includes(search.trim().toLowerCase()));

  async function respondToRequest(request, action) {
    const id = request.requestId || request._id;
    if (requestAction) return;
    setRequestAction(String(id));
    try { checked(await (action === 'accept' ? acceptFriendRequest(id) : rejectFriendRequest(id))); await loadSocial(); notify(action === 'accept' ? 'Friend added' : 'Request declined'); }
    catch (cause) { notify(cause?.message || 'Could not update request.'); }
    finally { setRequestAction(''); }
  }

  async function handleSend(event) {
    event?.preventDefault();
    const ctx = contextRef.current, version = generation.current;
    if (!ctx?.canSend || sending || (!text.trim() && !attachment)) return;
    const content = { text: text.trim(), attachment, replyTo: replyTo ? { id: replyTo.id, from: replyTo.from } : null, ttlSeconds };
    setSending(true); setError('');
    try {
      const sent = await sendSecureMessage(ctx, content);
      if (version !== generation.current) { releaseMessageAttachments([sent]); return; }
      appendMessages([sent]);
      setText(''); setAttachment(null); setReplyTo(null); setEmojiOpen(false);
      if (fileRef.current) fileRef.current.value = '';
    } catch (cause) { if (version === generation.current) report(cause); }
    finally { if (version === generation.current) setSending(false); }
  }

  async function loadEarlier() {
    const ctx = contextRef.current, version = generation.current;
    if (!ctx || busy || !nextCursor.current) return;
    setBusy(true);
    try {
      const records = await loadMessages(ctx, { before: nextCursor.current, limit: 50 });
      if (version !== generation.current) { releaseMessageAttachments(records); return; }
      appendMessages(records);
      setHasEarlier(records.hasMore ?? records.length >= 50); nextCursor.current = records.nextCursor || records[0]?._id || null;
    } catch (cause) { if (version === generation.current) report(cause); }
    finally { if (version === generation.current) setBusy(false); }
  }

  async function deleteMessage(scope) {
    const ctx = contextRef.current, target = targetMessage, version = generation.current;
    if (!ctx || !target || busy) return;
    setBusy(true);
    try {
      await deleteSecureMessage(ctx, target._id, scope);
      if (version !== generation.current) return;
      deletedIds.current.add(String(target._id));
      updateMessages(current => current.filter(message => message._id !== target._id));
      setReplyTo(current => current?.id === target._id ? null : current);
      setSheet(null); setTargetMessage(null); notify(scope === 'everyone' ? 'Message deleted for everyone' : 'Message deleted for you');
    } catch (cause) { if (version === generation.current) report(cause); }
    finally { if (version === generation.current) setBusy(false); }
  }

  async function clearConversation() {
    const ctx = contextRef.current, version = generation.current;
    if (!ctx || busy) return;
    setBusy(true);
    try {
      const result = await clearSecureConversation(ctx, 'me');
      if (version !== generation.current) return;
      const cutoff = Date.parse(result.cutoffAt);
      if (!Number.isFinite(cutoff)) throw new Error('The server did not confirm the clear time. Reopen the conversation.');
      clearedBefore.current = Math.max(clearedBefore.current, cutoff);
      messagesRef.current.filter(message => Date.parse(message.createdAt) <= cutoff).forEach(message => deletedIds.current.add(String(message._id)));
      updateMessages(current => current.filter(message => Date.parse(message.createdAt) > cutoff)); setReplyTo(null); setSheet(null); notify('Conversation cleared for you');
    } catch (cause) { if (version === generation.current) report(cause); }
    finally { if (version === generation.current) setBusy(false); }
  }

  async function trustKey() {
    if (!trustConfirmed || busy || !context) return;
    const version = generation.current;
    setBusy(true);
    try {
      const next = await acceptPeerKeyChange(context);
      if (version !== generation.current) return;
      contextRef.current = next; setContext(next); setTrustConfirmed(false); setSheet(null); notify('New key trusted on this device');
    } catch (cause) { if (version === generation.current) report(cause); }
    finally { if (version === generation.current) setBusy(false); }
  }

  async function replaceDeviceKey() {
    if (!resetConfirmed || busy || !context) return;
    const version = generation.current; setBusy(true);
    try {
      const next = await resetConversationDeviceKey(context);
      if (version !== generation.current) return;
      contextRef.current = next; setContext(next); setResetConfirmed(false); setSheet(null); setReload(value => value + 1); notify('New device key created. Compare safety codes again.');
    } catch (cause) { if (version === generation.current) report(cause); }
    finally { if (version === generation.current) setBusy(false); }
  }

  function replyPreview(id) {
    const original = messages.find(message => message._id === id && isMessageAlive(message));
    return original ? (original.text || 'Attachment') : 'Original message unavailable';
  }

  function startFriendCall(type, friend = selected) {
    if (!friend?.accountId) return notify('This friend is not available for calls yet.');
    if (!socket.connected) socket.connect();
    socket.emit('friendCall:invite', { fromAccountId: accountId, toAccountId: friend.accountId, fromTelegramId: telegramId, toTelegramId: friend.telegramId, type }, response => {
      if (!response?.success) return notify(response?.error || 'Unable to start call.');
      recordLocalCall(selfStorageId, response.call, { direction: 'outgoing' });
      window.dispatchEvent(new CustomEvent('friend-call:start', { detail: { ...response.call, name: friendName(friend), photo: friend.photo || friend.photoUrl } }));
      notify(`${type === 'video' ? 'Video' : 'Voice'} call ringing`);
    });
  }

  function sendGameInvite() {
    if (!selected?.accountId || !selected?.telegramId) return notify('This friend is not available for game invites yet.');
    const targets = inviteMode === 'group' ? friends.filter(friend => groupFriendIds.includes(peerIdOf(friend)) || peerIdOf(friend) === selectedId) : [selected];
    if (inviteMode === 'group' && targets.length < 2) return notify('Choose at least two friends.');
    const common = { fromId: accountId, fromTelegramId: telegramId, fromName: 'TonPlaygram player', roomId: `invite-${accountId}-${Date.now()}-${targets.length + 1}`, game: inviteGame, token: 'TPG', amount: 100 };
    const payload = inviteMode === 'group' ? { ...common, toIds: targets.map(friend => friend.accountId), telegramIds: targets.map(friend => friend.telegramId), opponentNames: targets.map(friendName) } : { ...common, toId: selected.accountId, toTelegramId: selected.telegramId };
    socket.emit(inviteMode === 'group' ? 'inviteGroup' : 'invite1v1', payload, response => { notify(response?.success ? 'Game invite sent' : response?.error || 'Invite failed'); if (response?.success) setSheet(null); });
  }

  function FriendRequest({ request }) {
    const id = request.requestId || request._id;
    return <article className="hub-request"><Avatar friend={{ nickname: request.fromName, photo: request.fromPhoto }} /><div><strong>{request.fromName || 'Player'}</strong><p>Wants to be your friend</p></div><footer><button disabled={requestAction === String(id)} className="hub-primary" onClick={() => respondToRequest(request, 'accept')}>Accept</button><button disabled={requestAction === String(id)} onClick={() => respondToRequest(request, 'reject')}>Decline</button></footer></article>;
  }

  return <main className={`messages-app hub-v2 ${selected ? 'chat-is-open' : ''}`}>
    <section className="hub-sidebar">
      <header className="hub-topbar"><div><span className="hub-eyebrow">TONPLAYGRAM</span><h1>Social hub<span>.</span></h1><p>Good games. Great company.</p></div><button className="hub-icon hub-plus" aria-label="Start a new chat" onClick={() => { setActiveTab('friends'); setSearch(''); }}><Plus /></button></header>
      <div className="hub-status"><LockKeyhole /><div><strong>Make it a private conversation</strong><small>Encrypted new messages · Your privacy controls</small></div><button className="hub-icon" aria-label="About conversation privacy" onClick={() => setSheet('privacy')}><ChevronRight /></button></div>
      <nav className="hub-tabs" aria-label="Social hub sections">{TABS.map(({ id, label, Icon }) => <button key={id} className={activeTab === id ? 'active' : ''} aria-current={activeTab === id ? 'page' : undefined} onClick={() => { setActiveTab(id); setSearch(''); }}><Icon /><span>{label}</span>{id === 'notifications' && incomingRequests.length > 0 && <b>{incomingRequests.length}</b>}</button>)}</nav>
      {activeTab !== 'leaderboard' && <label className="hub-search"><Search /><input aria-label={`Search ${activeTab === 'calls' ? 'call history' : 'friends'}`} value={search} onChange={event => setSearch(event.target.value)} placeholder={activeTab === 'calls' ? 'Search call history' : 'Find your people'} />{search && <button className="hub-icon" aria-label="Clear search" onClick={() => setSearch('')}><X /></button>}</label>}
      <div className="hub-list">
        {authRequired && <div className="hub-auth" role="alert"><LockKeyhole /><strong>Verify your identity to continue</strong><p>Sign in again with Google, or reopen TonPlaygram from Telegram. An account number alone cannot unlock conversations.</p><LinkGoogleButton telegramId={null} label="Sign in with Google" onAuthenticated={() => { setAuthRequired(false); loadSocial(); setReload(value => value + 1); }} onError={({ message }) => setListError(message)} /><a href="https://t.me/TonPlaygramBot?startapp=account" target="_blank" rel="noreferrer">Open in Telegram</a></div>}
        {setupError && !authRequired && <div className="hub-warning"><LockKeyhole /><p>{setupError}</p><button onClick={loadSocial}>Retry setup</button></div>}
        {listError && !authRequired && <div className="hub-error" role="alert">{listError}<button onClick={loadSocial}>Try again</button></div>}
        {activeTab === 'leaderboard' ? <LeaderboardCard /> : activeTab === 'calls' ? <>
          <div className="hub-section-title"><strong>On this device</strong><button disabled={!calls.length} onClick={() => setSheet('clearCalls')}>Clear history</button></div>
          <p className="hub-caption">Call activity clears after 7 days. No audio or video is recorded by the hub.</p>
          {visibleCalls.map(call => <article className="hub-call" key={call.roomId}><span className="hub-call-icon">{call.type === 'video' ? <Video /> : <Phone />}</span><div><strong>{call.name}</strong><small>{call.direction === 'incoming' ? <ArrowDownLeft /> : <ArrowUpRight />}{call.status} · {new Date(call.createdAt).toLocaleDateString()} {formatTime(call.createdAt)}</small></div><button className="hub-icon" aria-label={`Delete call with ${call.name}`} onClick={() => clearLocalCalls(selfStorageId, call.roomId)}><Trash2 /></button></article>)}
          {!visibleCalls.length && <div className="hub-empty"><Phone /><strong>No call activity</strong><p>Start a voice or video call from a conversation.</p></div>}
        </> : activeTab === 'notifications' ? <>
          <div className="hub-section-title"><strong>Friend requests</strong><span>{incomingRequests.length}</span></div>
          {incomingRequests.map(request => <FriendRequest key={request.requestId || request._id} request={request} />)}
          {!incomingRequests.length && <div className="hub-empty"><Bell /><strong>You're all caught up</strong><p>New friend requests will appear here.</p></div>}
        </> : <>
          <div className="hub-section-title"><strong>{activeTab === 'chats' ? 'Your people' : 'All friends'}</strong><span>{friends.length} {friends.length === 1 ? 'friend' : 'friends'}</span></div>
          {activeTab === 'friends' && incomingRequests.map(request => <FriendRequest key={request.requestId || request._id} request={request} />)}
          {socialLoading && <p className="hub-caption" role="status">Loading your friends…</p>}
          {visibleFriends.map(friend => { const id = peerIdOf(friend), pinned = preferences.pins.includes(id); return <button key={id} className={`hub-person ${selectedId === id ? 'active' : ''}`} onClick={() => setSelected(friend)}><Avatar friend={friend} /><span><strong>{friendName(friend)}</strong><small>{pinned ? 'Pinned conversation' : 'Message, call or play together'}</small></span>{pinned ? <Pin className="hub-pin" /> : <ChevronRight />}</button>; })}
          {!socialLoading && !authRequired && !listError && !visibleFriends.length && <div className="hub-empty"><Users /><strong>{search ? 'No matching friends' : 'Your next friendship starts with a game'}</strong><p>{search ? 'Try a different name.' : 'Add players after a match to chat and play together.'}</p></div>}
        </>}
      </div>
    </section>

    <section className="hub-conversation" aria-label="Conversation">
      {selected ? <>
        <header className="hub-chat-head"><button className="hub-icon hub-back" onClick={() => setSelected(null)} aria-label="Back to conversations"><ArrowLeft /></button><Avatar friend={selected} /><div><strong>{friendName(selected)}</strong><small>{context?.canSend ? <><LockKeyhole /> Encrypted messages</> : loading ? 'Opening conversation…' : 'Privacy setup needed'}</small></div><button className="hub-icon" onClick={() => startFriendCall('voice')} aria-label={`Voice call ${friendName(selected)}`}><Phone /></button><button className="hub-icon" onClick={() => startFriendCall('video')} aria-label={`Video call ${friendName(selected)}`}><Video /></button><button className="hub-icon" onClick={() => setSheet('options')} aria-label="Conversation options"><MoreHorizontal /></button></header>
        <div className="hub-chat-tools"><button onClick={() => setSheet('timer')}><Clock3 /> Disappearing: {timerLabel}</button><button className={searchOpen ? 'active' : ''} onClick={() => setSearchOpen(value => !value)} aria-label="Search this conversation"><Search /></button></div>
        {searchOpen && <label className="hub-search hub-thread-search"><Search /><input value={messageSearch} onChange={event => setMessageSearch(event.target.value)} aria-label="Search loaded messages" placeholder="Search loaded messages" autoFocus /><button className="hub-icon" aria-label="Close message search" onClick={() => { setSearchOpen(false); setMessageSearch(''); }}><X /></button></label>}
        <div className="hub-thread" ref={threadRef} aria-live="polite" aria-busy={loading}>
          <div className="hub-thread-intro"><Avatar friend={selected} large /><h2>{friendName(selected)}</h2><p>A little conversation. A new adventure.</p><button onClick={() => setSheet('privacy')}><ShieldCheck /> Conversation privacy</button></div>
          {loading && <p className="hub-caption" role="status">Opening encrypted conversation…</p>}
          {error && <div className="hub-error" role="alert">{error}<button onClick={() => setReload(value => value + 1)}>Retry conversation</button></div>}
          {context?.securityReason === 'KEYS_NOT_READY' && <div className="hub-warning"><LockKeyhole /><p>Ask your friend to open the Social Hub once to set up encrypted messages.</p><button onClick={() => setReload(value => value + 1)}>Check again</button></div>}
          {context?.securityReason === 'DEVICE_KEY_UNAVAILABLE' && <div className="hub-warning"><LockKeyhole /><p>This browser does not have your active encryption key. Open your original device, or replace the key to send from this one.</p><button onClick={() => { setResetConfirmed(false); setSheet('resetKey'); }}>Device key options</button></div>}
          {context?.securityReason === 'KEY_CHANGED' && <div className="hub-warning"><ShieldCheck /><p>Your friend's encryption key changed. Compare their safety code before sending.</p><button onClick={() => { setTrustConfirmed(false); setSheet('privacy'); }}>Review key</button></div>}
          {hasEarlier && <button className="hub-load" disabled={busy} onClick={loadEarlier}>{busy ? 'Loading…' : 'Load earlier messages'}</button>}
          {filteredMessages.map((message, index) => {
            const mine = String(message.from) === String(context?.selfId) || [String(socialId), String(accountId)].includes(String(message.from));
            const date = new Date(message.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
            const previousDate = index && new Date(filteredMessages[index - 1].createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
            return <div key={message._id}>{date !== previousDate && <div className="hub-day">{date}</div>}<article className={`hub-message ${mine ? 'mine' : ''}`}><div className="hub-bubble">{message.replyTo && <div className="hub-quote"><Reply /><span>{replyPreview(message.replyTo.id)}</span></div>}<MessageAttachment attachment={message.attachment} />{message.attachmentUnavailable && <small className="hub-legacy">Older attachment unavailable or too large to load securely</small>}{message.text && <p>{message.text}</p>}<footer>{message.legacy ? <small className="hub-legacy">Older · not end-to-end encrypted</small> : message.decryptionError ? <small className="hub-legacy">Could not verify</small> : <LockKeyhole aria-label="Encrypted message" />}<time dateTime={message.createdAt}>{formatTime(message.createdAt)}</time>{message.expiresAt && <Clock3 aria-label={`Disappears ${new Date(message.expiresAt).toLocaleString()}`} />}{mine && <Check aria-label="Sent" />}</footer></div><button className="hub-icon hub-message-menu" aria-label={`Actions for ${mine ? 'your' : friendName(selected) + "'s"} message`} onClick={() => { setTargetMessage(message); setSheet('message'); }}><MoreHorizontal /></button></article></div>;
          })}
          {!loading && !messages.length && !error && <div className="hub-icebreakers"><span>Break the ice</span><button onClick={() => setText('Hey! Want to play a match?')}>🎮 Play a match?</button><button onClick={() => setText('Hey! How are you doing?')}>👋 Say hello</button></div>}
          {messageSearch && !filteredMessages.length && <p className="hub-caption">No matching loaded messages.</p>}
        </div>
        {replyTo && <div className="hub-compose-preview"><Reply /><span><strong>Replying</strong><small>{replyPreview(replyTo.id)}</small></span><button className="hub-icon" aria-label="Cancel reply" onClick={() => setReplyTo(null)}><X /></button></div>}
        {attachment && <div className="hub-compose-preview"><Paperclip /><span><strong>{attachment.name}</strong><small>{Math.ceil(attachment.size / 1024)} KB · Encrypted before sending</small></span><button className="hub-icon" aria-label="Remove attachment" onClick={() => { setAttachment(null); if (fileRef.current) fileRef.current.value = ''; }}><X /></button></div>}
        {emojiOpen && <div className="hub-emoji" aria-label="Choose an emoji">{EMOJI.map(emoji => <button key={emoji} onClick={() => setText(value => `${value}${emoji}`)} aria-label={`Add ${emoji}`}>{emoji}</button>)}</div>}
        <form className="hub-composer" onSubmit={handleSend}><label className="hub-icon hub-attach" aria-label="Attach a file up to 2 MB"><Paperclip /><input ref={fileRef} type="file" disabled={!context?.canSend || sending} onChange={event => { const file = event.target.files?.[0]; if (!file) return; if (file.size > MAX_ATTACHMENT) { setError('Choose a file of 2 MB or less for encrypted sharing.'); event.target.value = ''; return; } setAttachment(file); setError(''); }} /></label><div><textarea aria-label="Message" rows={1} maxLength={2000} value={text} onChange={event => setText(event.target.value)} placeholder={context?.canSend ? 'Message privately…' : 'Encryption setup required'} disabled={!context?.canSend || sending} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) handleSend(event); }} /><button type="button" className="hub-icon" aria-label="Choose emoji" aria-expanded={emojiOpen} onClick={() => setEmojiOpen(value => !value)}><Smile /></button></div><button className="hub-icon hub-send" type="submit" disabled={!context?.canSend || sending || (!text.trim() && !attachment)} aria-label="Send encrypted message"><Send /></button></form>
        <div className="hub-compose-bottom"><button onClick={() => { setGroupFriendIds([selectedId]); setSheet('invite'); }}><Gamepad2 /> Invite to a game</button><span>{sending ? 'Encrypting & sending…' : `${text.length}/2000`}</span></div>
      </> : <div className="hub-welcome"><span><Send /></span><h2>Your people.<br />Your private space.</h2><p>Choose a friend to chat, call, or jump into a game together.</p><div><LockKeyhole /> Encrypted new messages</div><div><Clock3 /> Choose when messages disappear</div></div>}
    </section>
    {note && <div className="hub-toast" role="status">{note}</div>}

    {sheet === 'options' && <Sheet title="Conversation" onClose={() => setSheet(null)}><div className="hub-sheet-profile"><Avatar friend={selected} /><strong>{friendName(selected)}</strong></div><button className="hub-option" onClick={() => { updatePreferences(current => ({ ...current, pins: current.pins.includes(selectedId) ? current.pins.filter(id => id !== selectedId) : [selectedId, ...current.pins] })); setSheet(null); }}><Pin /><span>{preferences.pins.includes(selectedId) ? 'Unpin conversation' : 'Pin conversation'}<small>Keep this friend at the top on this device</small></span></button><button className="hub-option" onClick={() => setSheet('timer')}><Clock3 /><span>Disappearing messages<small>{timerLabel} · Applies to new messages you send</small></span></button><button className="hub-option" onClick={() => { setTrustConfirmed(false); setSheet('privacy'); }}><ShieldCheck /><span>Encryption & safety codes<small>Compare codes with your friend</small></span></button><button className="hub-option" onClick={() => { setSearchOpen(true); setSheet(null); }}><Search /><span>Search conversation<small>Search messages loaded on this device</small></span></button><button className="hub-option danger" disabled={!context} onClick={() => setSheet('clearChat')}><Trash2 /><span>Clear conversation for me<small>Your friend's copy stays available</small></span></button></Sheet>}
    {sheet === 'timer' && <Sheet title="Disappearing messages" onClose={() => setSheet(null)}><p className="hub-sheet-copy">New messages you send disappear from the conversation after this time, starting when sent. Existing messages keep their original timer.</p><div className="hub-timers">{TIMERS.map(timer => <button key={timer.value} className={ttlSeconds === timer.value ? 'selected' : ''} aria-pressed={ttlSeconds === timer.value} onClick={() => { updatePreferences(current => ({ ...current, timers: { ...current.timers, [selectedId]: timer.value } })); setSheet(null); }}><Clock3 /><span><strong>{timer.label}</strong><small>{timer.detail}</small></span>{ttlSeconds === timer.value && <Check />}</button>)}</div><p className="hub-sheet-copy">Someone can still save a screenshot or download a file before it disappears.</p></Sheet>}
    {sheet === 'privacy' && <Sheet title="Conversation privacy" onClose={() => setSheet(null)}><div className="hub-security-banner"><ShieldCheck /><strong>New messages are encrypted on your device</strong></div><p className="hub-sheet-copy">Text and files are encrypted before upload. Private keys stay in this browser. Older messages are marked separately. Clearing browser data can make encrypted history unreadable.</p>{context && <><p className="hub-sheet-copy">Compare these codes with your friend in person or using another trusted channel. Each person's code should match on both devices.</p><label className="hub-code">Your safety code<code>{context.ownFingerprint || 'Not available'}</code></label><label className="hub-code">{friendName(selected)}'s safety code<code>{context.peerFingerprint || 'Your friend has not enabled encryption yet'}</code></label>{context.securityReason === 'KEY_CHANGED' && <><p className="hub-warning">This code changed. Sending is paused until you verify it.</p><label className="hub-checkbox"><input type="checkbox" checked={trustConfirmed} onChange={event => setTrustConfirmed(event.target.checked)} /><span>I compared the new code with my friend using another trusted channel.</span></label><button className="hub-primary hub-full" disabled={!trustConfirmed || busy} onClick={trustKey}>Trust verified new key</button></>}</>}<div className="hub-privacy-facts"><p><Clock3 /> Timers remove messages from the hub; downloaded copies and screenshots cannot be recalled.</p><p><Phone /> Calls use WebRTC transport encryption. The hub does not record audio or video. Call history is stored only on this device and can be cleared.</p><p><LockKeyhole /> This encryption has not had an independent security audit and does not provide Signal-style forward secrecy. Protect your device and verify safety codes.</p></div></Sheet>}
    {sheet === 'message' && <Sheet title="Message actions" onClose={() => { setSheet(null); setTargetMessage(null); }}>{targetMessage ? <><button className="hub-option" disabled={!context?.canSend} onClick={() => { setReplyTo({ id: targetMessage._id, from: targetMessage.from, expiresAt: targetMessage.expiresAt }); setSheet(null); }}><Reply /><span>Reply privately</span></button><button className="hub-option danger" disabled={busy} onClick={() => deleteMessage('me')}><Trash2 /><span>Delete for me<small>Remove from your conversation</small></span></button>{[String(context?.selfId), String(socialId), String(accountId)].includes(String(targetMessage.from)) && <button className="hub-option danger" disabled={busy} onClick={() => setSheet('deleteEveryone')}><Trash2 /><span>Delete for everyone<small>Remove your message from both conversations</small></span></button>}<p className="hub-sheet-copy">Screenshots and downloaded copies cannot be deleted remotely.</p></> : <p className="hub-sheet-copy">This message is no longer available.</p>}</Sheet>}
    {sheet === 'resetKey' && <Sheet title="Replace this device key?" onClose={() => setSheet(null)}><p className="hub-sheet-copy">Use your original device if you still have access to it. Replacing your account's active key lets this browser send new encrypted messages. Other devices will stop sending until you switch the key again.</p><p className="hub-warning">Messages encrypted to missing keys cannot be recovered. Your friends will see a changed safety code and must verify it with you before sending.</p><label className="hub-checkbox"><input type="checkbox" checked={resetConfirmed} onChange={event => setResetConfirmed(event.target.checked)} /><span>I understand that old history may remain unreadable and will compare my new safety code with my friends.</span></label><button className="hub-danger hub-full" disabled={!resetConfirmed || busy} onClick={replaceDeviceKey}>{busy ? 'Replacing key…' : 'Replace active key for this device'}</button></Sheet>}
    {sheet === 'deleteEveryone' && <Sheet title="Delete for everyone?" onClose={() => setSheet(null)}><p className="hub-sheet-copy">This removes your message from the hub for both of you. Any screenshots or saved copies will remain.</p><button className="hub-danger hub-full" disabled={busy || !targetMessage} onClick={() => deleteMessage('everyone')}>{busy ? 'Deleting…' : 'Delete for everyone'}</button></Sheet>}
    {sheet === 'clearChat' && <Sheet title="Clear conversation for you?" onClose={() => setSheet(null)}><p className="hub-sheet-copy">Existing messages will be removed from your conversation. Your friend can still see their copies. New messages will appear as usual.</p><button className="hub-danger hub-full" disabled={busy} onClick={clearConversation}>{busy ? 'Clearing…' : 'Clear conversation for me'}</button></Sheet>}
    {sheet === 'clearCalls' && <Sheet title="Clear call history?" onClose={() => setSheet(null)}><p className="hub-sheet-copy">Delete all call activity stored on this device. This does not end an active call or remove another person's history.</p><button className="hub-danger hub-full" onClick={() => { clearLocalCalls(selfStorageId); setSheet(null); notify('Local call history cleared'); }}>Clear local call history</button></Sheet>}
    {sheet === 'invite' && <Sheet title="Play together" onClose={() => setSheet(null)}><label className="hub-field">Choose a game<select value={inviteGame} onChange={event => setInviteGame(event.target.value)}>{inviteGamesCatalog.map(game => <option key={game.slug} value={game.slug}>{game.name}</option>)}</select></label><div className="hub-invite-modes"><button className={inviteMode === '1v1' ? 'selected' : ''} onClick={() => setInviteMode('1v1')}>1v1 challenge</button><button className={inviteMode === 'group' ? 'selected' : ''} onClick={() => setInviteMode('group')}>Group invite</button></div><p className="hub-sheet-copy">Game invite stake: 100 TPG. Your friend reviews the invitation before joining.</p>{inviteMode === 'group' && <div className="hub-invite-friends">{friends.map(friend => { const id = peerIdOf(friend); return <label key={id}><input type="checkbox" checked={groupFriendIds.includes(id) || id === selectedId} disabled={id === selectedId} onChange={() => setGroupFriendIds(ids => ids.includes(id) ? ids.filter(value => value !== id) : [...ids, id])} /><Avatar friend={friend} /><span>{friendName(friend)}</span></label>; })}</div>}<button className="hub-primary hub-full" onClick={sendGameInvite}><Gamepad2 /> Send game invite</button></Sheet>}
  </main>;
}
