export const maxPlayers = 2;

export function createState() {
  return { rolls: {} };
}

export function onInput(room, playerId, _payload) {
  const value = Math.floor(Math.random() * 6) + 1;
  const arr = room.data.rolls[playerId] || [];
  arr.push(value);
  room.data.rolls[playerId] = arr;
}
