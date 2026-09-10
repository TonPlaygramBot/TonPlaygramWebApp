import { describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'

import {
  POOL_ROYAL_STROKE,
  advancePoolRoyalCueStroke,
  sampleCueStrokeTimeline
} from './poolRoyaleCueStrokeTimeline.js'

describe('Pool Royale cue stroke timeline', () => {
  it('arms the shot only when the cue reaches the reference contact threshold', () => {
    const beforeContact = sampleCueStrokeTimeline({
      ...POOL_ROYAL_STROKE,
      elapsed: POOL_ROYAL_STROKE.strikeDuration * (POOL_ROYAL_STROKE.hitArmRatio - 0.01)
    })
    const atContact = sampleCueStrokeTimeline({
      ...POOL_ROYAL_STROKE,
      elapsed: POOL_ROYAL_STROKE.strikeDuration * POOL_ROYAL_STROKE.hitArmRatio
    })

    expect(beforeContact.hitArmed).toBe(false)
    expect(atContact.hitArmed).toBe(true)
  })

  it('moves the existing cue to contact before applying one physical shot', () => {
    const cue = new THREE.Object3D()
    const onImpact = vi.fn()
    const startTime = 1_000
    const stroke = {
      ...POOL_ROYAL_STROKE,
      startTime,
      idlePos: new THREE.Vector3(0, 0, -1),
      pullPos: new THREE.Vector3(0, 0, -2),
      contactPos: new THREE.Vector3(0, 0, 0),
      onImpact
    }

    advancePoolRoyalCueStroke(
      cue,
      stroke,
      startTime + POOL_ROYAL_STROKE.strikeDuration * (POOL_ROYAL_STROKE.hitArmRatio - 0.01)
    )
    expect(onImpact).not.toHaveBeenCalled()

    const contactSample = advancePoolRoyalCueStroke(
      cue,
      stroke,
      startTime + POOL_ROYAL_STROKE.strikeDuration * POOL_ROYAL_STROKE.hitArmRatio + 0.01
    )
    expect(contactSample.hitArmed).toBe(true)
    expect(cue.position).toEqual(stroke.contactPos)
    expect(onImpact).toHaveBeenCalledTimes(1)

    advancePoolRoyalCueStroke(cue, stroke, startTime + POOL_ROYAL_STROKE.strikeDuration + 10)
    expect(onImpact).toHaveBeenCalledTimes(1)
  })

  it('holds the cue at contact for the supplied 50 ms reference hold', () => {
    const cue = new THREE.Object3D()
    const startTime = 2_000
    const stroke = {
      ...POOL_ROYAL_STROKE,
      startTime,
      idlePos: new THREE.Vector3(0, 0, -1),
      pullPos: new THREE.Vector3(0, 0, -2),
      contactPos: new THREE.Vector3(0, 0, 0)
    }

    const sample = advancePoolRoyalCueStroke(
      cue,
      stroke,
      startTime + POOL_ROYAL_STROKE.strikeDuration + POOL_ROYAL_STROKE.holdDuration - 1
    )

    expect(sample.phase).toBe('hold')
    expect(sample.done).toBe(false)
    expect(cue.visible).toBe(true)
    expect(cue.position).toEqual(stroke.contactPos)
  })
})
