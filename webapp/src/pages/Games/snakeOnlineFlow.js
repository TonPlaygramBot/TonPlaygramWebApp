import { ensureAccountId, getTelegramFirstName, getTelegramId } from '../../utils/telegram.js';
import { getAccountBalance, addTransaction } from '../../utils/api.js';
import { socket } from '../../utils/socket.js';

const DEFAULT_SEAT_TIMEOUT_MS = 12000;
const DEFAULT_MATCH_TIMEOUT_MS = 30000;

function logSnakeOnlineError(message, error, context = {}) {
  console.error('[SnakeOnlineFlow]', message, { ...context, error });
}

function clearTimeoutSafely(ref) {
  if (ref?.current) {
    clearTimeout(ref.current);
    ref.current = null;
  }
}

export async function runSnakeOnlineFlow({
  table,
  stake,
  playerName,
  playerAvatar,
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
    getTelegramFirstName: getTelegramFirstNameFn = getTelegramFirstName,
    socket: socketInstance = socket
  } = deps;

  const {
    setMatchingError,
    setMatchStatus,
    setMatching,
    setIsSearching,
    setPlayers,
    setReadyList,
    setConfirmed,
    setJoinedTableId,
    setJoinedCapacity,
    setCurrentTurn
  } = state;

  const {
    accountIdRef,
    pendingTableRef,
    cleanupRef,
    matchTimeoutRef,
    seatTimeoutRef,
    stakeDebitRef
  } = refs;

  const seatTimeoutMs = timeouts.seat ?? DEFAULT_SEAT_TIMEOUT_MS;
  const matchmakingTimeoutMs = timeouts.matchmaking ?? DEFAULT_MATCH_TIMEOUT_MS;
  const capacity = table?.capacity || table?.maxPlayers || 4;
  const telegramId = getTelegramIdFn?.();

  setMatchingError?.('');
  setMatchStatus?.('Checking your TPC account…');
  setMatching?.(true);
  setIsSearching?.(true);

  const refundStake = async (reason, extra = {}) => {
    if (!stakeDebitRef?.current) return false;
    const { telegramId: debitedTelegram, accountId: debitedAccount, amount } = stakeDebitRef.current;
    try {
      await addTransactionFn(debitedTelegram, amount, 'stake_refund', {
        game: 'snake-online',
        players: capacity,
        accountId: debitedAccount,
        reason,
        ...extra
      });
      return true;
    } catch (error) {
      logSnakeOnlineError('Stake refund failed', error, { reason, extra });
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
    setMatchingError?.('Unable to verify your TPC account. Please retry.');
    setMatchStatus?.('');
    setMatching?.(false);
    setIsSearching?.(false);
    logSnakeOnlineError('ensureAccountId failed', error);
    return { success: false };
  }

  try {
    const balRes = await getAccountBalanceFn(accountId);
    const balance = balRes?.balance || 0;
    if (balance < stake.amount) {
      setMatchingError?.('Insufficient balance for this stake.');
      setMatchStatus?.('');
      setMatching?.(false);
      setIsSearching?.(false);
      return { success: false };
    }
  } catch (error) {
    setMatchingError?.('Could not check your balance. Please try again.');
    setMatchStatus?.('');
    setMatching?.(false);
    setIsSearching?.(false);
    logSnakeOnlineError('getAccountBalance failed', error, { accountId });
    return { success: false };
  }

  try {
    await addTransactionFn(telegramId, -stake.amount, 'stake', {
      game: 'snake-online',
      players: capacity,
      accountId
    });
    stakeDebitRef.current = { telegramId, accountId, amount: stake.amount };
  } catch (error) {
    setMatchingError?.('Unable to reserve your stake. Please retry.');
    setMatchStatus?.('');
    setMatching?.(false);
    setIsSearching?.(false);
    logSnakeOnlineError('addTransaction debit failed', error, { accountId, telegramId });
    return { success: false };
  }

  if (!socketInstance?.connected) {
    setMatchStatus?.('');
    setMatchingError?.('Unable to reach the online arena. We refunded your stake.');
    await refundStake('socket_registration_failed', { accountId });
    setMatching?.(false);
    setIsSearching?.(false);
    return { success: false };
  }

  function handleLobbyUpdate({ tableId: tid, players: list = [], ready = [], currentTurn } = {}) {
    if (!tid || tid !== pendingTableRef.current) return;
    setPlayers?.(list);
    setReadyList?.(ready);
    setCurrentTurn?.(currentTurn ?? null);
    const others = list.filter((p) => String(p.id) !== String(accountId));
    setMatchStatus?.(
      others.length > 0 ? 'Opponent joined. Locking seats…' : 'Waiting for another player…'
    );
  }

  async function cleanupLobby({
    account = accountIdRef.current,
    skipRefReset,
    refundReason,
    keepError,
    preserveSeat
  } = {}) {
    socketInstance.off('lobbyUpdate', handleLobbyUpdate);
    socketInstance.off('gameStart', handleGameStart);
    if (!preserveSeat && pendingTableRef.current && account) {
      socketInstance.emit('leaveLobby', { accountId: account, tableId: pendingTableRef.current });
    }
    pendingTableRef.current = '';
    clearTimers();
    if (!preserveSeat) {
      setJoinedTableId?.(null);
      setJoinedCapacity?.(null);
      setConfirmed?.(false);
      setPlayers?.([]);
      setReadyList?.([]);
      setCurrentTurn?.(null);
    }
    setMatchStatus?.('');
    setMatching?.(false);
    setIsSearching?.(false);
    if (!keepError) setMatchingError?.('');
    if (refundReason || stakeDebitRef?.current) {
      await refundStake(refundReason || 'manual_cleanup', { account });
    }
    if (!skipRefReset) cleanupRef.current = () => {};
  }

  const triggerTimeoutRefund = (reason, message, extra = {}) => {
    setMatchStatus?.('');
    setMatchingError?.(message);
    cleanupLobby({ account: accountId, refundReason: reason, keepError: true });
    logSnakeOnlineError(message, null, { reason, ...extra });
  };

  function handleGameStart({ tableId: startedId } = {}) {
    if (!startedId || startedId !== pendingTableRef.current) return;
    stakeDebitRef.current = null;
    clearTimers();
    cleanupLobby({ account: accountId, skipRefReset: true, keepError: true, preserveSeat: true });
    onGameStart?.({ tableId: startedId, accountId });
  }

  cleanupRef.current = cleanupLobby;

  seatTimeoutRef.current = setTimeout(() => {
    triggerTimeoutRefund(
      'seat_ack_timeout',
      'Timed out while joining the online arena. We refunded your stake.',
      { accountId }
    );
  }, seatTimeoutMs);

  socketInstance.on('lobbyUpdate', handleLobbyUpdate);
  socketInstance.on('gameStart', handleGameStart);
  socketInstance.emit('register', { playerId: accountId });

  function startMatchTimeout(tableId) {
    clearTimeoutSafely(matchTimeoutRef);
    matchTimeoutRef.current = setTimeout(() => {
      triggerTimeoutRefund('matchmaking_timeout', 'Matchmaking timed out. We refunded your stake.', {
        accountId,
        tableId
      });
    }, matchmakingTimeoutMs);
  }

  socketInstance.emit(
    'seatTable',
    {
      accountId,
      stake: stake.amount,
      token: stake.token,
      gameType: 'snake',
      maxPlayers: capacity,
      playerName: playerName || getTelegramFirstNameFn?.() || `TPC ${accountId}` || 'Player',
      tableId: table?.id,
      avatar: playerAvatar
    },
    (res) => {
      clearTimeoutSafely(seatTimeoutRef);
      setIsSearching?.(false);
      if (!res?.success || !res.tableId) {
        triggerTimeoutRefund(
          'seat_table_failed',
          res?.message || 'Failed to join the online arena. Please retry.',
          { response: res, accountId }
        );
        return;
      }
      pendingTableRef.current = res.tableId;
      setJoinedTableId?.(res.tableId);
      setJoinedCapacity?.(res.maxPlayers ?? capacity ?? null);
      setPlayers?.(res.players || []);
      setReadyList?.(res.ready || []);
      setCurrentTurn?.(res.currentTurn ?? null);
      setMatchStatus?.('Waiting for another player…');
      if (res.tableId) {
        try {
          localStorage.setItem('snakeCurrentTable', res.tableId);
        } catch {}
      }
      socketInstance.emit('confirmReady', {
        accountId,
        tableId: res.tableId
      });
      setConfirmed?.(true);
      startMatchTimeout(res.tableId);
    }
  );

  return { success: true };
}
