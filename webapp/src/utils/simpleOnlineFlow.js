import { ensureAccountId, getTelegramId } from './telegram.js';
import { getAccountBalance } from './api.js';
import { refreshSocketAuthIdentity, socket } from './socket.js';

const MATCHMAKING_REFRESH_MS = 120000;
const SOCKET_TIMEOUT_MS = 6000;
const RETRY_DELAY_MS = 700;
const RECOVERABLE_ERRORS = new Set([
  'register_required',
  'rate_limited',
  'identity_mismatch'
]);

function waitForSocket(socketInstance, timeoutMs = SOCKET_TIMEOUT_MS) {
  if (socketInstance.connected) return Promise.resolve(true);
  return new Promise((resolve) => {
    let settled = false;
    const finish = (ready) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socketInstance.off('connect', onConnect);
      socketInstance.off('connect_error', onError);
      socketInstance.off('error', onError);
      resolve(ready);
    };
    const onConnect = () => finish(true);
    const onError = () => finish(false);
    const timer = setTimeout(() => finish(socketInstance.connected), timeoutMs);
    socketInstance.once('connect', onConnect);
    socketInstance.once('connect_error', onError);
    socketInstance.once('error', onError);
    socketInstance.connect?.();
  });
}

function registerSocket(socketInstance, identity, timeoutMs = SOCKET_TIMEOUT_MS) {
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      settled = true;
      resolve(false);
    }, timeoutMs);
    socketInstance.emit('register', identity, (response) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(Boolean(response?.success));
    });
  });
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Shared two-stage online flow used by Battle Royal lobbies. A seat is kept in
 * the lightweight lobby until the authoritative gameStart event, just like
 * Chess Battle Royal; reconnects re-register the TPG identity and restore the
 * same seat instead of silently placing the phone in a second queue.
 */
export async function runSimpleOnlineFlow({
  gameType,
  stake,
  maxPlayers = 2,
  avatar = '',
  playerName = 'Player',
  matchMeta = {},
  tableId = '',
  quickMatch = !tableId,
  state,
  onMatched,
  deps = {},
  refreshMs = MATCHMAKING_REFRESH_MS
}) {
  const {
    setMatching,
    setMatchStatus,
    setMatchError,
    setOnlineCount,
    setMatchPlayers,
    setCleanup
  } = state;
  const {
    ensureAccountId: ensureAccountIdFn = ensureAccountId,
    getAccountBalance: getAccountBalanceFn = getAccountBalance,
    getTelegramId: getTelegramIdFn = getTelegramId,
    socket: socketInstance = socket
  } = deps;

  let active = true;
  let accountId = '';
  let pendingTableId = '';
  let refreshTimer;
  let startedTableId = '';
  const identity = () => ({
    tpcAccountNumber: String(accountId),
    tpcAccountId: String(accountId),
    accountId: String(accountId),
    playerId: String(accountId)
  });

  const removeListeners = () => {
    socketInstance.off('lobbyUpdate', handleLobbyUpdate);
    socketInstance.off('gameStart', handleGameStart);
    socketInstance.off('gameStarted', handleGameStart);
    socketInstance.off('connect', handleReconnect);
    socketInstance.off('connect_error', handleConnectionError);
    socketInstance.off('disconnect', handleDisconnect);
  };

  const cleanup = ({ keepError = false, skipLeave = false } = {}) => {
    active = false;
    clearTimeout(refreshTimer);
    removeListeners();
    if (!skipLeave && pendingTableId && accountId) {
      socketInstance.emit('leaveLobby', { ...identity(), tableId: pendingTableId });
    }
    pendingTableId = '';
    setMatchPlayers?.([]);
    setMatching(false);
    setMatchStatus('');
    if (!keepError) setMatchError('');
  };

  function handleLobbyUpdate({ tableId: updatedId, players = [], ready = [] } = {}) {
    if (!active || !pendingTableId || String(updatedId) !== String(pendingTableId)) return;
    setOnlineCount?.(players.length);
    setMatchPlayers?.(players);
    setMatchStatus(
      players.length >= maxPlayers
        ? ready.length >= maxPlayers
          ? 'Players ready. Starting match…'
          : 'Match found. Securing every seat…'
        : 'Waiting for the next same-stake opponent…'
    );
  }

  function handleGameStart(payload = {}) {
    const startedId = payload.tableId;
    if (!active || !startedId || String(startedId) !== String(pendingTableId)) return;
    if (startedTableId === String(startedId)) return;
    startedTableId = String(startedId);
    cleanup({ skipLeave: true });
    onMatched?.({ accountId, ...payload });
  }

  function handleConnectionError() {
    if (active) setMatchStatus('Lobby connection failed. Reconnecting…');
  }

  function handleDisconnect() {
    if (active && pendingTableId) setMatchStatus('Connection dropped. Restoring your lobby seat…');
  }

  async function handleReconnect() {
    if (!active || !pendingTableId) return;
    const restoreId = pendingTableId;
    setMatchStatus('Restoring your lobby seat…');
    if (await registerSocket(socketInstance, identity())) seatPlayer(restoreId, true);
  }

  const armRefresh = () => {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => {
      if (!active || !pendingTableId) return;
      if (!quickMatch) {
        setMatchError('No opponent joined the private table in time.');
        cleanup({ keepError: true });
        return;
      }
      const oldTableId = pendingTableId;
      socketInstance.emit('leaveLobby', { ...identity(), tableId: oldTableId });
      pendingTableId = '';
      setMatchPlayers?.([]);
      setMatchStatus('Still searching the ordered queue for the next same-stake opponent…');
      seatPlayer();
    }, refreshMs);
  };

  let seatAttempts = 0;
  function seatPlayer(tableIdOverride = '', reconnecting = false) {
    if (!active) return;
    if (!reconnecting) seatAttempts += 1;
    socketInstance.emit('seatTable', {
      ...identity(),
      gameType,
      stake: Number(stake.amount) || 0,
      maxPlayers,
      playerName,
      avatar,
      ...matchMeta,
      mode: 'online',
      token: stake.token,
      tableId: tableIdOverride || tableId || undefined,
      matchMeta: { ...matchMeta, mode: 'online', token: stake.token }
    }, async (response = {}) => {
      if (!active) return;
      if (!response.success || !response.tableId) {
        const retry = quickMatch || reconnecting || RECOVERABLE_ERRORS.has(response.error);
        if (retry) {
          setMatchStatus('Retrying matchmaking request…');
          if (response.error === 'identity_mismatch') {
            refreshSocketAuthIdentity({ accountId }, { reconnect: true });
          }
          await sleep(Math.min(RETRY_DELAY_MS * 2 ** Math.min(seatAttempts - 1, 2), 3000));
          if (!active) return;
          if (await waitForSocket(socketInstance)) {
            await registerSocket(socketInstance, identity());
            seatPlayer(tableIdOverride, reconnecting);
          } else {
            seatPlayer(tableIdOverride, reconnecting);
          }
          return;
        }
        setMatchError(`Could not join the online lobby${response.error ? ` (${String(response.error).replace(/_/g, ' ')})` : ''}.`);
        cleanup({ keepError: true });
        return;
      }
      pendingTableId = response.tableId;
      setMatchPlayers?.(Array.isArray(response.players) ? response.players : []);
      if (response.started && response.gameStart) {
        handleGameStart(response.gameStart);
        return;
      }
      setMatchStatus(response.players?.length >= maxPlayers
        ? 'Match found. Securing every seat…'
        : quickMatch
          ? 'Waiting for the next same-stake opponent…'
          : 'Private table ready. Waiting for your opponent…');
      // Ready only means this client has loaded the lightweight lobby. Both
      // clients still navigate together exclusively from gameStart.
      socketInstance.emit('confirmReady', { ...identity(), tableId: response.tableId });
      armRefresh();
    });
  }

  setMatching(true);
  setMatchError('');
  setMatchStatus('Checking wallet…');
  setCleanup?.(() => cleanup);

  try {
    accountId = String(await ensureAccountIdFn() || '');
    if (!accountId) throw new Error('missing_account');
    const balance = await getAccountBalanceFn(accountId);
    if ((balance?.balance || 0) < stake.amount) {
      setMatchError('Insufficient balance for this stake.');
      cleanup({ keepError: true });
      return { ok: false, cleanup };
    }
    // The authoritative server reserves the stake when every seat is locked;
    // the lobby must never debit/refund independently while still searching.
    getTelegramIdFn?.();
    refreshSocketAuthIdentity({ accountId }, { reconnect: true });
    while (active) {
      const connected = await waitForSocket(socketInstance);
      if (!active) return { ok: false, cleanup };
      if (connected && await registerSocket(socketInstance, identity())) break;
      if (!quickMatch) throw new Error('connection_failed');
      setMatchStatus('Matchmaker unavailable. Reconnecting and continuing the search…');
      await sleep(RETRY_DELAY_MS);
    }
    socketInstance.on('lobbyUpdate', handleLobbyUpdate);
    socketInstance.on('gameStart', handleGameStart);
    socketInstance.on('gameStarted', handleGameStart);
    socketInstance.on('connect', handleReconnect);
    socketInstance.on('connect_error', handleConnectionError);
    socketInstance.on('disconnect', handleDisconnect);
    seatPlayer();
    return { ok: true, cleanup, accountId };
  } catch {
    setMatchError('Could not start online matchmaking. Please retry.');
    cleanup({ keepError: true });
    return { ok: false, cleanup };
  }
}
