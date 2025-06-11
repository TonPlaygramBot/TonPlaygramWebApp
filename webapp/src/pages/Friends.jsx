import { useEffect, useState } from 'react';
import { TELEGRAM_ID } from '../utils/telegram.js';
import { getFriendsInfo, addFriend } from '../utils/api.js';

export default function Friends() {
  const [info, setInfo] = useState(null);
  const [friendId, setFriendId] = useState('');

  const load = async () => {
    const res = await getFriendsInfo(TELEGRAM_ID);
    setInfo(res);
  };

  useEffect(() => {
    load();
  }, []);

  const handleAdd = async () => {
    if (!friendId) return;
    await addFriend(TELEGRAM_ID, Number(friendId));
    setFriendId('');
    load();
  };

  if (!info) return <div className="p-4">Loading...</div>;

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-bold">Friends</h2>
      <p>Your referral code: <span className="font-mono">{info.code}</span></p>
      <p>Total referrals: {info.referrals}</p>

      <div className="space-y-2">
        <h3 className="font-bold">Add Friend by Telegram ID</h3>
        <input
          className="w-full p-1 border"
          value={friendId}
          onChange={(e) => setFriendId(e.target.value)}
          placeholder="Friend Telegram ID"
        />
        <button className="px-3 py-1 bg-blue-500 text-white" onClick={handleAdd}>
          Add Friend
        </button>
      </div>

      <div>
        <h3 className="font-bold">Your Friends</h3>
        <ul className="list-disc list-inside">
          {info.friends.map((f, i) => (
            <li key={i}>{f}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
