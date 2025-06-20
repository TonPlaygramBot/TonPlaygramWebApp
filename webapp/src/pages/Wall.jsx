import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { FaTelegramPlane, FaTwitter, FaFacebook } from 'react-icons/fa';
import useTelegramBackButton from '../hooks/useTelegramBackButton.js';
import OpenInTelegram from '../components/OpenInTelegram.jsx';
import { getTelegramId } from '../utils/telegram.js';
import {
  listWallFeed,
  listWallPosts,
  createWallPost,
  likeWallPost,
  commentWallPost,
  shareWallPost,
  getProfile
} from '../utils/api.js';

export default function Wall() {
  useTelegramBackButton();
  let telegramId;
  try {
    telegramId = getTelegramId();
  } catch (err) {
    return <OpenInTelegram />;
  }

  const { id } = useParams();
  const idParam = id;

  const [posts, setPosts] = useState([]);
  const [text, setText] = useState('');
  const [photo, setPhoto] = useState(null);
  const [commentText, setCommentText] = useState({});
  const [tags, setTags] = useState('');
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    if (id) {
      listWallPosts(id).then(setPosts);
      getProfile(id).then(setProfile).catch(() => {});
    } else {
      listWallFeed(telegramId).then(setPosts);
    }
  }, [telegramId, id]);

  async function handlePost() {
    if (!text && !photo) return;
    const tagArr = tags
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t);
    await createWallPost(telegramId, telegramId, text, photo, tagArr);
    setText('');
    setPhoto(null);
    setTags('');
    const data = await listWallFeed(telegramId);
    setPosts(data);
  }

  async function handleLike(id) {
    await likeWallPost(id, telegramId);
    const data = idParam ? await listWallPosts(idParam) : await listWallFeed(telegramId);
    setPosts(data);
  }

  async function handleComment(id) {
    if (!commentText[id]) return;
    await commentWallPost(id, telegramId, commentText[id]);
    setCommentText({ ...commentText, [id]: '' });
    const data = idParam ? await listWallPosts(idParam) : await listWallFeed(telegramId);
    setPosts(data);
  }

  async function handleShare(id) {
    await shareWallPost(id, telegramId);
    const data = idParam ? await listWallPosts(idParam) : await listWallFeed(telegramId);
    setPosts(data);
  }

  function shareOn(platform, post) {
    const url = `${window.location.origin}/wall/${post.owner}?post=${post._id}`;
    const text = post.text || '';
    let shareUrl = '';
    if (platform === 'telegram') {
      shareUrl = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
    } else if (platform === 'twitter') {
      shareUrl = `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
    } else if (platform === 'facebook') {
      shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
    }
    window.open(shareUrl, '_blank');
  }

  return (
    <div className="p-4 space-y-4 text-text">
      <h2 className="text-xl font-bold">
        {idParam && profile
          ? `${profile.nickname || profile.firstName || 'User'}'s Wall`
          : 'The Wall'}
      </h2>
      <div className="flex space-x-4 text-sm border-b border-border pb-2">
        <Link to="/wall" className="hover:underline">
          Wall
        </Link>
        <Link to="/friends" className="hover:underline">
          Friends
        </Link>
        <Link to="/friends#leaderboard" className="hover:underline">
          Leaderboard
        </Link>
        <Link to="/messages" className="hover:underline">
          Inbox
        </Link>
      </div>
      {!idParam && (
        <div className="space-y-2">
          <textarea
            className="w-full border border-border rounded p-2 bg-surface"
            rows="3"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Write something..."
          />
          <input
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            className="w-full border border-border rounded p-2 bg-surface"
            placeholder="Tags (comma separated)"
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
      )}
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
            {p.tags?.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {p.tags.map((t, idx) => (
                  <span key={idx} className="bg-accent text-xs px-1 rounded">#{t}</span>
                ))}
              </div>
            )}
            <div className="flex space-x-2 text-sm">
              <button onClick={() => handleLike(p._id)}>Like ({p.likes?.length || 0})</button>
              <button onClick={() => handleShare(p._id)}>Repost</button>
              <FaTelegramPlane className="cursor-pointer" onClick={() => shareOn('telegram', p)} />
              <FaTwitter className="cursor-pointer" onClick={() => shareOn('twitter', p)} />
              <FaFacebook className="cursor-pointer" onClick={() => shareOn('facebook', p)} />
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
