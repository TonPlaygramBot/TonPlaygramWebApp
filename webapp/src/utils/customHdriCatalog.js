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

const toVariant = (entry, slug, optionIdOverride = null) => {
  const optionId = optionIdOverride || entry?.optionIdByGame?.[slug];
  if (typeof optionId !== 'string' || !optionId) return null;
  const name =
    typeof entry?.name === 'string' && entry.name.trim()
      ? entry.name.trim()
      : 'Premium HDRI';
  const environmentUrl =
    typeof entry?.environmentUrl === 'string' ? entry.environmentUrl : '';
  const thumbnailUrl =
    typeof entry?.thumbnailUrl === 'string' ? entry.thumbnailUrl : '';
  return {
    id: optionId,
    name,
    assetUrl: environmentUrl,
    thumbnail: thumbnailUrl || environmentUrl || '',
    preferredResolutions: ['2k'],
    fallbackResolution: '2k',
    exposure: 1.02,
    environmentIntensity: 1.04,
    backgroundIntensity: 0.98,
    swatches: ['#d946ef', '#7c3aed'],
    description: `Creator HDRI · ${name}`,
    isCustomUpload: true
  };
};

export const getCustomHdriVariantsForGame = (
  slug,
  viewerAccountId = null,
  ownedOptionIds = []
) => {
  const catalogVariants = getCustomHdriCatalog(viewerAccountId)
    .filter(
      (entry) =>
        Array.isArray(entry.supportedGames) &&
        entry.supportedGames.includes(slug) &&
        typeof entry.optionIdByGame?.[slug] === 'string'
    )
    .map((entry) => toVariant(entry, slug))
    .filter(Boolean);

  const seenIds = new Set(catalogVariants.map((variant) => variant.id));
  const fallbackOwnedVariants = Array.isArray(ownedOptionIds)
    ? ownedOptionIds
        .filter(
          (optionId) =>
            typeof optionId === 'string' &&
            optionId.startsWith('custom-hdri:') &&
            !seenIds.has(optionId)
        )
        .map((optionId) =>
          toVariant(
            {
              name: 'Premium HDRI',
              optionIdByGame: { [slug]: optionId }
            },
            slug,
            optionId
          )
        )
        .filter(Boolean)
    : [];

  return [...catalogVariants, ...fallbackOwnedVariants];
};
