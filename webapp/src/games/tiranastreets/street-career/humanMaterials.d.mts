import type * as T from 'three';
export function isHumanSkinMaterial(material:T.Material):boolean;
export function prepareHumanMaterials(root:T.Object3D, options?:{maxAnisotropy?:number}):(instances?:T.Object3D)=>void;
