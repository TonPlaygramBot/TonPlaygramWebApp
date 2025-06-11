import { useState } from 'react';
import { tonToTpc, tpcToTon } from '../utils/tokenomics.js';

export default function Wallet() {
  const [ton, setTon] = useState('');
  const [tpc, setTpc] = useState('');

  const handleTonChange = (e) => {
    const value = e.target.value;
    setTon(value);
    setTpc(value ? tonToTpc(Number(value)) : '');
  };

  const handleTpcChange = (e) => {
    const value = e.target.value;
    setTpc(value);
    setTon(value ? tpcToTon(Number(value)) : '');
  };

  return (
    <div className="p-4 space-y-2">
      <h2 className="text-xl font-bold">Wallet</h2>
      <div className="space-y-1">
        <label className="block">TON</label>
        <input
          type="number"
          value={ton}
          onChange={handleTonChange}
          className="border p-1 rounded w-full"
        />
      </div>
      <div className="space-y-1">
        <label className="block">TPC</label>
        <input
          type="number"
          value={tpc}
          onChange={handleTpcChange}
          className="border p-1 rounded w-full"
        />
      </div>
    </div>
  );
}
