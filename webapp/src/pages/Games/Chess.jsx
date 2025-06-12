import { useState } from 'react';
import ConnectWallet from '../../components/ConnectWallet.jsx';

// Simple placeholder for Chess game integration.
// Displays stake selector and connect wallet button.
export default function Chess() {
  const [stake, setStake] = useState(100);
  return (
    <div className="p-4 text-yellow-400 bg-black min-h-screen">
      <h2 className="text-2xl font-bold mb-4">Chessu</h2>
      <p className="mb-4">Stake TPC and challenge another player.</p>
      <div className="space-x-2 mb-4">
        {[100,500,1000,5000,10000].map((amt) => (
          <button
            key={amt}
            onClick={() => setStake(amt)}
            className={`px-2 py-1 border rounded ${stake===amt?'bg-yellow-600':'bg-gray-700'}`}
          >
            {amt} TPC
          </button>
        ))}
      </div>
      <ConnectWallet />
      {/* Actual chess board will be integrated from dotnize/chessu */}
      <div className="mt-8 border border-yellow-600 p-4">Chess board coming soon...</div>
    </div>
  );
}
