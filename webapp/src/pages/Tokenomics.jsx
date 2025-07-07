import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

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

// SIMPLE ROADMAP DATA
const roadmap = [
  {
    phase: 'Q2 2024',
    items: [
      'Beta launch of TonPlaygram',
      'Token generation event',
      'Initial marketing push',
    ],
  },
  {
    phase: 'Q3 2024',
    items: [
      'Staking rewards',
      'New games and features',
      'Strategic partnerships',
    ],
  },
  {
    phase: 'Q4 2024',
    items: [
      'Mobile app release',
      'CEX listings',
      'DAO governance launch',
    ],
  },
];

// TABLE DATA
const tableRows = [
  {
    name: 'Play-to-Earn & Mining',
    percent: '40%',
    tokens: '40,000,000',
    details: 'Daily emission for players (games, mining, tasks) over 3 years',
  },
  {
    name: 'DEX/CEX Liquidity & Ecosystem',
    percent: '20%',
    tokens: '20,000,000',
    details: 'Exchange pools, partnerships, price stability',
  },
  {
    name: 'Team/Founder',
    percent: '15%',
    tokens: '15,000,000',
    details: '6mo cliff, 2yr linear vesting, owner/dev incentive',
  },
  {
    name: 'Development/Treasury',
    percent: '10%',
    tokens: '10,000,000',
    details: 'Upgrades, maintenance, server costs, audits',
  },
  {
    name: 'Marketing & Growth',
    percent: '7%',
    tokens: '7,000,000',
    details: 'Ads, influencers, user growth, partnerships',
  },
  {
    name: 'Referral/Airdrop/Leaderboard',
    percent: '5%',
    tokens: '5,000,000',
    details: 'Airdrops, viral rewards, competitions',
  },
  {
    name: 'Advisors & Strategic Partners',
    percent: '3%',
    tokens: '3,000,000',
    details: 'Vested, for legal and key partners',
  },
];

export default function TokenomicsPage() {
  const RADIAN = Math.PI / 180;
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

  return (
    <div className="space-y-4">
      <div className="relative bg-surface border border-border rounded-xl p-4 space-y-2 text-center overflow-hidden wide-card">
        <img
          src="/assets/SnakeLaddersbackground.png"
          className="background-behind-board object-cover"
          alt=""
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
      <div className="relative bg-surface border border-border rounded-xl p-4 overflow-hidden wide-card">
        <img
          src="/assets/SnakeLaddersbackground.png"
          className="background-behind-board object-cover"
          alt=""
        />
        <h3 className="text-lg font-bold mb-2 text-center">Full Token Allocation Breakdown</h3>
        <table className="w-full text-sm text-left">
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
        />
        <div>
          <h4 className="font-semibold text-accent mb-1">Total Supply</h4>
          <p>
            <b>100,000,000 TPC</b> — Fixed supply. Each allocation and fee mechanism is governed by smart contract, with vesting and transparency for investors and users.
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
      </div>

      {/* Roadmap */}
      <div className="relative bg-surface border border-border rounded-xl p-4 space-y-4 overflow-hidden wide-card">
        <img
          src="/assets/SnakeLaddersbackground.png"
          className="background-behind-board object-cover"
          alt=""
        />
        <h3 className="text-lg font-bold text-center">Roadmap</h3>
        <div className="space-y-2 text-sm">
          {roadmap.map((phase) => (
            <div key={phase.phase}>
              <h4 className="font-semibold text-accent">{phase.phase}</h4>
              <ul className="list-disc pl-6 space-y-1">
                {phase.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

