import {
  Ball,
  Pocket,
  JawParams,
  resolveJawCollision,
  centerPathIntersectsFunnel,
  willEnterPocket
} from '../src/core/poolPhysics'

// Parameters configure pocket jaw physics. Jaws bounce with 75% less
// restitution than cushions and collisions dampen speed by 75%.
const params: JawParams = {
  ballRadius: 0.028575,
  eJaw: 0.25,
  muJaw: 0,
  dragJaw: 0.75,
  captureSpeedMin: 0,
  reboundThreshold: 0
}

const pocket: Pocket = {
  center: { x: 0, y: 0 },
  uPocket: { x: 0, y: -1 },
  mouthWidth: 0.1,
  funnelDepth: 0.0714375
}

describe('Pocket jaw physics', () => {
  test('jaw collisions reflect velocity with reduced restitution and speed', () => {
    const ball: Ball = { position: { x: 0, y: 0.04 }, velocity: { x: -0.1, y: -0.2 }, omega: 0 }
    resolveJawCollision(ball, { x: 1, y: 0 }, params, 0)
    expect(ball.velocity.x).toBeCloseTo(0.00625)
    expect(ball.velocity.y).toBeCloseTo(-0.05)
  })

  test('balls are always considered to enter the pocket', () => {
    const ball: Ball = { position: { x: 0, y: 0.2 }, velocity: { x: 0, y: -0.5 }, omega: 0 }
    expect(centerPathIntersectsFunnel(ball, pocket, params)).toBe(true)
    expect(willEnterPocket(ball.velocity, pocket, params)).toBe(true)
  })
})

