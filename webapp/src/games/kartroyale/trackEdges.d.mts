export interface EdgeFrame {x:number;z:number;length:number;yaw:number;tx:number;tz:number;nx:number;nz:number;side(sign:number,offset?:number):{x:number;z:number}}
export function segmentFrame(a:{x:number;z:number},b:{x:number;z:number},halfWidth:number):EdgeFrame;
export function circuitSides(points:Array<{x:number;z:number}>,halfWidth:number):{left:Array<{x:number;z:number}>;right:Array<{x:number;z:number}>};
