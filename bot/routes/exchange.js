import { Router } from 'express';

const router = Router();

const COINGECKO_BASE = 'https://api.coingecko.com/api/v3';
const CACHE_TTL_MS = 15_000;
let cache = {
  at: 0,
  markets: []
};

function normalizeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

async function fetchTopMarkets() {
  const now = Date.now();
  if (cache.markets.length && now - cache.at < CACHE_TTL_MS) {
    return cache.markets;
  }

  const url = `${COINGECKO_BASE}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&sparkline=false&price_change_percentage=24h`;
  const res = await fetch(url, {
    headers: {
      accept: 'application/json'
    }
  });

  if (!res.ok) {
    throw new Error(`CoinGecko request failed: ${res.status}`);
  }

  const data = await res.json();
  const markets = (Array.isArray(data) ? data : []).map((coin) => ({
    id: coin.id,
    symbol: String(coin.symbol || '').toUpperCase(),
    name: coin.name,
    image: coin.image,
    currentPriceUsd: normalizeNumber(coin.current_price),
    marketCapUsd: normalizeNumber(coin.market_cap),
    marketCapRank: normalizeNumber(coin.market_cap_rank, 9999),
    priceChange24h: normalizeNumber(coin.price_change_percentage_24h)
  }));

  cache = { at: now, markets };
  return markets;
}

router.get('/markets', async (_req, res) => {
  try {
    const markets = await fetchTopMarkets();
    res.json({ ok: true, updatedAt: new Date(cache.at).toISOString(), markets });
  } catch (error) {
    res.status(502).json({ ok: false, error: error.message || 'Unable to fetch markets' });
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
      pricingSource: 'CoinGecko top-100 market feed',
      quoteTimestamp: new Date(cache.at).toISOString()
    });
  } catch (error) {
    return res.status(502).json({ ok: false, error: error.message || 'Unable to convert' });
  }
});

export default router;
