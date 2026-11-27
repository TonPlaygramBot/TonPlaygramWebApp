export const BANK_WIDTH:number;
export function offsetRiver(line:number[][],offset:number):number[][];
export function riverRing(path:{line:number[][];width:number},margin?:number):number[][];

type RiverPath = { id: string; line: number[][]; width: number; lana?: boolean };
export const CHANNEL_LINER_RUN: number;
export function channelWaterMargin(level: number, bed: number, shoulder: number): number;
export function riverFlowOrigins(paths: readonly RiverPath[]): Map<string, number>;
