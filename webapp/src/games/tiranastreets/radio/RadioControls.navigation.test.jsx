import React, {act} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {RadioControls} from './RadioControls';
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let host,root;
beforeEach(()=>{host=document.createElement('div');document.body.append(host);root=createRoot(host);});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();});
it('station controls dispatch in the click gesture, expose five choices and retain the panel through HUD refreshes',async()=>{
  const onAction=vi.fn(),onVolume=vi.fn(),radio={station:'top-albania',enabled:false,volume:.45,status:'off'};
  const render=async()=>act(async()=>root.render(<RadioControls radio={{...radio}} onAction={onAction} onVolume={onVolume}/>));
  await render();
  host.querySelector('[aria-label="Play radio"]').click();expect(onAction).toHaveBeenLastCalledWith('toggle');
  host.querySelector('[aria-label="Next radio station"]').click();expect(onAction).toHaveBeenLastCalledWith('next');
  host.querySelector('[aria-label="Previous radio station"]').click();expect(onAction).toHaveBeenLastCalledWith('previous');
  await act(async()=>host.querySelector('[aria-label="Choose radio station"]').click());
  expect(host.querySelectorAll('option')).toHaveLength(5);
  radio.station='club-fm';radio.status='playing';radio.enabled=true;await render();
  expect(host.querySelector('select').value).toBe('club-fm');
  expect(host.querySelector('[role="status"]').textContent).toBe('LIVE');
  expect(host.querySelector('[aria-label="Choose radio station"]').getAttribute('aria-expanded')).toBe('true');
  expect(host.querySelector('a').href).toBe('https://clubfm.al/radiochannel/live-clubfm/');
  await act(async()=>{const select=host.querySelector('select');select.value='top-gold';select.dispatchEvent(new Event('change',{bubbles:true}));});
  expect(onAction).toHaveBeenLastCalledWith('top-gold');
  await act(async()=>host.querySelector('.ts-radio-panel button').click());
  expect(host.querySelector('select')).toBeNull();
});
it('blocked and offline stations have a retry action and never falsely display LIVE',async()=>{
  const onAction=vi.fn();
  for(const status of ['blocked','unavailable']){
    await act(async()=>root.render(<RadioControls radio={{station:'top-gold',enabled:true,volume:.5,status}} onAction={onAction} onVolume={()=>{}}/>));
    expect(host.querySelector('[role="status"]').textContent).not.toBe('LIVE');
    host.querySelector('[aria-label="Play radio"]').click();expect(onAction).toHaveBeenLastCalledWith('toggle');
  }
});
