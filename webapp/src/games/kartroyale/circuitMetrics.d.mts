export interface CircuitPoint { x: number; z: number; }
export interface MetricCircuit { points: CircuitPoint[]; }
export interface CircuitProjection extends CircuitPoint { index: number; }
export interface CircuitSample extends CircuitProjection { yaw: number; distance: number; }
export function circuitDistance(track: MetricCircuit, near: CircuitProjection): number;
export function sampleCircuitDistance(track: MetricCircuit, metres: number): CircuitSample;
export function pointAhead(track: MetricCircuit, near: CircuitProjection, metres: number): CircuitSample;
export function cornerSpeedLimit(track: MetricCircuit, near: CircuitProjection, horizon?: number): number;
