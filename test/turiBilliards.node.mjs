import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import * as THREE from '../webapp/node_modules/three/build/three.module.js';
import { GLTFLoader } from '../webapp/node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import { PoolRoyalHumanPlayers } from '../webapp/src/pages/Games/shared/PoolRoyalHumanPlayers.ts';
import { TURI_MODEL_URL } from '../webapp/src/config/playerCharacter.js';
import { loadPoseModel } from './fixtures/poolRoyalPoseTrace.mjs';

async function loadTuri() {
  const loader = new GLTFLoader();
  // Decode the actual mesh/skeleton; image decoding is browser-only.
  loader.register(() => ({ name: 'TestTextures', loadTexture: () => Promise.resolve(null) }));
  const bytes = await readFile(new URL('../webapp/public/assets/tirana-streets/players/turi.glb', import.meta.url));
  return (await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')).scene;
}

const options = { floorY: -3, clothY: 4, tableW: 20, tableL: 32 };
const frame = { activeSeat: 'B', state: 'dragging', cueBall: new THREE.Vector3(0, 4.3, 8),
  aimForward: new THREE.Vector3(0, 0, -1), power: 0.7, nowMs: 1000 };

for (const realisticMovement of [false, true]) test(`actual Turi plays local seat B with ${realisticMovement ? 'Pool' : 'Snooker'} controller`, async () => {
  const model = await loadPoseModel();
  const turi = await loadTuri();
  const originalMaterials = [];
  turi.traverse(mesh => { if (mesh.isMesh) for (const mat of [mesh.material].flat())
    originalMaterials.push([mat, mat.color.clone(), mat.roughness, mat.metalness]); });
  const parent = new THREE.Scene();
  const players = new PoolRoyalHumanPlayers(parent, { ...options, model,
    realisticMovement, exactEyeCamera: true,
    localPlayer: { seat: 'B', modelUrl: TURI_MODEL_URL, model: turi } });
  assert.equal(await players.ready, true);
  const [opponent, local] = players.players;
  assert.equal(local.human.model.userData.playerCharacterId, 'turi');
  assert.equal(opponent.human.model.userData.playerCharacterId, undefined);
  assert.notEqual(local.human.bones.hips, opponent.human.bones.hips);
  assert.ok(Object.values(local.human.bones).every(bone => bone?.isBone));
  assert.equal(local.human.leftFingers.length, 20);
  assert.equal(local.human.rightFingers.length, 20);
  assert.equal(turi.getObjectByName('LeftEye'), undefined, 'source skeleton remains unchanged');
  const heights = players.players.map(player => new THREE.Box3().setFromObject(player.human.modelRoot).getSize(new THREE.Vector3()).y);
  assert.ok(Math.abs(heights[0] - heights[1]) < 1e-5, 'both rigs share the existing solver scale');
  for (const [mat, color, roughness, metalness] of originalMaterials) {
    assert.ok(mat.color.equals(color)); assert.equal(mat.roughness, roughness); assert.equal(mat.metalness, metalness);
  }
  for (let i = 0; i < 120; i++) players.update(1 / 60, { ...frame, nowMs: 1000 + i * 16.667 });
  assert.ok(players.eyeView, 'Turi provides a player-eye camera without eye bones');
  assert.ok(players.eyeView.position.toArray().every(Number.isFinite));
  for (const bone of Object.values(local.human.bones)) {
    assert.ok(bone.quaternion.toArray().every(Number.isFinite));
    assert.ok(bone.getWorldPosition(new THREE.Vector3()).toArray().every(Number.isFinite));
  }
  players.update(1 / 60, { ...frame, state: 'striking' });
  const root = local.human.root.position.clone();
  players.update(1 / 60, { ...frame, state: 'striking', cueBall: new THREE.Vector3(7, 4.3, 4) });
  assert.ok(root.distanceTo(local.human.root.position) < 1e-8, 'shot does not move the player root');
  const camera = new THREE.PerspectiveCamera();
  camera.position.copy(local.human.model.getObjectByName('LeftEye').getWorldPosition(new THREE.Vector3()));
  players.updateCameraVisibility(camera, frame.cueBall, 'B');
  assert.ok(local.firstPerson.meshes.length > 0);
  const combined = local.firstPerson.meshes.find(mesh => mesh.geometry.hasAttribute('poolLocalHeadWeight'));
  assert.ok(combined, 'combined Turi body/head uses a partial mask');
  const weights = combined.geometry.getAttribute('poolLocalHeadWeight').array;
  assert.ok(weights.some(weight => weight < 0.1), 'body vertices remain visible');
  assert.ok(weights.some(weight => weight > 0.8), 'head vertices can be suppressed');
  const material = [combined.material].flat()[0];
  const shader = { uniforms: {}, vertexShader: '#include <begin_vertex>', fragmentShader: '#include <clipping_planes_fragment>' };
  material.onBeforeCompile(shader, null);
  combined.onBeforeRender(null, parent, camera, combined.geometry, material, null);
  assert.equal(shader.uniforms.poolLocalFace.value, 1);
  assert.match(shader.fragmentShader, /poolHeadWeight > 0.35/);
  combined.onBeforeRender(null, parent, new THREE.PerspectiveCamera(), combined.geometry, material, null);
  assert.equal(shader.uniforms.poolLocalFace.value, 0, 'broadcast camera restores the entire face');
  players.dispose();
  assert.equal(parent.children.length, 0);
});
