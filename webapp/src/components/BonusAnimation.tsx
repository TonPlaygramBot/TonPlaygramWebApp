import { motion, AnimatePresence } from 'framer-motion';
interface BonusAnimationProps {
  show: boolean;
  onComplete?: () => void;
}

export default function BonusAnimation({ show, onComplete }: BonusAnimationProps) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed inset-0 flex items-center justify-center pointer-events-none z-50"
          initial={{ opacity: 1, scale: 1 }}
          animate={{ scale: [1, 3, 1], opacity: [1, 1, 0] }}
          transition={{ duration: 2 }}
          onAnimationComplete={onComplete}
        >
          <span className="text-red-600 text-5xl font-extrabold drop-shadow-[0_0_4px_black]">
            BONUS X3
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
