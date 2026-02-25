export const ONLINE_CONTRACT_CHECKS = Object.freeze({
  lobby: 'Lobby uses shared online flow and validated seat/join handling',
  runtime: 'Game runtime consumes tableId/accountId and stays socket-synced',
  backend: 'Backend event contract for seat/ready/start/cleanup is validated'
});

export const ONLINE_READINESS_BY_GAME = Object.freeze({
  poolroyale: {
    checks: { lobby: true, runtime: true, backend: true },
    label: 'Online Ready'
  },
  snookerroyale: {
    checks: { lobby: true, runtime: true, backend: true },
    label: 'Online Ready'
  },
  snake: {
    checks: { lobby: true, runtime: true, backend: true },
    label: 'Online Ready'
  },
  'domino-royal': {
    checks: { lobby: true, runtime: true, backend: false },
    label: 'Beta'
  },
  ludobattleroyal: {
    checks: { lobby: true, runtime: true, backend: false },
    label: 'Beta'
  }
});

const FALLBACK_STATE = Object.freeze({
  checks: { lobby: false, runtime: false, backend: false },
  label: 'Coming Soon'
});

export function getOnlineReadiness(slug = '') {
  const state = ONLINE_READINESS_BY_GAME[slug] || FALLBACK_STATE;
  const checks = {
    lobby: Boolean(state.checks?.lobby),
    runtime: Boolean(state.checks?.runtime),
    backend: Boolean(state.checks?.backend)
  };
  const ready = checks.lobby && checks.runtime && checks.backend;
  return {
    slug,
    checks,
    ready,
    label: state.label || (ready ? 'Online Ready' : 'Coming Soon')
  };
}

