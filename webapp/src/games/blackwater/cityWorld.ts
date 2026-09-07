import * as THREE from 'three';
import {makeCityWorld as makeBaseCityWorld} from './baseCityWorld';
import type {World} from './world';
import {WORLD} from '../tiranastreets/shared/world.mjs';
import {ORIGIN} from './shared/layout.mjs';
import {resolveNativeLandmarks,translateNativeLandmarks} from '../tirana-landmarks/nativeLocations.mjs';
import {NativeLandmarkLayer} from '../tirana-landmarks/NativeLandmarkLayer';

/** Same geographic anchors as the other games; BlackWater's original translation
 * is applied once. Its lighting, weapons, combat and world update are preserved. */
export function makeCityWorld(scene:THREE.Scene,camera:THREE.PerspectiveCamera,renderer:THREE.WebGLRenderer):World {
  const {landmarks,issues}=resolveNativeLandmarks(WORLD);
  const excludedIds=new Set(landmarks.flatMap(l=>l.buildingId?[l.buildingId]:[]));
  const world=makeBaseCityWorld(scene,camera,renderer,excludedIds);
  const local=translateNativeLandmarks(landmarks,ORIGIN);
  const layer=new NativeLandmarkLayer(local);
  scene.add(layer.group);
  scene.userData.tiranaLandmarks={issues,excludedBuildingIds:[...excludedIds]};
  const dispose=world.dispose;
  world.dispose=()=>{layer.dispose();dispose();};
  return world;
}
