import { useEffect, useState } from 'react';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import { getSnakeResults } from '../../utils/api.js';

export default function SnakeResults() {
  useTelegramBackButton();
  const [results, setResults] = useState([]);

  useEffect(() => {
    getSnakeResults().then((data) => setResults(data.results || []));
  }, []);

  return (
    <div className="p-4 space-y-2 text-text">
      <h2 className="text-xl font-bold text-center">Recent Snake &amp; Ladder Results</h2>
      <ul className="space-y-1">
        {results.map((r, idx) => (
          <li key={idx} className="border-b border-border py-1 text-sm">
            <span className="font-semibold">{r.winner}</span> won against{' '}
            {r.participants.filter((p) => p !== r.winner).join(', ') || 'AI'}
          </li>
        ))}
        {results.length === 0 && <li>No games recorded yet.</li>}
      </ul>
    </div>
  );
}
