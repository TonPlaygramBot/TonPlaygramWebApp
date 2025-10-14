const SNOKER_CUE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="192" height="480" viewBox="0 0 192 480">
  <defs>
    <linearGradient id="gShaft" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0%" stop-color="#f8e4c5" />
      <stop offset="35%" stop-color="#f0d1a0" />
      <stop offset="75%" stop-color="#c78f47" />
      <stop offset="100%" stop-color="#8b5a2b" />
    </linearGradient>
    <linearGradient id="gButt" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0%" stop-color="#2a2a2a" />
      <stop offset="50%" stop-color="#111" />
      <stop offset="100%" stop-color="#2a2a2a" />
    </linearGradient>
    <linearGradient id="gRing" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0%" stop-color="#fdf2ce" />
      <stop offset="100%" stop-color="#d9c48a" />
    </linearGradient>
  </defs>
  <g fill="none" fill-rule="evenodd">
    <rect x="88" y="12" width="16" height="360" rx="8" fill="url(#gShaft)" />
    <rect x="72" y="372" width="48" height="72" rx="10" fill="url(#gRing)" />
    <rect x="60" y="432" width="72" height="36" rx="12" fill="url(#gButt)" />
    <rect x="86" y="0" width="20" height="16" rx="8" fill="#fdf3dd" />
    <rect x="90" y="4" width="12" height="12" rx="6" fill="#fff" />
    <path d="M96 396c-6.627 0-12 5.373-12 12s5.373 12 12 12 12-5.373 12-12-5.373-12-12-12z" fill="#5c3317" opacity="0.35" />
  </g>
</svg>`;

export const SNOOKER_CUE_DATA_URI = `data:image/svg+xml,${encodeURIComponent(SNOKER_CUE_SVG)}`;
