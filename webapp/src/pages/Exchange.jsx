import { useEffect, useMemo, useState } from 'react';
import {
  getExchangeMarkets,
  getExchangeConversionQuote,
  getExchangeCoinDetails
} from '../utils/api.js';

function formatUsd(v) {
  if (!Number.isFinite(Number(v))) return '...';
  return Number(v).toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 6 });
}

function MiniChart({ points = [] }) {
  if (!points.length) return <p className="text-xs text-subtext">No chart data yet.</p>;
  const values = points.map((p) => Number(p.price || 0));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const path = values
    .map((value, index) => {
      const x = (index / Math.max(values.length - 1, 1)) * 100;
      const y = 100 - ((value - min) / range) * 100;
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');

  return (
    <svg viewBox="0 0 100 100" className="w-full h-24">
      <path d={path} fill="none" stroke="#22c55e" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

export default function Exchange() {
  const [markets, setMarkets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatedAt, setUpdatedAt] = useState('');
  const [selectedCoinId, setSelectedCoinId] = useState('');
  const [coinDetail, setCoinDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

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

  const loadCoinDetail = async (coinId) => {
    setSelectedCoinId(coinId);
    setDetailLoading(true);
    const detailRes = await getExchangeCoinDetails(coinId);
    if (detailRes?.error) {
      setCoinDetail(null);
      setError(detailRes.error);
      setDetailLoading(false);
      return;
    }
    setCoinDetail(detailRes.detail || null);
    setDetailLoading(false);
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
          Live top 100 market-cap coins with 10s refresh. Tap any coin to open a 7-day chart and live metrics from CoinGecko.
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

      {coinDetail && (
        <div className="bg-surface border border-border rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">{coinDetail.name} ({coinDetail.symbol})</h2>
            <button className="text-xs text-subtext hover:text-white" onClick={() => setCoinDetail(null)}>Close</button>
          </div>
          <MiniChart points={coinDetail.chart7d} />
          <div className="grid grid-cols-2 gap-2 text-xs">
            <p>Price: <span className="text-white">{formatUsd(coinDetail.currentPriceUsd)}</span></p>
            <p>Market Cap: <span className="text-white">{formatUsd(coinDetail.marketCapUsd)}</span></p>
            <p>24h High: <span className="text-white">{formatUsd(coinDetail.high24hUsd)}</span></p>
            <p>24h Low: <span className="text-white">{formatUsd(coinDetail.low24hUsd)}</span></p>
          </div>
          {coinDetail.homepage && (
            <a className="text-xs text-primary underline" href={coinDetail.homepage} target="_blank" rel="noreferrer">Official website</a>
          )}
        </div>
      )}

      <div className="bg-surface border border-border rounded-xl p-4">
        <h2 className="text-lg font-semibold text-white mb-3">Top 100 Coins (Market Cap)</h2>
        {loading && <p className="text-sm text-subtext">Loading market feed…</p>}
        {error && <p className="text-sm text-red-300">{error}</p>}
        <div className="space-y-2 max-h-[60vh] overflow-auto pr-1">
          {sorted.map((coin) => (
            <button
              key={coin.id}
              type="button"
              onClick={() => loadCoinDetail(coin.id)}
              className={`w-full flex items-center justify-between rounded-lg bg-background/50 border px-3 py-2 text-left ${selectedCoinId === coin.id ? 'border-primary' : 'border-border'}`}
            >
              <div className="flex items-center gap-2 min-w-0">
                {coin.image ? (
                  <img src={coin.image} alt={coin.symbol} className="w-6 h-6 rounded-full" />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-surface border border-border" />
                )}
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
            </button>
          ))}
        </div>
        {detailLoading && <p className="text-xs text-amber-300 mt-2">Loading selected coin details...</p>}
      </div>
    </div>
  );
}
