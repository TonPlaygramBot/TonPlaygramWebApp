import { PowerSlider } from '../power-slider.js';

class Element extends EventTarget {
  constructor() {
    super();
    this.style = { setProperty() {} };
    this.classList = { add() {}, remove() {} };
    this.clientHeight = 200;
    this.offsetHeight = 30;
  }
  append() {}
  appendChild() {}
  remove() {}
  setAttribute() {}
  setPointerCapture() {}
  releasePointerCapture() {}
  getBoundingClientRect() { return { top: 0, height: 200 }; }
}

describe('shot power pointer lifecycle', () => {
  let slider;
  let commit;
  let release;
  let originals;
  const dispatch = (type, pointerId = 1, clientY = 120) => {
    const event = Object.assign(new Event(type), { pointerId, clientY, button: 0 });
    slider.el.dispatchEvent(event);
  };
  beforeEach(() => {
    originals = Object.fromEntries(['window', 'document', 'requestAnimationFrame', 'cancelAnimationFrame'].map(key => [key, global[key]]));
    global.window = new EventTarget();
    global.document = Object.assign(new EventTarget(), { createElement: () => new Element(), hidden: false });
    global.requestAnimationFrame = jest.fn(() => 1);
    global.cancelAnimationFrame = jest.fn();
    commit = jest.fn();
    release = jest.fn();
    slider = new PowerSlider({ mount: new Element(), onCommit: commit, onShotRelease: release });
  });
  afterEach(() => {
    slider.destroy();
    for (const [key, value] of Object.entries(originals)) {
      if (value === undefined) delete global[key];
      else global[key] = value;
    }
  });

  test.each(['pointercancel', 'lostpointercapture'])('%s resets power without firing', type => {
    dispatch('pointerdown');
    dispatch(type);
    dispatch('pointerup');
    expect(commit).not.toHaveBeenCalled();
    expect(release).not.toHaveBeenCalled();
    expect(slider.get()).toBe(0);
    expect(slider.dragging).toBe(false);
  });

  test('only the finger that started the pull can move or release it', () => {
    dispatch('pointerdown', 1, 100);
    dispatch('pointerdown', 2, 180);
    dispatch('pointermove', 2, 190);
    dispatch('pointerup', 2, 190);
    expect(slider.get()).toBe(50);
    expect(commit).not.toHaveBeenCalled();
    dispatch('pointerup', 1, 120);
    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit).toHaveBeenCalledWith(60);
  });

  test.each(['lock', 'destroy'])('%s during a drag cannot fire later', action => {
    dispatch('pointerdown');
    slider[action]();
    dispatch('pointerup');
    expect(commit).not.toHaveBeenCalled();
    expect(slider.dragging).toBe(false);
  });

  test.each(['blur', 'visibilitychange'])('%s cancels an interrupted shot', type => {
    dispatch('pointerdown');
    document.hidden = true;
    (type === 'blur' ? window : document).dispatchEvent(new Event(type));
    dispatch('pointerup');
    expect(commit).not.toHaveBeenCalled();
    expect(slider.get()).toBe(0);
  });

  test('returning the pull to zero cancels the shot', () => {
    dispatch('pointerdown');
    dispatch('pointerup', 1, 0);
    expect(commit).not.toHaveBeenCalled();
  });

  test('one completed drag commits exactly once and permits the next drag', () => {
    dispatch('pointerdown');
    dispatch('pointerup');
    dispatch('pointerup');
    expect(commit).toHaveBeenCalledTimes(1);
    dispatch('pointerdown');
    dispatch('pointerup');
    expect(commit).toHaveBeenCalledTimes(2);
  });

  test('destroy stops pending shot animation callbacks', () => {
    dispatch('pointerdown');
    dispatch('pointerup');
    slider.destroy();
    expect(cancelAnimationFrame).toHaveBeenCalled();
    expect(slider._shotAnimFrame).toBeNull();
    expect(slider._returnAnimFrame).toBeNull();
  });
});
