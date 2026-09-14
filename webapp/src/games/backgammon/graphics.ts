// Backgammon owns its settings and storage. Catalogue data is shared with Murlan.
export const BACKGAMMON_GRAPHICS_KEY = 'backgammonGraphicsProfile';
export const BACKGAMMON_GRAPHICS = Object.freeze([
  {
    id: 'fhd60',
    label: 'Performance (60 Hz)',
    fps: 60,
    renderScale: 1,
    pixelRatioCap: 1.4,
    resolutions: ['2k', '1k']
  },
  {
    id: 'smooth90',
    label: 'Smooth (90 Hz)',
    fps: 90,
    renderScale: 1.12,
    pixelRatioCap: 1.55,
    resolutions: ['4k', '2k', '1k']
  },
  {
    id: 'uhd120',
    label: 'Ultra (120 Hz)',
    fps: 120,
    renderScale: 1.22,
    pixelRatioCap: 1.72,
    resolutions: ['8k', '4k', '2k', '1k']
  }
]);
export function readBackgammonGraphics() {
  try {
    return Math.max(
      0,
      BACKGAMMON_GRAPHICS.findIndex(
        (profile) =>
          profile.id === localStorage.getItem(BACKGAMMON_GRAPHICS_KEY)
      )
    );
  } catch {
    return 0;
  }
}
export function backgammonHdriUrls(
  variant: any,
  resolutions: readonly string[]
) {
  if (!variant) return [];
  const explicit = resolutions
    .map((resolution) => variant.assetUrls?.[resolution])
    .filter(Boolean);
  if (variant.assetUrl) explicit.push(variant.assetUrl);
  return [
    ...new Set<string>([
      ...explicit,
      ...resolutions
        .map((resolution) =>
          variant.assetId
            ? `https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/${resolution}/${variant.assetId}_${resolution}.hdr`
            : null
        )
        .filter(Boolean)
    ])
  ];
}
