// Official Facebook Login Graph API only. Aggregate marketing telemetry is never
// a reward entitlement, and this module does not read or write player data.
const ORIGIN = 'https://graph.facebook.com';
const VERSION = 'v27.0';
const ACCOUNT_FIELDS = 'id,followers_count';
const REEL_FIELDS = 'id,owner,media_product_type,total_views_count,shares_count,total_comments_count';
const METRICS_SOURCE = 'meta-aggregate';
const isId = value => typeof value === 'string' && /^[1-9]\d{0,39}$/.test(value);
const count = value => Number.isSafeInteger(value) && value >= 0 ? value : null;

const readGraph = async (id, fields, token, fetchImpl) => {
  const url = new URL(`/${VERSION}/${id}`, ORIGIN);
  url.searchParams.set('fields', fields);
  try {
    const response = await fetchImpl(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      redirect: 'error',
      signal: AbortSignal.timeout(6_000)
    });
    if (!response.ok) throw new Error('Non-success response');
    const data = await response.json();
    if (!data || typeof data !== 'object' || data.error) throw new Error('Invalid response');
    return data;
  } catch {
    // Provider errors might contain credential or response details. Do not
    // pass them on to logs or any caller.
    throw new Error('Instagram marketing data unavailable');
  }
};

export async function readInstagramMarketingSnapshot({
  accountId, mediaId, token, fetchImpl = globalThis.fetch, now = () => new Date()
} = {}) {
  if (!isId(accountId) || !isId(mediaId) || typeof token !== 'string' || !token.trim()) {
    throw new Error('Instagram marketing monitoring not configured');
  }
  const [account, reel] = await Promise.all([
    readGraph(accountId, ACCOUNT_FIELDS, token, fetchImpl),
    readGraph(mediaId, REEL_FIELDS, token, fetchImpl)
  ]);
  if (account.id !== accountId || reel.id !== mediaId || reel.owner?.id !== accountId ||
      reel.media_product_type !== 'REELS') {
    throw new Error('Instagram account or Reel ownership not verified');
  }
  return {
    source: METRICS_SOURCE,
    observedAt: now().toISOString(),
    mediaId,
    followers: count(account.followers_count),
    views: count(reel.total_views_count),
    comments: count(reel.total_comments_count),
    shares: count(reel.shares_count)
  };
}
