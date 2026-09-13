import { expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { createSnakeDiceVisibility } from './snakeDiceVisibility';

it('reveals only blocking clothing and restores shared authored materials on disposal', () => {
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(); scene.add(camera); camera.position.z = 5;
  const die = new THREE.Object3D(); scene.add(die);
  const material = new THREE.MeshStandardMaterial();
  const blocker = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material); blocker.name = 'Wolf3D_Outfit_Top'; blocker.position.z = 2; scene.add(blocker);
  const other = blocker.clone(); other.position.x = 4; scene.add(other);
  const visibility = createSnakeDiceVisibility(camera, [die], [blocker, other]); visibility.update(0);
  expect(blocker.material).not.toBe(material); expect((blocker.material as THREE.Material).opacity).toBe(0.08);
  expect(other.material).toBe(material); expect(material.opacity).toBe(1);
  const dispose = vi.spyOn(blocker.material as THREE.Material, 'dispose');
  visibility.dispose(); visibility.dispose(); expect(dispose).toHaveBeenCalledOnce(); expect(blocker.material).toBe(material);
});
it('restores a blocker when the sightline clears and never fades the hand/skin', () => {
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(); scene.add(camera); camera.position.z = 5;
  const die = new THREE.Object3D(); scene.add(die);
  const blocker = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial()); blocker.name = 'shirt'; blocker.position.z = 2; scene.add(blocker);
  const skin = blocker.clone(); skin.material = new THREE.MeshStandardMaterial(); skin.name = 'Wolf3D_Body'; skin.position.z = 1; scene.add(skin);
  const original = blocker.material;
  const visibility = createSnakeDiceVisibility(camera, [die], [blocker, skin]); visibility.update(0);
  expect(skin.material.opacity).toBe(1); blocker.position.x = 4; visibility.update(100);
  expect(blocker.material).toBe(original); visibility.dispose();
});
