import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { createRestoredSeatedHumanActor } from './seatedHumanActors.js'

function createHumanTemplate () {
  const actor = new THREE.Group()
  actor.add(new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1), new THREE.MeshBasicMaterial()))

  const hips = new THREE.Bone()
  hips.name = 'Hips'
  const leftHand = new THREE.Bone()
  leftHand.name = 'LeftHand'
  const rightHand = new THREE.Bone()
  rightHand.name = 'RightHand'
  hips.add(leftHand, rightHand)
  actor.add(hips)
  actor.userData.seatedHumanScale = 2.5
  return actor
}

describe('restored Snake seated humans', () => {
  it('reuses the original seated-human presentation scale', () => {
    const chair = new THREE.Group()
    const restored = createRestoredSeatedHumanActor(createHumanTemplate(), chair)

    expect(restored).not.toBeNull()
    expect(restored.actor.scale.toArray()).toEqual([2.5, 2.5, 2.5])
    expect(restored.actor.parent).toBe(chair)
  })
})
