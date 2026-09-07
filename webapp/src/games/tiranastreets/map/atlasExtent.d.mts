export function expandedAtlasBounds(cityBounds: readonly number[], references: readonly {x:number;z:number}[], margin?:number): readonly [number,number,number,number];
export function atlasPin<T extends {x:number;z:number}>(point:T, cityBounds:readonly number[]): T & {available:boolean};
