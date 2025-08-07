import { useEffect, useState } from 'react';

import TasksCard from '../components/TasksCard.jsx';
import NftGiftCard from '../components/NftGiftCard.jsx';
import ProjectAchievementsCard from '../components/ProjectAchievementsCard.jsx';
import HomeGamesCard from '../components/HomeGamesCard.jsx';

import {
  FaArrowCircleUp,
  FaArrowCircleDown,
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
              src="/assets/SnakeLaddersbackground.png"
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
              <img src="/assets/icons/eab316f3-7625-42b2-9468-d421f81c4d7c.webp" alt="TPC" className="w-8 h-8" />
              <span className="text-base">{formatValue(tpcWalletBalance ?? '...', 2)}</span>
            </div>
          </div>

          <div className="relative">
            <div className="relative bg-surface border border-border rounded-xl p-4 pt-6 space-y-2 overflow-hidden wide-card">
              <div className="flex items-center justify-center space-x-1 mb-1">
                <FaWallet className="text-primary" />
                <span className="text-lg font-bold">Wallet</span>
              </div>
              <img
                
                src="/assets/SnakeLaddersbackground.png"
                className="background-behind-board object-cover"
                alt=""
              onError={(e) => { e.currentTarget.style.display = "none"; }}
              />

              <p className="text-center text-xs text-subtext">Only to send and receive TPC coins</p>

              <div className="flex items-start justify-between">
                <Link to="/wallet?mode=send" className="flex items-center space-x-1 -ml-1 pt-1">
                  <FaArrowCircleUp className="text-accent w-8 h-8" />
                  <span className="text-xs text-accent">Send</span>
                </Link>
                <div className="flex flex-col items-center space-y-1">
                  <img src="/assets/icons/eab316f3-7625-42b2-9468-d421f81c4d7c.webp" alt="TPC" className="w-10 h-10" />
                  <span className="text-sm">{formatValue(tpcBalance ?? '...', 2)}</span>
                </div>
                <Link to="/wallet?mode=receive" className="flex items-center space-x-1 -mr-1 pt-1">
                  <FaArrowCircleDown className="text-accent w-8 h-8" />
                  <span className="text-xs text-accent">Receive</span>
                </Link>
              </div>
            </div>
          </div>

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
      <p className="text-center text-xs text-subtext">Status: {status}</p>


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
