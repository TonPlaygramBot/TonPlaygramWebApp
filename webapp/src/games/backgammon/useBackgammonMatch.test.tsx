import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { act } from 'react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { useBackgammonMatch } from './useBackgammonMatch.ts';
import { legalFirstMoves } from './match.mjs';
vi.mock('./match.mjs', async (load) => {
  const actual = await load<any>();
  let die = 0;
  return { ...actual, rollDie: () => (++die % 2 ? 6 : 1) };
});
let root: Root,
  holder: HTMLDivElement,
  controller: ReturnType<typeof useBackgammonMatch>,
  pending: ((value: boolean) => void)[],
  sound: ReturnType<typeof vi.fn>,
  scene: any;
function Harness() {
  controller = useBackgammonMatch(scene, sound);
  return (
    <span>
      {controller.match.phase}:{controller.busy ? 'busy' : 'ready'}
    </span>
  );
}
beforeEach(async () => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  holder = document.createElement('div');
  document.body.append(holder);
  root = createRoot(holder);
  pending = [];
  sound = vi.fn();
  const animate = () =>
    new Promise<boolean>((resolve) => pending.push(resolve));
  scene = {
    current: {
      animateDiceThrow: vi.fn(animate),
      animateCheckerMove: vi.fn(animate),
      cancelActions: () =>
        pending.splice(0).forEach((resolve) => resolve(false))
    }
  };
  await act(async () => {
    root.render(<Harness />);
  });
});
afterEach(async () => {
  await act(async () => root.unmount());
  holder.remove();
});
const settle = async () => {
  await act(async () => {
    pending.shift()?.(true);
    await Promise.resolve();
  });
};
test('rapid rolls create only one opening sequence and wait for both human throws', async () => {
  await act(async () => {
    controller.roll();
    controller.roll();
  });
  expect(scene.current.animateDiceThrow).toHaveBeenCalledTimes(1);
  expect(controller.match.phase).toBe('opening');
  await settle();
  expect(scene.current.animateDiceThrow).toHaveBeenCalledTimes(2);
  expect(controller.match.phase).toBe('opening');
  await settle();
  expect(controller.match.phase).toBe('move');
  expect(controller.match.turn).toBe('white');
  expect(controller.match.dice).toEqual([6, 1]);
});
test('one chosen move commits only after placement, leaving the second move for the player', async () => {
  await act(async () => {
    controller.roll();
  });
  await settle();
  await settle();
  const board = controller.match.board;
  const move = legalFirstMoves(controller.match)[0];
  await act(async () => {
    controller.move(move);
    controller.move(move);
  });
  expect(scene.current.animateCheckerMove).toHaveBeenCalledTimes(1);
  expect(controller.match.board).toBe(board);
  await settle();
  expect(controller.match.board).not.toBe(board);
  expect(controller.match.turn).toBe('white');
  expect(controller.match.dice).toHaveLength(1);
  expect(controller.busy).toBe(false);
});
test('restart during pickup cancels the old turn without granting its dice', async () => {
  await act(async () => {
    controller.roll();
  });
  await act(async () => controller.restart(3));
  expect(controller.match.phase).toBe('opening');
  expect(controller.match.target).toBe(3);
  expect(controller.match.dice).toEqual([]);
  expect(controller.busy).toBe(false);
  expect(scene.current.animateDiceThrow).toHaveBeenCalledTimes(1);
});

test('a new action waits for the committed board meshes before unlocking input', async () => {
  scene.current.waitForBoard = vi.fn(
    () => new Promise<boolean>((resolve) => pending.push(resolve))
  );
  await act(async () => {
    controller.roll();
  });
  await settle();
  await settle();
  await act(async () => {
    controller.move(legalFirstMoves(controller.match)[0]);
  });
  await settle();
  expect(controller.match.dice).toHaveLength(1);
  expect(controller.busy).toBe(true);
  expect(scene.current.waitForBoard).toHaveBeenCalledWith(
    controller.match.board
  );
  await settle();
  expect(controller.busy).toBe(false);
});

test('Black player throws from the local seat; White AI uses the opening dice without rerolling', async () => {
  function BlackHarness() {
    controller = useBackgammonMatch(scene, sound, 'black');
    return null;
  }
  await act(async () => {
    root.render(<BlackHarness />);
  });
  await act(async () => {
    controller.roll();
  });
  expect(scene.current.animateDiceThrow).toHaveBeenLastCalledWith([1], 0, [1]);
  await settle();
  expect(scene.current.animateDiceThrow).toHaveBeenLastCalledWith([6], 1, [0]);
  await settle();
  expect(controller.match.turn).toBe('white');
  expect(scene.current.animateCheckerMove).toHaveBeenCalledTimes(1);
  await settle();
  await settle();
  expect(controller.match.turn).toBe('black');
  expect(controller.match.phase).toBe('roll');
  expect(scene.current.animateDiceThrow).toHaveBeenCalledTimes(2);
});
