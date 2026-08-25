import { runSimpleOnlineFlow } from '../../utils/simpleOnlineFlow.js';

/**
 * Snake & Ladder adapter for the shared Battle Royal lobby lifecycle.
 *
 * Stakes are only checked here; the authoritative matchmaker reserves them
 * when every seat is locked. This deliberately mirrors Chess Battle Royal and
 * prevents a disconnected phone from being charged twice while its seat is
 * restored.
 */
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
  const capacity = table?.capacity || Number(table?.id?.split('-')[1]) || 4;
  const setCleanup = (cleanup) => {
    refs.cleanupRef.current = async ({ keepError = false } = {}) => {
      cleanup?.({ keepError });
      state.setIsSearching(false);
      state.setConfirmed(false);
      state.setJoinedTableId(null);
      state.setJoinedCapacity(null);
      refs.pendingTableRef.current = '';
    };
  };

  state.setIsSearching(true);
  state.setConfirmed(false);

  const result = await runSimpleOnlineFlow({
    gameType: 'snake',
    stake,
    maxPlayers: capacity,
    avatar: playerAvatar,
    playerName,
    // The capacity lobby is a matchmaking criterion, not a private room. Let
    // the server choose the canonical same-stake table, as Chess Quick Match does.
    quickMatch: true,
    matchMeta: { requestedCapacity: capacity },
    refreshMs: timeouts.matchmaking,
    deps: {
      ensureAccountId: deps.ensureAccountIdFn || deps.ensureAccountId,
      getAccountBalance: deps.getAccountBalanceFn || deps.getAccountBalance,
      getTelegramId: deps.getTelegramIdFn || deps.getTelegramId,
      socket: deps.socket
    },
    state: {
      setMatching: state.setMatching,
      setMatchStatus: state.setMatchStatus,
      setMatchError: state.setMatchingError,
      setMatchPlayers: state.setPlayers,
      setCleanup
    },
    onMatched: (payload) => {
      refs.stakeDebitRef.current = null;
      refs.pendingTableRef.current = payload.tableId || '';
      state.setIsSearching(false);
      state.setConfirmed(true);
      state.setJoinedTableId(payload.tableId || null);
      state.setJoinedCapacity(payload.maxPlayers || capacity);
      if (payload.currentTurn != null) state.setCurrentTurn(payload.currentTurn);
      if (Array.isArray(payload.players)) state.setPlayers(payload.players);
      onGameStart?.({ ...payload, maxPlayers: payload.maxPlayers || capacity });
    }
  });

  if (!result.ok) state.setIsSearching(false);
  refs.accountIdRef.current = result.accountId || null;
  return { success: result.ok, cleanup: result.cleanup };
}
