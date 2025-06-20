import { useState } from 'react';
import { searchUsers, sendFriendRequest } from '../utils/api.js';
import { getTelegramId } from '../utils/telegram.js';

export default function UserSearchBar() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);

  async function handleSearch() {
    if (!query) return;
    const users = await searchUsers(query);
    setResults(users);
  }

  async function requestFriend(id) {
    const fromId = getTelegramId();
    await sendFriendRequest(fromId, id);
    alert('Friend request sent');
  }

  return (
    <div className="space-y-2">
      <div className="flex space-x-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search users"
          className="flex-1 border border-border rounded px-2 py-1 bg-surface"
        />
        <button
          onClick={handleSearch}
          className="px-2 py-1 bg-primary hover:bg-primary-hover rounded text-text"
        >
          Search
        </button>
      </div>
      {results.length > 0 && (
        <ul className="space-y-1">
          {results.map((u) => (
            <li key={u.telegramId} className="flex items-center justify-between">
              <span>
                {u.nickname || `${u.firstName} ${u.lastName}`.trim() || 'User'}
              </span>
              <button
                onClick={() => requestFriend(u.telegramId)}
                className="px-2 py-1 text-sm bg-primary hover:bg-primary-hover rounded"
              >
                Add Friend
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
