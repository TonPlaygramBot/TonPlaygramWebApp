import React, { act, createRef } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, afterEach, expect, test, vi } from 'vitest';
import SpinWheel from './SpinWheel.tsx';
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let root, host, ref, finish;
beforeEach(() => {
  vi.useFakeTimers(); ref = createRef(); finish = vi.fn();
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  act(() => root.render(<SpinWheel ref={ref} onFinish={finish} spinning={false} setSpinning={() => {}} disableSound showButton={false} />));
});
afterEach(() => { act(() => root.unmount()); host.remove(); vi.useRealTimers(); });
test('animates to the explicit server result once even with repeated spin calls', () => {
  act(() => { ref.current.spin(1200); ref.current.spin(400); });
  act(() => vi.advanceTimersByTime(5000));
  expect(finish).toHaveBeenCalledExactlyOnceWith(1200);
});
test('does not silently replace an invalid supplied result with a random prize', () => {
  act(() => ref.current.spin('NOT_A_PRIZE'));
  act(() => vi.advanceTimersByTime(5000));
  expect(finish).not.toHaveBeenCalled();
});
