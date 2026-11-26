import type {Group,Object3D} from 'three';
export declare class StreetBasketVisuals {
  readonly group: Group;
  constructor(source: Object3D);
  update(x: number,z: number,battery: boolean): void;
  dispose(): void;
}
