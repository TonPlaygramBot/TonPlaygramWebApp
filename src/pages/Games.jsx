export default function Games() {
  const games = ['Dice Duel', 'Ludo', 'Horse Racing', 'Snake & Ladders'];
  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Games</h2>
      <ul className="grid gap-2">
        {games.map((g) => (
          <li key={g} className="border p-2 rounded opacity-50">{g} (Coming Soon)</li>
        ))}
      </ul>
    </div>
  );
}
