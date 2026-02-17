import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';

type Market = {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  market_cap: number;
  price_change_percentage_24h: number;
};

export function ExchangePage() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [amount, setAmount] = useState('1');
  const [symbol, setSymbol] = useState('btc');
  const [quote, setQuote] = useState<any>();

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const data = await api<{ ok: true; markets: Market[] }>('/api/exchange/markets');
      if (alive) {
        setMarkets(data.markets);
        if (!data.markets.find((m) => m.symbol === symbol) && data.markets.length) setSymbol(data.markets[0].symbol);
      }
    };
    load();
    const t = setInterval(load, 10000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [symbol]);

  const top = useMemo(() => markets.slice(0, 100), [markets]);

  const convert = async () => {
    const data = await api<{ ok: true; quote: any }>('/api/exchange/quote', {
      method: 'POST',
      body: JSON.stringify({ fromSymbol: symbol, amount: Number(amount) }),
    });
    setQuote(data.quote);
  };

  return (
    <div>
      <h2>Exchange (Top 100, realtime)</h2>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount" />
        <select value={symbol} onChange={(e) => setSymbol(e.target.value)}>
          {top.map((m) => (
            <option key={m.id} value={m.symbol}>
              {m.symbol.toUpperCase()} - {m.name}
            </option>
          ))}
        </select>
        <button onClick={() => convert().catch((e) => alert(e.message))}>Convert to TPC</button>
      </div>
      {quote && <p>{quote.amount} {quote.from} ≈ {quote.tpcAmount.toFixed(4)} TPC</p>}

      <div>
        {top.map((m) => (
          <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #eee', padding: '6px 0' }}>
            <span>{m.symbol.toUpperCase()} • {m.name}</span>
            <span>${m.current_price.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
