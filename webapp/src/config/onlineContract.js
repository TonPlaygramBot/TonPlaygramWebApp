import { get } from '../utils/api.js';

export const ONLINE_CONTRACT_CHECKS = Object.freeze({
  lobby: 'Lobby uses shared online flow and validated seat/join handling',
  runtime: 'Game runtime consumes tableId/accountId and stays socket-synced',
  backend: 'Backend event contract for seat/ready/start/cleanup is validated',
  security: 'Rate limits, identity binding and anti-cheat guardrails are active'
});

export const ONLINE_READINESS_BY_GAME = Object.freeze({
  poolroyale: {
    checks: { lobby: true, runtime: true, backend: true, security: true },
    label: 'Online Ready'
  },
  snookerroyale: {
    checks: { lobby: true, runtime: true, backend: true, security: true },
    label: 'Online Ready'
  },
  snake: {
    checks: { lobby: true, runtime: true, backend: true, security: true },
    label: 'Online Ready'
  },
  chessbattleroyal: {
    checks: { lobby: true, runtime: true, backend: true, security: true },
    label: 'Online Ready'
  },
  'domino-royal': {
    checks: { lobby: true, runtime: true, backend: true, security: true },
    label: 'Online Ready'
  },
  ludobattleroyal: {
    checks: { lobby: true, runtime: true, backend: true, security: true },
    label: 'Online Ready'
  },
  texasholdem: {
    checks: { lobby: true, runtime: true, backend: true, security: true },
    label: 'Online Ready'
  },
  airhockey: {
    checks: { lobby: true, runtime: true, backend: true, security: true },
    label: 'Online Ready'
  },
  goalrush: {
    checks: { lobby: true, runtime: true, backend: true, security: true },
    label: 'Online Ready'
  },
  murlanroyale: {
    checks: { lobby: true, runtime: true, backend: true, security: true },
    label: 'Online Ready'
  },
  tabletennisroyal: {
    checks: { lobby: true, runtime: true, backend: true, security: true },
    label: 'Online Ready'
  }
});

const FALLBACK_STATE = Object.freeze({
  checks: { lobby: false, runtime: false, backend: false, security: false },
  label: 'Coming Soon'
});

export function getOnlineReadiness(slug = '', source = ONLINE_READINESS_BY_GAME) {
  const state = source[slug] || FALLBACK_STATE;
  const checks = {
    lobby: Boolean(state.checks?.lobby),
    runtime: Boolean(state.checks?.runtime),
    backend: Boolean(state.checks?.backend),
    security: Boolean(state.checks?.security)
  };
  const ready = checks.lobby && checks.runtime && checks.backend && checks.security;
  return {
    slug,
    checks,
    ready,
    label: state.label || (ready ? 'Online Ready' : 'Coming Soon')
  };
}

export async function fetchOnlineReadinessMap() {
  try {
    const payload = await get('/api/online/readiness');
    if (payload && typeof payload.games === 'object') {
      return payload.games;
    }
  } catch {
    // keep local fallback when backend readiness snapshot is unavailable
  }
  return ONLINE_READINESS_BY_GAME;
}
