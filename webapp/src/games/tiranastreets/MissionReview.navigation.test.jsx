import React, {act} from 'react';
import {afterEach,beforeEach,expect,it} from 'vitest';
import {createRoot} from 'react-dom/client';
import {MissionDirectorReview} from './review/missionDirector';
let root,host;
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
beforeEach(async()=>{host=document.createElement('div');document.body.append(host);root=createRoot(host);await act(async()=>root.render(<MissionDirectorReview/>));});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();});
const change=async(index,value)=>act(async()=>{const select=host.querySelectorAll('select')[index];select.value=value;select.dispatchEvent(new Event('change',{bubbles:true}));});
const tick=async(n=1)=>{for(let i=0;i<n;i++)await act(async()=>host.querySelector('button').click());};
it('runs the actual intel and extraction director from the shared live HUD',async()=>{
  await change(1,'guard');await tick(4);expect(host.textContent).toContain('Intel pending');expect(host.querySelector('progress').value).toBe(0);
  await change(1,'clear');await tick(4);expect(host.textContent).toContain('Intel secured');
  await change(1,'damage');await tick(2);expect(host.querySelector('progress').value).toBe(0);
  await change(1,'clear');await tick(6);expect(host.textContent).toContain('Objective complete');expect(host.querySelector('button').disabled).toBe(true);
});
it('pursuit cannot complete during continuous fire; courier impacts change actual integrity',async()=>{
  await change(0,'pursuit');await change(1,'damage');await tick(5);expect(host.querySelector('progress').value).toBe(0);
  await change(1,'clear');await tick(3);expect(host.textContent).toContain('Hideout secured');
  await change(0,'cargo');await change(1,'damage');await tick();expect(host.textContent).toContain('Cargo 84%');
});
