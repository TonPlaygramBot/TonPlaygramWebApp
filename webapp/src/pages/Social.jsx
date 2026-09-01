import { useEffect, useState } from 'react';
import { Bell, MessageCircle, Users } from 'lucide-react';
import { Link } from 'react-router-dom';

import MediaWall from '../features/flamingo/MediaWall';
import '../features/flamingo/community-wall.css';
import { getUnreadCount, listFriendRequests, listFriends } from '../utils/api.js';
import { getTelegramId } from '../utils/telegram.js';

function countItems(value) {
  if (Array.isArray(value)) return value.length;
  if (Array.isArray(value?.requests)) return value.requests.length;
  return 0;
}

export default function Social() {
  const [summary, setSummary] = useState({ messages: 0, friends: 0, notifications: 0 });

  useEffect(() => {
    let active = true;
    let telegramId;
    try { telegramId = getTelegramId(); } catch { return undefined; }

    Promise.allSettled([
      getUnreadCount(telegramId),
      listFriends(telegramId),
      listFriendRequests(telegramId),
    ]).then(([messages, friends, notifications]) => {
      if (!active) return;
      setSummary({
        messages: messages.status === 'fulfilled' ? Number(messages.value?.count ?? messages.value ?? 0) : 0,
        friends: friends.status === 'fulfilled' ? countItems(friends.value) : 0,
        notifications: notifications.status === 'fulfilled' ? countItems(notifications.value) : 0,
      });
    });

    return () => { active = false; };
  }, []);

  return (
    <main className="community-wall-page social-wall-page">
      <section className="social-hub" aria-labelledby="social-hub-title">
        <div className="social-hub-heading">
          <div><small>YOUR COMMUNITY</small><h1 id="social-hub-title">Social Hub</h1></div>
          <p>Messages, friends and notifications—all together.</p>
        </div>
        <div className="social-hub-links">
          <Link to="/messages" aria-label={`${summary.messages} unread messages`}>
            <span><MessageCircle /></span><strong>Messages</strong><b>{summary.messages}</b>
          </Link>
          <Link to="/messages" aria-label={`${summary.friends} friends`}>
            <span><Users /></span><strong>Friends</strong><b>{summary.friends}</b>
          </Link>
          <Link to="/messages" aria-label={`${summary.notifications} friend notifications`}>
            <span><Bell /></span><strong>Notifications</strong><b>{summary.notifications}</b>
          </Link>
        </div>
      </section>
      <section className="social-wall-content"><MediaWall /></section>
    </main>
  );
}
