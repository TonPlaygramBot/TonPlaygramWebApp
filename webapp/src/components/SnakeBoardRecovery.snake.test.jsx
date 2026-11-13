import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import SnakeBoard3D from './SnakeBoard3D';
const state = vi.hoisted(() => ({ attempts: 0 }));
vi.mock('three', async (original) => ({
  ...await original(),
  WebGLRenderer: class { constructor() { state.attempts++; throw new Error('No WebGL context'); } }
}));
it('keeps a failed WebGL launch recoverable without reloading the match', async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const host=document.createElement('div');document.body.append(host);
  const root=createRoot(host);
  try {
    await act(async()=>root.render(<SnakeBoard3D players={[]} />));
    expect(host.querySelector('[role="alert"]').textContent).toContain('could not start');
    expect(state.attempts).toBe(1);
    await act(async()=>host.querySelector('button').click());
    expect(state.attempts).toBe(2);
    expect(host.querySelector('button').textContent).toBe('Restore 3D view');
  } finally { await act(async()=>root.unmount());host.remove();delete globalThis.IS_REACT_ACT_ENVIRONMENT; }
});
