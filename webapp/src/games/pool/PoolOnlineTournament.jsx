import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ensureAccountId } from '../../utils/telegram.js';
import { refreshSocketAuthIdentity, socket } from '../../utils/socket.js';
import { PoolBracket } from './PoolCompetitionMatch.jsx';
import { poolRoundName } from './competition.js';
import './competition.css';

const request = payload => new Promise((resolve, reject) => {
  socket.timeout(12000).emit('poolTournament', payload, (error, result) => {
    if (error) reject(Error('Connection timed out. Reconnect and retry.'));
    else if (!result?.success) reject(Error(result?.error || 'Tournament unavailable.'));
    else resolve(result.event);
  });
});

export default function PoolOnlineTournament({ Game, options }) {
  const { search, pathname } = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(search);
  const id = params.get('tournamentId') || '';
  const tableId = params.get('tableId') || '';
  const inRack = params.get('rack') === '1';
  const [accountId, setAccountId] = useState('');
  const [event, setEvent] = useState(null);
  const [code, setCode] = useState(id);
  const [size, setSize] = useState(Number(params.get('players')) || 8);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [connected, setConnected] = useState(socket.connected);
  const [pendingFrame, setPendingFrame] = useState(null);
  const [conceding, setConceding] = useState(false);
  useEffect(() => {
    let active = true;
    ensureAccountId().then(value => {
      if (!active) return;
      setAccountId(String(value));
      refreshSocketAuthIdentity({ accountId: String(value) }, { reconnect: true });
    }).catch(() => active && setError('Sign in to your TPG account and reopen the tournament.'));
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!accountId) return;
    let active = true;
    const accept = next => { if (active && next.id === id) setEvent(next); };
    const sync = () => {
      setConnected(true);
      if (id) request({ action: 'join', id, accountId, name: options.playerName }).then(accept).catch(error => active && setError(error.message));
    };
    const offline = () => setConnected(false);
    socket.on('poolTournamentState', accept);
    socket.on('connect', sync);
    socket.on('disconnect', offline);
    if (socket.connected) sync();
    return () => {
      active = false;
      socket.off('poolTournamentState', accept);
      socket.off('connect', sync);
      socket.off('disconnect', offline);
    };
  }, [accountId, id, options.playerName]);
  useEffect(() => {
    if (!accountId) return;
    try {
      const key = `poolRoyalOnlineRoom:${accountId}`;
      if (id) localStorage.setItem(key, id);
      else setCode(localStorage.getItem(key) || '');
    } catch { /* Room codes can still be shared without browser storage. */ }
  }, [accountId, id]);
  const changeUrl = (next, pair = null) => {
    // Construct from safe game options; never copy another account's invite identity.
    const query = new URLSearchParams({ mode: 'online', type: 'tournament', onlineTournament: '1',
      tournamentId: next.id, variant: next.variant, tableSize: '9ft', accountId, name: options.playerName || 'Player' });
    if (options.playerAvatar) query.set('avatar', options.playerAvatar);
    if (options.tableModelKey) query.set('tableModel', options.tableModelKey);
    if (pair) {
      query.set('tableId', pair.tableId); query.set('seat', pair.a === accountId ? 'A' : 'B');
      query.set('starter', 'A'); query.set('rack', '1');
    }
    navigate(`${pathname}?${query}`, { replace: true });
  };
  const action = async (type, extra = {}) => {
    if (busy || !accountId) return;
    setBusy(true); setError('');
    try {
      const next = await request({ action: type, id, accountId, ...extra });
      setEvent(next);
      if (type === 'create' || type === 'join') changeUrl(next);
      if (type === 'leave') {
        try { localStorage.removeItem(`poolRoyalOnlineRoom:${accountId}`); } catch {}
        navigate('/games/poolroyale/lobby?type=tournament&mode=online');
      }
      if (type === 'forfeit') { setConceding(false); changeUrl(next); }
    } catch (error) { setError(error.message); }
    finally { setBusy(false); }
  };
  const report = useCallback(async (frame) => {
    setPendingFrame(frame); setError('');
    try {
      const next = await request({ action: 'report', id, accountId, tableId, winner: frame.winner });
      setEvent(next); setPendingFrame(null);
      // Stay in the match until the settled result has reached the server.
      const query = new URLSearchParams(search);
      query.delete('rack'); query.delete('tableId'); query.delete('seat');
      navigate(`${pathname}?${query}`, { replace: true });
    } catch (error) { setError(error.message); }
  }, [accountId, id, tableId, navigate, pathname, search]);
  const pair = event?.draw[event.round]?.find(pair => [pair.a, pair.b].includes(accountId));
  const playedPair = event?.draw.flat().find(pair => pair.tableId === tableId && [pair.a, pair.b].includes(accountId));
  const opponent = event?.entrants.find(player => player.id === (playedPair?.a === accountId ? playedPair?.b : playedPair?.a));
  const leaveRack = () => event && changeUrl(event);
  const share = async () => {
    const url = new URL('/games/poolroyale', window.location.origin);
    url.search = new URLSearchParams({ mode: 'online', type: 'tournament', onlineTournament: '1', tournamentId: event.id }).toString();
    try {
      if (navigator.share) await navigator.share({ title: 'Pool Royal tournament', text: `Join room ${event.id}`, url: url.href });
      else { await navigator.clipboard.writeText(url.href); setNotice('Invite link copied.'); }
    } catch { setNotice(`Share room code ${event.id} with your friends.`); }
  };
  if (inRack && event && playedPair && !playedPair.winner) return <>
    <Game {...options} accountId={accountId} variantKey={event.variant} tableSizeKey="9ft" ballSetKey={null} mode="online" playType="regular" opponentName={opponent?.name} onCompetitionFrameComplete={report} />
    <button className="pr-series-leave" onClick={leaveRack}>Tournament draw</button>
    {!connected && <div className="pr-save-error" role="status">Reconnecting… Your tournament seat is reserved.</div>}
    {error && <div className="pr-save-error" role="alert">{error}{pendingFrame && <button onClick={() => report(pendingFrame)}>Retry result confirmation</button>}</div>}
  </>;
  return <main className="pr-tour">
    <button className="pr-back" onClick={() => navigate('/games/poolroyale/lobby?type=tournament&mode=online')}>‹ Lobby</button>
    <p className="pr-eyebrow">Pool Royal · Online tournament</p>
    <h1>{event?.status === 'complete' ? 'A champion is crowned.' : 'Your friends.\nOne title.'}</h1>
    <p className="pr-muted">Free entry · Live opponents · One rack per round · Invite only</p>
    {!connected && <p className="pr-notice" role="status">Reconnecting…</p>}
    {error && <p role="alert" className="pr-notice">{error}</p>}
    {notice && <p role="status" className="pr-notice">{notice}</p>}
    {!event ? <section className="pr-feature">
      <label htmlFor="pool-draw-size">Tournament size</label>
      <select id="pool-draw-size" value={size} onChange={e => setSize(Number(e.target.value))}>{[4, 8, 16, 32].map(value => <option key={value} value={value}>{value} players</option>)}</select>
      <button className="pr-primary" disabled={busy || !accountId || !connected} onClick={() => action('create', { size, variant: options.variantKey, name: options.playerName })}>Create tournament →</button>
      <label htmlFor="pool-invite-code">Join with a room code</label>
      <input id="pool-invite-code" autoCapitalize="characters" autoComplete="off" maxLength={10} value={code} onChange={e => setCode(e.target.value.replace(/[^a-z0-9]/gi, '').toUpperCase())} placeholder="Room code" />
      <button className="pr-secondary" disabled={busy || !accountId || !connected || code.length !== 10} onClick={() => action('join', { id: code, name: options.playerName })}>Join tournament</button>
    </section> : <>
      <section className="pr-feature">
        <p className="pr-eyebrow">Room {event.id}</p>
        <h2>{event.status === 'waiting' ? `${event.entrants.length} / ${event.size} players ready` : event.status === 'complete' ? 'Tournament complete' : poolRoundName(event)}</h2>
        {event.status === 'waiting' ? <>
          <button className="pr-secondary" onClick={share}>Share invite</button>
          <ol>{event.entrants.map(player => <li key={player.id}>{player.name}{player.id === accountId ? ' · You' : ''}{player.id === event.host ? ' · Host' : ''}</li>)}</ol>
          {event.host === accountId ? <button className="pr-primary" disabled={busy || !connected || event.entrants.length !== event.size} onClick={() => action('start')}>Start tournament →</button> : <p className="pr-muted">The host starts when every seat is filled.</p>}
        </> : pair && !pair.winner ? <>
          <p className="pr-muted">Your opponent: {event.entrants.find(player => player.id === (pair.a === accountId ? pair.b : pair.a))?.name}</p>
          {pair.confirmedCount > 0 && <p className="pr-notice">Waiting for both players to confirm the result. Rejoin the rack if your confirmation is missing.</p>}
          <button className="pr-primary" disabled={!connected || busy} onClick={() => changeUrl(event, pair)}>Play / resume match →</button>
          {conceding ? <div className="pr-notice"><p>Concede this match and leave the title race?</p><button className="pr-secondary" disabled={busy} onClick={() => action('forfeit', { tableId: pair.tableId })}>Confirm concede</button><button className="pr-secondary" onClick={() => setConceding(false)}>Keep playing</button></div> : <button className="pr-secondary" onClick={() => setConceding(true)}>Concede match</button>}
        </> : event.status === 'active' ? <p className="pr-muted">{pair?.winner === accountId ? 'You are through. Waiting for the other matches to finish.' : 'Your run is over. Follow the remaining matches below.'}</p> : <p className="pr-champion">🏆 {event.entrants.find(player => player.id === event.champion)?.name}</p>}
      </section>
      {event.draw.length > 0 && <PoolBracket event={event} playerId={accountId} />}
      {(event.status !== 'active' || !pair || (pair.winner && pair.winner !== accountId)) && <button className="pr-secondary" disabled={busy} onClick={() => action('leave')}>Leave tournament</button>}
    </>}
    <p className="pr-mini">Live rooms stay available for six hours of inactivity. A server restart ends the room. Online tournaments do not award TPG; both players confirm each completed rack.</p>
  </main>;
}
