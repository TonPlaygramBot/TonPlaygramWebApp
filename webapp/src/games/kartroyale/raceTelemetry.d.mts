import type {Racer} from './simulation.mjs';
export interface LapTiming {time:number;sectors:number[];valid:boolean;clean:boolean;}
export interface RaceTelemetry {valid:boolean;clean:boolean;sectors:number[];lastLap:LapTiming|null;bestLap:number;completed:number;topSpeed:number;distance:number;driftDistance:number;draftSeconds:number;cleanSeconds:number;drivingSeconds:number;}
export interface Powertrain {gear:number;rpm:number;shift:number;shiftId:number;}
export interface RivalInterval {id:string;name:string;position:number;meters:number;ahead:boolean;player:boolean;finished:boolean;}
export function createRaceTelemetry():RaceTelemetry;
export function recordTimingGate(r:Racer,gate:number,time:number):void;
export function stepRaceTelemetry(r:Racer,dt:number):void;
export function stepPowertrain(r:Racer,dt:number):Powertrain;
export function rivalIntervals(racers:Racer[],playerId:string,trackLength:number):RivalInterval[];
