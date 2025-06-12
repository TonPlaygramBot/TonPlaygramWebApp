import { useEffect, useState } from 'react';
import { getMiningStatus, startMining, stopMining, claimMining } from '../utils/api.js';
import { getTelegramId } from '../utils/telegram.js';

export default function Mining() {
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
    const res = await claimMining(getTelegramId());
    alert(`Claimed ${res.amount} TPC. New balance: ${res.balance}`);
    refresh();
  };

  if (!status) return <div className="p-4 text-subtext">Loading...</div>;

  return (
    <div className="p-4 space-y-2 text-text">
      <h2 className="text-xl font-bold">Mining</h2>
      <p>
        Status: <span className="font-semibold">{status.isMining ? 'Mining' : 'Stopped'}</span>
      </p>
      <p>
        Pending rewards: <span className="text-accent">{status.pending}</span>
      </p>
      <p>
        Balance: <span className="text-accent">{status.balance}</span>
      </p>
      <div className="space-x-2">
        <button
          className="px-2 py-1 rounded bg-primary text-text hover:bg-primary-hover"
          onClick={handleStart}
        >
          Start
        </button>
        <button
          className="px-2 py-1 rounded bg-accent text-background"
          onClick={handleStop}
        >
          Stop
        </button>
        <button
          className="px-2 py-1 rounded bg-primary text-text hover:bg-primary-hover"
          onClick={handleClaim}
        >
          Claim
        </button>
      </div>
    </div>
  );
}
