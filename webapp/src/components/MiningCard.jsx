import { useEffect, useState } from 'react';
import { getMiningStatus, startMining, claimMining } from '../utils/api.js';
import { getTelegramId } from '../utils/telegram.js';

export default function MiningCard() {
  const [status, setStatus] = useState('Not Mining');
  const [startTime, setStartTime] = useState(null);

  // Always use server-provided lastMineAt
  const refresh = async () => {
    try {
      const data = await getMiningStatus(getTelegramId());
      setStatus(data.isMining ? 'Mining' : 'Not Mining');
      setStartTime(data.lastMineAt ? new Date(data.lastMineAt).getTime() : null);
    } catch (err) {
      console.warn('Failed to refresh mining status', err);
    }
  };

  useEffect(() => {
    refresh();
    /
