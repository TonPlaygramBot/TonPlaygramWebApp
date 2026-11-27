type Point = {x:number;z:number};
type Path = ReadonlyArray<ReadonlyArray<number>>;
export function keepSquareTree(tree:{id:string;zone:string}):boolean;
export function publicRealmSeatingZone(x:number,z:number,lanaLine:Path):'square'|'lana'|null;
export function squareSeatingZone(x:number,z:number):boolean;
export function curateMappedBenches<T extends Point>(points:readonly T[],lanaLine:Path):T[];
