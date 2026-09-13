// @vitest-environment node
import { beforeAll, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { ludoTableFrame, ludoRightDicePosition, prepareLudoParkedWeapon, parkLudoWeapon } from './ludoTabletopLayout';
import { snakeParkingBounds } from './snakeWeaponParking';
import { readSnakeWeaponContacts } from './snakeWeaponGrip';
const models = new Map<string, THREE.Object3D>();
const boardScale = 3.22 * .72 * .374;
const radius = 4.2 * .75 * .72 * .374 * .92 * .9;
beforeAll(async () => {
  const loader = new GLTFLoader();
  loader.register(() => ({ name: 'NoTextures', loadTexture: () => Promise.resolve(null) }));
  for (const id of ['polyAssaultRifle01Attack', 'polyPistol01Attack', 'polyShotgun01Attack']) {
    const bytes = await readFile(`public/assets/tirana-streets/imported/${id}.glb`);
    models.set(id, (await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')).scene);
  }
});
it.each(['polyAssaultRifle01Attack', 'polyPistol01Attack', 'polyShotgun01Attack'])('parks four real %s models flat, aligned, supported and clear of every dice lane', id => {
  const scene = new THREE.Scene(), board = new THREE.Group(); scene.add(board);
  board.scale.setScalar(boardScale); board.rotation.y = -Math.PI / 2; board.position.y = .116;
  const table = { radius, surfaceY: .116, getOuterRadius: () => radius };
  const seats = [0,1,2,3].map(i => { const seat = new THREE.Object3D(); seat.position.set(Math.sin(i*Math.PI/2)*.84, .16, Math.cos(i*Math.PI/2)*.84); scene.add(seat); return seat; });
  const frames = seats.map(seat => ludoTableFrame(board, seat, .5625));
  const dicePositions = frames.map(frame => ludoRightDicePosition(frame, table, .054*boardScale)!);
  dicePositions.forEach((point,i) => {
    expect(point).not.toBeNull();
    expect(point.clone().sub(frames[i].center).dot(frames[i].right)).toBeGreaterThan(0);
    expect(point.y).toBeCloseTo(table.surfaceY + .054*boardScale/2+.002,8);
  });
  const reserveTokens = frames.flatMap(frame => [-.058,.058].flatMap(side=>[.547,.634].map(reach=>{
    const token = new THREE.Mesh(new THREE.CylinderGeometry(.022,.022,.1,12));
    token.position.copy(frame.center).addScaledVector(frame.outward,reach).addScaledVector(frame.right,side);scene.add(token);return token;
  })));
  const holders: THREE.Object3D[] = [];
  frames.forEach(frame => {
    const rack = new THREE.Group(), holder = new THREE.Group(); scene.add(rack); rack.add(holder);
    rack.position.set(.13,.02,-.08); rack.rotation.y = .37;
    holder.add(prepareLudoParkedWeapon(models.get(id)!.clone(true), id, id.includes('Pistol') ? .18 : .4));
    expect(parkLudoWeapon({ holder, frame, table, obstacles: [...holders,...reserveTokens], dicePositions })).toBe(true);
    const bounds = snakeParkingBounds(holder), size = bounds.getSize(new THREE.Vector3());
    expect(bounds.min.y).toBeCloseTo(table.surfaceY+.002,8);
    expect(size.y).toBeLessThan(Math.min(size.x,size.z));
    expect(bounds.intersectsBox(frame.bounds.clone().expandByScalar(.011))).toBe(false);
    dicePositions.forEach(p=>expect(bounds.intersectsBox(new THREE.Box3().setFromCenterAndSize(p,new THREE.Vector3(.10,1,.10)))).toBe(false));
    holders.forEach(other=>expect(bounds.intersectsBox(snakeParkingBounds(other))).toBe(false));
    for(const x of [bounds.min.x,bounds.max.x]) for(const z of [bounds.min.z,bounds.max.z]) expect(Math.hypot(x,z)).toBeLessThan(radius-.01);
    const contacts = readSnakeWeaponContacts(holder)!;
    expect(contacts.grip.clone().sub(frame.center).dot(frame.right)).toBeGreaterThan(0);
    expect(holder.userData.ludoParkingScale).toBeGreaterThanOrEqual(.6);
    const bore = contacts.muzzle.clone().sub(contacts.stock).setY(0).normalize();
    expect(Math.abs(bore.dot(frame.right))).toBeGreaterThan(.995);
    const before = holder.matrixWorld.clone();
    expect(parkLudoWeapon({ holder, frame, table, obstacles: [...holders,...reserveTokens], dicePositions })).toBe(true);
    holder.matrixWorld.elements.forEach((n,index)=>expect(n).toBeCloseTo(before.elements[index],8));
    holders.push(holder);
  });
});
