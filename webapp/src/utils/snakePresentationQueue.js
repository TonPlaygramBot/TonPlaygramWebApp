// Socket events describe one move synchronously; presentation takes time.
// Keep snapshots and turn changes behind the dice, movement and jump effects.
export function createSnakePresentationQueue(onError = () => {}) {
  let tail = Promise.resolve();
  let disposed = false;
  return {
    enqueue(task) {
      tail = tail.then(() => disposed ? undefined : task()).catch(onError);
      return tail;
    },
    dispose() { disposed = true; }
  };
}
