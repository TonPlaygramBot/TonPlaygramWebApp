import React, { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

// Token root (jetton contract) on the TON network
const TPC_JETTON_ADDRESS =
  'EQDY3qbfGN6IMI5d4MsEoprhuMTz09OkqjyhPKX6DVtzbi6X';
// Main mining wallet used throughout the app
const TPC_MASTER_ADDRESS =
  'UQDM5AVaMaeoLEvSwBn3C6MuMZ-Ouf0IQXEA-kbnzCuKLRBJ';
import { AiOutlineCheck } from 'react-icons/ai';

// TOKEN ALLOCATION DATA
const tokenData = [
  { name: 'Play-to-Earn & Mining', value: 40 },
  { name: 'DEX/CEX Liquidity & Ecosystem', value: 20 },
  { name: 'Team/Founder', value: 15 },
  { name: 'Development/Treasury', value: 10 },
  { name: 'Marketing & Growth', value: 7 },
  { name: 'Referral/Airdrop/Leaderboard', value: 5 },
  { name: 'Advisors & Strategic Partners', value: 3 },
];

const tokenColors = [
  '#FFD700', // Gold
  '#1F2937', // Navy/Black
  '#FFB300', // Amber
  '#5058FF', // Blue
  '#00FFB9', // Teal
  '#FF5F1F', // Orange
  '#A1A1A1', // Silver
];

// FEE DISTRIBUTION DATA
const feeData = [
  { name: 'Dev/Owner/Operations', value: 3 },
  { name: 'Buyback & Burn', value: 3 },
  { name: 'Ecosystem Rewards', value: 2 },
  { name: 'Liquidity Pool', value: 1 },
  { name: 'Marketing', value: 1 },
];

const feeColors = [
  '#FFD700', // Gold - Dev/Owner
  '#FF7F50', // Coral - Burn
  '#00BFFF', // Blue - Ecosystem
  '#2ECC40', // Green - Liquidity
  '#FFDC00', // Yellow - Marketing
];

// PUBLIC WALLET ADDRESSES
const walletAddresses = [
  { label: 'Mining', address: 'UQDM5AVaMaeoLEvSwBn3C6MuMZ-Ouf0IQXEA-kbnzCuKLRBJ' },
  { label: 'Dev', address: 'UQC5D42owfZ9JzYhyDid93QdVCX8D-DhgupB27FMpKNMf0lb' },
  { label: 'DEX/CEX & Liquidity', address: 'UQDSPHxwE8o9HoEUF89U-U577GPI_5pdESDkUBIQ4RzFWiH1' },
  { label: 'Development & Treasury', address: 'UQCGMf2Xqdw6uDpPidA0ufcEeXU4Z7i2DwIxT5gkH4AENmaJ' },
  { label: 'Marketing & Growth', address: 'UQCGfGKrqLQ8vmsVNLMzBtOUZ-S2-83kQGPoDlHUiKLcf1pm' },
  { label: 'Referral Leaderboard Airdrop', address: 'UQB28dBa2IUtMfeK2k68FLYqCfXV7_Oh6rB1BdiSZKcvrwxB' },
  { label: 'Advisors & Partners', address: 'UQDZmB800S6JkIpStYXocag08stDFEHgo1lbxHOXP8bfQRto' },
];

// SIMPLE ROADMAP DATA WITH PROGRESS FLAGS
const roadmap = [
  {
    phase: 'Q2 2024',
    items: [
      {
        text:
          'Beta launch of TonPlaygram with integrated wallet and The Wall social feed',
        done: true,
      },
      {
        text:
          'Token generation event and distribution of initial supply to early supporters',
        done: true,
      },
      {
        text: 'Initial marketing push across Telegram and X',
        done: true,
      },
      {
        text: 'Initial TPC transfers for early backers',
        done: true,
      },
    ],
  },
  {
    phase: 'Q3 2024',
    items: [
      {
        text: 'Staking rewards live with lock-ups and compounding APY',
        done: true,
      },
      {
        text: 'Mining and daily login rewards to grow the user base',
        done: true,
      },
      {
        text: 'Release of Snake & Ladder mini games and friend invites',
        done: true,
      },
    ],
  },
  {
    phase: 'Q4 2024',
    items: [
      {
        text: `TPC deployed on TON network (${TPC_JETTON_ADDRESS})`,
        done: true,
      },
      {
        text: 'Smart contracts powering TON/USDT tables',
        done: false,
      },
      {
        text: 'Adaptive reward formula across mining, ads and tasks',
        done: true,
      },
      { text: 'DAO governance launch', done: false },
      { text: 'Mobile app release', done: false },
      { text: 'CEX & DEX listings', done: false },
    ],
  },
  {
    phase: '2024–2027',
    items: [
      {
        text: 'Emission of 400M TPC with daily cap of 15–20M tokens',
        done: false,
      },
      {
        text: 'Reward pool depleted; ecosystem runs on in-game demand',
        done: false,
      },
    ],
  },
];

// TABLE DATA
const tableRows = [
  {
    name: 'Play-to-Earn & Mining',
    percent: '40%',
    tokens: '400,000,000',
    details: 'Daily emission for players (games, mining, tasks) over 3 years',
  },
  {
    name: 'DEX/CEX Liquidity & Ecosystem',
    percent: '20%',
    tokens: '200,000,000',
    details: 'Exchange pools, partnerships, price stability',
  },
  {
    name: 'Team/Founder',
    percent: '15%',
    tokens: '150,000,000',
    details: '6mo cliff, 2yr linear vesting, owner/dev incentive',
  },
  {
    name: 'Development/Treasury',
    percent: '10%',
    tokens: '100,000,000',
    details: 'Upgrades, maintenance, server costs, audits',
  },
  {
    name: 'Marketing & Growth',
    percent: '7%',
    tokens: '70,000,000',
    details: 'Ads, influencers, user growth, partnerships',
  },
  {
    name: 'Referral/Airdrop/Leaderboard',
    percent: '5%',
    tokens: '50,000,000',
    details: 'Airdrops, viral rewards, competitions',
  },
  {
    name: 'Advisors & Strategic Partners',
    percent: '3%',
    tokens: '30,000,000',
    details: 'Vested, for legal and key partners',
  },
];

export default function TokenomicsPage() {
  const RADIAN = Math.PI / 180;
  const [supply, setSupply] = useState(null);
  const [holders, setHolders] = useState(null);
  const [tonBalance, setTonBalance] = useState(null);
  const [walletBalances, setWalletBalances] = useState({});
  const renderLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
    const radius = innerRadius + (outerRadius - innerRadius) / 2;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    return (
      <text x={x} y={y} fill="#fff" fontSize="12" textAnchor="middle" dominantBaseline="middle">
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

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
        setTonBalance(Number(acc.balance) / 1e9);
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

  return (
    <div className="space-y-4">
      <div className="relative bg-surface border border-border rounded-xl p-4 space-y-2 text-center overflow-hidden wide-card">
        <img
          src="/assets/SnakeLaddersbackground.png"
          className="background-behind-board object-cover"
          alt=""
          onError={(e) => { e.currentTarget.style.display = "none"; }}
        />
        <h2 className="text-xl font-bold">Tokenomics &amp; Roadmap</h2>
        <p className="text-subtext">
          The foundation of a sustainable, investor-ready, and community-driven GameFi platform.
        </p>
      </div>

      {/* Token Allocation */}
      <div className="relative bg-surface border border-border rounded-xl p-4 space-y-2 overflow-hidden wide-card">
        <img
          src="/assets/SnakeLaddersbackground.png"
          className="background-behind-board object-cover"
          alt=""
          onError={(e) => { e.currentTarget.style.display = "none"; }}
        />
        <h3 className="text-lg font-bold text-center">Token Allocation</h3>
        <div className="mx-auto w-40">
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={tokenData}
                dataKey="value"
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                label={renderLabel}
                paddingAngle={1}
              >
                {tokenData.map((entry, idx) => (
                  <Cell key={`token-${idx}`} fill={tokenColors[idx % tokenColors.length]} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
        <ul className="text-sm space-y-1">
          {tokenData.map((d) => (
            <li key={d.name} className="flex justify-between">
              <span>{d.name}</span>
              <span>{d.value}%</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Fee Distribution */}
      <div className="relative bg-surface border border-border rounded-xl p-4 space-y-2 overflow-hidden wide-card">
        <img
          src="/assets/SnakeLaddersbackground.png"
          className="background-behind-board object-cover"
          alt=""
          onError={(e) => { e.currentTarget.style.display = "none"; }}
        />
        <h3 className="text-lg font-bold text-center">Game Fee Distribution (per Table)</h3>
        <div className="mx-auto w-40">
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={feeData}
                dataKey="value"
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                label={renderLabel}
                paddingAngle={1}
              >
                {feeData.map((entry, idx) => (
                  <Cell key={`fee-${idx}`} fill={feeColors[idx % feeColors.length]} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
        <ul className="text-sm space-y-1">
          {feeData.map((d) => (
            <li key={d.name} className="flex justify-between">
              <span>{d.name}</span>
              <span>{d.value}%</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Detailed Table */}
      <div className="relative bg-surface border border-border rounded-xl p-4 overflow-hidden wide-card overflow-x-auto">
        <img
          src="/assets/SnakeLaddersbackground.png"
          className="background-behind-board object-cover"
          alt=""
          onError={(e) => { e.currentTarget.style.display = "none"; }}
        />
        <h3 className="text-lg font-bold mb-2 text-center">Full Token Allocation Breakdown</h3>
        <table className="w-full text-sm text-left min-w-[32rem]">
          <thead>
            <tr>
              <th className="py-2 px-2">Category</th>
              <th className="py-2 px-2">%</th>
              <th className="py-2 px-2">Tokens</th>
              <th className="py-2 px-2">Details</th>
            </tr>
          </thead>
          <tbody>
            {tableRows.map((row) => (
              <tr key={row.name} className="border-b border-[#222848] last:border-none">
                <td className="py-2 px-2 font-semibold">{row.name}</td>
                <td className="py-2 px-2">{row.percent}</td>
                <td className="py-2 px-2">{row.tokens}</td>
                <td className="py-2 px-2">{row.details}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Explanation */}
      <div className="relative bg-surface border border-border rounded-xl p-4 space-y-4 overflow-hidden wide-card text-sm">
        <img
          src="/assets/SnakeLaddersbackground.png"
          className="background-behind-board object-cover"
          alt=""
          onError={(e) => { e.currentTarget.style.display = "none"; }}
        />
        <div>
          <h4 className="font-semibold text-accent mb-1">Total Supply</h4>
          <p>
            <b>1,000,000,000 TPC</b> — Fixed supply. Each allocation and fee mechanism is governed by smart contract, with vesting and transparency for investors and users.
          </p>
        </div>
        <div>
          <h4 className="font-semibold text-accent mb-1">Game Fee Model</h4>
          <p>
            A <b>10% fee</b> is charged on every table game (winner pays). Distribution: <b>3%</b> Dev/Owner, <b>3%</b> buyback & burn, <b>2%</b> ecosystem rewards, <b>1%</b> liquidity pool, <b>1%</b> marketing. The <b>remaining 90%</b> goes to winners.
          </p>
        </div>
        <div>
          <h4 className="font-semibold text-accent mb-1">Deflation, Sustainability & Growth</h4>
          <ul className="list-disc pl-6 space-y-1">
            <li><b>Vesting:</b> Team & treasury allocations locked with long-term vesting.</li>
            <li><b>Buyback & Burn:</b> Supply reduction tied to platform activity.</li>
            <li><b>Liquidity:</b> Deep pools on DEX/CEX for stable trading.</li>
            <li><b>Ecosystem & Marketing:</b> Continuous user incentives and campaigns.</li>
          </ul>
        </div>
        <div>
          <h4 className="font-semibold text-accent mb-1">Transparency & Trust</h4>
          <p>
            All allocations and fee distributions are on-chain and reported regularly. The project focuses on sustainable growth and investor protection.
          </p>
        </div>
        <div>
          <h4 className="font-semibold text-accent mb-1">Emission Formula & Distribution Plan (2024–2027)</h4>
          <p>
            To ensure sustainability across our <b>1,000,000,000 TPC</b> supply, TonPlaygram uses an adaptive reward formula that adjusts giveaways based on user activity and capped daily limits.
          </p>
          <p>
            <b>400,000,000 TPC (40%)</b> is allocated for Play-to-Earn, Mining and Tasks. This pool is emitted over three years with per-user rewards and a global cap of around 15–20M TPC per day.
          </p>
          <p>
            Mining, check-ins, ads, spins and referrals all scale with system load. Each reward type has daily emission limits enforced by smart contracts or backend logic.
          </p>
          <p>
            Once the 400M pool is distributed, emissions stop and the circulating supply relies on in-game utility and user-driven demand. This model prevents over-rewarding early users and keeps token economics healthy.
          </p>
        </div>
        <div>
          <h4 className="font-semibold text-accent mb-1">TonPlaygram Accomplishments So Far</h4>
          <ul className="list-disc pl-6 space-y-1">
            <li><b>Core Infrastructure</b></li>
            <li className="ml-4">🔐 Smart-contract store live — TON sent, TPC <img src="/assets/icons/TPCcoin_1.webp" alt="TPC" className="inline-block w-4 h-4 ml-1" /> auto-delivered to wallet</li>
            <li className="ml-4">🚀 TPC deployed on TON network at {TPC_JETTON_ADDRESS}</li>
            <li className="ml-4">🧾 Wallet transaction history fully functional</li>
            <li className="ml-4">💬 In-chat TPC <img src="/assets/icons/TPCcoin_1.webp" alt="TPC" className="inline-block w-4 h-4 ml-1" /> transfers enabled</li>
            <li><b>Game Features</b></li>
            <li className="ml-4">🎲 Snake &amp; Ladder Game launched (1v1 vs AI &amp; 2–4 player multiplayer)</li>
            <li className="ml-4">🧑‍🤝‍🤝 Online user status, add friends, and inbox chat inside game</li>
            <li className="ml-4">🕹️ Full integration between Telegram Bot and WebApp</li>
            <li className="ml-4">🎲 Crazy Dice Duel for quick head-to-head matches</li>
            <li><b>Rewards &amp; Incentives</b></li>
            <li className="ml-4">🔄 Daily Check-In System: 150 <img src="/assets/icons/TPCcoin_1.webp" alt="TPC" className="inline-block w-4 h-4 mx-1" /> on Day 1 → 1,600 <img src="/assets/icons/TPCcoin_1.webp" alt="TPC" className="inline-block w-4 h-4 ml-1" /> by Day 30</li>
            <li className="ml-4">⛏️ Mining system (250–1,000 <img src="/assets/icons/TPCcoin_1.webp" alt="TPC" className="inline-block w-4 h-4 mx-1" /> every 12 hours)</li>
            <li className="ml-4">📺 Ad Watch Rewards: 50 <img src="/assets/icons/TPCcoin_1.webp" alt="TPC" className="inline-block w-4 h-4 mx-1" /> per ad (up to 5/day)</li>
            <li className="ml-4">🎯 Social Tasks: +2,500 <img src="/assets/icons/TPCcoin_1.webp" alt="TPC" className="inline-block w-4 h-4 mx-1" /> each for X, Telegram, TikTok</li>
            <li className="ml-4">📹 Intro Video Views: +5 <img src="/assets/icons/TPCcoin_1.webp" alt="TPC" className="inline-block w-4 h-4 mx-1" /> each</li>
            <li className="ml-4">🎡 Spin &amp; Win Wheel: 400–1,600 <img src="/assets/icons/TPCcoin_1.webp" alt="TPC" className="inline-block w-4 h-4 mx-1" /> prizes + Bonus x2 chance</li>
            <li className="ml-4">🍀 Lucky Card daily prizes and free spin chances</li>
            <li className="ml-4">🎁 NFT Gifts with fun on-screen effects</li>
          </ul>
        </div>

        <div>
          <h4 className="font-semibold text-accent mb-1">What’s Live Right Now</h4>
          <ul className="list-disc pl-6 space-y-1">
            <li>🛒 Store with bundles up to 8M <img src="/assets/icons/TPCcoin_1.webp" alt="TPC" className="inline-block w-4 h-4 ml-1" /></li>
            <li>🧑‍💻 Mining &amp; Boosters (via Virtual Friends)</li>
            <li>🔁 Spin &amp; Win Packs (with spins and TPC <img src="/assets/icons/TPCcoin_1.webp" alt="TPC" className="inline-block w-4 h-4 ml-1" />)</li>
            <li>🎁 Bonus Packs (spins + TPC <img src="/assets/icons/TPCcoin_1.webp" alt="TPC" className="inline-block w-4 h-4 ml-1" /> + boosts)</li>
            <li>🎲 Crazy Dice Duel mini-game</li>
            <li>🍀 Lucky Card rewards</li>
            <li>🎁 NFT Gifts marketplace</li>
            <li>📲 Telegram Notifications for token transfers</li>
            <li>👥 Multiplayer game rooms and social features</li>
            <li>💼 Automated wallet system across WebApp and Telegram</li>
          </ul>
        </div>

        <div>
          <h4 className="font-semibold text-accent mb-1">Next Phase: Coming Soon</h4>
          <ul className="list-disc pl-6 space-y-1">
            <li><b>Utility &amp; Token Expansion</b></li>
            <li className="ml-4">🌐 Claim TPC <img src="/assets/icons/TPCcoin_1.webp" alt="TPC" className="inline-block w-4 h-4 ml-1" /> to external wallets (Tonkeeper, OKX, etc.)</li>
            <li className="ml-4">💱 Smart contracts for TON/USDT betting tables</li>
            <li><b>Governance &amp; Growth</b></li>
            <li className="ml-4">🗳️ DAO Governance System launch</li>
            <li className="ml-4">📈 Leaderboard, Player Stats &amp; Referral Bonuses</li>
            <li className="ml-4">🧩 More mini-games integrated into the ecosystem</li>
            <li><b>Mobile &amp; Listings</b></li>
            <li className="ml-4">📱 TonPlaygram Mobile App for Android/iOS</li>
            <li className="ml-4">🔁 Listings on major CEXs and DEXs</li>
          </ul>
        </div>
      </div>

      {/* Roadmap */}
      <div className="relative bg-surface border border-border rounded-xl p-4 space-y-4 overflow-hidden wide-card">
        <img
          src="/assets/SnakeLaddersbackground.png"
          className="background-behind-board object-cover"
          alt=""
          onError={(e) => { e.currentTarget.style.display = "none"; }}
        />
        <h3 className="text-lg font-bold text-center">Roadmap</h3>
        <div className="space-y-2 text-sm">
          {roadmap.map((phase) => (
            <div key={phase.phase}>
              <h4 className="font-semibold text-accent">{phase.phase}</h4>
              <ul className="pl-6 space-y-1 list-none">
                {phase.items.map(({ text, done }) => (
                  <li key={text} className="flex items-center gap-2">
                    {done && <AiOutlineCheck className="w-4 h-4 text-green-500" />}
                    <span className={done ? 'text-green-500' : ''}>{text}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* On-chain Stats */}
      <div className="relative bg-surface border border-border rounded-xl p-4 flex items-center gap-4 overflow-hidden wide-card">
        <img
          src="/assets/SnakeLaddersbackground.png"
          className="background-behind-board object-cover"
          alt=""
          onError={(e) => { e.currentTarget.style.display = "none"; }}
        />
        <img src="/assets/icons/TPCcoin_1.webp" alt="TPC" className="w-16 h-16" />
        <div>
          <p className="text-lg font-bold">Total Balance</p>
          <p className="text-2xl flex items-center gap-1">
            {supply == null ? '...' : formatValue(supply, 2)}
            <img src="/assets/icons/TPCcoin_1.webp" alt="TPC" className="w-4 h-4" />
          </p>
          {holders != null && (
            <p className="text-sm text-subtext">Holders: {holders}</p>
          )}
          <p className="text-xs break-all mt-1 text-brand-gold">
            Token Contract: {TPC_JETTON_ADDRESS}
          </p>
        </div>
      </div>

      {/* Wallet Addresses */}
      <div className="relative bg-surface border border-border rounded-xl p-4 space-y-2 overflow-hidden wide-card">
        <img
          src="/assets/SnakeLaddersbackground.png"
          className="background-behind-board object-cover"
          alt=""
          onError={(e) => { e.currentTarget.style.display = "none"; }}
        />
        <h3 className="text-lg font-bold text-center">TPC Wallet Addresses</h3>
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
    </div>
  );
}

function formatValue(value, decimals = 2) {
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

