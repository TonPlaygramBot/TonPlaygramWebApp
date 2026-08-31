// Older wall records can contain the absolute hostname that served the upload
// at the time it was published. Always route our own media paths through the
// current API host; concatenating an absolute legacy URL produces an invalid
// URL and following the legacy host can fail after a deployment migration.
export function resolveWallMediaUrl(apiBaseUrl, storedUrl) {
  const value = String(storedUrl || '').trim();
  if (!value || value.startsWith('blob:') || value.startsWith('data:')) return value;

  try {
    const parsed = new URL(value, 'https://wall.local');
    if (parsed.pathname.startsWith('/api/flamingo-wall/')) {
      return `${String(apiBaseUrl || '').replace(/\/$/, '')}${parsed.pathname}${parsed.search}`;
    }
    if (/^https?:$/i.test(parsed.protocol) && parsed.origin !== 'https://wall.local') return parsed.href;
  } catch {
    // Preserve unusual browser-supported sources rather than making them
    // unplayable while normal API paths continue through the branch below.
  }

  return `${String(apiBaseUrl || '').replace(/\/$/, '')}/${value.replace(/^\/+/, '')}`;
}
