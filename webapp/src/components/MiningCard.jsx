import { useEffect, useState } from 'react';
import { getMiningStatus, startMining, claimMining } from '../utils/api.js';
import { getTelegramId } from '../utils/telegram.js';

export default function MiningCard() {
  const [status, setStatus] = useState('Not Mining');
  const [startTime, setStartTime] = useState(null);

  const refresh = async () => {
    const data = await getMiningStatus(getTelegramId());
    setStatus(data.isMining ? 'Mining' : 'Not Mining');
  };

  useEffect(() => {
    refresh();
  }, []);

  const handleStart = async () => {
    setStartTime(Date.now());
    setStatus('Mining');
    await startMining(getTelegramId());
  };

  useEffect(() => {
    if (status === 'Mining') {
      const interval = setInterval(() => {
        const now = Date.now();
        const elapsed = now - startTime;
        const twelveHours = 12 * 60 * 60 * 1000;
        if (elapsed >= twelveHours) {
          setStatus('Not Mining');
          autoDistributeRewards();
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [status, startTime]);

  const autoDistributeRewards = async () => {
    await claimMining(getTelegramId());
    refresh();
  };

  if (!status) {
    return (
      <div className="bg-gray-800/60 p-4 rounded-xl shadow-lg text-white">
        Loading...
      </div>
    );
  }

  return (
    <div className="bg-gray-800/60 p-4 rounded-xl shadow-lg text-white space-y-2">
      <h3 className="text-lg font-bold flex items-center space-x-2">
        <span>⛏</span>
        <span>Mining</span>
      </h3>
      <p>
        Status:{' '}
        <span className={status === 'Mining' ? 'text-green-500' : 'text-red-500'}>
          {status}
        </span>
      </p>
      <div>
        <button className="px-2 py-1 bg-green-500 text-white" onClick={handleStart} disabled={status === 'Mining'}>Start</button>
      </div>
    </div>
  );
}
