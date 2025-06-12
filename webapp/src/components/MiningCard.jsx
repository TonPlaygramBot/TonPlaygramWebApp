import { useEffect, useState } from 'react';
import { getMiningStatus, startMining, stopMining, claimMining } from '../utils/api.js';
import { getTelegramId } from '../utils/telegram.js';

export default function MiningCard() {
  const [status, setStatus] = useState(null);

  const refresh = async () => {
    const data = await getMiningStatus(getTelegramId());
    setStatus(data);
  };

  useEffect(() => {
    refresh();
  }, []);

  const handleStart = async () => {
    await startMining(getTelegramId());
    refresh();
  };

  const handleStop = async () => {
    await stopMining(getTelegramId());
    refresh();
  };

  const handleClaim = async () => {
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
        <span className={status.isMining ? 'text-green-500' : 'text-red-500'}>
          {status.isMining ? 'Mining' : 'Not Mining'}
        </span>
      </p>
      <p>Pending rewards: {status.pending}</p>
      <div className="space-x-2">
        <button className="px-2 py-1 bg-green-500 text-white" onClick={handleStart}>Start</button>
        <button className="px-2 py-1 bg-yellow-500 text-white" onClick={handleStop}>Stop</button>
        <button className="px-2 py-1 bg-blue-500 text-white" onClick={handleClaim}>Claim</button>
      </div>
    </div>
  );
}
