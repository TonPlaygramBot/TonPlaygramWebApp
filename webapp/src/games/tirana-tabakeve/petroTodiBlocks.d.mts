type Building = { id:string; h:number; p:number[][]; tags?:Record<string,unknown> };
type Block = {
 id:string; label:string; x:number; z:number; h:number; levels:number;
 towards:number[]; finish:number; trim:number;
 edge:{ a:number[]; b:number[]; ux:number; uz:number; nx:number; nz:number; x:number; z:number; length:number; yaw:number }
};
type Part={x:number;z:number;y:number;w:number;h:number;d:number;color:number;yaw:number;buildingId:string;model:'box'};
export function petroTodiBlockFacades(buildings:readonly Building[]):Block[];
export function petroTodiBlockParts(block:Block):Part[];
