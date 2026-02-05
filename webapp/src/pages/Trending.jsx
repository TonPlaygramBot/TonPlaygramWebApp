import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FaTelegramPlane, FaFacebook, FaGamepad, FaBolt, FaFilter } from 'react-icons/fa';
import {
  AiFillHeart,
  AiOutlineShareAlt,
  AiOutlineComment,
  AiOutlineSend
} from 'react-icons/ai';
import ReactMarkdown from 'react-markdown';

const xIcon = (
  <img
    src="/assets/icons/new-twitter-x-logo-twitter-icon-x-social-media-icon-free-png.webp"
    alt="X"
    className="w-4 h-4"
  />
);

import useTelegramBackButton from '../hooks/useTelegramBackButton.js';
import LoginOptions from '../components/LoginOptions.jsx';
import InboxWidget from '../components/InboxWidget.jsx';
import { getTelegramId } from '../utils/telegram.js';
import {
  createWallPost,
  listTrendingPosts,
  listWallFeed,
  likeWallPost,
  commentWallPost,
  shareWallPost,
  reactWallPost,
  getProfile
} from '../utils/api.js';

const EMOJIS = ['👍', '❤️', '😂', '🎉', '🔥'];
const FEED_TABS = [
  { id: 'for-you', label: 'For You' },
  { id: 'trending', label: 'Trending' }
];

export default function Trending() {
  useTelegramBackButton();
  let telegramId;
  try {
    telegramId = getTelegramId();
  } catch (err) {
    return <LoginOptions />;
  }

  const [posts, setPosts] = useState([]);
  const [authorProfiles, setAuthorProfiles] = useState({});
  const [commentText, setCommentText] = useState({});
  const [postText, setPostText] = useState('');
  const [postTags, setPostTags] = useState('');
  const [activeTab, setActiveTab] = useState('for-you');
  const [isPosting, setIsPosting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    const request =
      activeTab === 'trending'
        ? listTrendingPosts()
        : listWallFeed(telegramId);
    request
      .then((data) => {
        if (active) setPosts(data || []);
      })
      .catch(() => {
        if (active) setPosts([]);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [activeTab, telegramId]);

  useEffect(() => {
    const uniqueAuthors = [...new Set(posts.map((p) => p.author))].filter(
      (a) => !authorProfiles[a]
    );
    uniqueAuthors.forEach((aid) => {
      getProfile(aid)
        .then((prof) =>
          setAuthorProfiles((prev) => ({ ...prev, [aid]: prof }))
        )
        .catch(() => {});
    });
  }, [posts, authorProfiles]);

  const postCountLabel = useMemo(() => {
    if (!posts.length) return '0 drops';
    return `${posts.length} drops`;
  }, [posts.length]);

  async function refresh() {
    const data =
      activeTab === 'trending'
        ? await listTrendingPosts()
        : await listWallFeed(telegramId);
    setPosts(data || []);
  }

  async function handlePostSubmit() {
    if (!postText.trim()) return;
    setIsPosting(true);
    const tags = postTags
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean)
      .slice(0, 5);
    try {
      await createWallPost(telegramId, telegramId, postText.trim(), '', '', tags);
      setPostText('');
      setPostTags('');
      refresh();
    } finally {
      setIsPosting(false);
    }
  }

  async function handleLike(id) {
    await likeWallPost(id, telegramId);
    refresh();
  }

  async function handleComment(id) {
    if (!commentText[id]) return;
    await commentWallPost(id, telegramId, commentText[id]);
    setCommentText({ ...commentText, [id]: '' });
    refresh();
  }

  async function handleShare(id) {
    await shareWallPost(id, telegramId);
    refresh();
  }

  async function handleReact(id, emoji) {
    await reactWallPost(id, telegramId, emoji);
    refresh();
  }

  function shareOn(platform, post) {
    const url = `${window.location.origin}/wall/${post.owner}?post=${post._id}`;
    const text = post.text || '';
    let shareUrl = '';
    if (platform === 'telegram') {
      shareUrl = `https://t.me/share/url?url=${encodeURIComponent(
        url
      )}&text=${encodeURIComponent(text)}`;
    } else if (platform === 'x') {
      shareUrl = `https://x.com/intent/tweet?url=${encodeURIComponent(
        url
      )}&text=${encodeURIComponent(text)}`;
    } else if (platform === 'facebook') {
      shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
    }
    window.open(shareUrl, '_blank');
  }

  return (
    <div className="p-4 space-y-6 text-text">
      <div className="bg-surface/80 border border-border rounded-2xl p-4 md:p-6 space-y-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-subtext">
              TonPlaygram Wall
            </p>
            <h2 className="text-2xl font-bold text-white">
              Gaming Wall Social
            </h2>
            <p className="text-sm text-subtext">
              Drop highlights, recruit squads, and celebrate wins with the
              community.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              to="/games"
              className="inline-flex items-center gap-2 px-3 py-2 rounded-full bg-primary text-background text-sm font-semibold"
            >
              <FaGamepad /> Play Now
            </Link>
            <Link
              to="/messages"
              className="inline-flex items-center gap-2 px-3 py-2 rounded-full border border-border text-sm text-white"
            >
              <FaBolt /> Squad Inbox
            </Link>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-background/50 p-3">
            <p className="text-xs text-subtext">Wall Activity</p>
            <p className="text-lg font-semibold text-white">{postCountLabel}</p>
          </div>
          <div className="rounded-xl border border-border bg-background/50 p-3">
            <p className="text-xs text-subtext">Mode</p>
            <p className="text-lg font-semibold text-white">
              {activeTab === 'trending' ? 'Trending' : 'For You'}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-background/50 p-3">
            <p className="text-xs text-subtext">Boost</p>
            <p className="text-lg font-semibold text-white">XP Drops</p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <div className="rounded-2xl border border-border bg-surface/90 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-white">
                  Share a highlight
                </p>
                <p className="text-xs text-subtext">
                  Start a match thread, shout out your squad, or post a tip.
                </p>
              </div>
              <span className="text-xs text-subtext">
                {postText.length}/240
              </span>
            </div>
            <textarea
              value={postText}
              onChange={(event) =>
                setPostText(event.target.value.slice(0, 240))
              }
              placeholder="What are you playing today?"
              className="w-full min-h-[110px] rounded-xl border border-border bg-background/60 px-3 py-2 text-sm text-white focus:outline-none"
            />
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <input
                type="text"
                value={postTags}
                onChange={(event) => setPostTags(event.target.value)}
                placeholder="Tags (e.g. clutch, ranked, lfg)"
                className="flex-1 rounded-full border border-border bg-background/60 px-3 py-2 text-xs text-white focus:outline-none"
              />
              <button
                onClick={handlePostSubmit}
                disabled={isPosting || !postText.trim()}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-background disabled:opacity-60"
              >
                <AiOutlineSend /> {isPosting ? 'Posting...' : 'Post'}
              </button>
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-subtext">
              <span className="inline-flex items-center gap-2 rounded-full border border-border bg-background/60 px-3 py-1">
                <FaFilter /> Quick filters
              </span>
              {['Highlights', 'Squad Finder', 'Tournaments', 'Coaching'].map(
                (chip) => (
                  <span
                    key={chip}
                    className="rounded-full border border-border bg-background/60 px-3 py-1"
                  >
                    {chip}
                  </span>
                )
              )}
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 border-b border-border pb-2">
            <div className="flex items-center gap-2">
              {FEED_TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    activeTab === tab.id
                      ? 'bg-primary text-background'
                      : 'border border-border text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <span className="text-xs text-subtext">
              {isLoading ? 'Loading feed…' : 'Live updates'}
            </span>
          </div>

          <div className="space-y-4">
            {posts.map((p) => (
              <div
                key={p._id}
                className="border border-border rounded-2xl p-4 space-y-3 bg-surface"
              >
                <div className="flex items-start gap-3">
                  <img
                    src={authorProfiles[p.author]?.photo || '/assets/icons/profile.svg'}
                    alt={`Avatar of ${
                      authorProfiles[p.author]?.nickname ||
                      authorProfiles[p.author]?.firstName ||
                      'User'
                    }`}
                    className="w-10 h-10 rounded-full border border-accent"
                  />
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="text-sm font-semibold text-white">
                          {authorProfiles[p.author]?.nickname ||
                            authorProfiles[p.author]?.firstName ||
                            'User'}
                        </div>
                        <div className="text-xs text-subtext">
                          {new Date(p.createdAt).toLocaleString()} ·{' '}
                          {p.views || 0} views
                        </div>
                      </div>
                      <span className="text-[11px] text-subtext rounded-full border border-border px-2 py-1">
                        {p.tags?.[0] ? `#${p.tags[0]}` : 'Wall Drop'}
                      </span>
                    </div>
                  </div>
                </div>

                {p.text && (
                  <ReactMarkdown className="prose prose-invert break-words">
                    {p.text}
                  </ReactMarkdown>
                )}
                {p.photo && (
                  <img
                    src={p.photo}
                    alt={p.photoAlt || 'post image'}
                    className="w-full rounded-xl"
                  />
                )}
                {p.tags?.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {p.tags.map((t, idx) => (
                      <span
                        key={idx}
                        className="bg-background/70 text-xs px-2 py-1 rounded-full border border-border"
                      >
                        #{t}
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-4 text-sm pt-2 border-t border-border">
                  <button
                    className="flex items-center gap-1 hover:text-accent"
                    onClick={() => handleLike(p._id)}
                  >
                    <AiFillHeart />
                    <span>{p.likes?.length || 0}</span>
                  </button>
                  <button
                    className="flex items-center gap-1 hover:text-accent"
                    onClick={() => handleShare(p._id)}
                  >
                    <AiOutlineShareAlt />
                    <span className="text-xs">Boost</span>
                  </button>
                  <button
                    className="flex items-center gap-1 hover:text-accent"
                    onClick={() => shareOn('telegram', p)}
                  >
                    <FaTelegramPlane />
                  </button>
                  <button
                    className="flex items-center gap-1 hover:text-accent"
                    onClick={() => shareOn('x', p)}
                  >
                    {xIcon}
                  </button>
                  <button
                    className="flex items-center gap-1 hover:text-accent"
                    onClick={() => shareOn('facebook', p)}
                  >
                    <FaFacebook />
                  </button>
                </div>

                <div className="flex flex-wrap gap-2 pt-1 text-sm">
                  {EMOJIS.map((e) => (
                    <button
                      key={e}
                      onClick={() => handleReact(p._id, e)}
                      className="rounded-full border border-border px-2 py-1 hover:opacity-80"
                    >
                      {e} {p.reactions?.[e]?.length || 0}
                    </button>
                  ))}
                </div>

                <div className="space-y-2">
                  {p.comments?.map((c, idx) => (
                    <div key={idx} className="text-sm">
                      <span className="font-semibold">{c.author}:</span> {c.text}
                    </div>
                  ))}
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    type="text"
                    value={commentText[p._id] || ''}
                    onChange={(e) =>
                      setCommentText({ ...commentText, [p._id]: e.target.value })
                    }
                    className="flex-1 border border-border rounded-full px-3 py-2 bg-background/60 text-sm"
                    placeholder="Drop a comment..."
                  />
                  <button
                    onClick={() => handleComment(p._id)}
                    className="px-4 py-2 bg-primary hover:bg-primary-hover rounded-full text-sm font-semibold text-background"
                  >
                    <AiOutlineComment className="inline" /> Reply
                  </button>
                </div>
              </div>
            ))}
            {!isLoading && posts.length === 0 && (
              <div className="border border-border rounded-2xl p-6 text-center text-subtext bg-surface">
                No wall drops yet. Be the first to post a highlight!
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-surface/90 p-4 space-y-3">
            <p className="text-sm font-semibold text-white">Wall Missions</p>
            <div className="space-y-2 text-xs text-subtext">
              <div className="flex items-center justify-between border border-border rounded-xl p-3">
                <span>Post a clip recap</span>
                <span className="text-primary">+50 XP</span>
              </div>
              <div className="flex items-center justify-between border border-border rounded-xl p-3">
                <span>Welcome 3 new players</span>
                <span className="text-primary">+120 XP</span>
              </div>
              <div className="flex items-center justify-between border border-border rounded-xl p-3">
                <span>Join a squad challenge</span>
                <span className="text-primary">+200 XP</span>
              </div>
            </div>
          </div>
          <InboxWidget />
        </div>
      </div>
    </div>
  );
}
