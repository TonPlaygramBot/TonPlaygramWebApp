import { motion } from 'framer-motion';

const pipMap = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8]
};

export default function Dice({ value = 1, rolling = false }) {
  const cells = Array.from({ length: 9 });
  return (
    <motion.div
      animate={rolling ? { rotate: 360 } : { rotate: 0 }}
      transition={{ duration: 0.6 }}
      className="w-16 h-16 bg-gradient-to-br from-brand-gold to-brand-black rounded-lg grid grid-cols-3 grid-rows-3 gap-1 p-1 shadow-lg"
    >
      {cells.map((_, i) => (
        <span
          key={i}
          className={`w-2 h-2 rounded-full bg-black place-self-center ${
            pipMap[value]?.includes(i) ? 'opacity-100' : 'opacity-0'
          }`}
        />
      ))}
    </motion.div>
  );
}
