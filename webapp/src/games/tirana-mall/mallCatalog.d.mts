export type MallGame = {slug:string;name:string;route:string;image:string;description:string;hall:number;side:number;row:number};
export const MALL_GAMES: readonly MallGame[];
export function mallGameFor(slug:string):MallGame|null;
export function mallHallPosition(index:number,count?:number):{x:number;z:number;width:number;depth:number};
