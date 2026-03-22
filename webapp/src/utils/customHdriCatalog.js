const STORAGE_KEY = 'tonplaygramCustomHdriCatalogV1';

export const CUSTOM_HDRI_GAME_OPTIONS = Object.freeze([
  { id: 'poolroyale', label: 'Pool Royale' },
  { id: 'snookerroyale', label: 'Snooker Royale' }
]);

const normalizeGames = (games = []) =>
  Array.from(new Set((Array.isArray(games) ? games : []).filter(Boolean)));

const readAll = () => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn('Failed to read custom HDRI catalog', error);
    return [];
  }
};

const writeAll = (items) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
};

export const listCustomHdrisForGame = ({ accountId, gameId }) => {
  if (!accountId || !gameId) return [];
  return readAll().filter(
    (entry) =>
      entry?.ownerAccountId === accountId &&
      Array.isArray(entry?.selectedGames) &&
      entry.selectedGames.includes(gameId)
  );
};

export const saveCustomHdri = (entry) => {
  if (!entry?.id || !entry?.ownerAccountId) return null;
  const normalized = {
    ...entry,
    selectedGames: normalizeGames(entry.selectedGames)
  };
  const all = readAll().filter((item) => item?.id !== normalized.id);
  const next = [normalized, ...all].slice(0, 100);
  writeAll(next);
  return normalized;
};
