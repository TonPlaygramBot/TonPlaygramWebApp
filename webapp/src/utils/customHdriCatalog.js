const STORAGE_KEY = 'tonplaygramCustomHdriCatalogV1';

const readCatalog = () => {
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

const writeCatalog = (entries) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
};

export const getCustomHdriCatalog = (viewerAccountId = null) => {
  const resolvedViewer =
    viewerAccountId ||
    (typeof window !== 'undefined'
      ? window.localStorage.getItem('accountId') || 'guest'
      : 'guest');
  return readCatalog().filter((entry) => {
    if (!entry || typeof entry !== 'object') return false;
    if (entry.visibility === 'public') return true;
    return entry.createdBy === resolvedViewer;
  });
};

export const saveCustomHdriEntry = (entry) => {
  if (!entry || typeof entry !== 'object') return null;
  const nextEntry = {
    ...entry,
    createdAt: Number(entry.createdAt || Date.now())
  };
  const catalog = readCatalog();
  const deduped = catalog.filter((candidate) => candidate?.id !== nextEntry.id);
  deduped.unshift(nextEntry);
  writeCatalog(deduped.slice(0, 100));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('customHdriCatalogUpdate', {
        detail: { entry: nextEntry }
      })
    );
  }
  return nextEntry;
};

export const getCustomHdriVariantsForGame = (slug, viewerAccountId = null) =>
  getCustomHdriCatalog(viewerAccountId)
    .filter(
      (entry) =>
        Array.isArray(entry.supportedGames) &&
        entry.supportedGames.includes(slug) &&
        typeof entry.optionIdByGame?.[slug] === 'string'
    )
    .map((entry) => ({
      id: entry.optionIdByGame[slug],
      name: entry.name,
      assetUrl: entry.environmentUrl,
      thumbnail: entry.thumbnailUrl || entry.environmentUrl || '',
      preferredResolutions: ['2k'],
      fallbackResolution: '2k',
      exposure: 1.02,
      environmentIntensity: 1.04,
      backgroundIntensity: 0.98,
      swatches: ['#d946ef', '#7c3aed'],
      description: `Creator HDRI · ${entry.name}`,
      isCustomUpload: true
    }));
