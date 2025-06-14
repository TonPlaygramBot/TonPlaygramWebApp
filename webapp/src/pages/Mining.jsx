import { useEffect, useState } from 'react';
import { useTonWallet } from '@tonconnect/ui-react';
import {
  startMining,
  claimMining,
  getWalletBalance,
  getTonBalance,
  getLeaderboard
} from '../utils/api.js';
import { getTelegramId, getTelegramPhotoUrl } from '../utils/telegram.js';
import OpenInTelegram from '../components/OpenInTelegram.jsx';

export default function Mining() {
  let telegramId;
  try {
    telegramId = getTelegramId();
  } catch (err) {
    return <OpenInTelegram />;
  }
  const [status, setStatus] = useState('Not Mining');
  const [startTime, setStartTime] = useState(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [balances, setBalances] = useState({ ton: null, tpc: null, usdt: 0 });
  const [leaderboard, setLeaderboard] = useState([]);
  const [rank, setRank] = useState(null);
  const wallet = useTonWallet();

  const loadBalances = async () => {
    try {
      const prof = await getWalletBalance(telegramId);
      const ton = wallet?.account?.address
        ? (await getTonBalance(wallet.account.address)).balance
        : null;
      setBalances({ ton, tpc: prof.balance, usdt: 0 });
    } catch (err) {
      console.error('Failed to load balances:', err);
    }
  };

  useEffect(() => {
    loadBalances();
    const saved = localStorage.getItem('miningStart');
    if (saved) {
      const start = parseInt(saved, 10);
      setStartTime(start);
      setStatus('Mining');
      const elapsed = Date.now() - start;
      const twelveHours = 12 * 60 * 60 * 1000;
      setTimeLeft(Math.max(0, twelveHours - elapsed));
    }
  }, [wallet]);

  useEffect(() => {
    if (status === 'Mining') {
      const interval = setInterval(() => {
        const now = Date.now();
        const elapsed = now - startTime;
        const twelveHours = 12 * 60 * 60 * 1000;
        setTimeLeft(Math.max(0, twelveHours - elapsed));
        if (elapsed >= twelveHours) {
          setStatus('Not Mining');
          autoDistributeRewards();
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [status, startTime]);

  useEffect(() => {
    async function loadLeaderboard() {
      try {
        const data = await getLeaderboard(telegramId);
        setLeaderboard(data.users);
        setRank(data.rank);
      } catch (err) {
        console.error('Failed to load leaderboard:', err);
      }
    }
    loadLeaderboard();
  }, [telegramId, status]);

  const handleStart = async () => {
    const now = Date.now();
    setStartTime(now);
    setTimeLeft(12 * 60 * 60 * 1000);
    localStorage.setItem('miningStart', String(now));
    setStatus('Mining');
    await startMining(telegramId);
  };

  const autoDistributeRewards = async () => {
    try {
      await claimMining(telegramId);
    } catch (err) {
      console.error('Auto-claim failed:', err);
    }
    localStorage.removeItem('miningStart');
    setTimeLeft(0);
    loadBalances();
  };

  return (
    <div className="bg-surface border border-border text-text p-4 rounded-lg shadow-lg">
      <div className="text-center mb-4">
        <p className="text-gray-300 mb-2">Total Balance</p>
        <div className="flex justify-around items-center text-sm">
          <Token icon="/icons/ton.svg" value={balances.ton ?? '...'} />
          <Token icon="/icons/tpc.svg" value={balances.tpc ?? '...'} />
          <Token icon="/icons/usdt.svg" value={balances.usdt ?? '0'} />
        </div>
      </div>

      <div className="flex items-center justify-between mt-4">
        <button
          onClick={handleStart}
          disabled={status === 'Mining'}
          className="bg-green-500 hover:bg-green-600 text-white px-4 py-1 rounded-full font-semibold disabled:opacity-50"
        >
          Start
        </button>
        <p>
          Status:{' '}
          <span className={status === 'Mining' ? 'text-green-400' : 'text-red-400'}>
            {status}
            {status === 'Mining' && ` - ${formatTimeLeft(timeLeft)}`}
          </span>
        </p>
      </div>

      <div className="mt-6">
        <h3 className="text-lg font-semibold mb-2">Leaderboard</h3>
        <div className="max-h-96 overflow-y-auto border border-border rounded">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-surface">
              <tr className="border-b border-border text-left">
                <th className="p-2">#</th>
                <th className="p-2">User</th>
                <th className="p-2 text-right">TPC</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((u, idx) => (
                <tr
                  key={u.telegramId}
                  className={`border-b border-border ${u.telegramId === telegramId ? 'bg-accent text-black' : ''}`}
                >
                  <td className="p-2">{idx + 1}</td>
                  <td className="p-2 flex items-center space-x-2">
                    {u.photo && (
                      <img
                        src={u.photo}
                        alt=""
                        className="w-6 h-6 object-cover hexagon hexagon-gold"
                      />
                    )}
                    <span>{u.nickname || `${u.firstName} ${u.lastName}`.trim() || 'User'}</span>
                  </td>
                  <td className="p-2 text-right">{u.balance}</td>
                </tr>
              ))}
              {rank && rank > 100 && (
                <tr className="bg-accent text-black">
                  <td className="p-2">{rank}</td>
                  <td className="p-2 flex items-center space-x-2">
                    {getTelegramPhotoUrl() && (
                      <img
                        src={getTelegramPhotoUrl()}
                        alt=""
                        className="w-6 h-6 object-cover hexagon hexagon-gold"
                      />
                    )}
                    <span>You</span>
                  </td>
                  <td className="p-2 text-right">{balances.tpc ?? '...'}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Token({ icon, value }) {
  return (
    <div className="flex items-center space-x-1">
      <img src={icon} alt="token" className="w-5 h-5" />
      <span>{value}</span>
    </div>
  );
}

function formatTimeLeft(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return (
    hours.toString().padStart(2, '0') +
    ':' +
    minutes.toString().padStart(2, '0') +
    ':' +
    seconds.toString().padStart(2, '0')
  );
}
