export function createCaptureGuard():{
 begin():number|null;current(ticket:number):boolean;cancel():void;finish():void;
 adopt(ticket:number,stream:Pick<MediaStream,'getTracks'>):boolean;readonly busy:boolean;
};
