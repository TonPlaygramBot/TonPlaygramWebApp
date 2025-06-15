import { motion } from 'framer-motion';

export default function GameResult({ result, onRematch }) {
  if (!result) return null;
  const { outcome, pot } = result;
  const house = Math.round(pot * 0.09);
  const prize = pot - house;
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50"
    >
      <div className="bg-surface border border-border p-6 rounded w-80 text-center space-y-4 text-text">
        <h3 className="text-xl font-bold">
          {outcome === 'win' ? 'You win!' : outcome === 'lose' ? 'You lose!' : 'Draw'}
        </h3>
        <p className="text-subtext">Pot: {pot}</p>
        {outcome !== 'draw' && (
          <p className="text-accent font-semibold">Prize: {prize}</p>
        )}
        <button
          onClick={onRematch}
          className="px-4 py-1 bg-primary hover:bg-primary-hover rounded text-white w-full"
        >
          Rematch
        </button>
      </div>
    </motion.div>
  );
}
