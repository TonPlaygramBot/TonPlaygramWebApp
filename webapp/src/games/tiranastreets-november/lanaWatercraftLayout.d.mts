export const LANA_SOLO_WATER_LEVEL: number;
export const LANA_CRAFT_LOAD_RADIUS: number;
export const LANA_CRAFT_DRAW_RADIUS: number;
export function lanaCraftAnchors(paths: readonly {id:string;lana?:boolean;line:number[][]}[]): {x:number;z:number;yaw:number;phase:number}[];
