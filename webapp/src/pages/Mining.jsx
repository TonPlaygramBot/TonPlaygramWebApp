import { useEffect, useState } from 'react';
import { getMiningStatus, startMining, stopMining, claimMining } from '../utils/api.js';

const TELEGRAM_ID = 1; // demo value

export default function Mining() {
  const [status, setStatus] = useState(null);

  const refresh = async () => {
    const data = await getMiningStatus(TELEGRAM_ID);
    setStatus(data);
  };

  useEffect(() => {
    refresh();
  }, []);

  const handleStart = async () => {
    await startMining(TELEGRAM_ID);
    refresh();
  };

  const handleStop = async () => {
    await stopMining(TELEGRAM_ID);
    refresh();
  };

  const handleClaim = async () => {
    const res = await claimMining(TELEGRAM_ID);
    alert(`Claimed ${res.amount} TPC`);
    refresh();
  };

  if (!status) return <div className="p-4">Loading...</div>;

  return (
    <div className="p-4 space-y-2">
      <h2 className="text-xl font-bold">Mining</h2>
      <p>Status: {status.isMining ? 'Mining' : 'Stopped'}</p>
      <p>Pending rewards: {status.pending}</p>
      <div className="space-x-2">
        <button className="px-2 py-1 bg-green-500 text-white" onClick={handleStart}>Start</button>
        <button className="px-2 py-1 bg-yellow-500 text-white" onClick={handleStop}>Stop</button>
        <button className="px-2 py-1 bg-blue-500 text-white" onClick={handleClaim}>Claim</button>
      </div>
    </div>
  );
}
