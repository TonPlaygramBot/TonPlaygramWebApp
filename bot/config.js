export const MAX_TPC_PER_WALLET = 1_000_000;
export const PURCHASE_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
export const INITIAL_PRICE = 0.000004;
export const PRICE_INCREASE_STEP = 0.0000001;
export const PRESALE_ROUNDS = [
  { round: 1, maxTokens: 125000000, pricePerTPC: 0.000004 },
  { round: 2, maxTokens: 100000000, pricePerTPC: 0.000005 },
  { round: 3, maxTokens: 100000000, pricePerTPC: 0.000006 },
  { round: 4, maxTokens: 100000000, pricePerTPC: 0.000008 },
  { round: 5, maxTokens: 75000000, pricePerTPC: 0.000010 }
];
export let WITHDRAW_ENABLED = false;
