import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach,beforeEach,it,expect,vi} from 'vitest';
import {FlightControls,FlightInstruments} from './FlightControls';

globalThis.IS_REACT_ACT_ENVIRONMENT=true;
let root,host,aircraft,lock,onAssist,onLock,held;
beforeEach(()=>{
 host=document.createElement('div');document.body.append(host);root=createRoot(host);
 aircraft={kind:'jet',x:0,y:50,z:0,heading:0,speed:10,airborne:true,missiles:8};
 lock={enabled:false,targetId:null,progress:0,distance:0,label:''};
 onAssist=vi.fn();onLock=vi.fn();held=vi.fn(()=>({}));
});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();});
const render=()=>act(async()=>root.render(<><FlightControls aircraft={aircraft} lock={lock} held={held} onAssist={onAssist} onLock={onLock}/><FlightInstruments aircraft={aircraft} lock={lock}/></>));
const button=label=>[...host.querySelectorAll('button')].find(b=>b.textContent===label||b.getAttribute('aria-label')===label);

it('portrait flight controls separate climb, descend, fire, lock and landing actions',async()=>{
 await render();expect(held.mock.calls.map(c=>c[0])).toEqual(['ascend','brake','fire']);
 expect(button('Hold to climb').textContent).toBe('UP');expect(button('Hold to descend').textContent).toBe('DOWN');
 await act(async()=>button('HOVER').click());expect(onAssist).toHaveBeenLastCalledWith('hover');
 await act(async()=>button('LAND').click());expect(onAssist).toHaveBeenLastCalledWith('land');
 await act(async()=>button('Toggle target lock').click());expect(onLock).toHaveBeenCalledTimes(1);
 expect(button('Fire missile').disabled).toBe(false);expect(host.textContent).toContain('8 missiles');
});
it('weapon controls stay unavailable on the ground and disappear in civilian helicopters',async()=>{
 aircraft.airborne=false;await render();expect(button('Fire missile').disabled).toBe(true);expect(button('Toggle target lock').disabled).toBe(true);
 expect(host.textContent).toContain('LIFT OFF TO ARM');
 aircraft.kind='helicopter';aircraft.civilian=true;await render();
 expect(button('Fire missile')).toBeUndefined();expect(button('Toggle target lock')).toBeUndefined();expect(button('HOVER')).toBeTruthy();
 expect(host.textContent).toContain('CIVILIAN AIRCRAFT');
});
it('flight instruments expose acquisition progress, ready lock, heading and speed',async()=>{
 lock.enabled=true;await render();expect(host.textContent).toContain('AIM AT A VEHICLE');
 lock.targetId='target';lock.progress=.5;await render();expect(host.textContent).toContain('ACQUIRING 50%');
 lock.progress=1;lock.distance=240;await render();expect(host.textContent).toContain('LOCKED · 240 m');
 expect(button('Toggle target lock').getAttribute('aria-pressed')).toBe('true');
 expect(host.textContent).toContain('N 000°');expect(host.textContent).toContain('36 km/h');
});
