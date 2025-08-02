import useTelegramBackButton from '../hooks/useTelegramBackButton.js';
import { PTONTPC_LP_TOKEN } from '../utils/lpToken.js';
import DexChartCard from '../components/DexChartCard.jsx';

export default function Store() {
  useTelegramBackButton();

  return (
    <div className="relative p-4 space-y-4 text-text flex flex-col items-center">
      <h2 className="text-xl font-bold">Store</h2>
      <div className="relative bg-surface border border-border rounded-xl p-2 text-center text-xs space-y-1 overflow-hidden wide-card">
        <img
          src={PTONTPC_LP_TOKEN.image}
          alt={PTONTPC_LP_TOKEN.symbol}
          className="w-8 h-8 mx-auto"
        />
        <p className="font-semibold">{PTONTPC_LP_TOKEN.name}</p>
        <p>{PTONTPC_LP_TOKEN.description}</p>
        <p className="break-all text-brand-gold">
          Address: {PTONTPC_LP_TOKEN.address}
        </p>
      </div>
      <DexChartCard />
    </div>
  );
}
