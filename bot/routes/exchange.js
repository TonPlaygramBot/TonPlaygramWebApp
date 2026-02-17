import { Router } from 'express';

const router = Router();

const CACHE_TTL_MS = 15_000;
let cache = {
  at: 0,
  markets: []
};

function normalizeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

async function fetchFromCoinGecko() {
  const url = 'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&sparkline=false&price_change_percentage=24h';
  const res = await fetch(url, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`CoinGecko failed: ${res.status}`);
  const data = await res.json();
  return (Array.isArray(data) ? data : []).map((coin) => ({
    id: coin.id,
    symbol: String(coin.symbol || '').toUpperCase(),
    name: coin.name,
    image: coin.image,
    currentPriceUsd: normalizeNumber(coin.current_price),
    marketCapUsd: normalizeNumber(coin.market_cap),
    marketCapRank: normalizeNumber(coin.market_cap_rank, 9999),
    priceChange24h: normalizeNumber(coin.price_change_percentage_24h)
  }));
}

async function fetchFromCoinCap() {
  const res = await fetch('https://api.coincap.io/v2/assets?limit=100');
  if (!res.ok) throw new Error(`CoinCap failed: ${res.status}`);
  const body = await res.json();
  const list = Array.isArray(body?.data) ? body.data : [];
  return list.map((coin, idx) => ({
    id: coin.id,
    symbol: String(coin.symbol || '').toUpperCase(),
    name: coin.name,
    image: '',
    currentPriceUsd: normalizeNumber(coin.priceUsd),
    marketCapUsd: normalizeNumber(coin.marketCapUsd),
    marketCapRank: normalizeNumber(coin.rank, idx + 1),
    priceChange24h: normalizeNumber(coin.changePercent24Hr)
  }));
}


async function fetchCoinDetail(coinId) {
  const [detailRes, chartRes] = await Promise.all([
    fetch(`https://api.coingecko.com/api/v3/coins/${encodeURIComponent(coinId)}?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false&sparkline=false`, { headers: { accept: 'application/json' } }),
    fetch(`https://api.coingecko.com/api/v3/coins/${encodeURIComponent(coinId)}/market_chart?vs_currency=usd&days=7&interval=daily`, { headers: { accept: 'application/json' } })
  ]);

  if (!detailRes.ok) throw new Error(`Coin detail failed: ${detailRes.status}`);
  if (!chartRes.ok) throw new Error(`Coin chart failed: ${chartRes.status}`);

  const detail = await detailRes.json();
  const chart = await chartRes.json();

  return {
    id: detail.id,
    symbol: String(detail.symbol || '').toUpperCase(),
    name: detail.name,
    image: detail.image?.large || detail.image?.small || '',
    description: detail.description?.en || '',
    homepage: detail.links?.homepage?.[0] || '',
    marketCapRank: normalizeNumber(detail.market_cap_rank, 9999),
    currentPriceUsd: normalizeNumber(detail.market_data?.current_price?.usd),
    marketCapUsd: normalizeNumber(detail.market_data?.market_cap?.usd),
    totalVolumeUsd: normalizeNumber(detail.market_data?.total_volume?.usd),
    high24hUsd: normalizeNumber(detail.market_data?.high_24h?.usd),
    low24hUsd: normalizeNumber(detail.market_data?.low_24h?.usd),
    athUsd: normalizeNumber(detail.market_data?.ath?.usd),
    atlUsd: normalizeNumber(detail.market_data?.atl?.usd),
    chart7d: Array.isArray(chart?.prices)
      ? chart.prices.map(([timestamp, price]) => ({ timestamp, price: normalizeNumber(price) }))
      : []
  };
}

async function fetchTopMarkets() {
  const now = Date.now();
  if (cache.markets.length && now - cache.at < CACHE_TTL_MS) {
    return cache.markets;
  }

  let markets = [];
  try {
    markets = await fetchFromCoinGecko();
  } catch (error) {
    console.warn('[exchange] CoinGecko unavailable, trying CoinCap:', error?.message || error);
    markets = await fetchFromCoinCap();
  }

  if (!markets.length && cache.markets.length) {
    return cache.markets;
  }

  cache = { at: now, markets };
  return markets;
}

router.get('/markets', async (_req, res) => {
  try {
    const markets = await fetchTopMarkets();
    return res.json({ ok: true, updatedAt: new Date(cache.at).toISOString(), markets });
  } catch (error) {
    if (cache.markets.length) {
      return res.json({ ok: true, updatedAt: new Date(cache.at).toISOString(), markets: cache.markets, stale: true });
    }
    return res.status(502).json({ ok: false, error: error.message || 'Unable to fetch markets' });
  }
});


router.get('/coins/:coinId', async (req, res) => {
  try {
    const coinId = String(req.params.coinId || '').trim();
    if (!coinId) {
      return res.status(400).json({ ok: false, error: 'coinId is required' });
    }
    const detail = await fetchCoinDetail(coinId);
    return res.json({ ok: true, detail, updatedAt: new Date().toISOString() });
  } catch (error) {
    return res.status(502).json({ ok: false, error: error.message || 'Unable to fetch coin details' });
  }
});

router.get('/convert', async (req, res) => {
  try {
    const fromSymbol = String(req.query.from || 'TON').toUpperCase();
    const amount = normalizeNumber(req.query.amount, 0);
    const tpcPriceUsd = normalizeNumber(process.env.TPC_REFERENCE_PRICE_USD, 0.02);

    if (!amount || amount <= 0) {
      return res.status(400).json({ ok: false, error: 'amount must be > 0' });
    }
    if (!tpcPriceUsd || tpcPriceUsd <= 0) {
      return res.status(500).json({ ok: false, error: 'TPC reference price is invalid' });
    }

    const markets = await fetchTopMarkets();
    const from = markets.find((coin) => coin.symbol === fromSymbol);
    if (!from) {
      return res.status(404).json({ ok: false, error: `Symbol ${fromSymbol} not found in top 100 list` });
    }

    const usdValue = amount * from.currentPriceUsd;
    const estimatedTpc = usdValue / tpcPriceUsd;

    return res.json({
      ok: true,
      fromSymbol,
      amount,
      fromPriceUsd: from.currentPriceUsd,
      usdValue,
      tpcReferencePriceUsd: tpcPriceUsd,
      estimatedTpc,
      quoteTimestamp: new Date(cache.at).toISOString()
    });
  } catch (error) {
    return res.status(502).json({ ok: false, error: error.message || 'Unable to convert' });
  }
});

export default router;
