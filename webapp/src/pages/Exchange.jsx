import { useEffect, useMemo, useState } from 'react';
import { getExchangeMarkets, getExchangeConversionQuote } from '../utils/api.js';

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
