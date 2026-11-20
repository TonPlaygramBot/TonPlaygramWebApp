// Exact origins used by the native WebViews. CORS permission is not proof of
// application identity or authentication: non-browser clients can forge Origin.
// Authentication and authorization must still be enforced on each API route.
export const nativeAppOrigins = new Set([
  'capacitor://localhost',
  // capacitor.config.ts uses this hostname and the default iOS capacitor scheme.
  'capacitor://tonplaygram-bot.onrender.com',
  'ionic://localhost',
  'http://localhost'
]);

export function isAllowedApiOrigin(origin, allowedOrigins = [], production = false) {
  if (!origin) return true;
  if (nativeAppOrigins.has(origin) || allowedOrigins.includes(origin)) return true;
  if (production) return false;

  try {
    const { hostname } = new URL(origin);
    return hostname === 'localhost' || hostname === '127.0.0.1';
  } catch {
    return false;
  }
}
