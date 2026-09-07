export const newGame = () => ({ frames: [[]], finished: false });
export function pinsAvailable(game) {
  if (game.finished) return 0;
  const f = game.frames.at(-1);
  if (!f.length) return 10;
  if (game.frames.length < 10) return 10 - f[0];
  if (f.length === 1) return f[0] === 10 ? 10 : 10 - f[0];
  return f[0] === 10 && f[1] !== 10 ? 10 - f[1] : 10;
}
export function recordRoll(game, pins) {
  if (game.finished) throw new Error('Game is complete');
  if (!Number.isInteger(pins) || pins < 0 || pins > pinsAvailable(game))
    throw new Error('Invalid pin count');
  const frames = game.frames.map((f) => [...f]);
  const f = frames.at(-1);
  f.push(pins);
  let finished = false;
  if (frames.length < 10) {
    if (f[0] === 10 || f.length === 2) frames.push([]);
  } else {
    finished =
      f.length === 3 || (f.length === 2 && f[0] !== 10 && f[0] + f[1] < 10);
  }
  return { frames, finished };
}
export function frameTotals(game) {
  let total = 0,
    pending = false;
  return Array.from({ length: 10 }, (_, i) => {
    const f = game.frames[i] || [];
    let value = null;
    const following = game.frames.slice(i + 1).flat();
    if (i === 9) {
      if (game.finished) value = f.reduce((a, b) => a + b, 0);
    } else if (f[0] === 10) {
      if (following.length >= 2) value = 10 + following[0] + following[1];
    } else if (f.length === 2) {
      if (f[0] + f[1] === 10) {
        if (following.length) value = 10 + following[0];
      } else value = f[0] + f[1];
    }
    if (value === null) pending = true;
    if (pending) return null;
    total += value;
    return total;
  });
}
export function totalScore(game) {
  return (
    frameTotals(game)
      .filter((n) => n !== null)
      .at(-1) ?? 0
  );
}
export function rollSymbols(f, frame) {
  return f.map((v, i) => {
    const fresh =
      i === 0 ||
      (frame === 9 && f[i - 1] === 10) ||
      (frame === 9 && i === 2 && f[0] !== 10);
    if (v === 10 && fresh) return 'X';
    if (i > 0 && !fresh && f[i - 1] + v === 10) return '/';
    return v === 0 ? '–' : String(v);
  });
}
