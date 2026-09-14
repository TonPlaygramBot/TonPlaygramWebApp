export function segmentHasClearance(a:{x:number;z:number},b:{x:number;z:number},radius:number,clearance:(x:number,z:number)=>number,spacing?:number):boolean;
export interface PassingAudit {requiredWidth:number;minimumWidth:number;widenedSamples:number;unresolved:{index:number;x:number;z:number;width:number}[]}
export function widenPassingSections(track:any,options:{clearance:(x:number,z:number)=>number;sides:(points:any[])=>{left:{x:number;z:number}[];right:{x:number;z:number}[]};minimum?:number}):PassingAudit;
