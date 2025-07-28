export const STORE_ADDRESS = 'UQAPwsGyKzA4MuBnCflTVwEcTLcGS9yV6okJWQGzO5VxVYD1';
// Address used for presale purchases, defaults to STORE_ADDRESS
export const PRESALE_ADDRESS = STORE_ADDRESS;

// Dynamic pricing configuration for the presale
export const initialPrice = 0.000004; // TON per 1 TPC
export let currentPrice = initialPrice;
export const priceIncreaseStep = 0.0000001; // TON added after each purchase

// Presale launch date (UTC)
export const PRESALE_START = new Date();

export const PRESALE_ROUNDS = [
  { round: 1, maxTokens: 125000000, pricePerTPC: 0.000004 },
  { round: 2, maxTokens: 100000000, pricePerTPC: 0.000005 },
  { round: 3, maxTokens: 100000000, pricePerTPC: 0.000006 },
  { round: 4, maxTokens: 100000000, pricePerTPC: 0.000008 },
  { round: 5, maxTokens: 75000000, pricePerTPC: 0.000010 }
];
