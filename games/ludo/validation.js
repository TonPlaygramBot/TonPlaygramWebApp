export function validateLobby(mode, seats) {
  if (mode === 'online') {
    if (seats.some(s => s.kind === 'ai')) throw new Error('AI not allowed in online mode');
    if (seats.length < 2) throw new Error('At least 2 humans required');
  } else {
    if (seats.some(s => s.kind === 'human' && !s.isLocal))
      throw new Error('Remote humans not allowed in local mode');
    if (seats.length < 2) throw new Error('At least 1 human + 1 AI required');
  }
}
