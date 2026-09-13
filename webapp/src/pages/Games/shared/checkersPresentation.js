// Display-only replay: never owns or writes the live board or turn.
export function createCheckersReplay(schedule = setTimeout, unschedule = clearTimeout) {
  let board = null;
  let timer = null;
  let generation = 0;
  const cancel = () => {
    generation += 1;
    if (timer !== null) unschedule(timer);
    timer = null;
    board = null;
  };
  return {
    getBoard: (liveBoard) => board || liveBoard,
    isActive: () => board !== null,
    cancel,
    play(beforeBoard, render) {
      cancel();
      board = beforeBoard;
      const current = generation;
      render();
      timer = schedule(() => {
        if (generation !== current) return;
        board = null;
        timer = null;
        render();
      }, 700);
    }
  };
}

export const isCheckersTap = ({ x, y, at, lookDragged }, { x: endX, y: endY, at: endAt }) =>
  !lookDragged && endAt - at <= 700 && Math.hypot(endX - x, endY - y) <= 12;

export function nextCheckersAnimationStart(animations, now) {
  return animations.reduce((start, animation) => animation.type === 'move'
    ? Math.max(start, animation.startedAt + animation.duration) : start, now);
}
