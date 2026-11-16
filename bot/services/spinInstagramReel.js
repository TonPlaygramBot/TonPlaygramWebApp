const CACHE_MS = 5 * 60_000;
const RETRY_MS = 60_000;

let latestReel = null;
let refreshAfter = 0;
let refresh;

function normalizeReelUrl(value) {
  const match = /^https:\/\/(?:www\.)?instagram\.com\/reels?\/([\w-]+)\/?(?:[?#].*)?$/i.exec(value || '');
  return match ? `https://www.instagram.com/reel/${match[1]}/` : null;
}

async function fetchLatestReel(accessToken) {
  const url = new URL('https://graph.instagram.com/me/media');
  url.search = new URLSearchParams({
    fields: 'permalink,timestamp',
    limit: '50',
    access_token: accessToken,
  });
  const signal = AbortSignal.timeout(4000);

  // The media edge lists recent posts first. Skip photos and other posts,
  // including full pages without a Reel.
  while (true) {
    const response = await fetch(url, { signal, redirect: 'error' });
    if (!response.ok) throw new Error(`Instagram returned HTTP ${response.status}`);
    const { data, paging } = await response.json();
    if (!Array.isArray(data)) throw new Error('Instagram returned invalid media data');

    const reels = data
      .map(({ permalink, timestamp }) => ({ url: normalizeReelUrl(permalink), timestamp }))
      .filter((item) => item.url)
      .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
    if (reels.length) return reels[0].url;

    const after = paging?.cursors?.after;
    if (!paging?.next || !after || after === url.searchParams.get('after')) return null;
    url.searchParams.set('after', after);
  }
}

export async function getSpinInstagramReel() {
  const fallback = normalizeReelUrl(process.env.SPIN_INSTAGRAM_REEL_URL?.trim());
  const token = process.env.SPIN_INSTAGRAM_ACCESS_TOKEN?.trim();
  if (!token) return fallback;

  if (Date.now() >= refreshAfter && !refresh) {
    refresh = fetchLatestReel(token)
      .then((url) => {
        latestReel = url;
        refreshAfter = Date.now() + CACHE_MS;
      })
      .catch(() => {
        // Keep the last known permalink while Meta is unavailable.
        refreshAfter = Date.now() + RETRY_MS;
        console.warn('Could not refresh the Spin rewards Instagram Reel.');
      })
      .finally(() => { refresh = undefined; });
  }

  if (!latestReel && refresh) await refresh;
  return latestReel || fallback;
}
