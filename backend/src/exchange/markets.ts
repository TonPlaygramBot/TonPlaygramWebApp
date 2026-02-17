const COINGECKO_MARKETS = 'https://api.coingecko.com/api/v3/coins/markets';

type MarketRow = {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  market_cap: number;
  price_change_percentage_24h: number;
};

let cache: { at: number; data: MarketRow[] } | null = null;

export async function fetchTopMarkets(): Promise<MarketRow[]> {
  if (cache && Date.now() - cache.at < 10_000) return cache.data;

  const url = new URL(COINGECKO_MARKETS);
  url.searchParams.set('vs_currency', 'usd');
  url.searchParams.set('order', 'market_cap_desc');
  url.searchParams.set('per_page', '100');
  url.searchParams.set('page', '1');
  url.searchParams.set('sparkline', 'false');

  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch markets');
  const data = (await res.json()) as MarketRow[];
  cache = { at: Date.now(), data };
  return data;
}

export async function getConversionQuote(symbol: string, amount: number, tpcUsdPrice: number) {
  const markets = await fetchTopMarkets();
  const market = markets.find((m) => m.symbol.toLowerCase() === symbol.toLowerCase());
  if (!market) throw new Error('Symbol not found in top 100 markets');

  const usdValue = amount * market.current_price;
  const tpcAmount = usdValue / tpcUsdPrice;

  return {
    from: symbol.toUpperCase(),
    amount,
    fromUsdPrice: market.current_price,
    usdValue,
    tpcUsdPrice,
    tpcAmount,
    timestamp: new Date().toISOString(),
  };
}
