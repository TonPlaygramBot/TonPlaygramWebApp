export function buildingClearance(x:number,z:number):number;
export function waterClearance(x:number,z:number):number;
export function courseClearance(track:{terrainMode?:string},x:number,z:number):number;
export function courseRoadSurface(raw:number[][],roadWidths:number[]):{polygons:number[][][][];contains(x:number,z:number):boolean;clearance(x:number,z:number):number};
export function roundRaceCourse(raw:number[][],roadWidths:number[]):{points:number[][];widths:number[];turns:{x:number;z:number;trim:number;angle:number}[]};
