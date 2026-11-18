import test from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from '../webapp/node_modules/three/build/three.module.js'
import { findExactUkrainianDroneRotor, spinExactUkrainianDroneRotors, createExactUkrainianFallbackDrone } from '../webapp/src/utils/ukrainianDroneModel.js'

const blade = (name) => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 0.02, 0.12), new THREE.MeshBasicMaterial())
  mesh.name = name
  return mesh
}
const close = (a, b) => assert.ok(a.angleTo(b) < 1e-7)

test('only blade assembly spins, never frame, motor or nested blade twice', () => {
  const root = new THREE.Group(); root.name = 'quadrotor'
  const frame = new THREE.Group(); frame.name = 'rotor-frame'
  const motor = blade('rotor-motor')
  const rotor = new THREE.Group(); rotor.name = 'propeller'
  const mesh = blade('propeller-blade'); rotor.add(mesh)
  frame.add(motor, rotor); root.add(frame)
  rotor.rotation.set(0.2, 0.1, 0.3)
  const rest = rotor.quaternion.clone()
  spinExactUkrainianDroneRotors(root, 0.3)
  close(root.quaternion, new THREE.Quaternion())
  close(frame.quaternion, new THREE.Quaternion())
  close(motor.quaternion, new THREE.Quaternion())
  close(mesh.quaternion, new THREE.Quaternion())
  close(rotor.quaternion, rest.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 7.2)))
  assert.equal(findExactUkrainianDroneRotor(root), rotor)
  const once = rotor.quaternion.clone()
  spinExactUkrainianDroneRotors(root, 0.3)
  close(rotor.quaternion, once)
})

test('known srcejon GLB primitive assemblies spin around local Z with body fixed', () => {
  const root = new THREE.Group(); root.rotation.x = -Math.PI / 2
  const body = blade('Circle001_0'); root.add(body)
  const rotors = Array.from({length: 4}, (_, i) => {
    const rotor = new THREE.Group(); rotor.name = `Circle00${i + 2}`
    const mesh = blade(`${rotor.name}_0`); rotor.add(mesh); root.add(rotor)
    return rotor
  })
  const rest = root.quaternion.clone()
  spinExactUkrainianDroneRotors(root, 0.2)
  close(root.quaternion, rest); close(body.quaternion, new THREE.Quaternion())
  rotors.forEach((rotor, i) => close(rotor.quaternion, new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), 4.8 * (i % 2 ? -1 : 1))))
})

test('unknown model never spins whole body and incomplete source signature is ignored', () => {
  const root = new THREE.Group(); root.name = 'rotor'
  root.add(blade('body'))
  const assembly = new THREE.Group(); assembly.name = 'Circle002'
  assembly.add(blade('Circle002_0')); root.add(assembly)
  spinExactUkrainianDroneRotors(root, 12)
  assert.equal(findExactUkrainianDroneRotor(root), null)
  close(root.quaternion, new THREE.Quaternion()); close(assembly.quaternion, new THREE.Quaternion())
})

test('fallback four rotors spin independently and preserve static body and clone isolation', () => {
  const original = createExactUkrainianFallbackDrone()
  const clone = original.clone(true)
  const rotors = clone.children.filter(n => n.name.includes('fallback-rotor'))
  const originalRotors = original.children.filter(n => n.name.includes('fallback-rotor'))
  const staticParts = clone.children.filter(n => !rotors.includes(n))
  const staticRest = staticParts.map(n => n.quaternion.clone())
  spinExactUkrainianDroneRotors(clone, 0.2)
  assert.equal(rotors.length, 4)
  rotors.forEach(r => assert.ok(r.quaternion.angleTo(new THREE.Quaternion()) > 0.01))
  originalRotors.forEach(r => close(r.quaternion, new THREE.Quaternion()))
  staticParts.forEach((n, i) => close(n.quaternion, staticRest[i]))
  const rest = rotors[0].quaternion.clone()
  spinExactUkrainianDroneRotors(clone, NaN)
  close(rotors[0].quaternion, rest)
})


test('rotor collection containers remain still while each assembly spins', () => {
  const root = new THREE.Group()
  const collection = new THREE.Group(); collection.name = 'rotor-collection'
  root.add(collection)
  const rotors = [0, 1].map(i => {
    const rotor = new THREE.Group(); rotor.name = `rotor-${i}`
    rotor.position.x = i ? 1 : -1
    rotor.add(blade('blade')); collection.add(rotor)
    return rotor
  })
  spinExactUkrainianDroneRotors(root, 0.2)
  close(collection.quaternion, new THREE.Quaternion())
  rotors.forEach(r => assert.ok(r.quaternion.angleTo(new THREE.Quaternion()) > 0.01))
})
