import { useEffect, useState } from 'react';

import GameCard from '../components/GameCard.jsx';

import MiningCard from '../components/MiningCard.tsx';

import SpinGame from '../components/SpinGame.jsx';
import DailyCheckIn from '../components/DailyCheckIn.jsx';

import TasksCard from '../components/TasksCard.jsx';
import StoreAd from '../components/StoreAd.jsx';
import NftGiftCard from '../components/NftGiftCard.jsx';

import {
  FaUser,
  FaArrowCircleUp,
  FaArrowCircleDown,
  FaWallet
} from 'react-icons/fa';
import { useTonAddress, useTonConnectUI } from '@tonconnect/ui-react';

import { Link } from 'react-router-dom';

import { ping, getAppStats, getOnlineCount } from '../utils/api.js';

import { getAvatarUrl, saveAvatar, loadAvatar } from '../utils/avatarUtils.js';

import TonConnectButton from '../components/TonConnectButton.jsx';
import useTokenBalances from '../hooks/useTokenBalances.js';
import useWalletUsdValue from '../hooks/useWalletUsdValue.js';
import { getTelegramId, getTelegramPhotoUrl } from '../utils/telegram.js';
import { getProfile } from '../utils/api.js';

// Token contract on the TON network
const TPC_JETTON_ADDRESS =
  'EQDY3qbfGN6IMI5d4MsEoprhuMTz09OkqjyhPKX6DVtzbi6X';

// Public wallet addresses with initial allocations
const walletAddresses = [
  {
    label: 'Token Contract',
    address: 'EQDY3qbfGN6IMI5d4MsEoprhuMTz09OkqjyhPKX6DVtzbi6X',
  },
  {
    label: 'Mining',
    address: 'UQDM5AVaMaeoLEvSwBn3C6MuMZ-Ouf0IQXEA-kbnzCuKLRBJ',
  },
  { label: 'Dev', address: 'UQC5D42owfZ9JzYhyDid93QdVCX8D-DhgupB27FMpKNMf0lb' },
  {
    label: 'DEX/CEX & Liquidity',
    address: 'UQDSPHxwE8o9HoEUF89U-U577GPI_5pdESDkUBIQ4RzFWiH1',
  },
  {
    label: 'Development & Treasury',
    address: 'UQCGMf2Xqdw6uDpPidA0ufcEeXU4Z7i2DwIxT5gkH4AENmaJ',
  },
  {
    label: 'Marketing & Growth',
    address: 'UQCGfGKrqLQ8vmsVNLMzBtOUZ-S2-83kQGPoDlHUiKLcf1pm',
  },
  {
    label: 'Referral Leaderboard Airdrop',
    address: 'UQB28dBa2IUtMfeK2k68FLYqCfXV7_Oh6rB1BdiSZKcvrwxB',
  },
  {
    label: 'Advisors & Partners',
    address: 'UQDZmB800S6JkIpStYXocag08stDFEHgo1lbxHOXP8bfQRto',
  },
];


export default function Home() {

  const [status, setStatus] = useState('checking');

  const [photoUrl, setPhotoUrl] = useState(loadAvatar() || '');
  const { tpcBalance, tonBalance, usdtBalance } = useTokenBalances();
  const usdValue = useWalletUsdValue(tonBalance, usdtBalance);
  const walletAddress = useTonAddress();
  const [tonConnectUI] = useTonConnectUI();
  const shortAddress = walletAddress
    ? `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}`
    : '';

  const [supply, setSupply] = useState(null);
  const [holders, setHolders] = useState(null);
  const [contractTonBalance, setContractTonBalance] = useState(null);
  const [walletBalances, setWalletBalances] = useState({});
  const [stats, setStats] = useState(null);

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
          const src = p?.photo || getTelegramPhotoUrl();
          setPhotoUrl(src);
          if (p?.photo) saveAvatar(p.photo);
        })
        .catch(() => {
          setPhotoUrl(getTelegramPhotoUrl());
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
            setPhotoUrl(p?.photo || getTelegramPhotoUrl());
            if (p?.photo) saveAvatar(p.photo);
          })
          .catch(() => setPhotoUrl(getTelegramPhotoUrl()));
      }
    };
    window.addEventListener('profilePhotoUpdated', handleUpdate);
    return () => window.removeEventListener('profilePhotoUpdated', handleUpdate);
  }, []);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(
          `https://tonapi.io/v2/jettons/${TPC_JETTON_ADDRESS}`
        );
        const data = await res.json();
        const decimals = Number(data.metadata?.decimals) || 0;
        setSupply(Number(data.total_supply) / 10 ** decimals);
        setHolders(data.holders_count);
      } catch (err) {
        console.error('Failed to load TPC info:', err);
      }
      try {
        const res = await fetch(
          `https://tonapi.io/v2/accounts/${TPC_JETTON_ADDRESS}`
        );
        const acc = await res.json();
        setContractTonBalance(Number(acc.balance) / 1e9);
      } catch (err) {
        console.error('Failed to load contract balance:', err);
      }
    }
    load();
  }, []);

  useEffect(() => {
    async function loadBalances() {
      const map = {};
      await Promise.all(
        walletAddresses.map(async (w) => {
          try {
            const res = await fetch(
              `https://tonapi.io/v2/accounts/${w.address}/jettons/${TPC_JETTON_ADDRESS}`
            );
            if (!res.ok) return;
            const data = await res.json();
            const decimals = Number(data.jetton?.decimals) || 0;
            map[w.address] = Number(data.balance) / 10 ** decimals;
          } catch (err) {
            console.error('Failed to load balance for', w.address, err);
          }
        })
      );
      setWalletBalances(map);
    }
    loadBalances();
  }, []);

  useEffect(() => {
    async function loadStats() {
      try {
        const data = await getAppStats();
        const online = await getOnlineCount();
        setStats({
          minted: data.minted,
          accounts: data.accounts,
          activeUsers: online.count || data.activeUsers || 0,
          nftsCreated: data.nftsCreated,
        });
      } catch (err) {
        console.error('Failed to load stats:', err);
      }
    }
    loadStats();
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
            />
            <div className="flex-1 flex items-center justify-center space-x-1">
              <img src="/assets/icons/TON.webp" alt="TON" className="w-8 h-8" />
              <span className="text-base">{formatValue(tonBalance ?? '...')}</span>
            </div>
            <div className="flex-1 flex items-center justify-center space-x-1">
              <img src="/assets/icons/Usdt.webp" alt="USDT" className="w-8 h-8" />
              <span className="text-base">{formatValue(usdtBalance ?? '...', 2)}</span>
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
              />

              <p className="text-center text-xs text-subtext">Only to send and receive TPC coins</p>

              <div className="flex items-start justify-between">
                <Link to="/wallet?mode=send" className="flex items-center space-x-1 -ml-1 pt-1">
                  <FaArrowCircleUp className="text-accent w-8 h-8" />
                  <span className="text-xs text-accent">Send</span>
                </Link>
                <div className="flex flex-col items-center space-y-1">
                  <img src="/assets/icons/TPCcoin_1.webp" alt="TPC" className="w-10 h-10" />
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
        </div>

      </div>

      <DailyCheckIn />
      <SpinGame />

      <div className="grid grid-cols-1 gap-4">
        <MiningCard />
        <TasksCard />
        <StoreAd />
        <div className="relative bg-surface border border-border rounded-xl p-4 space-y-2 overflow-hidden wide-card">
          <img
            src="/assets/SnakeLaddersbackground.png"
            className="background-behind-board object-cover"
            alt=""
          />
          <h3 className="text-lg font-bold text-text text-center">Tokenomics &amp; Roadmap</h3>
          {/* Removed outdated emission schedule */}
          <div className="space-y-1">
            <p className="text-lg font-bold">Total Balance</p>
            <p className="text-2xl flex items-center gap-1">
              {supply == null ? '...' : formatValue(supply, 2)}
              <img src="/assets/icons/TPCcoin_1.webp" alt="TPC" className="w-4 h-4" />
            </p>
            {holders != null && (
              <p className="text-sm text-subtext">Holders: {holders}</p>
            )}
            {contractTonBalance != null && (
              <p className="text-sm text-subtext">
                Contract TON balance: {formatValue(contractTonBalance, 3)} TON
              </p>
            )}
            <p className="text-xs break-all mt-1 text-primary">{TPC_JETTON_ADDRESS}</p>
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-center">TPC Wallet Addresses</h4>
            <ul className="text-xs break-all space-y-1">
              {walletAddresses.map((w) => (
                <li key={w.address} className="flex justify-between items-center gap-2">
                  <div>
                    <span className="font-semibold text-brand-gold">{w.label}: </span>
                    <a
                      href={`https://tonscan.org/address/${w.address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      {w.address}
                    </a>
                  </div>
                  {walletBalances[w.address] != null && (
                    <span className="flex items-center whitespace-nowrap">
                      {formatValue(walletBalances[w.address], 2)}{' '}
                      <img src="/assets/icons/TPCcoin_1.webp" alt="TPC" className="inline-block w-3 h-3 ml-1" />
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
          <Link
            to="/tokenomics"
            className="mx-auto block px-3 py-1 bg-primary rounded hover:bg-primary-hover text-white-shadow text-center"
          >
            Learn More
          </Link>
        </div>
      </div>

      {stats && (
        <div className="relative bg-surface border border-border rounded-xl p-4 space-y-2 overflow-hidden wide-card">
          <img
            src="/assets/SnakeLaddersbackground.png"
            className="background-behind-board object-cover"
            alt=""
          />
          <h3 className="text-lg font-bold text-text text-center">Platform Stats</h3>
          <div className="text-center space-y-1 text-sm">
            <p>
              Total Minted: {formatValue(stats.minted, 0)}{' '}
              <img src="/assets/icons/TPCcoin_1.webp" alt="TPC" className="inline-block w-4 h-4 ml-1" />
            </p>
            <p>Accounts: {stats.accounts}</p>
            <p>Active Users: {stats.activeUsers}</p>
            <p>NFTs Created: {stats.nftsCreated}</p>
          </div>
        </div>
      )}

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
