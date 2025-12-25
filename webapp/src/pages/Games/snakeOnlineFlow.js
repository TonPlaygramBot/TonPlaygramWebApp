import { ensureAccountId, getTelegramId } from '../../utils/telegram.js';
import { getAccountBalance, addTransaction } from '../../utils/api.js';
import { socket } from '../../utils/socket.js';

const DEFAULT_SEAT_TIMEOUT_MS = 12000;
const DEFAULT_MATCH_TIMEOUT_MS = 30000;

function logSupportError(message, error, context = {}) {
  console.error('[SnakeOnline]', message, { ...context, error });
}

function clearTimeoutSafely(ref) {
  if (ref?.current) {
    clearTimeout(ref.current);
    ref.current = null;
  }
}

export async function runSnakeOnlineFlow({
  stake,
  table,
  playerName,
  avatar,
  deps = {},
  state,
  refs,
  timeouts = {},
  onGameStart
}) {
  const {
    ensureAccountId: ensureAccountIdFn = ensureAccountId,
    getAccountBalance: getAccountBalanceFn = getAccountBalance,
    addTransaction: addTransactionFn = addTransaction,
    getTelegramId: getTelegramIdFn = getTelegramId,
    socket: socketInstance = socket
  } = deps;

  const {
    setMatchingError,
    setMatchStatus,
    setMatching,
    setPlayers,
    setReadyList,
    setCurrentTurn,
    setJoinedTableId,
    setJoinedCapacity,
    setConfirmed
  } = state;

  const {
    accountIdRef,
    pendingTableRef,
    cleanupRef,
    seatTimeoutRef,
    matchTimeoutRef,
    stakeDebitRef
  } = refs;

  const seatTimeoutMs = timeouts.seat ?? DEFAULT_SEAT_TIMEOUT_MS;
  const matchmakingTimeoutMs = timeouts.matchmaking ?? DEFAULT_MATCH_TIMEOUT_MS;

  setMatchingError('');
  setMatchStatus('Checking your TPC account…');
  setMatching(true);

  const refundStake = async (reason, extra = {}) => {
    if (!stakeDebitRef?.current) return false;
    const { telegramId, accountId, amount } = stakeDebitRef.current;
    try {
      await addTransactionFn(telegramId, amount, 'stake_refund', {
        game: 'snake-online',
        players: table?.capacity || 0,
        accountId,
        reason,
        ...extra
      });
      return true;
    } catch (error) {
      logSupportError('Stake refund failed', error, { reason, extra });
      return false;
    } finally {
      stakeDebitRef.current = null;
    }
  };

  const clearTimers = () => {
    clearTimeoutSafely(matchTimeoutRef);
    clearTimeoutSafely(seatTimeoutRef);
  };

  let accountId;
  try {
    accountId = await ensureAccountIdFn();
    accountIdRef.current = accountId;
  } catch (error) {
    setMatchingError('Unable to verify your TPC account. Please retry.');
    setMatchStatus('');
    setMatching(false);
    logSupportError('ensureAccountId failed', error);
    return { success: false };
  }

  const stakeAmount = Number(stake?.amount) || 0;
  if (stakeAmount > 0) {
    try {
      const balRes = await getAccountBalanceFn(accountId);
      const balance = balRes?.balance || 0;
      if (balance < stakeAmount) {
        setMatchingError('Insufficient balance for this stake.');
        setMatchStatus('');
        setMatching(false);
        return { success: false };
      }
    } catch (error) {
      setMatchingError('Could not check your balance. Please try again.');
      setMatchStatus('');
      setMatching(false);
      logSupportError('getAccountBalance failed', error, { accountId });
      return { success: false };
    }

    try {
      const telegramId = getTelegramIdFn?.();
      await addTransactionFn(telegramId, -stakeAmount, 'stake', {
        game: 'snake-online',
        players: table?.capacity || 0,
        accountId,
        token: stake?.token
      });
      stakeDebitRef.current = { telegramId, accountId, amount: stakeAmount };
    } catch (error) {
      setMatchingError('Unable to reserve your stake. Please retry.');
      setMatchStatus('');
      setMatching(false);
      logSupportError('addTransaction debit failed', error, { accountId });
      return { success: false };
    }
  }

  if (!socketInstance?.connected) {
    setMatchStatus('');
    setMatchingError('Unable to reach the online lobby. We refunded your stake.');
    await refundStake('socket_registration_failed', { accountId });
    setMatching(false);
    return { success: false };
  }

  function clearSpinDown({ keepError } = {}) {
    clearTimers();
    setMatching(false);
    if (!keepError) {
      setMatchingError('');
      setMatchStatus('');
    }
  }

  function startMatchTimeout(tableId) {
    clearTimeoutSafely(matchTimeoutRef);
    matchTimeoutRef.current = setTimeout(() => {
      setMatchStatus('');
      setMatchingError('Matchmaking timed out. We refunded your stake.');
      cleanupLobby({ account: accountId, refundReason: 'matchmaking_timeout', keepError: true });
      logSupportError('Matchmaking timeout', null, { accountId, tableId });
    }, matchmakingTimeoutMs);
  }

  async function cleanupLobby({
    account = accountIdRef.current,
    refundReason,
    keepError
  } = {}) {
    socketInstance.off('lobbyUpdate', handleLobbyUpdate);
    socketInstance.off('gameStart', handleGameStart);
    if (pendingTableRef.current && account) {
      socketInstance.emit('leaveLobby', { accountId: account, tableId: pendingTableRef.current });
    }
    pendingTableRef.current = '';
    clearSpinDown({ keepError });
    setPlayers([]);
    setReadyList([]);
    setCurrentTurn(null);
    setJoinedTableId(null);
    setJoinedCapacity(null);
    setConfirmed(false);
    if (refundReason || stakeDebitRef?.current) {
      await refundStake(refundReason || 'manual_cleanup', { account });
    }
    if (cleanupRef) cleanupRef.current = () => {};
  }

  function handleLobbyUpdate({ tableId: tid, players: list = [], currentTurn, ready = [], maxPlayers }) {
    if (!tid || tid !== pendingTableRef.current) return;
    setPlayers(list);
    if (currentTurn != null) setCurrentTurn(currentTurn);
    setReadyList(ready);
    if (maxPlayers) setJoinedCapacity(maxPlayers);
    const others = list.filter((p) => String(p.id) !== String(accountId));
    setMatchStatus(
      others.length > 0 ? 'Opponent joined. Locking seats…' : 'Waiting for another player…'
    );
  }

  async function handleGameStart({ tableId: startedId, players: list = [], currentTurn } = {}) {
    if (!startedId || startedId !== pendingTableRef.current) return;
    clearSpinDown({ keepError: true });
    pendingTableRef.current = '';
    stakeDebitRef.current = null;
    const maxPlayers = table?.capacity || list?.length || undefined;
    onGameStart?.({ tableId: startedId, players: list, currentTurn, maxPlayers });
    socketInstance.off('lobbyUpdate', handleLobbyUpdate);
    socketInstance.off('gameStart', handleGameStart);
  }

  cleanupRef.current = cleanupLobby;

  seatTimeoutRef.current = setTimeout(() => {
    setMatchStatus('');
    setMatchingError('Timed out while joining the online lobby. We refunded your stake.');
    cleanupLobby({ account: accountId, refundReason: 'seat_ack_timeout', keepError: true });
    logSupportError('Seat ack timeout', null, { accountId, table });
  }, seatTimeoutMs);

  socketInstance.on('lobbyUpdate', handleLobbyUpdate);
  socketInstance.on('gameStart', handleGameStart);
  socketInstance.emit('register', { playerId: accountId });

  socketInstance.emit(
    'seatTable',
    {
      accountId,
      gameType: 'snake',
      stake: stakeAmount,
      maxPlayers: table?.capacity,
      playerName,
      tableId: table?.id,
      avatar,
      token: stake?.token
    },
    (res) => {
      clearTimeoutSafely(seatTimeoutRef);
      setMatching(false);
      if (!res?.success || !res.tableId) {
        setMatchStatus('');
        setMatchingError(res?.message || 'Failed to join the online lobby. Please retry.');
        cleanupLobby({
          account: accountId,
          refundReason: 'seat_table_failed',
          keepError: true
        });
        logSupportError('seatTable failed', null, { response: res, accountId });
        return;
      }
      pendingTableRef.current = res.tableId;
      setJoinedTableId(res.tableId);
      const resolvedCapacity = res.maxPlayers ?? table?.capacity ?? null;
      setJoinedCapacity(resolvedCapacity);
      setPlayers(res.players || []);
      if (res.currentTurn != null) setCurrentTurn(res.currentTurn);
      setReadyList(res.ready || []);
      if (res.tableId) {
        window?.localStorage?.setItem('snakeCurrentTable', res.tableId);
      }
      socketInstance.emit('confirmReady', { accountId, tableId: res.tableId });
      setConfirmed(true);
      startMatchTimeout(res.tableId);
      setMatchStatus('Waiting for another player…');
    }
  );

  return { success: true };
}
