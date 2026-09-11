import { SnookerRoyalRules } from '../src/rules/SnookerRoyalRules.ts';
import {
  buildSnookerViewerHud,
  resolveSnookerShotClockExpiry,
  resolveSnookerViewerScores
} from '../webapp/src/pages/Games/snookerRoyalMatchQuality.js';
import { PowerSlider, isPowerPointerCancel } from '../power-slider.js';

describe('Snooker Royal quality safeguards', () => {
  test('seat B sees their own score first in the portrait scoreboard', () => {
    expect(resolveSnookerViewerScores({ A: 18, B: 42 }, 'B')).toEqual({
      playerScore: 42,
      opponentScore: 18
    });
    expect(resolveSnookerViewerScores({ A: 18, B: 42 }, 'A')).toEqual({
      playerScore: 18,
      opponentScore: 42
    });
  });

  test('shot-clock expiry awards the foul and advances the real frame turn', () => {
    const rules = new SnookerRoyalRules('snooker');
    const state = rules.getInitialFrame('Player', 'AI');
    const next = resolveSnookerShotClockExpiry({ rules, state, localSeat: 'A' });
    expect(next).not.toBeNull();
    expect(next.activePlayer).toBe('B');
    expect(next.players.B.score).toBe(4);
    expect(next.foul).toEqual({ points: 4, reason: 'shot clock expired' });
    expect(state.activePlayer).toBe('A');
    expect(state.players.B.score).toBe(0);
  });

  test('a non-active viewer cannot expire the opponent clock', () => {
    const rules = new SnookerRoyalRules('snooker');
    const state = rules.getInitialFrame('Player A', 'Player B');
    expect(resolveSnookerShotClockExpiry({ rules, state, localSeat: 'B' })).toBeNull();
  });

  test('viewer HUD maps the authoritative frame without changing seat scores', () => {
    const rules = new SnookerRoyalRules('snooker');
    const state = rules.getInitialFrame('Player A', 'Player B');
    const next = resolveSnookerShotClockExpiry({ rules, state, localSeat: 'A' });
    expect(buildSnookerViewerHud(next, { power: 0.8 }, 'A')).toMatchObject({
      A: 0,
      B: 4,
      turn: 1,
      inHand: false,
      power: 0
    });
    expect(buildSnookerViewerHud(next, {}, 'B')).toMatchObject({ turn: 0 });
  });

  test('mobile pointer cancellation is distinct from an intentional release', () => {
    expect(isPowerPointerCancel({ type: 'pointercancel' })).toBe(true);
    expect(isPowerPointerCancel({ type: 'pointerup' })).toBe(false);
    expect(isPowerPointerCancel(null)).toBe(false);
  });

  test('a cancelled mobile drag resets power without committing a shot', () => {
    const slider = Object.create(PowerSlider.prototype);
    slider.dragging = true;
    slider.value = 78;
    slider._feedbackBand = 3;
    slider._onPointerMove = () => {};
    slider._onPointerUp = () => {};
    slider.el = {
      ownerDocument: {
        removeEventListener: jest.fn()
      },
      releasePointerCapture: jest.fn(),
      removeEventListener: jest.fn(),
      classList: { remove: jest.fn() }
    };
    slider.animateToMin = jest.fn();
    slider.onCommit = jest.fn();
    slider.onFeedback = jest.fn();
    slider._playShotAnimation = jest.fn();

    slider._pointerUp({ type: 'pointercancel', pointerId: 9 });

    expect(slider.onCommit).not.toHaveBeenCalled();
    expect(slider._playShotAnimation).not.toHaveBeenCalled();
    expect(slider.animateToMin).toHaveBeenCalledWith({ duration: 120 });
    expect(slider.onFeedback).toHaveBeenCalledWith({ type: 'cancel', band: 0, value: 78 });
  });

  test('portrait drag release is handled outside the narrow slider track', () => {
    const listeners = new Map();
    const ownerDocument = {
      addEventListener: jest.fn((type, handler) => listeners.set(type, handler)),
      removeEventListener: jest.fn((type) => listeners.delete(type))
    };
    const slider = Object.create(PowerSlider.prototype);
    slider.locked = false;
    slider.value = 0;
    slider.min = 0;
    slider.max = 100;
    slider.step = 1;
    slider.el = {
      ownerDocument,
      classList: { add: jest.fn(), remove: jest.fn() },
      setPointerCapture: jest.fn(() => { throw new Error('capture unavailable'); }),
      releasePointerCapture: jest.fn(),
      getBoundingClientRect: () => ({ top: 100, height: 400 })
    };
    slider._onPointerMove = slider._pointerMove.bind(slider);
    slider._onPointerUp = slider._pointerUp.bind(slider);
    slider._cancelReturnAnimation = jest.fn();
    slider._cancelShotAnimation = jest.fn();
    slider._update = jest.fn();
    slider.set = jest.fn((value) => { slider.value = slider._clamp(slider._step(value)); });
    slider.onCommit = jest.fn();
    slider._playShotAnimation = jest.fn();

    slider._pointerDown({ preventDefault: jest.fn(), pointerId: 4, clientY: 180 });
    listeners.get('pointermove')({ pointerId: 4, clientY: 420 });
    listeners.get('pointerup')({ type: 'pointerup', pointerId: 4 });

    expect(slider.onCommit).toHaveBeenCalledWith(80);
    expect(slider._playShotAnimation).toHaveBeenCalledWith(80);
    expect(slider.dragging).toBe(false);
  });
});
