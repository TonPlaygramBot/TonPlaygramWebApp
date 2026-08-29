import { useEffect, useMemo, useState } from 'react';
import {
  FaFacebookF,
  FaInstagram,
  FaLinkedinIn,
  FaRedditAlien,
  FaTiktok,
  FaWhatsapp,
  FaXTwitter
} from 'react-icons/fa6';
import { FaTelegramPlane } from 'react-icons/fa';
import { Check, Copy, Mail, Share2, Sparkles, Users } from 'lucide-react';

import LoginOptions from '../components/LoginOptions.jsx';
import gamesCatalog from '../config/gamesCatalog.js';
import { getGameThumbnail } from '../config/gameAssets.js';
import useTelegramBackButton from '../hooks/useTelegramBackButton.js';
import { getProfile, getReferralInfo } from '../utils/api.js';
import { getAvatarUrl, loadAvatar } from '../utils/avatarUtils.js';
import { BOT_USERNAME } from '../utils/constants.js';
import {
  getTelegramFirstName,
  getTelegramId,
  getTelegramUsername
} from '../utils/telegram.js';

const featuredGameSlugs = [
  'poolroyale',
  'texasholdem',
  'chessbattleroyal',
  'ludobattleroyal',
  'airhockey',
  'domino-royal'
];

export default function Referral() {
  useTelegramBackButton();
  const telegramId = getTelegramId();
  const [info, setInfo] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!telegramId) return;
    let active = true;
    Promise.allSettled([getReferralInfo(telegramId), getProfile(telegramId)])
      .then(([referralResult, profileResult]) => {
        if (!active) return;
        if (referralResult.status === 'fulfilled') setInfo(referralResult.value);
        else setError('We could not load your invite link. Please try again.');
        if (profileResult.status === 'fulfilled') setProfile(profileResult.value);
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [telegramId]);

  const games = useMemo(
    () =>
      featuredGameSlugs
        .map((slug) => gamesCatalog.find((game) => game.slug === slug))
        .filter(Boolean),
    []
  );

  if (!telegramId) return <LoginOptions />;

  const link = info?.referralCode
    ? `https://t.me/${BOT_USERNAME}?start=${info.referralCode}`
    : '';
  const username =
    profile?.nickname ||
    profile?.firstName ||
    getTelegramFirstName() ||
    getTelegramUsername() ||
    'A TonPlayGram player';
  const handle = profile?.username || getTelegramUsername();
  const avatar = getAvatarUrl(profile?.photo || loadAvatar() || '/assets/icons/profile.svg');
  const shareText = `${username} invited you to play on TonPlayGram! Join the games, meet players and earn rewards.`;

  const copyLink = async () => {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  const openShare = (url) => {
    if (!link) return;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const encodedLink = encodeURIComponent(link);
  const encodedText = encodeURIComponent(shareText);
  const socialLinks = [
    { name: 'Telegram', icon: FaTelegramPlane, tone: 'telegram', url: `https://t.me/share/url?url=${encodedLink}&text=${encodedText}` },
    { name: 'WhatsApp', icon: FaWhatsapp, tone: 'whatsapp', url: `https://wa.me/?text=${encodedText}%20${encodedLink}` },
    { name: 'Facebook', icon: FaFacebookF, tone: 'facebook', url: `https://www.facebook.com/sharer/sharer.php?u=${encodedLink}` },
    { name: 'X', icon: FaXTwitter, tone: 'x', url: `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedLink}` },
    { name: 'LinkedIn', icon: FaLinkedinIn, tone: 'linkedin', url: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedLink}` },
    { name: 'Reddit', icon: FaRedditAlien, tone: 'reddit', url: `https://www.reddit.com/submit?url=${encodedLink}&title=${encodedText}` },
    { name: 'Email', icon: Mail, tone: 'email', url: `mailto:?subject=${encodeURIComponent('Come play TonPlayGram with me')}&body=${encodedText}%0A%0A${encodedLink}` }
  ];

  const shareNative = async () => {
    if (!link) return;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Join me on TonPlayGram', text: shareText, url: link });
        return;
      } catch (shareError) {
        if (shareError?.name === 'AbortError') return;
      }
    }
    copyLink();
  };

  const copyForApp = async (appUrl) => {
    await copyLink();
    window.open(appUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <main className="invite-page">
      <section className="invite-hero">
        <div className="invite-hero__orb" aria-hidden="true" />
        <div className="invite-kicker"><Sparkles size={13} /> YOUR PERSONAL INVITE</div>
        <div className="invite-profile">
          <div className="invite-avatar-wrap">
            <img src={avatar} alt={`${username}'s avatar`} className="invite-avatar" />
            <span className="invite-avatar-badge">TPG</span>
          </div>
          <div>
            <p className="invite-profile__label">You’re invited by</p>
            <h1>{username}</h1>
            {handle && <p className="invite-profile__handle">@{handle.replace(/^@/, '')}</p>}
          </div>
        </div>
        <p className="invite-hero__copy">
          One profile. A growing arcade. Real players. Join me on TonPlayGram and let’s play together.
        </p>
        <div className="invite-link-card">
          <div><span>Your unique invite link</span><strong>{loading ? 'Creating your link…' : link || 'Link unavailable'}</strong></div>
          <button type="button" onClick={copyLink} disabled={!link} aria-label="Copy invite link">
            {copied ? <Check size={19} /> : <Copy size={19} />}
          </button>
        </div>
        {error && <p className="invite-error">{error}</p>}
        <button type="button" className="invite-share-primary" onClick={shareNative} disabled={!link}>
          <Share2 size={18} /> Share my invite
        </button>
        <div className="invite-stats">
          <div><Users size={17} /><span><strong>{info?.referralCount ?? 0}</strong> friends joined</span></div>
          <div><Sparkles size={17} /><span><strong>+{(Number(info?.bonusMiningRate || 0) * 100).toFixed(0)}%</strong> mining boost</span></div>
        </div>
      </section>

      <section className="invite-section">
        <div className="invite-section__heading"><span>SHARE ANYWHERE</span><h2>Bring your crew</h2><p>Tap a platform to send your personal invite.</p></div>
        <div className="invite-social-grid">
          {socialLinks.map(({ name, icon: Icon, tone, url }) => (
            <button type="button" key={name} className={`invite-social invite-social--${tone}`} onClick={() => openShare(url)} disabled={!link}>
              <Icon size={21} /><span>{name}</span>
            </button>
          ))}
          <button type="button" className="invite-social invite-social--instagram" onClick={() => copyForApp('https://www.instagram.com/')} disabled={!link}><FaInstagram size={21} /><span>Instagram</span></button>
          <button type="button" className="invite-social invite-social--tiktok" onClick={() => copyForApp('https://www.tiktok.com/')} disabled={!link}><FaTiktok size={20} /><span>TikTok</span></button>
        </div>
        {copied && <p className="invite-copied" role="status"><Check size={14} /> Invite link copied</p>}
      </section>

      <section className="invite-section invite-games-section">
        <div className="invite-section__heading"><span>PLAY TOGETHER</span><h2>Games waiting for you</h2><p>Quick matches, classic strategy and competitive 3D arenas.</p></div>
        <div className="invite-games">
          {games.map((game) => (
            <article className="invite-game" key={game.slug}>
              <img src={getGameThumbnail(game.slug) || game.image} alt={`${game.name} thumbnail`} loading="lazy" />
              <div><strong>{game.name}</strong><p>{game.description}</p></div>
            </article>
          ))}
        </div>
      </section>

      <section className="invite-about">
        <span>WHAT IS TONPLAYGRAM?</span>
        <h2>Your gaming world, together.</h2>
        <p>TonPlayGram is a mobile-first social gaming platform where one player profile connects games, friends, rewards, collectibles and your TON wallet experience.</p>
        <div className="invite-about__pills"><span>🎮 Multiplayer games</span><span>🏆 Play & earn</span><span>💬 Social community</span><span>💎 Digital collectibles</span></div>
        <button type="button" onClick={shareNative} disabled={!link}><Share2 size={17} /> Invite a friend now</button>
      </section>
    </main>
  );
}
