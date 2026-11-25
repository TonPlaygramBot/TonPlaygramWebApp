// @vitest-environment jsdom
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {expect,test,vi} from 'vitest';
import {TiranaLoading} from './TiranaLoading';
import {FrameRateControl} from './FrameRateControl';
import {FramePacer} from './renderSettings';
test('the exact historic loading UI offers immediate and slow recovery',()=>{
  vi.useFakeTimers();globalThis.IS_REACT_ACT_ENVIRONMENT=true;
  const node=document.createElement('div'),root=createRoot(node),back=vi.fn();
  try{
    act(()=>root.render(<TiranaLoading onBack={back}/>));
    expect(node.querySelector('[role=status]').textContent).toBe('Loading Tirana Streets…');
    act(()=>vi.advanceTimersByTime(12000));
    expect(node.querySelector('[role=status]').textContent).toMatch(/^Still loading/);
    act(()=>node.querySelector('button').click());expect(back).toHaveBeenCalledOnce();
  }finally{act(()=>root.unmount());vi.useRealTimers();}
});
test('historic frame targets remain exact and a long delay does not cause catch-up render bursts',()=>{
  globalThis.IS_REACT_ACT_ENVIRONMENT=true;
  const node=document.createElement('div'),root=createRoot(node),change=vi.fn();
  try{
    act(()=>root.render(<FrameRateControl value={60} onChange={change}/>));
    const select=node.querySelector('select');expect([...select.options].map(o=>+o.value)).toEqual([50,60,75,90,120]);
    act(()=>{select.value='90';select.dispatchEvent(new Event('change',{bubbles:true}));});
    expect(change).toHaveBeenCalledWith(90);
    const p=new FramePacer();
    expect([0,10,20,5000,5000.1].map(t=>p.shouldRender(t,50))).toEqual([true,false,true,true,false]);
  }finally{act(()=>root.unmount());}
});
