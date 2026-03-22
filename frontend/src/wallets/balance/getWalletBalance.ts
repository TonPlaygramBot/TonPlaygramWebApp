import { Connection, PublicKey } from '@solana/web3.js';
import { createPublicClient, formatEther, http } from 'viem';
import { bsc } from 'viem/chains';

const solanaConnection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
const bnbClient = createPublicClient({ chain: bsc, transport: http('https://bsc-dataseed.binance.org') });

const CACHE_TTL_MS = 30_000;
const cache = new Map<string, { expiresAt: number; value: WalletBalance }>();

export type WalletBalance = {
  symbol: 'TON' | 'SOL' | 'BNB';
  formatted: string;
};

function getCacheKey(chain: string, address: string) {
  return `${chain}:${address}`;
}

function readCache(chain: string, address: string): WalletBalance | undefined {
  const key = getCacheKey(chain, address);
  const hit = cache.get(key);
  if (!hit) return undefined;
  if (hit.expiresAt < Date.now()) {
    cache.delete(key);
    return undefined;
  }
  return hit.value;
}

function writeCache(chain: string, address: string, value: WalletBalance) {
  cache.set(getCacheKey(chain, address), { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

async function getTonBalance(address: string): Promise<WalletBalance> {
  const cached = readCache('ton', address);
  if (cached) return cached;

  const response = await fetch(`https://tonapi.io/v2/accounts/${encodeURIComponent(address)}`);
  if (!response.ok) throw new Error('TON balance unavailable');
  const data = (await response.json()) as { balance?: number };
  const ton = Number(data.balance ?? 0) / 1_000_000_000;
  const value = { symbol: 'TON' as const, formatted: ton.toFixed(4) };
  writeCache('ton', address, value);
  return value;
}

async function getSolBalance(address: string): Promise<WalletBalance> {
  const cached = readCache('solana', address);
  if (cached) return cached;

  const lamports = await solanaConnection.getBalance(new PublicKey(address));
  const sol = lamports / 1_000_000_000;
  const value = { symbol: 'SOL' as const, formatted: sol.toFixed(4) };
  writeCache('solana', address, value);
  return value;
}

async function getBnbBalance(address: string): Promise<WalletBalance> {
  const cached = readCache('evm', address);
  if (cached) return cached;

  const wei = await bnbClient.getBalance({ address: address as `0x${string}` });
  const bnb = Number(formatEther(wei));
  const value = { symbol: 'BNB' as const, formatted: bnb.toFixed(4) };
  writeCache('evm', address, value);
  return value;
}

export async function getWalletBalance(input: { chain: 'solana' | 'evm' | 'ton'; address: string }): Promise<WalletBalance> {
  if (input.chain === 'ton') return getTonBalance(input.address);
  if (input.chain === 'solana') return getSolBalance(input.address);
  return getBnbBalance(input.address);
}
