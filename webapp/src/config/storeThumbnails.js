const POLYHAVEN_THUMB_BASE = 'https://cdn.polyhaven.com/asset_img/thumbs';
const POLYHAVEN_ASSET_ALIASES = {
  rosewood_veneer_01: 'rosewood_veneer1'
};

const resolvePolyHavenId = (id) => POLYHAVEN_ASSET_ALIASES[id] ?? id;

const encodeSvg = (svg) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

export const polyHavenThumb = (id) =>
  `${POLYHAVEN_THUMB_BASE}/${resolvePolyHavenId(id)}.png?width=256&height=256`;

export const khronosThumb = (modelId) =>
  `https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/${modelId}/screenshot/screenshot.jpg`;

export const swatchThumbnail = (colors = []) => {
  const [primary = '#1f2937', secondary = '#0f172a', accent = '#ffffff'] = colors;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${primary}"/>
        <stop offset="100%" stop-color="${secondary}"/>
      </linearGradient>
      <radialGradient id="s" cx="35%" cy="30%" r="70%">
        <stop offset="0%" stop-color="${accent}" stop-opacity="0.6"/>
        <stop offset="100%" stop-color="${secondary}" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="256" height="256" rx="36" fill="url(#g)"/>
    <circle cx="92" cy="82" r="120" fill="url(#s)"/>
    <rect x="40" y="168" width="176" height="12" rx="6" fill="${accent}" opacity="0.35"/>
  </svg>`;
  return encodeSvg(svg);
};
