import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {MovementStick} from './MovementStick';
import {StreetInput} from './street-career/StreetInput';
import {loadSettings} from './street-career/settings';
import {renderPixelRatio} from './renderSettings';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
let host,root,input,look,props;
beforeEach(()=>{
  host=document.createElement('div');document.body.append(host);root=createRoot(host);look=vi.fn();input=new StreetInput(vi.fn(),look);
  props={className:'stick',label:'Movement joystick',disabled:false,deadzone:.08,
    claim:(id,x,y)=>input.pointerDown(id,'move',x,y),release:id=>input.pointerUp(id),move:(x,y)=>{input.touch.x=x;input.touch.y=y;}};
});
afterEach(async()=>{await act(async()=>root.unmount());input.destroy();host.remove();vi.restoreAllMocks();});
const render=async()=>{await act(async()=>root.render(<MovementStick {...props}><button>SPRINT</button></MovementStick>));const stick=host.querySelector('.stick');stick.getBoundingClientRect=()=>({x:0,y:0,left:0,top:0,width:112,height:112});stick.setPointerCapture=vi.fn();return stick;};
const pointer=async(target,type,id,x=56,y=56)=>{const e=new MouseEvent(type,{bubbles:true,cancelable:true,clientX:x,clientY:y});Object.defineProperty(e,'pointerId',{value:id});await act(async()=>target.dispatchEvent(e));};
it('moves forward on an upward screen drag and preserves simultaneous look/fire owners',async()=>{
 const stick=await render();await pointer(stick,'pointerdown',1,56,12);
 expect(input.touch.y).toBe(1);expect(input.touch.x).toBe(0);expect(stick.querySelector('span').style.transform).toContain('-34.944px');
 input.pointerDown(2,'look',100,100);input.pointerDown(3,'fire',200,200);
 input.pointerMove(2,112,90);expect(look).toHaveBeenCalledWith(12,-10);expect(input.readStreet(0,0,false).fire).toBe(true);
 await pointer(stick,'pointerup',1);expect(input.touch.y).toBe(0);expect(input.touch.fire).toBe(true);
 input.pointerUp(3);expect(input.touch.fire).toBe(false);
});
it('second finger and sprint button cannot steal or start joystick movement',async()=>{
 const stick=await render();await pointer(stick.querySelector('button'),'pointerdown',9,90,10);expect(input.touch.x).toBe(0);
 await pointer(stick,'pointerdown',1,100,56);await pointer(stick,'pointerdown',2,12,56);
 await pointer(stick,'pointermove',2,12,56);expect(input.touch.x).toBe(1);
 await pointer(stick,'pointerup',2);expect(input.touch.x).toBe(1);
});
it('cancel, capture loss, pause, blur and unmount release movement',async()=>{
 const stick=await render();
 for(const type of ['pointercancel','lostpointercapture']){await pointer(stick,'pointerdown',1,56,12);await pointer(stick,type,1);expect(input.touch.y).toBe(0);}
 await pointer(stick,'pointerdown',1,56,12);await act(async()=>window.dispatchEvent(new Event('blur')));expect(input.touch.y).toBe(0);
 await pointer(stick,'pointerdown',1,56,12);props.disabled=true;await render();expect(input.touch.y).toBe(0);
 await pointer(stick,'pointerdown',1,56,12);expect(input.touch.y).toBe(0);
});
it('settings migrate older saves and clamp malformed values',()=>{
 const load=value=>loadSettings({getItem:()=>JSON.stringify(value)});
 expect(load({sensitivity:1.4}).aimSensitivity).toBe(.65);
 expect(load({aimSensitivity:50,joystickDeadzone:-1,buttonSize:200})).toMatchObject({aimSensitivity:1.2,joystickDeadzone:0,buttonSize:64});
 expect(load({leftHanded:true,showPerformance:true})).toMatchObject({leftHanded:true,showPerformance:true});
 expect(load({leftHanded:'true',showPerformance:1})).toMatchObject({leftHanded:false,showPerformance:false});
 expect(load(null).quality).toBe('auto');
});
it('framebuffer budget preserves phone detail and caps large high-DPI screens',()=>{
 expect(renderPixelRatio(390,844,3,1.8)).toBe(1.8);
 for(const [w,h] of [[1440,2560],[3840,2160],[7680,4320]]){
   const ratio=renderPixelRatio(w,h,3,1.8);expect(w*h*ratio*ratio).toBeLessThanOrEqual(2000000.01);
 }
 expect(Number.isFinite(renderPixelRatio(NaN,0,Infinity,-1))).toBe(true);
});
