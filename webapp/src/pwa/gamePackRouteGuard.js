const GAME_PACKS_REQUIRED = import.meta.env.VITE_REQUIRE_GAME_PACKS === 'true';
const INSTALL_STATE_KEY = 'tonplaygram-game-pack-installs-v1';

const MANAGED_GAME_ROUTES = [
  { prefixes: ['/games/tiranastreets', '/games/blackwater'], packId: 'tirana-streets' },
  { prefixes: ['/games/kartroyale'], packId: 'racing-royal' },
  { prefixes: ['/games/poolroyale', '/games/snookerroyale'], packId: 'pool-royale' },
  { prefixes: ['/games/tabletennisroyal', '/games/tennisroyal'], packId: 'table-tennis-royal' },
  { prefixes: ['/games/royallanes'], packId: 'royal-lanes' }
];

const findRequiredPackId = pathname =>
  MANAGED_GAME_ROUTES.find(entry => entry.prefixes.some(prefix => pathname.startsWith(prefix)))?.packId || null;

const readInstallations = () => {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(INSTALL_STATE_KEY) || '{}');
    return parsed?.packs && typeof parsed.packs === 'object' ? parsed.packs : {};
  } catch {
    return {};
  }
};

const isInstallationTreeAvailable = async (packId, installations, visited = new Set()) => {
  if (visited.has(packId)) return true;
  visited.add(packId);
  const installation = installations[packId];
  if (installation?.status !== 'installed' || !installation.cacheName) return false;
  try {
    if (typeof caches === 'undefined' || !(await caches.has(installation.cacheName))) return false;
  } catch {
    return false;
  }
  for (const dependencyId of installation.dependencies || []) {
    if (!(await isInstallationTreeAvailable(dependencyId, installations, visited))) return false;
  }
  return true;
};

export async function enforceRequiredGamePackRoute() {
  if (!GAME_PACKS_REQUIRED || typeof window === 'undefined') return false;
  const packId = findRequiredPackId(window.location.pathname);
  if (!packId) return false;

  const installations = readInstallations();
  if (await isInstallationTreeAvailable(packId, installations)) return false;

  const returnTo = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  const target = new URL('/games', window.location.origin);
  target.searchParams.set('downloadPack', packId);
  target.searchParams.set('returnTo', returnTo);
  window.location.replace(target.toString());
  return true;
}

export { GAME_PACKS_REQUIRED, MANAGED_GAME_ROUTES };
