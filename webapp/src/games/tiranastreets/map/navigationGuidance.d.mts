type Point = {x:number;z:number};
export type Guidance = {instruction:string;direction:string;remaining:number;nextDistance:number;etaSeconds:number|null;offRoute:boolean;arrived:boolean;accessDistance:number};
export function formatRouteDistance(metres:number):string;
export function navigationGuidance(route:Point[],player:(Point&{speed?:number})|undefined,destination:Point|null|undefined,mode?:'walk'|'drive'):Guidance|null;
export function nearbyServices<T extends Point & {id?:string;available?:boolean}>(places:T[],player:Point|undefined,limit?:number):(T&{distance:number})[];
