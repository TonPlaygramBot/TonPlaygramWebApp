import { ensureAccountId, getTelegramId } from './telegram.js';
import { getAccountBalance, addTransaction } from './api.js';
import { socket } from './socket.js';

const DEFAULT_MATCH_TIMEOUT_MS = 35000;
const SOCKET_CONNECT_TIMEOUT_MS = 8000;

async function ensureSocketReady(socketInstance, timeoutMs = SOCKET_CONNECT_TIMEOUT_MS) {
  if (!socketInstance) return false;
  if (socketInstance.connected) return true;

  try {
    socketInstance.connect?.();
  } catch {
    return false;
  }

  return await new Promise((resolve) => {
    let settled = false;

    const finish = (ok) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socketInstance.off?.('connect', onConnect);
      socketInstance.off?.('connect_error', onConnectError);
      socketInstance.off?.('error', onConnectError);
      resolve(ok);
    };

    const onConnect = () => finish(true);
    const onConnectError = () => finish(false);

    const timer = setTimeout(() => finish(socketInstance.connected), timeoutMs);

    socketInstance.once?.('connect', onConnect);
    socketInstance.once?.('connect_error', onConnectError);
    socketInstance.once?.('error', onConnectError);
  });
}

export async function runSimpleOnlineFlow({
  gameType,
  stake,
  maxPlayers = 2,
  avatar = '',
  playerName = 'Player',
  matchMeta = {},
  state,
  onMatched,
  deps = {},
  timeoutMs = DEFAULT_MATCH_TIMEOUT_MS,
  socketConnectTimeoutMs = SOCKET_CONNECT_TIMEOUT_MS,
}) {
  const {
    setMatching,
    setMatchStatus,
    setMatchError,
    setOnlineCount,
    setCleanup,
  } = state;
  const {
    ensureAccountId: ensureAccountIdFn = ensureAccountId,
    getAccountBalance: getAccountBalanceFn = getAccountBalance,
    addTransaction: addTransactionFn = addTransaction,
    getTelegramId: getTelegramIdFn = getTelegramId,
    socket: socketInstance = socket,
  } = deps;

  let accountId = '';
  let stakeDebited = false;
  let pendingTableId = '';
  let timeoutRef = null;

  const cleanup = ({ keepError = false, refund = false } = {}) => {
    if (timeoutRef) {
      clearTimeout(timeoutRef);
      timeoutRef = null;
    }
    socketInstance.off('lobbyUpdate', handleLobbyUpdate);
    socketInstance.off('gameStart', handleGameStart);
    if (pendingTableId && accountId) {
      socketInstance.emit('leaveLobby', { accountId, tableId: pendingTableId });
    }
    pendingTableId = '';
    setMatching(false);
    setMatchStatus('');
    if (!keepError) setMatchError('');
    if (refund && stakeDebited && accountId) {
      const tgId = getTelegramIdFn?.();
      addTransactionFn(tgId, stake.amount, 'stake_refund', {
        game: `${gameType}-online`,
        players: maxPlayers,
        accountId,
        reason: 'matchmaking_cleanup',
      }).catch(() => {});
      stakeDebited = false;
    }
  };

  const handleLobbyUpdate = ({ tableId, players = [] } = {}) => {
    if (!pendingTableId || tableId !== pendingTableId) return;
    setOnlineCount?.(players.length);
    setMatchStatus(players.length > 1 ? 'Opponent joined. Confirming table…' : 'Waiting for players…');
  };

  const handleGameStart = ({ tableId, players = [] } = {}) => {
    if (!pendingTableId || tableId !== pendingTableId) return;
    stakeDebited = false;
    if (timeoutRef) {
      clearTimeout(timeoutRef);
      timeoutRef = null;
    }
    socketInstance.off('lobbyUpdate', handleLobbyUpdate);
    socketInstance.off('gameStart', handleGameStart);
    setMatching(false);
    setMatchStatus('Match found. Launching game…');
    onMatched?.({ accountId, tableId, players });
  };

  setMatching(true);
  setMatchError('');
  setMatchStatus('Checking wallet…');

  try {
    accountId = await ensureAccountIdFn();
    const balRes = await getAccountBalanceFn(accountId);
    if ((balRes?.balance || 0) < stake.amount) {
      setMatchError('Insufficient balance for this stake.');
      setMatching(false);
      setMatchStatus('');
      return { ok: false, cleanup };
    }

    const tgId = getTelegramIdFn?.();
    await addTransactionFn(tgId, -stake.amount, 'stake', {
      game: `${gameType}-online`,
      players: maxPlayers,
      accountId,
    });
    stakeDebited = true;

    const socketReady = await ensureSocketReady(socketInstance, socketConnectTimeoutMs);
    if (!socketReady) {
      setMatchError('Socket not connected. Please retry.');
      cleanup({ keepError: true, refund: stakeDebited });
      return { ok: false, cleanup };
    }

    socketInstance.on('lobbyUpdate', handleLobbyUpdate);
    socketInstance.on('gameStart', handleGameStart);
    socketInstance.emit('register', { playerId: accountId });

    timeoutRef = setTimeout(() => {
      setMatchError('Matchmaking timeout. Stake refunded.');
      cleanup({ keepError: true, refund: true });
    }, timeoutMs);

    socketInstance.emit('seatTable', {
      accountId,
      gameType,
      stake: Number(stake.amount) || 0,
      maxPlayers,
      playerName,
      avatar,
      mode: 'online',
      token: stake.token,
      ...matchMeta,
    }, (res = {}) => {
      if (!res.success || !res.tableId) {
        setMatchError('Unable to join online table. Stake refunded.');
        cleanup({ keepError: true, refund: true });
        return;
      }
      pendingTableId = res.tableId;
      setMatchStatus('Waiting for players…');
      socketInstance.emit('confirmReady', { accountId, tableId: res.tableId });
    });

    setCleanup?.(() => cleanup);
    return { ok: true, cleanup, accountId };
  } catch {
    setMatchError('Could not start online matchmaking.');
    cleanup({ keepError: true, refund: stakeDebited });
    return { ok: false, cleanup };
  }
}
