// Capacitor serves installed applications from a local, non-HTTP origin. The
// origin is still trustworthy: it can only be produced by the installed app,
// while browser pages cannot claim a capacitor:// or ionic:// origin.
export const nativeAppOrigins = new Set([
  'capacitor://localhost',
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
