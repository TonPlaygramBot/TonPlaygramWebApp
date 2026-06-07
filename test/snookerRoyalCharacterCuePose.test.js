/* global describe, test */
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

describe('Snooker Royal character and cue parity', () => {
  test('scales the ReadyPlayer human to be about 30% taller than the cue stick', async () => {
    const source = await readFile('webapp/src/pages/Games/SnookerRoyal.jsx', 'utf8')

    assert.match(source, /cueLength:\s*1\.78 \* SNOOKER_CUE_POSE_SCALE,/)
    assert.match(source, /humanScale:\s*1\.3 \* 1\.78 \* SNOOKER_CUE_POSE_SCALE,/)
  })

  test('uses SnookerRoyalProvided cue endpoint math for aiming, spin, bridge, and pull', async () => {
    const source = await readFile('webapp/src/pages/Games/SnookerRoyal.jsx', 'utf8')

    assert.match(source, /const bridgeHandTarget = cueBallWorld\.clone\(\)\s*\.addScaledVector\(aimForward, -CFG\.bridgeHandBackFromBall\)\s*\.addScaledVector\(aimSide, CFG\.bridgeHandSide\)\s*\.setY\(CFG\.tableTopY \+ CFG\.bridgePalmTableLift\);/s)
    assert.match(source, /const bridgeCuePoint = bridgeHandTarget\.clone\(\)\s*\.addScaledVector\(aimForward, CFG\.bridgeVGrooveForward\)\s*\.addScaledVector\(aimSide, CFG\.bridgeVGrooveSide\)\s*\.add\(new THREE\.Vector3\(0, CFG\.bridgeCueLift, 0\)\);/s)
    assert.match(source, /const providedCueTip = cueBallWorld\.clone\(\)\s*\.addScaledVector\(aimForward, -\(CFG\.ballR \+ gap\)\)\s*\.addScaledVector\(aimSide, \(spinOffset\.x \?\? 0\) \* CFG\.ballR \* 0\.52\)\s*\.add\(new THREE\.Vector3\(0, \(spinOffset\.y \?\? 0\) \* CFG\.ballR \* 0\.44, 0\)\);/s)
    assert.match(source, /const providedCueBack = bridgeCuePoint\.clone\(\)\.addScaledVector\(aimForward, -\(CFG\.cueLength - CFG\.bridgeDist - CFG\.ballR - gap\)\)\.add\(new THREE\.Vector3\(0, 0\.024 \* CFG\.scale, 0\)\);/)
  })
})
