function playerId(player) {
  return String(player?.id || player?.tpcAccountNumber || '');
}

function remapIndexedState(state, orderedPlayers, oldIndexById) {
  const newIndexByOldIndex = new Map();
  orderedPlayers.forEach((player, newIndex) => {
    const oldIndex = oldIndexById.get(playerId(player));
    if (oldIndex !== undefined) newIndexByOldIndex.set(oldIndex, newIndex);
  });
  const remapIndex = (value) => Number.isInteger(value) && newIndexByOldIndex.has(value)
    ? newIndexByOldIndex.get(value)
    : value;
  return {
    ...state,
    players: orderedPlayers.map((player, index) => ({ ...player, seatIndex: index })),
    actionIndex: remapIndex(state.actionIndex),
    dealerIndex: remapIndex(state.dealerIndex),
    winnerFocusIndex: remapIndex(state.winnerFocusIndex),
    winners: Array.isArray(state.winners)
      ? state.winners.map((pot) => ({
          ...pot,
          winners: Array.isArray(pot?.winners)
            ? pot.winners.map((winner) => ({ ...winner, index: remapIndex(winner.index) }))
            : pot?.winners
        }))
      : state.winners
  };
}

export function orderTexasHoldemStateForViewer(state, accountId) {
  if (!state?.players?.length || !accountId) return state;
  const selfIndex = state.players.findIndex((player) => playerId(player) === String(accountId));
  if (selfIndex <= 0) return state;
  const oldIndexById = new Map(state.players.map((player, index) => [playerId(player), index]));
  const ordered = [...state.players.slice(selfIndex), ...state.players.slice(0, selfIndex)];
  return remapIndexedState(state, ordered, oldIndexById);
}

export function orderTexasHoldemStateForNetwork(state, tablePlayers = []) {
  if (!state?.players?.length || !tablePlayers?.length) return state;
  const oldIndexById = new Map(state.players.map((player, index) => [playerId(player), index]));
  const orderById = new Map(tablePlayers.map((player, index) => [playerId(player), index]));
  const ordered = [...state.players].sort((a, b) =>
    (orderById.get(playerId(a)) ?? Number.MAX_SAFE_INTEGER) -
    (orderById.get(playerId(b)) ?? Number.MAX_SAFE_INTEGER)
  );
  return remapIndexedState(state, ordered, oldIndexById);
}
