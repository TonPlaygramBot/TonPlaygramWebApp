import { useEffect, useState } from 'react';
import useTelegramBackButton from '../hooks/useTelegramBackButton.js';
import OpenInTelegram from '../components/OpenInTelegram.jsx';
import { getTelegramId } from '../utils/telegram.js';
import { listWallPosts, createWallPost } from '../utils/api.js';

export default function Wall() {
  useTelegramBackButton();
  let telegramId;
  try {
    telegramId = getTelegramId();
  } catch (err) {
    return <OpenInTelegram />;
  }

  const [posts, setPosts] = useState([]);
  const [text, setText] = useState('');

  useEffect(() => {
    listWallPosts(telegramId).then(setPosts);
  }, [telegramId]);

  async function handlePost() {
    if (!text) return;
    await createWallPost(telegramId, telegramId, text);
    setText('');
    const data = await listWallPosts(telegramId);
    setPosts(data);
  }

  return (
    <div className="p-4 space-y-4 text-text">
      <h2 className="text-xl font-bold">My Wall</h2>
      <div className="space-y-2">
        <textarea
          className="w-full border border-border rounded p-2 bg-surface"
          rows="3"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Write something..."
        />
        <button
          onClick={handlePost}
          className="px-2 py-1 bg-primary hover:bg-primary-hover rounded"
        >
          Post
        </button>
      </div>
      <div className="space-y-2">
        {posts.map((p) => (
          <div key={p._id} className="border border-border rounded p-2">
            <div className="text-sm text-subtext">
              {new Date(p.createdAt).toLocaleString()}
            </div>
            <div>{p.text}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
