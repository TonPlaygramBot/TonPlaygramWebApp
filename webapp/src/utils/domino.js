export function generateDominoSet() {
  const set = [];
  for (let i = 0; i <= 6; i++) {
    for (let j = i; j <= 6; j++) {
      set.push({ left: i, right: j });
    }
  }
  return set;
}

export function shuffle(array) {
  const a = [...array];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function dealHands(count, players) {
  const deck = shuffle(generateDominoSet());
  const handSize = players <= 2 ? 7 : 5;
  const hands = Array.from({ length: players }, () => []);
  for (let i = 0; i < handSize; i++) {
    for (let p = 0; p < players; p++) {
      hands[p].push(deck.pop());
    }
  }
  return { hands, deck };
}
