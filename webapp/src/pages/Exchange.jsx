import { useEffect, useMemo, useState } from 'react';
import { getExchangeMarkets, getExchangeConversionQuote, getExchangeCoinDetails } from '../utils/api.js';

function formatUsd(v) {
  if (!Number.isFinite(Number(v))) return '...';
  return Number(v).toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 6 });
}

function Sparkline({ points = [] }) {
  if (!points.length) return <p className="text-xs text-subtext">Chart data unavailable.</p>;
  const prices = points.map((p) => Number(p.priceUsd)).filter((v) => Number.isFinite(v));
  if (!prices.length) return <p className="text-xs text-subtext">Chart data unavailable.</p>;
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;
  const coords = prices.map((p, i) => {
    const x = (i / Math.max(prices.length - 1, 1)) * 100;
    const y = 100 - ((p - min) / range) * 100;
    return `${x},${y}`;
  }).join(' ');

  return (
    <div className="space-y-1">
      <svg viewBox="0 0 100 100" className="w-full h-28 rounded bg-background/60 border border-border" preserveAspectRatio="none">
        <polyline points={coords} fill="none" stroke="#22d3ee" strokeWidth="2" />
      </svg>
      <div className="flex items-center justify-between text-[11px] text-subtext">
        <span>7d low: {formatUsd(min)}</span>
        <span>7d high: {formatUsd(max)}</span>
      </div>
    </div>
  );
}

export default function Exchange() {
  const [markets, setMarkets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatedAt, setUpdatedAt] = useState('');
  const [selectedCoin, setSelectedCoin] = useState(null);
  const [coinDetails, setCoinDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  const [symbol, setSymbol] = useState('TON');
  const [amount, setAmount] = useState('1');
  const [quote, setQuote] = useState(null);

  const sorted = useMemo(() => [...markets].sort((a, b) => (a.marketCapRank || 9999) - (b.marketCapRank || 9999)), [markets]);

  const refresh = async () => {
    setError('');
    try {
      const data = await getExchangeMarkets();
      if (data?.error) throw new Error(data.error);
      setMarkets(data.markets || []);
      setUpdatedAt(data.updatedAt || new Date().toISOString());
    } catch (err) {
      setError(err.message || 'Unable to load prices');
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

  const loadCoin = async (coin) => {
    setSelectedCoin(coin);
    setCoinDetails(null);
    setDetailsLoading(true);
    try {
      const data = await getExchangeCoinDetails(coin.id);
      if (data?.error) throw new Error(data.error);
      setCoinDetails(data.coin || null);
    } catch (err) {
      setError(err.message || 'Failed to load coin details');
    } finally {
      setDetailsLoading(false);
    }
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
          Live top 100 market-cap coins with 10s refresh. Tap any coin to open live chart + details from CoinGecko.
        </p>
        <p className="text-[11px] text-green-300">Last update: {updatedAt ? new Date(updatedAt).toLocaleTimeString() : '...'}</p>
      </div>

      <div className="bg-surface border border-border rounded-xl p-4 space-y-3">
        <h2 className="text-lg font-semibold text-white">Convert to TPC</h2>
        <div className="flex gap-2">
          <input value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} className="bg-background border border-border rounded px-3 py-2 w-24" placeholder="TON" />
          <input value={amount} onChange={(e) => setAmount(e.target.value)} className="bg-background border border-border rounded px-3 py-2 flex-1" placeholder="Amount" />
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
        <h2 className="text-lg font-semibold text-white mb-1">Top 100 Coins (Market Cap)</h2>
        <p className="text-[11px] text-subtext mb-3">Loaded: {sorted.length}/100 coins</p>
        {loading && <p className="text-sm text-subtext">Loading market feed…</p>}
        {error && <p className="text-sm text-red-300">{error}</p>}
        <div className="space-y-2 max-h-[60vh] overflow-auto pr-1">
          {sorted.map((coin) => (
            <button key={coin.id} onClick={() => loadCoin(coin)} className="w-full flex items-center justify-between rounded-lg bg-background/50 border border-border px-3 py-2 text-left">
              <div className="flex items-center gap-2 min-w-0">
                {coin.image ? <img src={coin.image} alt={coin.symbol} className="w-6 h-6 rounded-full" /> : <div className="w-6 h-6 rounded-full bg-background border border-border" />}
                <div className="min-w-0">
                  <p className="text-sm text-white truncate">#{coin.marketCapRank} {coin.name} ({coin.symbol})</p>
                  <p className="text-[11px] text-subtext truncate">MCap: {formatUsd(coin.marketCapUsd)}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-white">{formatUsd(coin.currentPriceUsd)}</p>
                <p className={`text-[11px] ${Number(coin.priceChange24h) >= 0 ? 'text-green-300' : 'text-red-300'}`}>{Number(coin.priceChange24h || 0).toFixed(2)}%</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {selectedCoin && (
        <div className="fixed inset-0 z-50 bg-black/70 p-4 flex items-end sm:items-center justify-center" onClick={() => setSelectedCoin(null)}>
          <div className="w-full max-w-xl bg-surface border border-border rounded-xl p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">{selectedCoin.name} ({selectedCoin.symbol})</h3>
              <button onClick={() => setSelectedCoin(null)} className="text-xs px-2 py-1 border border-border rounded">Close</button>
            </div>
            {detailsLoading && <p className="text-sm text-subtext">Loading chart + info…</p>}
            {coinDetails && (
              <>
                <Sparkline points={coinDetails.chart} />
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded border border-border bg-background/50 p-2">Price: {formatUsd(coinDetails.currentPriceUsd)}</div>
                  <div className="rounded border border-border bg-background/50 p-2">24h Vol: {formatUsd(coinDetails.volume24hUsd)}</div>
                  <div className="rounded border border-border bg-background/50 p-2">ATH: {formatUsd(coinDetails.athUsd)}</div>
                  <div className="rounded border border-border bg-background/50 p-2">ATL: {formatUsd(coinDetails.atlUsd)}</div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
