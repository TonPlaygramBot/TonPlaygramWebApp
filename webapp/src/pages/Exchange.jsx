import { useEffect, useMemo, useState } from 'react';
import { getExchangeMarkets, getExchangeConversionQuote } from '../utils/api.js';

const FALLBACK_SYMBOLS = [
  'BTC','ETH','USDT','BNB','SOL','XRP','USDC','DOGE','ADA','TRX','TON','AVAX','SHIB','DOT','BCH','LINK','LEO','XLM','NEAR','MATIC',
  'LTC','DAI','UNI','PEPE','ICP','APT','ETC','HBAR','CRO','TAO','ARB','FIL','KAS','RENDER','MNT','OP','STX','ATOM','XMR','IMX',
  'SUI','MKR','AAVE','INJ','WIF','FDUSD','THETA','GRT','RUNE','FET','ALGO','BONK','LDO','JUP','QNT','FLOW','SEI','BTT','EGLD','XTZ',
  'MANA','SAND','JASMY','AXS','HNT','PYTH','BEAM','CHZ','CFX','WLD','GALA','ENS','KCS','DYDX','ORDI','NEO','FTM','EOS','PENDLE','COMP',
  'RAY','SNX','IOTA','ZEC','AKT','RSR','KAVA','1INCH','MINA','DASH','NEXO','ZRO','W','BLUR','APE','GMX','HOT','TWT','BAT','ZIL'
];

function fallbackMarketList() {
  return FALLBACK_SYMBOLS.map((symbol, index) => ({
    id: symbol.toLowerCase(),
    symbol,
    name: symbol,
    image: '/assets/icons/TON.webp',
    currentPriceUsd: 0,
    marketCapUsd: 0,
    marketCapRank: index + 1,
    priceChange24h: 0
  }));
}

function formatUsd(v) {
  if (!Number.isFinite(Number(v))) return '...';
  return Number(v).toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 6 });
}

export default function Exchange() {
  const [markets, setMarkets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatedAt, setUpdatedAt] = useState('');

  const [symbol, setSymbol] = useState('TON');
  const [amount, setAmount] = useState('1');
  const [quote, setQuote] = useState(null);

  const sorted = useMemo(() => [...markets].sort((a, b) => (a.marketCapRank || 9999) - (b.marketCapRank || 9999)), [markets]);

  const refresh = async () => {
    setError('');
    try {
      const data = await getExchangeMarkets();
      if (data?.error) throw new Error(data.error);
      const list = Array.isArray(data.markets) ? data.markets : [];
      if (!list.length) throw new Error('No market data returned by API');
      setMarkets(list);
      setUpdatedAt(data.updatedAt || new Date().toISOString());
    } catch (err) {
      try {
        const fallbackRes = await fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&sparkline=false&price_change_percentage=24h');
        const fallback = await fallbackRes.json();
        const list = (Array.isArray(fallback) ? fallback : []).map((coin) => ({
          id: coin.id,
          symbol: String(coin.symbol || '').toUpperCase(),
          name: coin.name,
          image: coin.image,
          currentPriceUsd: Number(coin.current_price) || 0,
          marketCapUsd: Number(coin.market_cap) || 0,
          marketCapRank: Number(coin.market_cap_rank) || 9999,
          priceChange24h: Number(coin.price_change_percentage_24h) || 0
        }));
        setMarkets(list);
        setUpdatedAt(new Date().toISOString());
        setError('Backend market feed unavailable, showing direct provider data.');
      } catch {
        setMarkets(fallbackMarketList());
        setUpdatedAt(new Date().toISOString());
        setError('Live market feed unavailable. Showing fallback top-100 list until connectivity is restored.');
      }
    } finally {
      setLoading(false);
    }
  };

  const convert = async () => {
    setError('');
    const data = await getExchangeConversionQuote(symbol, amount);
    if (data?.error) {
      setQuote(null);
      setError(data.error);
      return;
    }
    setQuote(data);
  };

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 10_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="space-y-4 p-3 pb-20">
      <div className="bg-surface border border-border rounded-xl p-4 space-y-2">
        <h1 className="text-xl font-semibold text-white">Exchange Infrastructure (Ready)</h1>
        <p className="text-xs text-subtext">
          Live top 100 market-cap coins with 10s refresh. TPC conversion uses a configurable reference price until live markets are active.
        </p>
        <p className="text-[11px] text-green-300">Last update: {updatedAt ? new Date(updatedAt).toLocaleTimeString() : '...'}</p>
      </div>

      <div className="bg-surface border border-border rounded-xl p-4 space-y-3">
        <h2 className="text-lg font-semibold text-white">Convert to TPC</h2>
        <div className="flex gap-2">
          <input
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            className="bg-background border border-border rounded px-3 py-2 w-24"
            placeholder="TON"
          />
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="bg-background border border-border rounded px-3 py-2 flex-1"
            placeholder="Amount"
          />
          <button onClick={convert} className="px-4 py-2 bg-primary text-black rounded font-semibold">Quote</button>
        </div>
        {quote && (
          <div className="text-sm rounded-lg border border-border bg-background/60 p-3 space-y-1">
            <p>Pair: {quote.fromSymbol} → TPC</p>
            <p>Input value: {quote.amount} {quote.fromSymbol} ({formatUsd(quote.usdValue)})</p>
            <p>TPC estimate: <span className="text-green-300 font-semibold">{Number(quote.estimatedTpc).toLocaleString(undefined, { maximumFractionDigits: 4 })} TPC</span></p>
          </div>
        )}
      </div>

      <div className="bg-surface border border-border rounded-xl p-4">
        <h2 className="text-lg font-semibold text-white mb-3">Top 100 Coins (Market Cap)</h2>
        {loading && <p className="text-sm text-subtext">Loading market feed…</p>}
        {error && <p className="text-sm text-red-300">{error}</p>}
        <div className="space-y-2 max-h-[60vh] overflow-auto pr-1">
          {sorted.map((coin) => (
            <div key={coin.id} className="flex items-center justify-between rounded-lg bg-background/50 border border-border px-3 py-2">
              <div className="flex items-center gap-2 min-w-0">
                <img src={coin.image} alt={coin.symbol} className="w-6 h-6 rounded-full" />
                <div className="min-w-0">
                  <p className="text-sm text-white truncate">#{coin.marketCapRank} {coin.name} ({coin.symbol})</p>
                  <p className="text-[11px] text-subtext truncate">MCap: {formatUsd(coin.marketCapUsd)}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-white">{formatUsd(coin.currentPriceUsd)}</p>
                <p className={`text-[11px] ${Number(coin.priceChange24h) >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                  {Number(coin.priceChange24h || 0).toFixed(2)}%
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
