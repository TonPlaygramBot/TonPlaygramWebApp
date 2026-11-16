const CACHE_MS = 5 * 60_000;
const RETRY_MS = 60_000;

let latestReel = null;
let refreshAfter = 0;
let refresh;

function normalizeReelUrl(value) {
  const match = /^https:\/\/(?:www\.)?instagram\.com\/reels?\/([\w-]+)\/?(?:[?#].*)?$/i.exec(value || '');
  return match ? `https://www.instagram.com/reel/${match[1]}/` : null;
}

function normalizeMediaUrl(value) {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

async function fetchLatestReel(accessToken) {
  const url = new URL('https://graph.instagram.com/me/media');
  url.search = new URLSearchParams({
    fields: 'permalink,timestamp,media_type,media_url,thumbnail_url',
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
      .filter((item) => item?.media_type === 'VIDEO')
      .map((item) => ({ ...item, reelUrl: normalizeReelUrl(item.permalink) }))
      .filter((item) => item.reelUrl)
      .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
    if (reels.length) {
      const reel = reels[0];
      // Some Reels have no direct media URL. Keep the latest Reel available
      // through its embed instead of substituting an older video.
      return {
        reelUrl: reel.reelUrl,
        mediaUrl: normalizeMediaUrl(reel.media_url),
        thumbnailUrl: normalizeMediaUrl(reel.thumbnail_url),
      };
    }

    const after = paging?.cursors?.after;
    if (!paging?.next || !after || after === url.searchParams.get('after')) return null;
    url.searchParams.set('after', after);
  }
}

export async function getSpinInstagramReel() {
  const fallback = {
    reelUrl: normalizeReelUrl(process.env.SPIN_INSTAGRAM_REEL_URL?.trim()),
    mediaUrl: null,
    thumbnailUrl: null,
  };
  const token = process.env.SPIN_INSTAGRAM_ACCESS_TOKEN?.trim();
  if (!token) return fallback;

  if (Date.now() >= refreshAfter && !refresh) {
    refresh = fetchLatestReel(token)
      .then((reel) => {
        latestReel = reel;
        refreshAfter = Date.now() + CACHE_MS;
      })
      .catch(() => {
        // Keep the last known Reel while Meta is unavailable.
        refreshAfter = Date.now() + RETRY_MS;
        console.warn('Could not refresh the Spin rewards Instagram Reel.');
      })
      .finally(() => { refresh = undefined; });
  }

  // Refresh media URLs before opening playback, since CDN URLs can change.
  if (refresh) await refresh;
  return latestReel || fallback;
}
