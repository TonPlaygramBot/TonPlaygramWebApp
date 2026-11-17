import { getTelegramId } from './telegram.js';
// A UI routing hint only, never an authentication credential.
export function rewardIdentity() {
  let telegramId = null;
  try { telegramId = getTelegramId(); } catch { /* Signed out. */ }
  return JSON.stringify([localStorage.getItem('accountId'), localStorage.getItem('googleId'), telegramId]);
}
export const rewardIdentityEvents = ['social-auth-changed', 'accountUpdated', 'telegramAuthUpdated', 'googleProfileUpdated', 'storage'];
export function affectsRewardIdentity(event) {
  return event.type !== 'storage' || ['accountId', 'googleId', 'googleProfile', 'telegramId', null].includes(event.key);
}
