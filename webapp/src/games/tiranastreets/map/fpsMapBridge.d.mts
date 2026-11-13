type Point={x:number;z:number};
export function worldPlayer(p:Point,yaw:number,origin:Point):Point&{heading:number};
export function sceneRoute(points:Point[],origin:Point,height?:number):number[];
export function openMapSession(engine:{phase:string;online:unknown;pause():void;resume():void}):{close():void};
