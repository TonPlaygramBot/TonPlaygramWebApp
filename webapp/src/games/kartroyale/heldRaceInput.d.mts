import type {Input} from './simulation.mjs';
export function steeringStickInput(value:number):number;
export function createHeldRaceInput(): {
  hold(id:string,key:string,value:number|boolean):void;
  release(id:string):void;
  clear():void;
  read():Input;
};
