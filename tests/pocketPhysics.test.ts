import { Ball, Pocket, JawParams, resolveJawCollision, centerPathIntersectsFunnel, willEnterPocket } from '../src/core/poolPhysics';

const params: JawParams = {
  ballRadius: 0.028575,
  eJaw: 0.85,
  muJaw: 0.12,
  dragJaw: 0.02,
  captureSpeedMin: 0.15,
  reboundThreshold: 0.08,
  lipOutAngle: 40,
  lipOutSpeed: 0.35,
  rattleTimeWindow: 0.08,
}

const pocket: Pocket = {
  center: { x: 0, y: 0 },
  uPocket: { x: 0, y: -1 },
  mouthWidth: 0.1,
  funnelDepth: 0.0714375,
}

describe('Pocket jaw physics', () => {
  test('moderate shot near jaw falls into pocket', () => {
    const ball: Ball = { position: { x: 0, y: 0.04 }, velocity: { x: -0.1, y: -0.2 }, omega: 0, rattleCount: 0, lastJawHitTime: -Infinity }
    resolveJawCollision(ball, { x: 1, y: 0 }, params, 0)
    expect(centerPathIntersectsFunnel(ball, pocket, params)).toBe(true)
    expect(willEnterPocket(ball.velocity, pocket, params)).toBe(true)
  })

  test('strong shot through mouth drops straight in', () => {
    const ball: Ball = { position: { x: 0, y: 0.2 }, velocity: { x: 0, y: -0.5 }, omega: 0, rattleCount: 0, lastJawHitTime: -Infinity }
    expect(centerPathIntersectsFunnel(ball, pocket, params)).toBe(true)
    expect(willEnterPocket(ball.velocity, pocket, params)).toBe(true)
  })

  test('edge shot with high angle lips out', () => {
    const ball: Ball = { position: { x: 0.04, y: 0.04 }, velocity: { x: -0.5, y: -0.1 }, omega: 0, rattleCount: 0, lastJawHitTime: -Infinity }
    resolveJawCollision(ball, { x: 1, y: 0 }, params, 0)
    expect(willEnterPocket(ball.velocity, pocket, params)).toBe(false)
  })

  test('rattle reduces energy on successive hits', () => {
    const ball: Ball = { position: { x: 0, y: 0.04 }, velocity: { x: -0.3, y: -0.2 }, omega: 0, rattleCount: 0, lastJawHitTime: -Infinity }
    resolveJawCollision(ball, { x: 1, y: 0 }, params, 0)
    const speed1 = Math.hypot(ball.velocity.x, ball.velocity.y)
    resolveJawCollision(ball, { x: -1, y: 0 }, params, 0.05)
    const speed2 = Math.hypot(ball.velocity.x, ball.velocity.y)
    expect(speed2).toBeLessThan(speed1)
  })
})

