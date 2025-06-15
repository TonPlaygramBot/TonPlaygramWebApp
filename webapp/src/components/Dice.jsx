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
      animate={
        rolling
          ? { rotateX: 360, rotateY: 360 }
          : { rotateX: 25, rotateY: -30 }
      }
      transition={{ duration: rolling ? 0.8 : 0 }}
      className="w-16 h-16 bg-black border-2 border-brand-gold rounded-lg grid grid-cols-3 grid-rows-3 gap-1 p-1 shadow-[0_4px_8px_rgba(0,0,0,0.6)] text-brand-gold"
      style={{ transformStyle: 'preserve-3d' }}
    >
      {cells.map((_, i) => (
        <span
          key={i}
          className={`w-2 h-2 rounded-full bg-brand-gold place-self-center ${
            pipMap[value]?.includes(i) ? 'opacity-100' : 'opacity-0'
          }`}
        />
      ))}
    </motion.div>
  );
}
