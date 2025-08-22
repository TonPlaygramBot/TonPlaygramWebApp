import { useState } from 'react';

const CARD_VALUES = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q'];
const SUITS = ['hearts', 'clubs', 'diamonds', 'spades', 'joker-black', 'joker-red'];

function randomSuit() {
  return SUITS[Math.floor(Math.random() * SUITS.length)];
}

function getRandomCenter() {
  const items = [
    `🎲 Roll ${1 + Math.floor(Math.random() * 6)}`,
    '🎰 Free Spins',
    '🎉 Bonus x3',
  ];
  return items[Math.floor(Math.random() * items.length)];
}

export default function LuckyCard() {
  const [cards, setCards] = useState(() =>
    CARD_VALUES.map((value) => ({ value, suit: randomSuit(), revealed: false }))
  );
  const [center, setCenter] = useState(getRandomCenter);
  const [prize, setPrize] = useState(null);
  const basePrice = 100;

  const suitSymbol = (suit) => {
    switch (suit) {
      case 'hearts':
        return '♥';
      case 'clubs':
        return '♣';
      case 'diamonds':
        return '♦';
      case 'spades':
        return '♠';
      default:
        return '🃏';
    }
  };

  const suitClass = (suit) => {
    if (suit === 'hearts' || suit === 'diamonds' || suit === 'joker-red') {
      return 'text-red-500';
    }
    return 'text-black';
  };

  const handleClick = (index) => {
    const card = cards[index];
    if (card.revealed) return;
    const next = cards.slice();
    next[index].revealed = true;
    setCards(next);

    let result = basePrice;
    switch (card.suit) {
      case 'hearts':
        result *= 2;
        break;
      case 'clubs':
        result *= 0.5;
        break;
      case 'diamonds':
        result *= 1.5;
        break;
      case 'spades':
        result *= 0.75;
        break;
      case 'joker-black':
        result = 5000;
        break;
      case 'joker-red':
        result = 10000;
        break;
      default:
        break;
    }
    setPrize(result);
    setCenter(getRandomCenter());
  };

  return (
    <div className="p-4 space-y-4 text-center text-text">
      <h2 className="text-2xl font-bold">Lucky Card</h2>
      <div className="grid grid-cols-4 gap-2">
        {cards.map((card, index) => (
          <div
            key={index}
            onClick={() => handleClick(index)}
            className="border border-border rounded-lg h-24 flex items-center justify-center cursor-pointer bg-surface"
          >
            {card.revealed ? (
              <span className={`text-2xl ${suitClass(card.suit)}`}>
                {card.value}
                {suitSymbol(card.suit)}
              </span>
            ) : (
              <span className="text-2xl">❓</span>
            )}
          </div>
        ))}
      </div>
      <div className="text-lg">{center}</div>
      {prize !== null && <div className="font-semibold">Prize: {prize}</div>}
    </div>
  );
}

