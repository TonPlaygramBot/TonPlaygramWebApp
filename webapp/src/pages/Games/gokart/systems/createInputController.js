const ACTIONS_BY_KEY = Object.freeze({
  arrowup: 'up',
  w: 'up',
  arrowdown: 'down',
  s: 'down'
});

export function createInputController() {
  const pressed = new Set();

  const onKeyDown = (event) => {
    const action = ACTIONS_BY_KEY[event.key.toLowerCase()];
    if (action) pressed.add(action);
  };

  const onKeyUp = (event) => {
    const action = ACTIONS_BY_KEY[event.key.toLowerCase()];
    if (action) pressed.delete(action);
  };

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  return {
    snapshot() {
      return {
        up: pressed.has('up'),
        down: pressed.has('down')
      };
    },
    dispose() {
      pressed.clear();
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    }
  };
}
