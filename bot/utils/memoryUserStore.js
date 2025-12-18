import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

const memoryUsers = new Map();

const defaultUserFields = () => ({
  balance: 0,
  transactions: [],
  gifts: [],
  referralCode: null,
  walletAddress: null,
  walletPublicKey: null,
  poolRoyalInventory: undefined
});

const findByKey = (key, value) => {
  if (!value) return null;
  for (const user of memoryUsers.values()) {
    if (user?.[key] === value) return user;
  }
  return null;
};

export const shouldUseMemoryUserStore = () =>
  process.env.MONGO_URI === 'memory' && mongoose.connection.readyState !== 1;

export const findMemoryUser = ({ accountId, telegramId, googleId }) => {
  if (accountId && memoryUsers.has(accountId)) return memoryUsers.get(accountId);
  if (telegramId) return findByKey('telegramId', telegramId);
  if (googleId) return findByKey('googleId', googleId);
  return null;
};

export const saveMemoryUser = (user) => {
  if (!user?.accountId) return null;
  memoryUsers.set(user.accountId, { ...defaultUserFields(), ...user });
  return memoryUsers.get(user.accountId);
};

export const createMemoryUser = (data = {}) => {
  const accountId = data.accountId || uuidv4();
  const base = {
    ...defaultUserFields(),
    ...data,
    accountId,
    referralCode: data.referralCode || accountId
  };
  memoryUsers.set(accountId, base);
  return memoryUsers.get(accountId);
};

export const ensureMemoryUser = (user) => {
  const accountId = user?.accountId || uuidv4();
  const merged = { ...defaultUserFields(), ...user, accountId };
  memoryUsers.set(accountId, merged);
  return memoryUsers.get(accountId);
};
