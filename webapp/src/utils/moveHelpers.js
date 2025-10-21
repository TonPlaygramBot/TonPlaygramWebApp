export function flashHighlight(cell, type, ctx, times = 1, done = () => {}) {
  if (times <= 0) return done();
  ctx.setHighlight({ cell, type });
  setTimeout(() => {
    ctx.setHighlight(null);
    setTimeout(() => flashHighlight(cell, type, ctx, times - 1, done), 150);
  }, 150);
}

export function moveSeq(seq, type, ctx, done = () => {}, dir = 'forward') {
  const stepMove = (idx) => {
    if (idx >= seq.length) return done();
    const next = seq[idx];
    ctx.updatePosition(next);
    if (ctx.moveSoundRef?.current) {
      ctx.moveSoundRef.current.currentTime = 0;
      if (!ctx.muted) ctx.moveSoundRef.current.play().catch(() => {});
    }
    const hType = idx === seq.length - 1 ? type : dir === 'back' ? 'back' : 'forward';
    ctx.setHighlight({ cell: next, type: hType });
    ctx.setTrail((t) => [...t, { cell: next, type: hType }]);
    if (idx === seq.length - 2 && ctx.hahaSoundRef?.current) ctx.hahaSoundRef.current.pause();
    setTimeout(() => stepMove(idx + 1), 700);
  };
  stepMove(0);
}

export function applyEffect(startPos, ctx, finalizeMove) {
  const snakeEnd = ctx.snakes[startPos];
  const ladderObj = ctx.ladders[startPos];
  const ladderEnd = typeof ladderObj === 'object' ? ladderObj.end : ladderObj;

  if (snakeEnd != null) {
    const offset = startPos - snakeEnd;
    ctx.setTrail([{ cell: startPos, type: 'snake' }]);
    ctx.setOffsetPopup({ cell: startPos, type: 'snake', amount: offset });
    setTimeout(() => ctx.setOffsetPopup(null), 1000);
    if (!ctx.muted) {
      ctx.snakeSoundRef?.current?.play().catch(() => {});
      ctx.oldSnakeSoundRef?.current?.play().catch(() => {});
      ctx.badLuckSoundRef?.current?.play().catch(() => {});
    }
    const seq = [];
    for (let i = 1; i <= offset && startPos - i >= 0; i++) seq.push(startPos - i);
    const target = Math.max(0, snakeEnd);
    const move = () => {
      if (
        ctx.startSlide &&
        ctx.startSlide({
          playerIndex: ctx.playerIndex ?? 0,
          from: startPos,
          to: target,
          type: 'snake',
          onComplete: () => finalizeMove(target, 'snake')
        })
      ) {
        return;
      }
      moveSeq(seq, 'snake', ctx, () => finalizeMove(target, 'snake'), 'back');
    };
    flashHighlight(startPos, 'snake', ctx, 2, move);
  } else if (ladderEnd != null) {
    const offset = ladderEnd - startPos;
    ctx.setTrail((t) => t.map((h) => (h.cell === startPos ? { ...h, type: 'ladder' } : h)));
    ctx.setOffsetPopup({ cell: startPos, type: 'ladder', amount: offset });
    setTimeout(() => ctx.setOffsetPopup(null), 1000);
    if (!ctx.muted) ctx.ladderSoundRef?.current?.play().catch(() => {});
    const seq = [];
    for (let i = 1; i <= offset && startPos + i <= ctx.FINAL_TILE; i++) seq.push(startPos + i);
    const target = Math.min(ctx.FINAL_TILE, ladderEnd);
    const move = () => {
      if (
        ctx.startSlide &&
        ctx.startSlide({
          playerIndex: ctx.playerIndex ?? 0,
          from: startPos,
          to: target,
          type: 'ladder',
          onComplete: () => finalizeMove(target, 'ladder')
        })
      ) {
        return;
      }
      moveSeq(seq, 'ladder', ctx, () => finalizeMove(target, 'ladder'), 'forward');
    };
    flashHighlight(startPos, 'ladder', ctx, 2, move);
  } else {
    finalizeMove(startPos, 'normal');
  }
}
