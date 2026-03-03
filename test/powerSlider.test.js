import { PowerSlider } from '../power-slider.js';

describe('PowerSlider pointer release commit path', () => {
  const buildSlider = ({ throwOnRelease = false } = {}) => {
    const listeners = new Map();
    const committed = [];
    const slider = Object.create(PowerSlider.prototype);
    slider.dragging = true;
    slider.dragMoved = true;
    slider.dragStartValue = 0;
    slider.value = 60;
    slider.min = 0;
    slider.max = 100;
    slider.onCommit = (value) => committed.push(value);
    slider.set = jest.fn();
    slider.el = {
      hasPointerCapture: jest.fn(() => true),
      releasePointerCapture: jest.fn(() => {
        if (throwOnRelease) {
          throw new Error('capture missing');
        }
      }),
      removeEventListener: jest.fn((type, cb) => {
        listeners.set(type, cb);
      }),
      classList: {
        remove: jest.fn()
      }
    };
    slider._onPointerMove = () => {};
    slider._onPointerUp = () => {};
    slider._onPointerCancel = () => {};
    return { slider, committed };
  };

  test('commits shot when pointer capture releases normally', () => {
    const { slider, committed } = buildSlider();
    slider._pointerUp({ pointerId: 11 });
    expect(committed).toEqual([60]);
  });

  test('still commits shot when releasePointerCapture throws', () => {
    const { slider, committed } = buildSlider({ throwOnRelease: true });
    expect(() => slider._pointerUp({ pointerId: 7 })).not.toThrow();
    expect(committed).toEqual([60]);
  });
});
