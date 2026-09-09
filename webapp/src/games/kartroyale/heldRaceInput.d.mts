export function createHeldRaceInput():{
 hold(id:string,key:'steer'|'brake'|'boost',value:number|boolean):void;
 release(id:string):void;clear():void;
 read():{steer:number;brake:boolean;boost:boolean;drift:boolean};
};
