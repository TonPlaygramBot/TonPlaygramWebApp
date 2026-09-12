import type {Input} from './simulation.mjs';
export function createHeldRaceInput(): {
  hold(id:string,key:string,value:number|boolean):void;
  release(id:string):void;
  clear():void;
  read():Input;
};
