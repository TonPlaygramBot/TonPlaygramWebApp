import { useEffect, useState } from 'react';

import ProjectAchievementsCard from '../components/ProjectAchievementsCard.jsx';
import PwaDownloadFrame from '../components/PwaDownloadFrame.jsx';
import ThemePicker from '../components/ThemePicker.jsx';
import HomeIntroduction from '../components/HomeIntroduction.jsx';
import PlatformHelpAgentCard from '../components/PlatformHelpAgentCard.jsx';

import { FaArrowUp, FaArrowDown, FaWallet } from 'react-icons/fa';
import { IoLogoTiktok } from 'react-icons/io5';
import { RiTelegramFill } from 'react-icons/ri';
import {
  BrainCircuit,
  Heart,
  Rocket,
  Sparkles,
  Users
} from 'lucide-react';
import { useTonAddress } from '@tonconnect/ui-react';

const xIcon = (
  <img
    src="/assets/icons/new-twitter-x-logo-twitter-icon-x-social-media-icon-free-png.webp"
    alt="X"
    className="w-6 h-6"
  />
);

import { Link } from 'react-router-dom';

import { ping, getProfile, fetchTelegramInfo } from '../utils/api.js';

import { getAvatarUrl, saveAvatar, loadAvatar } from '../utils/avatarUtils.js';

import TonConnectButton from '../components/TonConnectButton.jsx';
import LinkGoogleButton from '../components/LinkGoogleButton.jsx';
import useTokenBalances from '../hooks/useTokenBalances.js';
import useWalletUsdValue from '../hooks/useWalletUsdValue.js';
import { getTelegramId, getTelegramPhotoUrl } from '../utils/telegram.js';
import { loadGoogleProfile } from '../utils/google.js';

const getStoredWalletAddress = () => {
  try {
    return localStorage.getItem('walletAddress') || '';
  } catch {
    return '';
  }
};

export default function Home() {
  const [status, setStatus] = useState('checking');
  const [photoUrl, setPhotoUrl] = useState(loadAvatar() || '');
  const { tpcBalance, tonBalance, tpcWalletBalance } = useTokenBalances();
  const usdValue = useWalletUsdValue(tonBalance, tpcWalletBalance);
  const tonAddress = useTonAddress();
  const [walletAddress, setWalletAddress] = useState(
    () => tonAddress || getStoredWalletAddress()
  );
  const hasGoogle = Boolean(loadGoogleProfile()?.id);
  let telegramId = null;
  try {
    telegramId = getTelegramId();
  } catch {
    telegramId = null;
  }
  const hasTelegram = Boolean(telegramId);

  useEffect(() => {
    setWalletAddress(tonAddress || getStoredWalletAddress());
  }, [tonAddress]);

  useEffect(() => {
    const syncFromStorage = () => {
      setWalletAddress(tonAddress || getStoredWalletAddress());
    };

    const handleWalletAddressUpdated = (event) => {
      const nextAddress = event?.detail?.address || '';
      setWalletAddress(nextAddress || tonAddress || getStoredWalletAddress());
    };

    window.addEventListener('storage', syncFromStorage);
    window.addEventListener('focus', syncFromStorage);
    window.addEventListener('pageshow', syncFromStorage);
    window.addEventListener('walletAddressUpdated', handleWalletAddressUpdated);

    return () => {
      window.removeEventListener('storage', syncFromStorage);
      window.removeEventListener('focus', syncFromStorage);
      window.removeEventListener('pageshow', syncFromStorage);
      window.removeEventListener(
        'walletAddressUpdated',
        handleWalletAddressUpdated
      );
    };
  }, [tonAddress]);

  const handleOpenTelegramAuth = () => {
    const deepLink = 'tg://resolve?domain=TonPlaygramBot&startapp=account';
    const fallback = 'https://t.me/TonPlaygramBot?startapp=account';
    window.location.href = deepLink;
    setTimeout(() => window.open(fallback, '_blank', 'noopener'), 450);
  };

  useEffect(() => {
    ping()
      .then(() => setStatus('online'))
      .catch(() => setStatus('offline'));

    const id = telegramId;
    const saved = loadAvatar();
    if (saved) {
      setPhotoUrl(saved);
    } else {
      getProfile(id)
        .then((p) => {
          if (p?.photo) {
            setPhotoUrl(p.photo);
            saveAvatar(p.photo);
          } else {
            fetchTelegramInfo(id).then((info) => {
              setPhotoUrl(info?.photoUrl || getTelegramPhotoUrl());
            });
          }
        })
        .catch(() => {
          fetchTelegramInfo(id)
            .then((info) => {
              setPhotoUrl(info?.photoUrl || getTelegramPhotoUrl());
            })
            .catch(() => setPhotoUrl(getTelegramPhotoUrl()));
        });
    }

    const handleUpdate = () => {
      const id = telegramId;
      const saved = loadAvatar();
      if (saved) {
        setPhotoUrl(saved);
      } else {
        getProfile(id)
          .then((p) => {
            if (p?.photo) {
              setPhotoUrl(p.photo);
              saveAvatar(p.photo);
            } else {
              fetchTelegramInfo(id).then((info) => {
                setPhotoUrl(info?.photoUrl || getTelegramPhotoUrl());
              });
            }
          })
          .catch(() => {
            fetchTelegramInfo(id)
              .then((info) => {
                setPhotoUrl(info?.photoUrl || getTelegramPhotoUrl());
              })
              .catch(() => setPhotoUrl(getTelegramPhotoUrl()));
          });
      }
    };
    window.addEventListener('profilePhotoUpdated', handleUpdate);
    return () =>
      window.removeEventListener('profilePhotoUpdated', handleUpdate);
  }, []);

  return (
    <div className="home-page app-theme-page space-y-4">
      <ThemePicker />
      <HomeIntroduction />
      <Link to="/airdrop" className="airdrop-home-card">
        <span><Sparkles /> LIVE TPG AIRDROP GAME</span>
        <strong>Splat targets.<br />Stack TPG rewards.</strong>
        <small>Eggs, tomatoes & oranges ready <b>PLAY NOW →</b></small>
      </Link>
      <div className="flex flex-col items-center">
        {photoUrl && (
          <div className="relative">
            <img
              src={getAvatarUrl(photoUrl)}
              alt="profile"
              className="w-36 h-36 hexagon border-4 border-brand-gold -mt-[20%] mb-3 object-cover"
            />
            {/* Removed inline wallet address overlay */}
          </div>
        )}

        <TonConnectButton />
        {walletAddress && (
          <div className="mt-2 text-center">
            <p className="text-xs text-subtext">Connected TON balance</p>
            <p className="text-lg font-semibold text-white">
              {formatValue(tonBalance ?? '...', 4)} TON
            </p>
          </div>
        )}
        <div className="w-full rounded-xl border border-border bg-surface/60 p-3 mb-2 space-y-2">
          <p className="text-xs text-subtext">
            1 TPG account • connect only what is still missing.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {!hasTelegram && (
              <button
                onClick={handleOpenTelegramAuth}
                className="px-3 py-2 rounded-lg bg-[#229ED9] text-white text-sm font-semibold"
              >
                Continue with Telegram
              </button>
            )}
            {!hasGoogle && (
              <div className="flex items-center justify-center rounded-lg border border-border bg-background/60 px-2 py-1">
                <LinkGoogleButton
                  telegramId={telegramId || null}
                  label="Continue with Google"
                />
              </div>
            )}
            {!walletAddress && (
              <div className="rounded-lg border border-border bg-background/60 px-2 py-1 flex items-center justify-center">
                <TonConnectButton small className="mt-0" />
              </div>
            )}
          </div>
          {hasTelegram && hasGoogle && walletAddress && (
            <p className="text-xs text-green-400">
              All account connection methods are already linked.
            </p>
          )}
        </div>

        {walletAddress && (
          <div className="roll-result text-white text-4xl">
            {'$' + formatValue(usdValue ?? '...', 2)}
          </div>
        )}

        <div className="w-full mt-2 space-y-4">
          <div className="relative bg-surface border border-border rounded-xl p-4 flex items-center justify-around overflow-hidden wide-card">
            <img
              src="/assets/icons/snakes_and_ladders.webp"
              className="background-behind-board object-cover"
              alt=""
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
            <div className="flex-1 flex items-center justify-center space-x-1">
              <img src="/assets/icons/TON.webp" alt="TON" className="w-8 h-8" />
              <span className="text-base">
                {formatValue(tonBalance ?? '...')}
              </span>
            </div>
            <div className="flex-1 flex items-center justify-center space-x-1">
              <img
                src="/assets/icons/file_00000000362481f7978631c42572193f.png"
                alt="TPG"
                className="w-8 h-8"
              />
              <span className="text-base">
                {formatValue(tpcWalletBalance ?? '...', 2)}
              </span>
            </div>
          </div>

          <div className="relative">
            <div className="relative bg-surface border border-border rounded-xl p-4 pt-6 space-y-2 overflow-hidden wide-card">
              <div className="flex items-center justify-center space-x-1 mb-1">
                <FaWallet className="text-primary" />
                <span className="text-lg font-bold text-white">Wallet</span>
              </div>
              <img
                src="/assets/icons/snakes_and_ladders.webp"
                className="background-behind-board object-cover"
                alt=""
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />

              <p className="text-center text-xs text-yellow-400">
                Only to send and receive TPG coins
              </p>

              <div className="flex items-start justify-between">
                <Link
                  to="/wallet?mode=send"
                  className="flex items-center space-x-1 -ml-1 pt-1"
                >
                  <span
                    className="text-sm text-red-500"
                    style={{ WebkitTextStroke: '1px white' }}
                  >
                    Send
                  </span>
                  <div className="w-9 h-9 rounded-full bg-red-500 border-2 border-white flex items-center justify-center">
                    <FaArrowUp
                      className="text-white w-5 h-5"
                      style={{ stroke: 'black', strokeWidth: '2px' }}
                    />
                  </div>
                </Link>
                <div className="flex flex-col items-center space-y-1">
                  <img
                    src="/assets/icons/file_00000000362481f7978631c42572193f.png"
                    alt="TPG"
                    className="w-[4rem] h-[4rem]"
                  />
                  <span className="text-sm">
                    {formatValue(tpcBalance ?? '...', 2)}
                  </span>
                </div>
                <Link
                  to="/wallet?mode=receive"
                  className="flex items-center space-x-1 -mr-1 pt-1"
                >
                  <div className="w-9 h-9 rounded-full bg-green-500 border-2 border-white flex items-center justify-center">
                    <FaArrowDown
                      className="text-white w-5 h-5"
                      style={{ stroke: 'black', strokeWidth: '2px' }}
                    />
                  </div>
                  <span
                    className="text-sm text-green-500"
                    style={{ WebkitTextStroke: '1px white' }}
                  >
                    Receive
                  </span>
                </Link>
              </div>
            </div>
          </div>

        </div>
      </div>

      <ProjectAchievementsCard />

      <PwaDownloadFrame />
      <p className="text-center text-xs text-subtext">Status: {status}</p>
      <section className="relative mt-5 overflow-hidden rounded-3xl border border-brand-gold/25 bg-gradient-to-b from-surface via-surface/95 to-background px-4 py-6 shadow-[0_18px_50px_rgba(0,0,0,0.28)]">
        <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-brand-gold/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-16 h-44 w-44 rounded-full bg-primary/10 blur-3xl" />

        <div className="relative">
          <div className="mx-auto flex w-fit items-center gap-2 rounded-full border border-brand-gold/30 bg-brand-gold/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-brand-gold">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            Building in public
          </div>

          <h2 className="mt-4 text-center text-2xl font-black leading-tight text-white">
            A bold vision,
            <span className="block bg-gradient-to-r from-brand-gold via-yellow-200 to-primary bg-clip-text text-transparent">
              growing every day.
            </span>
          </h2>
          <p className="mx-auto mt-3 max-w-sm text-center text-sm leading-6 text-subtext">
            TonPlaygram is an evolving prototype—your first look at a connected
            crypto-gaming ecosystem. New features, sharper experiences, and
            meaningful improvements are being built continuously.
          </p>

          <div className="mt-5 space-y-3 text-left">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-sm">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary">
                  <BrainCircuit className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Founder-built. AI-powered.</h3>
                  <p className="mt-1 text-xs leading-5 text-subtext">
                    Designed and developed by one founder, amplified by AI
                    tools, and created with zero external funding—so far.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-sm">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-brand-gold/25 bg-brand-gold/10 text-brand-gold">
                  <Users className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">The next chapter</h3>
                  <p className="mt-1 text-xs leading-5 text-subtext">
                    With the right funding, a dedicated team will elevate the
                    platform for greater performance, scale, and lasting growth.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-brand-gold/20 bg-gradient-to-r from-brand-gold/10 via-white/[0.03] to-primary/10 p-4 text-center">
            <div className="mb-2 flex justify-center gap-2 text-brand-gold">
              <Heart className="h-4 w-4" aria-hidden="true" />
              <Rocket className="h-4 w-4" aria-hidden="true" />
            </div>
            <p className="text-sm font-semibold leading-6 text-white">
              Thank you for believing early.
            </p>
            <p className="mt-1 text-xs leading-5 text-subtext">
              Your support and patience are helping shape the future of crypto
              gaming—one milestone at a time.
            </p>
          </div>
        </div>
      </section>
      <div className="flex justify-center space-x-4 mt-4">
        <a
          href="https://x.com/TonPlaygram?t=SyGyXA0H8PdLz7z2kfIWQw&s=09"
          target="_blank"
          rel="noopener noreferrer"
        >
          {xIcon}
        </a>
        <a
          href="https://t.me/TonPlaygram"
          target="_blank"
          rel="noopener noreferrer"
        >
          <RiTelegramFill className="text-sky-400 w-6 h-6" />
        </a>
        <a
          href="https://www.tiktok.com/@tonplaygram?_t=ZS-8xxPL1nbD9U&_r=1"
          target="_blank"
          rel="noopener noreferrer"
        >
          <IoLogoTiktok className="text-pink-500 w-6 h-6" />
        </a>
      </div>
      <PlatformHelpAgentCard />
    </div>
  );
}

function formatValue(value, decimals = 4) {
  if (typeof value !== 'number') {
    const parsed = parseFloat(value);
    if (isNaN(parsed)) return value;
    return parsed.toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  }
  return value.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}
