// @vitest-environment jsdom
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {MemoryRouter, Route, Routes} from 'react-router-dom';
import {afterEach, beforeEach, expect, test, vi} from 'vitest';
import TiranaStreets from './TiranaStreets.jsx';
const control=vi.hoisted(()=>({poison:false,session:null,dispose:vi.fn(),setQuality:vi.fn(),vehicle:vi.fn()}));
vi.mock('../../games/tirana-standalone/CityRoamView.js',()=>({
  CityRoamView: class {
    constructor(_root,send){
      if(control.poison)throw Error('WebGL unavailable');
      this.touch={x:0,y:0,brake:false};control.session=this;
      this.send=send;send({state:'walk',ready:true,paused:false,near:true,assetReady:false});
    }
    pause(value){this.send({paused:value});}
    dispose=control.dispose;
    vehicle=control.vehicle;
    setQuality=control.setQuality;
  }
}));
const page='/games/tiranastreets';
let root,dom;
const show=async path=>act(async()=>{
  root.render(<MemoryRouter initialEntries={[path]}><Routes>
    <Route path="/games" element={<p>Games list</p>}/>
    <Route path={page+'/lobby'} element={<TiranaStreets/>}/>
    <Route path={page} element={<TiranaStreets/>}/>
  </Routes></MemoryRouter>);
  await new Promise(requestAnimationFrame);
});
const click=el=>act(async()=>{
  el.dispatchEvent(new MouseEvent('click',{bubbles:true,button:0,cancelable:true}));
  await new Promise(requestAnimationFrame);
});
const button=(text)=>[...dom.querySelectorAll('button')].find(b=>b.textContent===text);
beforeEach(()=>{
  window.IS_REACT_ACT_ENVIRONMENT=true;
  control.session=null;control.poison=false;vi.clearAllMocks();
  dom=document.createElement('div');document.body.append(dom);root=createRoot(dom);
});
afterEach(async()=>{await act(async()=>root.unmount());dom.remove();delete window.IS_REACT_ACT_ENVIRONMENT;});
test('lobby does not initialize graphics, link launches local portrait HUD, exit disposes independently',async()=>{
  await show(page+'/lobby');expect(dom.textContent).toContain('Nuk kërkon llogari apo pagesë');expect(control.session).toBeNull();
  await click(dom.querySelector('a[href="'+page+'"]'));expect(control.session).not.toBeNull();
  expect(button('Makina po ngarkohet').disabled).toBe(true);
  await act(async()=>control.session.send({assetReady:true}));
  expect(button('Hyr në makinë').disabled).toBe(false);
  await click(button('Hyr në makinë'));expect(control.vehicle).toHaveBeenCalledOnce();
  await act(async()=>control.session.send({state:'drive',speed:7}));
  expect(dom.textContent).toContain('7 km/h');expect(button('Freno')).not.toBeUndefined();
  await click(button('Pauzë'));expect(button('Freno')).toBeUndefined();
  expect(dom.querySelector('select').value).toBe('auto');
  await click(dom.querySelector('a[href="'+page+'/lobby"]'));
  expect(control.dispose).toHaveBeenCalledOnce();expect(dom.textContent).toContain('Eksploro Tiranën');
});
test('WebGL renderer unavailable shows explicit retry and works when mock prerequisite becomes available',async()=>{
  control.poison=true;await show(page);
  expect(dom.querySelector('[role="alert"]').textContent).toContain('WebGL');
  expect(button('Hyr në makinë')).toBeUndefined();
  control.poison=false;await click(button('Rifillo'));
  expect(dom.querySelector('[role="alert"]')).toBeNull();expect(button('Makina po ngarkohet').disabled).toBe(true);
});

test('touch cancellation releases the joystick; map pauses controls and selecting a waypoint resumes',async()=>{
  await show(page);
  const runtime=control.session;
  runtime.setDestination=vi.fn();
  const map={viewBox:'0 0 70 70',district:{x:0,z:0,width:70,height:70},points:[{id:'square',label:'Sheshi Skënderbej',x:2,z:3}]};
  await act(async()=>runtime.send({map,player:{x:0,z:0,yaw:0}}));
  const pad=dom.querySelector('.tsc-pad');
  pad.getBoundingClientRect=()=>({x:0,y:0,left:0,top:0,width:90,height:90});
  pad.setPointerCapture=vi.fn();
  const event=(name,id,x,y)=>{
    const e=new MouseEvent(name,{bubbles:true,clientX:x,clientY:y});Object.defineProperty(e,'pointerId',{value:id});
    pad.dispatchEvent(e);
  };
  await act(async()=>event('pointerdown',13,44,11));
  expect(runtime.touch.y).toBeGreaterThan(.8);
  expect(pad.querySelector('span').style.transform).not.toBe('translate(0px,0px)');
  await act(async()=>window.dispatchEvent(new Event('blur')));
  expect(runtime.touch).toEqual({x:0,y:0,brake:false});
  expect(pad.querySelector('span').style.transform).toBe('translate(0px,0px)');
  await act(async()=>event('pointerdown',13,44,11));
  await act(async()=>event('pointercancel',7,44,11));expect(runtime.touch.y).toBeGreaterThan(.8);
  await act(async()=>event('pointercancel',13,44,11));expect(runtime.touch).toEqual({x:0,y:0,brake:false});
  await act(async()=>event('pointerdown',12,44,11));expect(runtime.touch.y).toBeGreaterThan(.8);
  await click(button('Harta'));expect(runtime.touch.y).toBe(0);expect(dom.querySelector('[role="dialog"]')).not.toBeNull();
  expect(dom.querySelector('.tsc-pad')).toBeNull();
  const close=button('Mbylle'),last=dom.querySelector('[aria-label="Ruaj: Sheshi Skënderbej"]');expect(document.activeElement).toBe(close);
  close.dispatchEvent(new KeyboardEvent('keydown',{key:'Tab',shiftKey:true,bubbles:true,cancelable:true}));expect(document.activeElement).toBe(last);
  last.dispatchEvent(new KeyboardEvent('keydown',{key:'Tab',bubbles:true,cancelable:true}));expect(document.activeElement).toBe(close);
  await click(button('Sheshi Skënderbej'));
  expect(dom.querySelector('[role="dialog"]')).toBeNull();expect(runtime.setDestination).toHaveBeenCalledWith('square');
  expect(document.activeElement).toBe(button('Harta'));
  const resumedPad=dom.querySelector('.tsc-pad');expect(resumedPad).not.toBeNull();
  resumedPad.getBoundingClientRect=pad.getBoundingClientRect;resumedPad.setPointerCapture=vi.fn();
  const again=new MouseEvent('pointerdown',{bubbles:true,clientX:44,clientY:11});Object.defineProperty(again,'pointerId',{value:22});
  await act(async()=>resumedPad.dispatchEvent(again));expect(runtime.touch.y).toBeGreaterThan(.8);
});
