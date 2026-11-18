import test from 'node:test'
import assert from 'node:assert/strict'
import { DRONE_RELEASE_RATIO, DRONE_PAYLOAD_OFFSET, sampleDroneDelivery, samplePayloadDrop, sampleCaptureBlast } from '../webapp/src/utils/chessCapturePresentation.js'
const from = { x: -2, y: 0.15, z: 1 }
const target = { x: 1, y: 0.4, z: -1 }
const sample = (progress) => sampleDroneDelivery({ from, target, progress, clearance: 1.38 })
test('drone carries payload continuously, holds directly above target, then leaves', () => {
  assert.deepEqual([sample(0).x, sample(0).z], [from.x, from.z])
  for (const u of [0.64, 0.66, DRONE_RELEASE_RATIO, 0.7]) {
    const p = sample(u)
    assert.equal(p.x, target.x)
    assert.equal(p.z, target.z)
    assert.ok(p.y - DRONE_PAYLOAD_OFFSET > target.y)
  }
  const at = sample(DRONE_RELEASE_RATIO)
  const before = sample(DRONE_RELEASE_RATIO - 1e-7)
  assert.ok(Math.hypot(at.x - before.x, at.y - before.y, at.z - before.z) < 1e-5)
  assert.ok(sample(1).x > target.x)
  assert.ok(sample(1).z < target.z)
  assert.equal(sample(1).direction.y, undefined, 'body heading remains horizontal')
})
test('payload starts below drone and accelerates straight down onto same square', () => {
  const drone = sample(DRONE_RELEASE_RATIO)
  const launch = { x: drone.x, y: drone.y - DRONE_PAYLOAD_OFFSET, z: drone.z }
  assert.deepEqual(samplePayloadDrop(launch, target, 0), launch)
  assert.deepEqual(samplePayloadDrop(launch, target, 1), target)
  let lastY = launch.y
  for (let i = 0; i <= 100; i++) {
    const p = samplePayloadDrop(launch, target, i / 100)
    assert.equal(p.x, target.x); assert.equal(p.z, target.z)
    assert.ok(p.y <= lastY); lastY = p.y
  }
  const first = samplePayloadDrop(launch, target, 0.25)
  const second = samplePayloadDrop(launch, target, 0.5)
  assert.ok(first.y - second.y > launch.y - first.y)
})
test('30/60/120 FPS sample identical release/drop and bounded finite paths', () => {
  for (const fps of [30, 60, 120]) {
    for (let frame = 0; frame <= fps * 6; frame++) {
      const p = sample(frame / (fps * 6))
      assert.ok([p.x, p.y, p.z].every(Number.isFinite))
      assert.ok(p.y >= from.y)
    }
    const releaseFrame = Math.ceil(DRONE_RELEASE_RATIO * fps * 6)
    assert.ok(sample(releaseFrame / (fps * 6)).released)
    // Runtime computes the exact release anchor, not the first post-release frame.
    assert.equal(sample(DRONE_RELEASE_RATIO).x, target.x)
  }
  const p = sampleDroneDelivery({ from: target, target, progress: 1, clearance: 0 })
  assert.ok([p.x,p.y,p.z].every(Number.isFinite))
})
test('blast flash is brief, smoke emerges after flash and all fades end', () => {
  assert.equal(sampleCaptureBlast(0).flash, 1)
  assert.equal(sampleCaptureBlast(0).smoke, 0)
  assert.equal(sampleCaptureBlast(0.12).flash, 0)
  assert.equal(sampleCaptureBlast(0.65).fire, 0)
  assert.ok(sampleCaptureBlast(0.3).smoke > 0)
  for (const t of [2.6, 3, 10]) {
    const p = sampleCaptureBlast(t)
    assert.equal(p.flash + p.fire + p.smoke, 0)
  }
})
