import { useEffect, useRef, useState } from 'react';
import { socket } from '../utils/socket.js';
import { getPlayerId } from '../utils/telegram.js';
import { recordLocalCall, updateLocalCall } from '../utils/socialHubState.js';
import FriendCallOverlay from './FriendCallOverlay.jsx';

// The standalone Social shell does not mount the main app's Layout.
export default function SocialCallController() {
  const [incoming, setIncoming] = useState(null);
  const [active, setActive] = useState(null);
  const [notice, setNotice] = useState('');
  const [answering, setAnswering] = useState(false);
  const incomingRef = useRef(null);
  const activeRef = useRef(null);
  useEffect(() => {
    const received = (call) => {
      if (!call?.roomId || activeRef.current || incomingRef.current) return;
      incomingRef.current = call;
      setIncoming(call);
      recordLocalCall(getPlayerId(), call, { direction: 'incoming', status: 'ringing' });
    };
    const start = (event) => {
      const call = event.detail;
      if (!call?.roomId) return;
      activeRef.current = call;
      setActive(call);
      recordLocalCall(getPlayerId(), call, { direction: 'outgoing', status: 'ringing' });
    };
    const accepted = ({ roomId } = {}) => updateLocalCall(getPlayerId(), roomId, 'connected');
    const pushed = (event) => {
      if (!event.detail?.roomId) return;
      socket.timeout(10000).emit('friendCall:details', { roomId: event.detail.roomId }, (error, response) => {
        if (!error && response?.success && response.call) received(response.call);
      });
    };
    const ended = ({ roomId, reason } = {}) => {
      updateLocalCall(getPlayerId(), roomId, reason || 'ended');
      if (incomingRef.current?.roomId === roomId) { incomingRef.current = null; setIncoming(null); setAnswering(false); }
      if (activeRef.current?.roomId === roomId) { activeRef.current = null; setActive(null); }
    };
    const unavailable = () => {
      if (activeRef.current) updateLocalCall(getPlayerId(), activeRef.current.roomId, 'disconnected');
      if (incomingRef.current) updateLocalCall(getPlayerId(), incomingRef.current.roomId, 'missed');
      incomingRef.current = null; activeRef.current = null;
      setIncoming(null); setActive(null); setAnswering(false);
    };
    socket.on('social:authentication-required', unavailable);
    socket.on('disconnect', unavailable);
    socket.on('friendCall:incoming', received);
    socket.on('friendCall:accepted', accepted);
    socket.on('friendCall:ended', ended);
    window.addEventListener('friend-call:start', start);
    window.addEventListener('friend-call:incoming-push', pushed);
    return () => {
      socket.off('social:authentication-required', unavailable);
      socket.off('disconnect', unavailable);
      socket.off('friendCall:incoming', received);
      socket.off('friendCall:accepted', accepted);
      socket.off('friendCall:ended', ended);
      window.removeEventListener('friend-call:start', start);
      window.removeEventListener('friend-call:incoming-push', pushed);
      if (activeRef.current) socket.emit('friendCall:end', activeRef.current);
      incomingRef.current = null;
      activeRef.current = null;
    };
  }, []);
  function answer() {
    const call = incomingRef.current;
    if (!call || answering) return;
    setAnswering(true);
    socket.timeout(10000).emit('friendCall:accept', call, (error, result) => {
      if (incomingRef.current?.roomId !== call.roomId) return;
      setAnswering(false);
      if (error || !result?.success) {
        setNotice(result?.error || 'This call is no longer available.');
      } else {
        const next = { ...call, name: call.fromName, photo: call.fromPhoto };
        activeRef.current = next;
        setActive(next);
        updateLocalCall(getPlayerId(), call.roomId, 'connected');
      }
      incomingRef.current = null;
      setIncoming(null);
    });
  }
  function end() {
    const call = activeRef.current;
    if (call) { socket.emit('friendCall:end', call); updateLocalCall(getPlayerId(), call.roomId, 'ended'); }
    activeRef.current = null;
    setActive(null);
  }
  return <>
    {notice && <div className="social-call-notice" role="status">{notice}<button onClick={() => setNotice('')} aria-label="Dismiss call notice">×</button></div>}
    {incoming && <div className="social-call-incoming" role="dialog" aria-modal="true" aria-label="Incoming call">
      <section><p>Incoming {incoming.type === 'video' ? 'video' : 'voice'} call</p><h2>{incoming.fromName || 'Friend'}</h2>
        <div><button disabled={answering} onClick={() => { socket.emit('friendCall:reject', incoming); updateLocalCall(getPlayerId(), incoming.roomId, 'declined'); incomingRef.current = null; setIncoming(null); }}>Decline</button>
          <button disabled={answering} onClick={answer}>{answering ? 'Connecting…' : 'Accept'}</button></div>
      </section>
    </div>}
    <FriendCallOverlay call={active} displayName="TonPlaygram player" onEnd={end} />
  </>;
}
