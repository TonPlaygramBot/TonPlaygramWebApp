import { useEffect } from 'react';

export default function WinningCardPopup({ card, onClose, duration = 1500 }) {
  if (!card) return null;
  useEffect(() => {
    const t = setTimeout(onClose, duration);
    return () => clearTimeout(t);
  }, [onClose, duration]);

  const isRed = card.suit === 'hearts' || card.suit === 'diamonds';
  const suitSymbol =
    card.suit === 'hearts'
      ? '♥'
      : card.suit === 'spades'
      ? '♠'
      : card.suit === 'diamonds'
      ? '♦'
      : '♣';

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-70 z-50">
      <div className="w-32 h-48 bg-white rounded-md flex flex-col items-center justify-center relative">
        <div className="absolute top-1 left-1 text-sm font-bold">
          <span className={isRed ? 'text-red-500' : 'text-black'}>{card.rank}</span>
          <span className={`ml-1 ${isRed ? 'text-red-500' : 'text-black'}`}>{suitSymbol}</span>
        </div>
        <span className={`text-5xl ${isRed ? 'text-red-500' : 'text-black'}`}>{suitSymbol}</span>
      </div>
    </div>
  );
}
