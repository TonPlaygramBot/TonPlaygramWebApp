import type {Group, Object3D} from 'three';
export declare const ALI_DEMI_FURNITURE: readonly {name: 'park_bench' | 'litter_bin'; x: number; z: number; yaw: number}[];
export declare function buildAliDemiFurniture(source: Object3D): Group;
export declare function aliDemiFurnitureVisible(x: number, z: number, battery: boolean): boolean;
