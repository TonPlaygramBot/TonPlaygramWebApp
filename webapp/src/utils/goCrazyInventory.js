import { GO_CRAZY_DEFAULT_UNLOCKS, GO_CRAZY_OPTION_LABELS } from '../config/goCrazyInventoryConfig.js';

const STORAGE_KEY = 'goCrazyInventoryByAccount';

const copyDefaults = () => Object.entries(GO_CRAZY_DEFAULT_UNLOCKS).reduce((acc,[k,v])=>{acc[k]=[...v];return acc;},{});
const resolveAccountId = (accountId) => {
  if (accountId) return accountId;
  if (typeof window !== 'undefined') return window.localStorage.getItem('accountId') || 'guest';
  return 'guest';
};
const readAll = () => {
  if (typeof window === 'undefined') return {};
  try { return JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}'); } catch { return {}; }
};
const writeAll = (v) => { if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, JSON.stringify(v)); };
const normalize = (raw) => {
  const base = copyDefaults();
  if (!raw || typeof raw !== 'object') return base;
  const merged = { ...base };
  Object.entries(raw).forEach(([k,v]) => { if (Array.isArray(v)) merged[k] = Array.from(new Set([...(merged[k]||[]), ...v])); });
  return merged;
};
export const getGoCrazyInventory = (accountId) => {
  const id = resolveAccountId(accountId); const all = readAll(); const inv = normalize(all[id]); writeAll({ ...all, [id]: inv }); return inv;
};
export const isGoCrazyOptionUnlocked = (type, optionId, inventoryOrAccountId) => {
  const inv = (typeof inventoryOrAccountId === 'string' || !inventoryOrAccountId) ? getGoCrazyInventory(inventoryOrAccountId) : inventoryOrAccountId;
  return Array.isArray(inv?.[type]) && inv[type].includes(optionId);
};
export const addGoCrazyUnlock = (type, optionId, accountId) => {
  const id = resolveAccountId(accountId); const all = readAll(); const curr = normalize(all[id]); curr[type] = Array.from(new Set([...(curr[type]||[]), optionId])); writeAll({ ...all, [id]: curr }); return curr;
};
export const listOwnedGoCrazyOptions = (accountId) => {
  const inv = getGoCrazyInventory(accountId);
  return Object.entries(inv).flatMap(([type, values]) => (values || []).map((optionId) => ({ type, optionId, label: GO_CRAZY_OPTION_LABELS[type]?.[optionId] || optionId })));
};
export const goCrazyAccountId = resolveAccountId;
