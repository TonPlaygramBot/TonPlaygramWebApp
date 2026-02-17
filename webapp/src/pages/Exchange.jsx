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

function buildPath(points, width = 320, height = 120) {
  if (!Array.isArray(points) || points.length < 2) return '';
  const prices = points.map((point) => Number(point.price)).filter(Number.isFinite);
  if (prices.length < 2) return '';
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const span = max - min || 1;
  return points
    .map((point, index) => {
      const x = (index / (points.length - 1)) * width;
      const y = height - ((Number(point.price) - min) / span) * height;
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');
}

export default function Exchange() {
  const [markets, setMarkets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatedAt, setUpdatedAt] = useState('');

  const [symbol, setSymbol] = useState('TON');
  const [amount, setAmount] = useState('1');
  const [quote, setQuote] = useState(null);

  const [selectedCoinId, setSelectedCoinId] = useState('');
  const [selectedCoin, setSelectedCoin] = useState(null);
  const [coinLoading, setCoinLoading] = useState(false);

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

  const openCoin = async (coin) => {
    setSelectedCoinId(coin.id);
    setSelectedCoin(null);
    setCoinLoading(true);
    const data = await getExchangeCoinDetails(coin.id);
    if (data?.error) {
      setError(data.error);
      setCoinLoading(false);
      return;
    }
    setSelectedCoin(data.coin);
    setCoinLoading(false);
  };

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 10_000);
    return () => clearInterval(id);
  }, []);

  const chartPath = buildPath(selectedCoin?.prices || []);

  return (
    <div className="space-y-4 p-3 pb-20">
      <div className="bg-surface border border-border rounded-xl p-4 space-y-2">
        <h1 className="text-xl font-semibold text-white">Exchange Infrastructure (Ready)</h1>
        <p className="text-xs text-subtext">
          Live top 100 market-cap coins with 10s refresh. Tap any coin to open real-time chart data and profile details from CoinGecko.
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
            <button
              key={coin.id}
              type="button"
              onClick={() => openCoin(coin)}
              className="w-full flex items-center justify-between rounded-lg bg-background/50 border border-border px-3 py-2 text-left hover:bg-background/70"
            >
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
            </button>
          ))}
        </div>
      </div>

      {selectedCoinId && (
        <div className="fixed inset-0 z-50 bg-black/70 p-4 flex items-end sm:items-center justify-center" onClick={() => setSelectedCoinId('')}>
          <div className="w-full max-w-xl bg-surface border border-border rounded-2xl p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
            {coinLoading || !selectedCoin ? (
              <p className="text-sm text-subtext">Loading coin details…</p>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <img src={selectedCoin.image} alt={selectedCoin.symbol} className="w-8 h-8 rounded-full" />
                  <div>
                    <p className="text-white font-semibold">{selectedCoin.name} ({selectedCoin.symbol})</p>
                    <p className="text-xs text-subtext">Rank #{selectedCoin.marketCapRank}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <p className="rounded bg-background/60 border border-border p-2">Price: <span className="text-white">{formatUsd(selectedCoin.currentPriceUsd)}</span></p>
                  <p className="rounded bg-background/60 border border-border p-2">MCap: <span className="text-white">{formatUsd(selectedCoin.marketCapUsd)}</span></p>
                  <p className="rounded bg-background/60 border border-border p-2">24h High: <span className="text-white">{formatUsd(selectedCoin.high24hUsd)}</span></p>
                  <p className="rounded bg-background/60 border border-border p-2">24h Low: <span className="text-white">{formatUsd(selectedCoin.low24hUsd)}</span></p>
                </div>
                <div className="rounded-lg border border-border bg-background/40 p-2">
                  <p className="text-xs text-subtext mb-2">7D price chart</p>
                  {chartPath ? (
                    <svg viewBox="0 0 320 120" className="w-full h-28">
                      <path d={chartPath} fill="none" stroke="#22d3ee" strokeWidth="2" />
                    </svg>
                  ) : (
                    <p className="text-xs text-subtext">Chart unavailable for this coin.</p>
                  )}
                </div>
                {selectedCoin.homepage && (
                  <a href={selectedCoin.homepage} target="_blank" rel="noreferrer" className="text-primary text-xs underline">Open project website</a>
                )}
              </>
            )}
            <button onClick={() => setSelectedCoinId('')} className="w-full py-2 rounded bg-primary text-black font-semibold">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
