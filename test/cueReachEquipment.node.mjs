import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import * as THREE from '../webapp/node_modules/three/build/three.module.js';
import {
  createCueReachEquipment,
  distanceToRearRail,
  hideCueReachEquipment,
  poseCueReachEquipment,
  resolveCueReachProfile
} from '../webapp/src/pages/Games/shared/cueReachEquipment.ts';
import { showPoolGuideMarkings } from '../webapp/src/pages/Games/shared/poolTableMarkings.js';

test('reach equipment is reserved for short-rail-to-opposite-half shots', () => {
  const aim = new THREE.Vector3(0, 0, -1);
  assert.equal(distanceToRearRail(new THREE.Vector3(0, 0, 0), aim, 5.4, 9), 4.5);
  assert.equal(distanceToRearRail(new THREE.Vector3(0, 0, 3.5), aim, 5.4, 9), 1);
  assert.equal(distanceToRearRail(new THREE.Vector3(0, 0, -3), aim, 5.4, 9), 7.5);

  const longReach = resolveCueReachProfile({
    cueBall: new THREE.Vector3(0, 0, -3), aimForward: aim, tableW: 5.4, tableL: 9
  });
  const centerReach = resolveCueReachProfile({
    cueBall: new THREE.Vector3(0, 0, 0), aimForward: aim, tableW: 5.4, tableL: 9
  });
  const sideRailShot = resolveCueReachProfile({
    cueBall: new THREE.Vector3(0, 0, -3), aimForward: new THREE.Vector3(1, 0, 0), tableW: 5.4, tableL: 9
  });
  assert.equal(longReach.needsExtension, true);
  assert.ok(longReach.extensionLength > 0);
  assert.ok(longReach.rearRailDistance > longReach.farSideThreshold);
  assert.equal(centerReach.needsExtension, false);
  assert.equal(centerReach.extensionLength, 0);
  assert.equal(sideRailShot.needsExtension, false);
  assert.equal(sideRailShot.longAxisAlignment, 0);
});

test('short-rail logic follows the actual long axis on a rotated table', () => {
  const profile = resolveCueReachProfile({
    cueBall: new THREE.Vector3(3, 0, 0),
    aimForward: new THREE.Vector3(1, 0, 0),
    tableW: 9,
    tableL: 5.4
  });
  assert.equal(profile.needsExtension, true);
  assert.equal(profile.longAxisAlignment, 1);
  assert.equal(profile.rearRailDistance, 7.5);
});

test('the procedural extension and four-prong rest follow the cue and return a hand grip', () => {
  const equipment = createCueReachEquipment();
  const profile = resolveCueReachProfile({
    cueBall: new THREE.Vector3(0, 1, -3),
    aimForward: new THREE.Vector3(0, 0, -1),
    tableW: 5.4,
    tableL: 9
  });
  const pose = poseCueReachEquipment(equipment, {
    cueBack: new THREE.Vector3(0, 1.1, 2),
    cueTip: new THREE.Vector3(0, 1, -2.8),
    cueBall: new THREE.Vector3(0, 1, -3),
    aimForward: new THREE.Vector3(0, 0, -1),
    rootTarget: new THREE.Vector3(0, 0, 3),
    clothY: 0.9,
    profile,
    scale: 1
  });

  assert.ok(pose);
  assert.equal(equipment.group.visible, true);
  assert.equal(equipment.restProngs.length, 4);
  assert.ok(equipment.extensionShaft.scale.y > 0);
  assert.ok(equipment.restPole.scale.y > 0);
  assert.ok(pose.restGrip.y > 0.9);
  assert.ok(Math.abs(pose.restDirection.length() - 1) < 1e-9);

  hideCueReachEquipment(equipment);
  assert.equal(equipment.group.visible, false);
});

test('pool guide filtering preserves the white penalty spot and head string', () => {
  const group = { visible: false };
  const baulkLine = { visible: false };
  const dArc = { visible: true };
  const penaltySpot = { visible: false };
  const snookerSpot = { visible: true };
  showPoolGuideMarkings({ group, baulkLine, dArc, spots: [penaltySpot, snookerSpot], penaltySpot });
  assert.equal(group.visible, true);
  assert.equal(baulkLine.visible, true);
  assert.equal(penaltySpot.visible, true);
  assert.equal(dArc.visible, false);
  assert.equal(snookerSpot.visible, false);
});

test('Snooker Royal starts physics at rendered tip contact and waits before shot resolution', async () => {
  const source = await readFile(
    new URL('../webapp/src/pages/Games/SnookerRoyal.jsx', import.meta.url),
    'utf8'
  );
  const contact = source.indexOf('const contactTip = resolveCueBallContact(');
  const snap = source.indexOf('cueStick.position.copy(impactPos);', contact);
  const impact = source.indexOf('applyCueBallImpact();', snap);
  assert.ok(contact > 0 && snap > contact && impact > snap);
  assert.match(source, /if \(shooting && !shotImpactPending\)/);
  assert.match(source, /resolvePoolRoyalReleasePower\(\{/);
  assert.match(source, /fireRef\.current\?\.\(committedValue \/ 100\)/);
  assert.match(source, /shotImpactFallbackTimer = window\.setTimeout/);
  assert.match(source, /new PoolRoyalHumanPlayers\(world,/);
});
