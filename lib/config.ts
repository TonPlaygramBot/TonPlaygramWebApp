export const BRAND = { bg: '#0c1020', panel: '#11172a', gold: '#d4af37' } as const;

export const FEATURE_FLAGS = { useLocalDemo: true } as const;

export const POKER_WS_URL = process.env.NEXT_PUBLIC_POKER_WS_URL ?? 'http://localhost:4001';
