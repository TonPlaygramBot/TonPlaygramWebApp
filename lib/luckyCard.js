const suits = ['\u2660', '\u2665', '\u2666', '\u2663'];
const ranks = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
const defaultPrizes = ['Free Spin', 'Bonus Points', 'Extra Life'];

export function createBoxes(prizes = defaultPrizes) {
  const boxes = {};
  for (let i = 1; i <= 12; i++) {
    boxes[i] = { cards: [], prize: null };
  }

  const mapping = {
    A: 1,
    '2': 2,
    '3': 3,
    '4': 4,
    '5': 5,
    '6': 6,
    '7': 7,
    '8': 8,
    '9': 9,
    '10': 10,
    J: 11,
    Q: 12
  };

  for (const rank of ranks) {
    for (const suit of suits) {
      if (!mapping[rank]) continue; // skip kings
      const card = `${rank}${suit}`;
      const boxNumber = mapping[rank];
      boxes[boxNumber].cards.push(card);
    }
  }

  const kings = suits.map(s => `K${s}`);
  const prizePool = [...prizes, 'Black Joker', 'Red Joker', ...kings];

  for (let i = 1; i <= 12; i++) {
    const prizeIndex = Math.floor(Math.random() * prizePool.length);
    boxes[i].prize = prizePool[prizeIndex];
  }
  return boxes;
}

export function spin(boxes) {
  const result = Math.floor(Math.random() * 12) + 1;
  const box = boxes[result];
  return { result, cards: box.cards, prize: box.prize };
}

