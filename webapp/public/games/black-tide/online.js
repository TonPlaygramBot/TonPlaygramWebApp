(() => {
  const params = new URLSearchParams(location.search);
  const tableId = params.get('tableId');
  const accountId = params.get('accountId');
  if (!tableId || !accountId) return;

  const panel = document.createElement('aside');
  panel.className = 'black-tide-online';
  panel.setAttribute('aria-live', 'polite');
  panel.innerHTML = '<b>CO-OP CONNECTING</b><span>Waiting for ally state…</span>';
  document.body.append(panel);

  const script = document.createElement('script');
  script.src = '/socket.io/socket.io.js';
  script.onload = () => {
    const socket = window.io({ transports: ['websocket', 'polling'] });
    let lastSent = 0;
    socket.on('connect', () => socket.emit('register', { accountId, playerId: accountId, tpcAccountNumber: accountId }, (registered) => {
      if (registered?.success) socket.emit('joinBlackTideTable', { tableId, accountId });
    }));
    socket.on('blackTideJoined', ({ players = [] }) => {
      panel.querySelector('b').textContent = 'CO-OP ONLINE';
      panel.querySelector('span').textContent = `${players.length}/2 players synced`;
    });
    socket.on('blackTideState', ({ accountId: allyId, state }) => {
      if (!state || String(allyId) === String(accountId)) return;
      panel.querySelector('span').textContent = `ALLY · ${state.health}% HP · ${Math.round(state.score)} PTS · ${state.weapon}`;
      window.dispatchEvent(new CustomEvent('blacktide:ally-state', { detail: state }));
    });
    socket.on('blackTideSyncError', () => {
      panel.querySelector('b').textContent = 'CO-OP OFFLINE';
      panel.querySelector('span').textContent = 'Return to lobby to restore your seat.';
    });
    window.addEventListener('blacktide:snapshot', ({ detail }) => {
      const now = performance.now();
      if (!detail || now - lastSent < 100) return;
      lastSent = now;
      socket.emit('blackTideState', { tableId, accountId, state: detail });
    });
  };
  script.onerror = () => { panel.querySelector('b').textContent = 'CO-OP OFFLINE'; };
  document.head.append(script);
})();
