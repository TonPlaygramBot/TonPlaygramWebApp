import React,{act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {ActionControls,CombatControls,createHeldActionInput,type ActionKey} from './ActionControls';
import {createHeldRaceInput} from './heldRaceInput.mjs';
Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
let host:HTMLDivElement,root:Root;
beforeEach(()=>{host=document.createElement('div');document.body.append(host);root=createRoot(host);HTMLElement.prototype.setPointerCapture=vi.fn();});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();});
function pointer(type:string,pointerId:number,x=0,y=0){const event=new Event(type,{bubbles:true,cancelable:true});Object.assign(event,{pointerId,pointerType:'touch',clientX:x,clientY:y,button:0});return event;}
const button=(label:string)=>Array.from(host.querySelectorAll('button')).find(b=>b.textContent===label)!;
it('maps visual up to forward and visual right to right while fire has an independent owner',async()=>{
 const input=createHeldActionInput(),hold=(id:string,key:string,value:number|boolean)=>input.hold(id,key as ActionKey,value);
 await act(async()=>root.render(React.createElement(ActionControls,{onFoot:true,hold,release:input.release})));
 const stick=host.querySelector('.rr-action-move') as HTMLDivElement;
 stick.getBoundingClientRect=()=>({x:0,y:0,left:0,top:0,width:112,height:112,right:112,bottom:112,toJSON(){}});
 await act(async()=>{stick.dispatchEvent(pointer('pointerdown',1,94,18));button('FIRE').dispatchEvent(pointer('pointerdown',2));});
 expect(input.read().moveX).toBeGreaterThan(.5);expect(input.read().moveZ).toBeGreaterThan(.5);expect(input.read().fire).toBe(true);
 await act(async()=>button('FIRE').dispatchEvent(pointer('pointerup',2)));
 expect(input.read().moveZ).toBeGreaterThan(.5);expect(input.read().fire).toBe(false);
 await act(async()=>stick.dispatchEvent(pointer('pointercancel',1)));
 expect(input.read().moveX).toBe(0);expect(input.read().moveZ).toBe(0);
});
it('turns visually right from the aim stick and clears all held actions on blur or disabling controls',async()=>{
 const input=createHeldActionInput(),hold=(id:string,key:string,value:number|boolean)=>input.hold(id,key as ActionKey,value),props={onFoot:true,hold,release:input.release};
 await act(async()=>root.render(React.createElement(ActionControls,props)));
 const aim=host.querySelector('.rr-action-aim') as HTMLDivElement;
 aim.getBoundingClientRect=()=>({x:0,y:0,left:0,top:0,width:116,height:65,right:116,bottom:65,toJSON(){}});
 await act(async()=>{aim.dispatchEvent(pointer('pointerdown',3,82,32));button('RUN').dispatchEvent(pointer('pointerdown',4));});
 expect(input.read().turn).toBeGreaterThan(.5);expect(input.read().sprint).toBe(true);
 await act(async()=>window.dispatchEvent(new Event('blur')));
 expect(input.read().turn).toBe(0);expect(input.read().sprint).toBe(false);
 await act(async()=>button('JUMP').dispatchEvent(pointer('pointerdown',5)));
 expect(input.read().jump).toBe(true);
 await act(async()=>root.render(React.createElement(ActionControls,{...props,disabled:true})));
 expect(input.read().jump).toBe(false);expect(button('JUMP').disabled).toBe(true);
});
it('keeps combat fire and shield separate from gas and each other',async()=>{
 const input=createHeldRaceInput();input.hold('pedal','throttle',true);
 await act(async()=>root.render(React.createElement(CombatControls,{hold:input.hold,release:input.release,shield:100})));
 await act(async()=>{button('FIRE').dispatchEvent(pointer('pointerdown',1));button('SHIELD 100%').dispatchEvent(pointer('pointerdown',2));});
 expect(input.read()).toMatchObject({throttle:true,fire:true,shield:true});
 await act(async()=>button('SHIELD 100%').dispatchEvent(pointer('lostpointercapture',2)));
 expect(input.read()).toMatchObject({throttle:true,fire:true,shield:false});
 await act(async()=>button('FIRE').dispatchEvent(pointer('pointercancel',1)));
 expect(input.read()).toMatchObject({throttle:true,fire:false,shield:false});
});
it('releases keyboard-activated buttons when the controls unmount',async()=>{
 const input=createHeldActionInput(),hold=(id:string,key:string,value:number|boolean)=>input.hold(id,key as ActionKey,value);
 await act(async()=>root.render(React.createElement(ActionControls,{onFoot:true,hold,release:input.release})));
 await act(async()=>button('FIRE').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true})));
 expect(input.read().fire).toBe(true);
 await act(async()=>root.render(null));
 expect(input.read().fire).toBe(false);
});
