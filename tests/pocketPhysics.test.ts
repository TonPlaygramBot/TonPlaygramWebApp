import { Ball, Pocket, JawParams, resolveJawCollision, centerPathIntersectsFunnel, willEnterPocket } from '../src/core/poolPhysics';

const params: JawParams = {
  ballRadius: 0.028575,
  eJaw: 0.85,
  muJaw: 0.12,
  dragJaw: 0.02,
  captureSpeedMin: 0.15,
  reboundThreshold: 0.08,
}

const pocket: Pocket = {
  center: { x: 0, y: 0 },
  uPocket: { x: 0, y: -1 },
  mouthWidth: 0.1,
  funnelDepth: 0.0714375,
}

describe('Pocket jaw physics', () => {
  test('moderate shot near jaw falls into pocket', () => {
    const ball: Ball = { position: { x: 0, y: 0.04 }, velocity: { x: -0.1, y: -0.2 }, omega: 0 }
    resolveJawCollision(ball, { x: 1, y: 0 }, params, 0)
    expect(centerPathIntersectsFunnel(ball, pocket, params)).toBe(true)
    expect(willEnterPocket(ball.velocity, pocket, params)).toBe(true)
  })

  test('strong shot through mouth drops straight in', () => {
    const ball: Ball = { position: { x: 0, y: 0.2 }, velocity: { x: 0, y: -0.5 }, omega: 0 }
    expect(centerPathIntersectsFunnel(ball, pocket, params)).toBe(true)
    expect(willEnterPocket(ball.velocity, pocket, params)).toBe(true)
  })
})

