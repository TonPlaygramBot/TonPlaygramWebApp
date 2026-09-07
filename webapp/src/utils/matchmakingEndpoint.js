export function resolveChessEndpoint({ configured, apiBase, pageUrl, native = false }) {
  const page = new URL(pageUrl);
  const api = new URL(apiBase || page.origin);
  const fallback = new URL('/colyseus', api);
  let endpoint = new URL(configured || fallback.href, api);
  // Older Render environment values can outlive a Blueprint sync.
  if (endpoint.hostname === 'tonplaygram-chess-matchmaking.onrender.com') endpoint = fallback;
  const isLocal = (hostname) => ['localhost', '127.0.0.1', '[::1]'].includes(hostname);
  if ((native || !isLocal(page.hostname)) && isLocal(endpoint.hostname)) endpoint = fallback;
  if (!['http:', 'https:', 'ws:', 'wss:'].includes(endpoint.protocol)) {
    throw new Error('Matchmaking requires an HTTP or WebSocket address');
  }
  endpoint.protocol = endpoint.protocol === 'https:' || endpoint.protocol === 'wss:' || page.protocol === 'https:' ? 'wss:' : 'ws:';
  return endpoint.toString().replace(/\/$/, '');
}
