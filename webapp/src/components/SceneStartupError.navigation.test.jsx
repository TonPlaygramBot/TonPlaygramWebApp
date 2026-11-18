import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, test, vi } from 'vitest';
import SceneStartupError from './SceneStartupError.jsx';
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
test('failed 3D scene exposes explanation and safe recovery controls',async()=>{
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 const reload=vi.fn(),lobby=vi.fn();
 try {
  await act(async()=>root.render(<SceneStartupError onReload={reload} onLobby={lobby}/>));
  expect(host.querySelector('[role="alert"]').textContent).toContain('The 3D board could not start.');
  expect(host.textContent).toContain('WebGL');
  const buttons=[...host.querySelectorAll('button')];
  expect(buttons.map(b=>b.textContent)).toEqual(['Reload game','Lobby']);
  await act(async()=>buttons[0].click());expect(reload).toHaveBeenCalledTimes(1);expect(lobby).not.toHaveBeenCalled();
  await act(async()=>buttons[1].click());expect(lobby).toHaveBeenCalledTimes(1);
 } finally {await act(async()=>root.unmount());host.remove();}
});
