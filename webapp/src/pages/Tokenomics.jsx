import React from 'react';
import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from 'recharts';

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
  return (
    <div className="w-full min-h-screen bg-background text-white py-8 px-2 flex flex-col items-center">
      <div className="max-w-4xl w-full mx-auto space-y-8">
        {/* HEADER */}
        <h1 className="text-4xl md:text-5xl font-bold mb-2 text-yellow-400 text-center tracking-tight">
          Tokenomics &amp; Roadmap
        </h1>
        <p className="text-lg md:text-xl text-gray-300 text-center mb-10">
          The foundation of a sustainable, investor-ready, and community-driven GameFi platform.
        </p>

        {/* PIE CHARTS */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-12 md:gap-8 my-10">
          {/* TOKEN ALLOCATION PIE CHART */}
          <div className="flex flex-col items-center w-full md:w-1/2 mb-8 md:mb-0">
            <h2 className="text-2xl font-semibold mb-3 text-yellow-300">Token Allocation</h2>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={tokenData}
                  dataKey="value"
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={120}
                  label={({ name, percent }) =>
                    `${name}: ${(percent * 100).toFixed(1)}%`
                  }
                >
                  {tokenData.map((entry, idx) => (
                    <Cell key={`cell-token-${idx}`} fill={tokenColors[idx % tokenColors.length]} />
                  ))}
                </Pie>
                <Legend verticalAlign="bottom" />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* FEE DISTRIBUTION PIE CHART */}
          <div className="flex flex-col items-center w-full md:w-1/2 mb-8 md:mb-0">
            <h2 className="text-2xl font-semibold mb-3 text-yellow-300">Game Fee Distribution (per Table)</h2>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={feeData}
                  dataKey="value"
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={120}
                  label={({ name, percent }) =>
                    `${name}: ${(percent * 100).toFixed(1)}%`
                  }
                >
                  {feeData.map((entry, idx) => (
                    <Cell key={`cell-fee-${idx}`} fill={feeColors[idx % feeColors.length]} />
                  ))}
                </Pie>
                <Legend verticalAlign="bottom" />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* DETAILED TABLE */}
        <div className="mt-10 bg-surface rounded-2xl p-6 shadow-lg overflow-x-auto border border-border">
          <h2 className="text-2xl font-bold text-yellow-400 mb-5">Full Token Allocation Breakdown</h2>
          <table className="w-full text-base text-left">
            <thead>
              <tr>
                <th className="py-2 px-2 text-yellow-300">Category</th>
                <th className="py-2 px-2 text-yellow-300">%</th>
                <th className="py-2 px-2 text-yellow-300">Tokens</th>
                <th className="py-2 px-2 text-yellow-300">Details</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map((row, idx) => (
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

        {/* EXPLANATORY TEXT */}
        <section className="mt-12 space-y-8 text-gray-200 leading-relaxed">
          <div>
            <h3 className="text-xl font-semibold text-yellow-300 mb-2">Total Supply</h3>
            <p>
              <b>100,000,000 TPC</b> — Fixed supply. Each allocation and fee mechanism is governed by smart contract, with vesting and transparency for investors and users.
            </p>
          </div>
          <div>
            <h3 className="text-xl font-semibold text-yellow-300 mb-2">Game Fee Model</h3>
            <p>
              A <b>10% fee</b> is charged on every table game (winner pays). Distribution:<br/>
              <b>3%</b> to Dev/Owner (salary, ops, upgrades), <b>3%</b> to buyback & burn (deflationary, value accrual), <b>2%</b> to ecosystem rewards (staking, leaderboard, referrals), <b>1%</b> to liquidity pool (market depth), <b>1%</b> to marketing. The <b>remaining 90%</b> is paid instantly to winners.
            </p>
          </div>
          <div>
            <h3 className="text-xl font-semibold text-yellow-300 mb-2">Deflation, Sustainability & Growth</h3>
            <ul className="list-disc pl-6">
              <li><b>Vesting:</b> Team & treasury allocations are locked and released over time to ensure trust and long-term commitment.</li>
              <li><b>Buyback & Burn:</b> Constant reduction of supply with platform activity, driving price support and investor confidence.</li>
              <li><b>Liquidity:</b> Deep pools on DEX/CEX for stable trading, anti-volatility.</li>
              <li><b>Ecosystem & Marketing:</b> Ongoing incentives for new and existing users, community events, and high-visibility campaigns.</li>
            </ul>
          </div>
          <div>
            <h3 className="text-xl font-semibold text-yellow-300 mb-2">Transparency & Trust</h3>
            <p>
              All allocations and fee distributions are visible on-chain and subject to regular reporting. The project prioritizes sustainable growth, anti-rug mechanisms, and investor protection.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}

