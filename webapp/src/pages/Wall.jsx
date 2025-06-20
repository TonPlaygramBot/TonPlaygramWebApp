import { useEffect, useState } from 'react';
import useTelegramBackButton from '../hooks/useTelegramBackButton.js';
import OpenInTelegram from '../components/OpenInTelegram.jsx';
import { getTelegramId } from '../utils/telegram.js';
import {
  listWallFeed,
  createWallPost,
  likeWallPost,
  commentWallPost,
  shareWallPost
} from '../utils/api.js';

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
  const [photo, setPhoto] = useState(null);
  const [commentText, setCommentText] = useState({});

  useEffect(() => {
    listWallFeed(telegramId).then(setPosts);
  }, [telegramId]);

  async function handlePost() {
    if (!text && !photo) return;
    await createWallPost(telegramId, telegramId, text, photo);
    setText('');
    setPhoto(null);
    const data = await listWallFeed(telegramId);
    setPosts(data);
  }

  async function handleLike(id) {
    await likeWallPost(id, telegramId);
    const data = await listWallFeed(telegramId);
    setPosts(data);
  }

  async function handleComment(id) {
    if (!commentText[id]) return;
    await commentWallPost(id, telegramId, commentText[id]);
    setCommentText({ ...commentText, [id]: '' });
    const data = await listWallFeed(telegramId);
    setPosts(data);
  }

  async function handleShare(id) {
    await shareWallPost(id, telegramId);
    const data = await listWallFeed(telegramId);
    setPosts(data);
  }

  return (
    <div className="p-4 space-y-4 text-text">
      <h2 className="text-xl font-bold">The Wall</h2>
      <div className="space-y-2">
        <textarea
          className="w-full border border-border rounded p-2 bg-surface"
          rows="3"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Write something..."
        />
        <input
          type="file"
          accept="image/*"
          onChange={(e) => {
            const file = e.target.files[0];
            if (!file) return setPhoto(null);
            const reader = new FileReader();
            reader.onload = (ev) => setPhoto(ev.target.result);
            reader.readAsDataURL(file);
          }}
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
          <div key={p._id} className="border border-border rounded p-2 space-y-1">
            <div className="text-sm text-subtext">
              {new Date(p.createdAt).toLocaleString()}
            </div>
            {p.text && <div>{p.text}</div>}
            {p.photo && (
              <img src={p.photo} alt="post" className="max-w-full rounded" />
            )}
            <div className="flex space-x-2 text-sm">
              <button onClick={() => handleLike(p._id)}>Like ({p.likes?.length || 0})</button>
              <button onClick={() => handleShare(p._id)}>Share</button>
            </div>
            <div className="space-y-1">
              {p.comments?.map((c, idx) => (
                <div key={idx} className="text-sm">
                  <span className="font-semibold">{c.author}:</span> {c.text}
                </div>
              ))}
            </div>
            <div className="flex space-x-2">
              <input
                type="text"
                value={commentText[p._id] || ''}
                onChange={(e) =>
                  setCommentText({ ...commentText, [p._id]: e.target.value })
                }
                className="flex-1 border border-border rounded px-2 py-1 bg-surface text-sm"
                placeholder="Comment..."
              />
              <button
                onClick={() => handleComment(p._id)}
                className="px-2 py-1 bg-primary hover:bg-primary-hover rounded text-sm"
              >
                Send
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
