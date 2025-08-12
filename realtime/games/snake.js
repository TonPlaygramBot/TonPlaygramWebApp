export const maxPlayers = 4;

export function createState() {
  return { scores: {} };
}

export function onInput(room, playerId, _payload) {
  room.data.scores[playerId] = (room.data.scores[playerId] || 0) + 1;
}
