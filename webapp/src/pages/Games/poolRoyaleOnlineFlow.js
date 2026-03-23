import { ensureAccountId, getTelegramFirstName, getTelegramId } from '../../utils/telegram.js';
import { getAccountBalance, addTransaction } from '../../utils/api.js';
import { socket, refreshSocketAuthIdentity } from '../../utils/socket.js';

const DEFAULT_SEAT_TIMEOUT_MS = 12000;
const DEFAULT_MATCH_TIMEOUT_MS = 30000;
const DEFAULT_SOCKET_CONNECT_TIMEOUT_MS = 15000;
const DEFAULT_REGISTER_TIMEOUT_MS = 6000;

function logSupportError(message, error, context = {}) {
  // Surface in console for support teams; caller will also show inline errors.
  console.error('[PoolRoyaleLobby]', message, { ...context, error });
}

function clearTimeoutSafely(ref) {
  if (ref?.current) {
    clearTimeout(ref.current);
    ref.current = null;
  }
}

async function ensureSocketReady(socketInstance, timeoutMs = DEFAULT_SOCKET_CONNECT_TIMEOUT_MS) {
  if (!socketInstance) return false;
  if (socketInstance.connected) return true;

  try {
    socketInstance.connect?.();
  } catch {
    return false;
  }

  return await new Promise((resolve) => {
    let settled = false;
    let timer;
    let lastError = null;

    const finish = (ok) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      socketInstance.off?.('connect', onConnect);
      socketInstance.off?.('connect_error', onConnectError);
      socketInstance.off?.('error', onConnectError);
      if (!ok && lastError) {
        logSupportError('Socket connect failed', lastError);
      }
      resolve(ok);
    };

    const onConnect = () => finish(true);
    const onConnectError = (error) => {
      lastError = error || lastError;
      // Mobile connections can emit temporary connect errors before succeeding.
      // Keep waiting until timeout so we avoid false negatives and unnecessary stake refunds.
    };

    timer = setTimeout(() => finish(socketInstance.connected), timeoutMs);

    socketInstance.once?.('connect', onConnect);
    socketInstance.once?.('connect_error', onConnectError);
    socketInstance.once?.('error', onConnectError);
  });
}

function setSocketIdentity(socketInstance, accountId) {
  if (!socketInstance || !accountId) return;
  try {
    if (socketInstance === socket) {
      refreshSocketAuthIdentity({ accountId: String(accountId) });
      return;
    }
    const existingAuth =
      socketInstance.auth && typeof socketInstance.auth === 'object'
        ? socketInstance.auth
        : {};
    socketInstance.auth = {
      ...existingAuth,
      accountId: String(accountId)
    };
  } catch (error) {
    logSupportError('Socket identity setup failed', error, { accountId });
  }
}

async function ensureSocketRegistered(
  socketInstance,
  accountId,
  timeoutMs = DEFAULT_REGISTER_TIMEOUT_MS
) {
  if (!socketInstance || !accountId) return false;

  return await new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve(false);
    }, timeoutMs);

    try {
      socketInstance.emit('register', { playerId: accountId }, (res) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(!!res?.success);
      });
    } catch (error) {
      clearTimeout(timer);
      logSupportError('Socket register emit failed', error, { accountId });
      resolve(false);
    }
  });
}

async function recoverSocketIdentity({
  socketInstance,
  accountId,
  socketConnectTimeoutMs,
  registerTimeoutMs
}) {
  setSocketIdentity(socketInstance, accountId);
  const ready = await ensureSocketReady(socketInstance, socketConnectTimeoutMs);
  if (!ready) return false;
  return ensureSocketRegistered(socketInstance, accountId, registerTimeoutMs);
}

export async function runPoolRoyaleOnlineFlow({
  stake,
  tableId,
  variant,
  ballSet,
  playType,
  mode,
  tableSize,
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
    getTelegramFirstName: getTelegramFirstNameFn = getTelegramFirstName,
    socket: socketInstance = socket
  } = deps;
  const {
    setMatchingError,
    setMatchStatus,
    setMatching,
    setIsSearching,
    setMatchPlayers,
    setReadyList,
    setSpinningPlayer
  } = state;
  const {
    accountIdRef,
    matchPlayersRef,
    pendingTableRef,
    cleanupRef,
    spinIntervalRef,
    stakeDebitRef,
    matchTimeoutRef,
    seatTimeoutRef
  } = refs;

  const seatTimeoutMs = timeouts.seat ?? DEFAULT_SEAT_TIMEOUT_MS;
  const matchmakingTimeoutMs = timeouts.matchmaking ?? DEFAULT_MATCH_TIMEOUT_MS;
  const socketConnectTimeoutMs = timeouts.socketConnect ?? DEFAULT_SOCKET_CONNECT_TIMEOUT_MS;
  const registerTimeoutMs = timeouts.register ?? DEFAULT_REGISTER_TIMEOUT_MS;
  const requestedTableId =
    typeof tableId === 'string' && tableId.trim()
      ? tableId.trim()
      : undefined;

  const telegramId = getTelegramIdFn?.();

  setMatchingError('');
  setMatchStatus('Checking your TPC account…');
  setMatching(true);
  setIsSearching(true);

  const refundStake = async (reason, extra = {}) => {
    if (!stakeDebitRef?.current) return false;
    const { telegramId: debitedTelegram, accountId: debitedAccount, amount } = stakeDebitRef.current;
    try {
      await addTransactionFn(debitedTelegram, amount, 'stake_refund', {
        game: 'poolroyale-online',
        players: 2,
        accountId: debitedAccount,
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
    setIsSearching(false);
    logSupportError('ensureAccountId failed', error);
    return { success: false };
  }

  try {
    const balRes = await getAccountBalanceFn(accountId);
    const balance = balRes?.balance || 0;
    if (balance < stake.amount) {
      setMatchingError('Insufficient balance for this stake.');
      setMatchStatus('');
      setMatching(false);
      setIsSearching(false);
      return { success: false };
    }
  } catch (error) {
    setMatchingError('Could not check your balance. Please try again.');
    setMatchStatus('');
    setMatching(false);
    setIsSearching(false);
    logSupportError('getAccountBalance failed', error, { accountId });
    return { success: false };
  }

  // Some mobile sessions can initialize socket auth before accountId is available.
  // Ensure the current accountId is attached to the next handshake attempt.
  setSocketIdentity(socketInstance, accountId);

  try {
    await addTransactionFn(telegramId, -stake.amount, 'stake', {
      game: 'poolroyale-online',
      players: 2,
      accountId
    });
    stakeDebitRef.current = { telegramId, accountId, amount: stake.amount };
  } catch (error) {
    setMatchingError('Unable to reserve your stake. Please retry.');
    setMatchStatus('');
    setMatching(false);
    setIsSearching(false);
    logSupportError('addTransaction debit failed', error, { accountId, telegramId });
    return { success: false };
  }

  const socketReady = await ensureSocketReady(socketInstance, socketConnectTimeoutMs);
  if (!socketReady) {
    setMatchStatus('');
    setMatchingError('Unable to reach the online arena. We refunded your stake.');
    await refundStake('socket_registration_failed', { accountId });
    setMatching(false);
    setIsSearching(false);
    return { success: false };
  }

  const socketRegistered = await ensureSocketRegistered(
    socketInstance,
    accountId,
    registerTimeoutMs
  );
  if (!socketRegistered) {
    setMatchStatus('');
    setMatchingError('Unable to sync your online session. We refunded your stake.');
    await refundStake('socket_register_ack_failed', { accountId });
    setMatching(false);
    setIsSearching(false);
    return { success: false };
  }

  function handleLobbyUpdate({ tableId: tid, players: list = [], ready = [] } = {}) {
    if (!tid || tid !== pendingTableRef.current) return;
    setMatchPlayers(list);
    matchPlayersRef.current = list;
    setReadyList(ready);
    const others = list.filter((p) => String(p.id) !== String(accountId));
    setMatchStatus(
      others.length > 0 ? 'Opponent joined. Locking seats…' : 'Waiting for another player…'
    );
  }

  function clearSpinInterval() {
    if (spinIntervalRef?.current) {
      clearInterval(spinIntervalRef.current);
      spinIntervalRef.current = null;
    }
  }

  async function cleanupLobby({ account = accountIdRef.current, skipRefReset, refundReason, keepError } = {}) {
    socketInstance.off('lobbyUpdate', handleLobbyUpdate);
    socketInstance.off('gameStart', handleGameStart);
    if (pendingTableRef.current && account) {
      socketInstance.emit('leaveLobby', { accountId: account, tableId: pendingTableRef.current });
    }
    pendingTableRef.current = '';
    clearSpinInterval();
    clearTimers();
    setMatchPlayers([]);
    matchPlayersRef.current = [];
    setReadyList([]);
    setMatchStatus('');
    setMatching(false);
    setSpinningPlayer('');
    setIsSearching(false);
    if (!keepError) setMatchingError('');
    if (refundReason || stakeDebitRef?.current) {
      await refundStake(refundReason || 'manual_cleanup', { account });
    }
    if (!skipRefReset) cleanupRef.current = () => {};
  }

  const triggerTimeoutRefund = (reason, message, extra = {}) => {
    setMatchStatus('');
    setMatchingError(message);
    cleanupLobby({ account: accountId, refundReason: reason, keepError: true });
    logSupportError(message, null, { reason, ...extra });
  };

  function handleGameStart({ tableId: startedId, players: joined = [], currentTurn } = {}) {
    if (!startedId || startedId !== pendingTableRef.current) return;
    const roster = Array.isArray(joined) && joined.length > 0 ? joined : matchPlayersRef.current;
    stakeDebitRef.current = null;
    clearTimers();
    cleanupLobby({ account: accountId, skipRefReset: true, keepError: true });
    onGameStart?.({ tableId: startedId, roster, accountId, currentTurn });
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

  function startMatchTimeout(tableId) {
    clearTimeoutSafely(matchTimeoutRef);
    matchTimeoutRef.current = setTimeout(() => {
      triggerTimeoutRefund('matchmaking_timeout', 'Matchmaking timed out. We refunded your stake.', {
        accountId,
        tableId
      });
    }, matchmakingTimeoutMs);
  }

  let seatAttempts = 0;
  const maxSeatAttempts = 2;
  const seatPlayer = () => {
    seatAttempts += 1;
    socketInstance.emit(
      'seatTable',
      {
        accountId,
        stake: stake.amount,
        token: stake.token,
        gameType: 'poolroyale',
        maxPlayers: 2,
        tableId: requestedTableId,
        mode,
        variant,
        ballSet,
        tableSize,
        playType,
        playerName: getTelegramFirstNameFn?.() || `TPC ${accountId}` || 'Player',
        avatar
      },
      (res) => {
        clearTimeoutSafely(seatTimeoutRef);
        setIsSearching(false);
        if (!res?.success || !res.tableId) {
          const isRegistrationError =
            res?.error === 'register_required' || res?.error === 'identity_mismatch';
          const shouldRetry =
            (isRegistrationError || res?.error === 'rate_limited') &&
            seatAttempts < maxSeatAttempts;
          if (shouldRetry) {
            const retrySeat = async () => {
              if (isRegistrationError) {
                setMatchStatus('Resyncing your online session…');
                const recovered = await recoverSocketIdentity({
                  socketInstance,
                  accountId,
                  socketConnectTimeoutMs,
                  registerTimeoutMs
                });
                if (!recovered) {
                  triggerTimeoutRefund(
                    'socket_registration_failed',
                    'Unable to sync your online session. We refunded your stake.',
                    { response: res, accountId, seatAttempts }
                  );
                  return;
                }
              } else {
                setMatchStatus('Retrying online seat…');
              }
              seatTimeoutRef.current = setTimeout(() => {
                seatPlayer();
              }, 400);
            };
            retrySeat();
            return;
          }
          triggerTimeoutRefund(
            'seat_table_failed',
            res?.message || 'Failed to join the online arena. Please retry.',
            { response: res, accountId, seatAttempts }
          );
          return;
        }
        pendingTableRef.current = res.tableId;
        setMatchStatus('Waiting for another player…');
        const playersList = res.players || [];
        setMatchPlayers(playersList);
        matchPlayersRef.current = playersList;
        setReadyList(res.ready || []);
        socketInstance.emit('confirmReady', {
          accountId,
          tableId: res.tableId
        });
        startMatchTimeout(res.tableId);
      }
    );
  };

  seatPlayer();

  return { success: true };
}
