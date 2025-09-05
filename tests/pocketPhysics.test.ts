import { Ball, Pocket, JawParams, Jaw, resolveJawCollision, centerPathIntersectsFunnel, willEnterPocket } from '../src/core/poolPhysics';

const params: JawParams = {
  ballRadius: 0.028575,
  eJaw: 0.85,
  muJaw: 0.12,
  dragJaw: 0.02,
  captureSpeedMin: 0.15,
  reboundThreshold: 0.08,
  lipOutAngle: 40,
  lipOutSpeed: 0.35,
}

const jawRadius = params.ballRadius * 1.2
const jaw: Jaw = {
  center: { x: jawRadius, y: 0 },
  radius: jawRadius,
  startAngle: -Math.PI / 2,
  endAngle: Math.PI / 2,
}

const pocket: Pocket = {
  center: { x: 0, y: 0 },
  uPocket: { x: 0, y: -1 },
  mouthWidth: 0.2,
  funnelDepth: jawRadius * 2,
  jaws: [jaw],
}

describe('Pocket jaw physics', () => {
  test('moderate shot near jaw falls into pocket', () => {
    const ball: Ball = {
      position: { x: jaw.center.x + params.ballRadius, y: 0 },
      velocity: { x: -0.1, y: -0.2 },
      omega: 0,
    }
    const collided = resolveJawCollision(ball, jaw, params, 0)
    expect(collided).toBe(true)
    expect(centerPathIntersectsFunnel(ball, pocket, params)).toBe(true)
    expect(willEnterPocket(ball.velocity, pocket, params)).toBe(true)
  })

  test('strong shot through mouth drops straight in', () => {
    const ball: Ball = { position: { x: 0, y: 0.2 }, velocity: { x: 0, y: -0.5 }, omega: 0 }
    expect(centerPathIntersectsFunnel(ball, pocket, params)).toBe(true)
    expect(willEnterPocket(ball.velocity, pocket, params)).toBe(true)
  })

  test('fast edge shot lips out and returns to table', () => {
    const ball: Ball = {
      position: { x: jaw.center.x + params.ballRadius, y: 0 },
      velocity: { x: -0.5, y: -0.1 },
      omega: 0,
    }
    const collided = resolveJawCollision(ball, jaw, params, 0)
    expect(collided).toBe(true)
    expect(willEnterPocket(ball.velocity, pocket, params)).toBe(false)
  })
})

