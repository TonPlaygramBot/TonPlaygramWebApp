import React, {act, lazy, Suspense} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {TiranaLoading} from './TiranaLoading';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let root, container;
beforeEach(()=>{vi.useFakeTimers();container=document.createElement('div');document.body.append(container);root=createRoot(container);});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();vi.useRealTimers();});
it('keeps Back usable while a runtime chunk never resolves, then explains a slow load',async()=>{
  const Runtime=lazy(()=>new Promise(()=>{})),back=vi.fn();
  await act(async()=>root.render(<Suspense fallback={<TiranaLoading onBack={back}/>}><Runtime/></Suspense>));
  expect(container.querySelector('[role="status"]').textContent).toContain('Loading Tirana Streets');
  await act(async()=>container.querySelector('button').click());expect(back).toHaveBeenCalledTimes(1);
  await act(async()=>vi.advanceTimersByTime(12000));
  expect(container.querySelector('[role="status"]').textContent).toContain('taking longer than usual');
  await act(async()=>container.querySelector('button').click());expect(back).toHaveBeenCalledTimes(2);
});
it('clears the slow-loading timer when the game becomes ready',async()=>{
  let finish;
  const Runtime=lazy(()=>new Promise(resolve=>{finish=()=>resolve({default:()=> <p>Game ready</p>});}));
  await act(async()=>root.render(<Suspense fallback={<TiranaLoading onBack={()=>{}}/>}><Runtime/></Suspense>));
  expect(vi.getTimerCount()).toBeGreaterThan(0);
  await act(async()=>finish());
  expect(container.textContent).toBe('Game ready');expect(vi.getTimerCount()).toBe(0);
});
