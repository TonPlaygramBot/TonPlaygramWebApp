// @vitest-environment jsdom
import {expect,test} from 'vitest';
import {CityInput} from '../input';
import {StreetInput} from './StreetInput';

function dispatch(target: EventTarget,type: string,key: string,code: string) {
  const event=new KeyboardEvent(type,{key,code,bubbles:true,cancelable:true});
  target.dispatchEvent(event);
  return event.defaultPrevented;
}
test('Space on a focused city HUD button remains a native activation, not a jump or brake',()=>{
  const actions: string[]=[];
  const input=new StreetInput(action=>actions.push(action),()=>{});
  const button=document.createElement('button');
  button.innerHTML='<span>Camera</span>';
  document.body.append(button);
  button.focus();
  try{
    expect(dispatch(button,'keydown',' ','Space')).toBe(false);
    expect(dispatch(button,'keyup',' ','Space')).toBe(false);
    expect(actions).toEqual([]);
    expect(input.readStreet(0,0,true).brake).toBe(false);
  }finally{button.remove();input.destroy();}
});
test('Space still jumps on the playfield and remains the vehicle brake',()=>{
  const actions: string[]=[];
  const input=new StreetInput(action=>actions.push(action),()=>{});
  try{
    expect(dispatch(document.body,'keydown',' ','Space')).toBe(true);
    expect(actions).toEqual(['jump']);
    expect(input.readStreet(0,0,true).brake).toBe(true);
    dispatch(document.body,'keyup',' ','Space');
    expect(input.readStreet(0,0,true).brake).toBe(false);
  }finally{input.destroy();}
});
test('base CityInput behavior for other host modes is unchanged',()=>{
  const input=new CityInput(()=>{});
  const button=document.body.appendChild(document.createElement('button'));
  try{
    expect(dispatch(button,'keydown',' ','Space')).toBe(true);
    expect(input.read(0,true).brake).toBe(true);
  }finally{button.remove();input.destroy();}
});
