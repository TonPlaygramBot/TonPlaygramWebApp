import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const ROUNDS = [
  { round: 1, tokens: 125_000_000, price: 0.000004 },
  { round: 2, tokens: 100_000_000, price: 0.000005 },
  { round: 3, tokens: 100_000_000, price: 0.000006 },
  { round: 4, tokens: 100_000_000, price: 0.000008 },
  { round: 5, tokens: 75_000_000,  price: 0.000010 }
];

export default function PresaleDashboardMultiRound() {
  const [currentRound, setCurrentRound] = useState(0);
  const [sold, setSold] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [salesData, setSalesData] = useState([]);
  const [totalTonRaised, setTotalTonRaised] = useState(0);

  const getRoundEnd = () => {
    const now = new Date();
    return new Date(now.getTime() + 28 * 24 * 60 * 60 * 1000); // 28 days
  };
  const [roundEnd, setRoundEnd] = useState(getRoundEnd());

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      const remaining = roundEnd - now;
      setTimeLeft(remaining);

      if (remaining <= 0 && currentRound < ROUNDS.length - 1) {
        goToNextRound();
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [roundEnd, currentRound]);

  const formatTime = (ms) => {
    if (ms <= 0) return '00d 00h 00m 00s';
    const totalSeconds = Math.floor(ms / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${days}d ${hours}h ${minutes}m ${seconds}s`;
  };

  const maxTokens = ROUNDS[currentRound].tokens;
  const percent = ((sold / maxTokens) * 100).toFixed(2);
  const tonRaised = (sold * ROUNDS[currentRound].price).toFixed(2);

  useEffect(() => {
    const interval = setInterval(() => {
      const newSold = Math.min(sold + 200_000, maxTokens);
      setSold(newSold);
      setSalesData((prev) => [
        ...prev,
        { name: `Day ${prev.length + 1}`, sold: newSold }
      ]);
      setTotalTonRaised((prev) => prev + 200_000 * ROUNDS[currentRound].price);
    }, 3000);
    return () => clearInterval(interval);
  }, [sold, maxTokens, currentRound]);

  const goToNextRound = () => {
    if (currentRound < ROUNDS.length - 1) {
      setCurrentRound((prev) => prev + 1);
      setSold(0);
      setSalesData([]);
      setRoundEnd(getRoundEnd());
    }
  };

  const goToPreviousRound = () => {
    if (currentRound > 0) {
      setCurrentRound((prev) => prev - 1);
      setSold(0);
      setSalesData([]);
      setRoundEnd(getRoundEnd());
    }
  };

  return (
    <div className="bg-gradient-to-b from-gray-900 to-gray-800 p-6 rounded-2xl shadow-2xl w-full max-w-3xl mx-auto text-white border border-gray-700">
      <h2 className="text-3xl font-extrabold text-center mb-1 tracking-wide bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-500">
        Presale - Round {ROUNDS[currentRound].round} of 5
      </h2>
      <p className="text-center text-sm mb-4 text-gray-300">
        Price: <span className="text-cyan-400">{ROUNDS[currentRound].price} TON</span> / 1 TPC
      </p>

      <div className="text-center mb-4">
        <p className="text-lg font-semibold text-gray-200">
          Ends in: <span className="text-cyan-300">{formatTime(timeLeft)}</span>
        </p>
        <p className="text-md text-gray-300 mt-1">
          TON Raised in this Round: <span className="text-cyan-300">{tonRaised} TON</span>
        </p>
      </div>

      <div className="text-center mb-4 text-gray-300">
        <p>
          Tokens Sold: <span className="text-cyan-300">{sold.toLocaleString()}</span> / {maxTokens.toLocaleString()} TPC
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
            <LineChart data={salesData}>
              <XAxis dataKey="name" stroke="#ccc" />
              <YAxis stroke="#ccc" />
              <Tooltip />
              <Line type="monotone" dataKey="sold" stroke="#00FFFF" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="flex justify-between mb-6">
        <button
          onClick={goToPreviousRound}
          disabled={currentRound === 0}
          className={`py-2 px-4 rounded-lg ${
            currentRound === 0
              ? 'bg-gray-600 cursor-not-allowed'
              : 'bg-cyan-500 hover:bg-cyan-400 text-black font-bold'
          }`}
        >
          Previous Round
        </button>
        <button
          onClick={goToNextRound}
          disabled={currentRound === ROUNDS.length - 1}
          className={`py-2 px-4 rounded-lg ${
            currentRound === ROUNDS.length - 1
              ? 'bg-gray-600 cursor-not-allowed'
              : 'bg-cyan-500 hover:bg-cyan-400 text-black font-bold'
          }`}
        >
          Next Round
        </button>
      </div>

      <div className="bg-gray-800 p-4 rounded-xl text-center border border-gray-700">
        <h3 className="text-lg font-bold mb-2 text-cyan-300">Total TON Raised</h3>
        <p className="text-2xl font-extrabold">{totalTonRaised.toFixed(2)} TON</p>
      </div>

      <div className="bg-gray-800 p-5 rounded-xl shadow-inner text-center border border-gray-700 mt-6">
        <h3 className="text-lg font-bold mb-2 text-cyan-300">Buy TPC</h3>
        <input
          type="number"
          placeholder="TON Amount"
          className="p-2 w-full rounded-md bg-gray-700 text-white mb-3 border border-gray-600"
        />
        <button className="bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-black font-bold py-2 px-4 rounded-lg w-full transition-all duration-300 shadow-md">
          Buy Now
        </button>
      </div>
    </div>
  );
}
