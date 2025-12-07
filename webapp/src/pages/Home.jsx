import { useEffect, useState } from 'react';

import TasksCard from '../components/TasksCard.jsx';
import NftGiftCard from '../components/NftGiftCard.jsx';
import ProjectAchievementsCard from '../components/ProjectAchievementsCard.jsx';
import HomeGamesCard from '../components/HomeGamesCard.jsx';
import DailyCheckIn from '../components/DailyCheckIn.jsx';

import {
  FaArrowUp,
  FaArrowDown,
  FaWallet
} from 'react-icons/fa';
import { IoLogoTiktok } from 'react-icons/io5';
import { RiTelegramFill } from 'react-icons/ri';
import { useTonAddress, useTonConnectUI } from '@tonconnect/ui-react';

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
import useTokenBalances from '../hooks/useTokenBalances.js';
import useWalletUsdValue from '../hooks/useWalletUsdValue.js';
import { getTelegramId, getTelegramPhotoUrl } from '../utils/telegram.js';


export default function Home() {

  const [status, setStatus] = useState('checking');

  const [photoUrl, setPhotoUrl] = useState(loadAvatar() || '');
  const baseUrl = import.meta.env.BASE_URL || '/';
  const gamePreloads = [
    {
      name: 'Pool Royale preload',
      description: 'Text bundle of code for Pool Royale animations and HUD.',
      href: `${baseUrl}game-preloads/pool-royale-preload.txt`
    },
    {
      name: '3D Snooker preload',
      description: 'Key snippets for billiards physics and +Y mobile controls.',
      href: `${baseUrl}game-preloads/3d-snooker-preload.txt`
    }
  ];
  const { tpcBalance, tonBalance, tpcWalletBalance } = useTokenBalances();
  const usdValue = useWalletUsdValue(tonBalance, tpcWalletBalance);
  const walletAddress = useTonAddress();
  const [tonConnectUI] = useTonConnectUI();


  useEffect(() => {
    ping()
      .then(() => setStatus('online'))
      .catch(() => setStatus('offline'));

    const id = getTelegramId();
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
      const id = getTelegramId();
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
    return () => window.removeEventListener('profilePhotoUpdated', handleUpdate);
  }, []);



  return (

    <div className="space-y-4">


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
              <span className="text-base">{formatValue(tonBalance ?? '...')}</span>
            </div>
            <div className="flex-1 flex items-center justify-center space-x-1">
              <img src="/assets/icons/ezgif-54c96d8a9b9236.webp" alt="TPC" className="w-8 h-8" />
              <span className="text-base">{formatValue(tpcWalletBalance ?? '...', 2)}</span>
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
              onError={(e) => { e.currentTarget.style.display = "none"; }}
              />

              <p className="text-center text-xs text-yellow-400">Only to send and receive TPC coins</p>

              <div className="flex items-start justify-between">
                <Link to="/wallet?mode=send" className="flex items-center space-x-1 -ml-1 pt-1">
                  <span className="text-sm text-red-500" style={{ WebkitTextStroke: '1px white' }}>Send</span>
                  <div className="w-9 h-9 rounded-full bg-red-500 border-2 border-white flex items-center justify-center">
                    <FaArrowUp className="text-white w-5 h-5" style={{ stroke: 'black', strokeWidth: '2px' }} />
                  </div>
                </Link>
                <div className="flex flex-col items-center space-y-1">
              <img src="/assets/icons/ezgif-54c96d8a9b9236.webp" alt="TPC" className="w-[4rem] h-[4rem]" />
                  <span className="text-sm">{formatValue(tpcBalance ?? '...', 2)}</span>
                </div>
                <Link to="/wallet?mode=receive" className="flex items-center space-x-1 -mr-1 pt-1">
                  <div className="w-9 h-9 rounded-full bg-green-500 border-2 border-white flex items-center justify-center">
                    <FaArrowDown className="text-white w-5 h-5" style={{ stroke: 'black', strokeWidth: '2px' }} />
                  </div>
                  <span className="text-sm text-green-500" style={{ WebkitTextStroke: '1px white' }}>Receive</span>
                </Link>
              </div>
            </div>
          </div>

          <DailyCheckIn />
          <NftGiftCard />
          <HomeGamesCard />
        </div>

      </div>

        <div className="grid grid-cols-1 gap-4">
          <TasksCard />
        </div>
        <ProjectAchievementsCard />

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

      <div className="mt-4 bg-surface border border-border rounded-xl p-4 space-y-3">
        <div className="text-center space-y-1">
          <h3 className="text-lg font-semibold text-white">Preload game code (tekst)</h3>
          <p className="text-sm text-subtext">
            Download text bundles for the main games so Tirana Hallway can cache them faster.
          </p>
        </div>
        <div className="space-y-2">
          {gamePreloads.map((preload) => (
            <div key={preload.name} className="flex flex-col sm:flex-row sm:items-center sm:justify-between bg-background/50 border border-border rounded-lg p-3">
              <div className="space-y-0.5">
                <p className="text-sm font-semibold text-white">{preload.name}</p>
                <p className="text-xs text-subtext">{preload.description}</p>
              </div>
              <a
                href={preload.href}
                download
                className="mt-2 sm:mt-0 inline-flex items-center justify-center px-3 py-1.5 text-sm font-semibold bg-primary text-surface rounded-full shadow-primary/40 hover:shadow-primary/60 shadow"
              >
                Download bundle
              </a>
            </div>
          ))}
        </div>
      </div>
      <p className="text-center text-xs text-subtext">Status: {status}</p>
      <div className="mt-4 space-y-2 text-center text-xs text-subtext">
        <p>
          This platform is currently in its prototype stage, built to give you a
          clear idea of how the full ecosystem will function. We’re actively
          working on improvements and new features around the clock.
        </p>
        <p>
          🧠 TonPlaygram was fully designed and developed by a single founder,
          with the help of AI tools and zero external funding. Despite limited
          resources, the goal has always been to deliver a powerful, engaging
          experience from day one.
        </p>
        <p>
          Once sufficient funding is secured, the platform will be rebuilt
          professionally with a dedicated team to ensure performance,
          scalability, and long-term growth.
        </p>
        <p>
          Thank you for your support and patience as we continue building the
          future of crypto gaming. 🚀
        </p>
      </div>
    </div>

  );

}

function formatValue(value, decimals = 4) {
  if (typeof value !== 'number') {
    const parsed = parseFloat(value);
    if (isNaN(parsed)) return value;
    return parsed.toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  }
  return value.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}
