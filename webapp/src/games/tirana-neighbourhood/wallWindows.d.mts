export type WindowProjection={columns:number;first:number;spacing:number;max:number};
export function wallWindowProjection(building:any,rows:readonly {y:number;height:number}[],width:number):WindowProjection|null;
export function windowVertex(projected:WindowProjection|null,horizontal:number,elevation:number):[number,number,number];
