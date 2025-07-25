import { useState, useEffect, useRef } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import BuyTpcCard from './BuyTpcCard.jsx';
import { getPresaleStatus, getAppStats } from '../utils/api.js';
import { PRESALE_ROUNDS, PRESALE_START } from '../utils/storeData.js';

export default function PresaleDashboardMultiRound() {
  const [status, setStatus] = useState(null);
  const [stats, setStats] = useState(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [salesData, setSalesData] = useState([]);
  const roundEndRef = useRef(null);

  useEffect(() => {
    const id = setInterval(() => {
      if (roundEndRef.current) {
        setTimeLeft(roundEndRef.current - Date.now());
      }
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const formatTime = (ms) => {
    if (ms <= 0) return '00d 00h 00m 00s';
    const totalSeconds = Math.floor(ms / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${days}d ${hours}h ${minutes}m ${seconds}s`;
  };

  const roundIndex = status ? status.currentRound - 1 : 0;
  const maxTokens = PRESALE_ROUNDS[roundIndex]?.maxTokens || 0;
  const sold = maxTokens - (status?.remainingTokens || 0);
  const percent = maxTokens
    ? ((sold / maxTokens) * 100).toFixed(2)
    : '0';
  const tonRaised = sold * (status?.currentPrice || PRESALE_ROUNDS[roundIndex]?.pricePerTPC || 0);
  const totalTonRaised = stats?.tonRaised || 0;

  useEffect(() => {
    async function load() {
      try {
        const s = await getPresaleStatus();
        setStatus(s);
        const idx = s.currentRound - 1;
        const duration = 4 * 7 * 24 * 60 * 60 * 1000;
        const start = new Date(PRESALE_START).getTime() + duration * idx;
        roundEndRef.current = start + duration;
        const max = PRESALE_ROUNDS[idx]?.maxTokens || 0;
        const currentSold = max - (s.remainingTokens || 0);
        setSalesData((prev) => [
          ...prev,
          { name: new Date().toLocaleTimeString(), sold: currentSold }
        ]);
      } catch {}
      try {
        const st = await getAppStats();
        setStats(st);
      } catch {}
    }
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-gradient-to-b from-gray-900 to-gray-800 p-6 rounded-2xl shadow-2xl w-full max-w-3xl mx-auto text-white border border-gray-700">
      <h2 className="text-3xl font-extrabold text-center mb-1 tracking-wide bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-500">
        Presale - Round {status ? status.currentRound : '...'} of {PRESALE_ROUNDS.length}
      </h2>
      <p className="text-center text-sm mb-4 text-gray-300">
        Price: <span className="text-cyan-400">{status ? status.currentPrice : PRESALE_ROUNDS[roundIndex]?.pricePerTPC} TON</span> / 1 TPC
      </p>

      <div className="text-center mb-4">
        <p className="text-lg font-semibold text-gray-200">
          Ends in: <span className="text-cyan-300">{formatTime(timeLeft)}</span>
        </p>
        <p className="text-md text-gray-300 mt-1">
          TON Raised in this Round:{' '}
          <span className="text-cyan-300">
            {status ? tonRaised.toFixed(2) : '...'} TON
          </span>
        </p>
      </div>

      <div className="text-center mb-4 text-gray-300">
        <p>
          Tokens Sold:{' '}
          <span className="text-cyan-300">
            {status ? sold.toLocaleString() : '...'}
          </span>{' '}
          / {maxTokens.toLocaleString()} TPC
        </p>
      </div>

      <div className="w-full bg-gray-700 rounded-full h-4 mb-2 overflow-hidden shadow-inner">
        <div
          className="bg-gradient-to-r from-cyan-400 to-blue-500 h-4 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${percent}%` }}
        ></div>
      </div>
      <p className="text-center text-sm mb-6 text-gray-400">{percent}% Completed</p>

      <div className="bg-gray-800 p-4 rounded-xl mb-6 shadow-inner border border-gray-700">
        <h3 className="text-lg font-bold mb-3 text-center text-cyan-300">Sales Progress</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={salesData}>
              <XAxis dataKey="name" stroke="#ccc" />
              <YAxis stroke="#ccc" />
              <Tooltip />
              <Bar dataKey="sold" fill="#00FF00" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>



      <div className="bg-gray-800 p-4 rounded-xl text-center border border-gray-700">
        <h3 className="text-lg font-bold mb-2 text-cyan-300">Total TON Raised</h3>
        <p className="text-2xl font-extrabold">
          {stats ? totalTonRaised.toFixed(2) : '...'} TON
        </p>
      </div>

      <BuyTpcCard />
    </div>
  );
}
