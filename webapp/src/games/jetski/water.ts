import * as T from 'three';
import { Water } from 'three/examples/jsm/objects/Water.js';
import type { Quality } from './renderer';
import type { Track } from './simulation.mjs';

// Keep the rendered displacement aligned with the simulation's waterHeight.
export const waveShader = /* glsl */ `
  float raceWaveHeight(vec2 xz, float time, float amplitude) {
    return amplitude * (sin(xz.x * .075 + time * 1.9) * .6
      + sin(xz.y * .12 - time * 1.45) * .3
      + sin((xz.x + xz.y) * .19 + time * 2.6) * .1);
  }
`;

const WATER_COLORS: Record<string, number> = {
  ksamil: 0x158f8e,
  dhermi: 0x0b587b,
  harbor: 0x226d76,
  lana: 0x386e64,
  karaburun: 0x084f73,
  koman: 0x256b59
};

export function createRaceWater(
  track: Track,
  normals: T.Texture,
  quality: Quality,
  day: 'day' | 'sunset',
  geometry: T.BufferGeometry = new T.PlaneGeometry(2000, 2000, 192, 192)
) {
  const river = track.id === 'lana';
  const size = quality === 'high' ? 768 : quality === 'battery' ? 384 : 512;
  normals.wrapS = normals.wrapT = T.RepeatWrapping;
  const water = new Water(geometry, {
    textureWidth: size,
    textureHeight: size,
    waterNormals: normals,
    sunDirection: new T.Vector3(
      0.35,
      day === 'day' ? 0.48 : 0.12,
      -0.7
    ).normalize(),
    sunColor: day === 'day' ? 0xfff6e5 : 0xffba82,
    waterColor: WATER_COLORS[track.id] ?? 0x087b83,
    distortionScale: river ? 1.8 : 2.5,
    fog: true
  });
  water.rotation.x = -Math.PI / 2;
  water.receiveShadow = true;
  water.material.uniforms.size.value = 5;
  water.material.uniforms.waveAmplitude = { value: track.wave };
  water.material.vertexShader = water.material.vertexShader
    .replace(
      'uniform float time;',
      `uniform float time;
      uniform float waveAmplitude;
      ${waveShader}`
    )
    .replace(
      'void main() {',
      `void main() {
      vec3 displaced = position;
      displaced.z += raceWaveHeight(vec2(position.x, -position.y), time, waveAmplitude);`
    )
    .replaceAll('vec4( position, 1.0 )', 'vec4( displaced, 1.0 )');

  if (quality === 'battery') {
    const reflect = water.onBeforeRender.bind(water);
    let reflectionFrame = 0;
    water.onBeforeRender = (...args) => {
      if (reflectionFrame++ % 3 === 0) reflect(...args);
    };
  }
  return water;
}
