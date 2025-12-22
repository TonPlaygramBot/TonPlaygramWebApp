import { randomBytes } from 'crypto';
import { ethers } from 'ethers';

const nonceStore = new Map();
const DEFAULT_TTL_MS = 10 * 60 * 1000;

function createNonce(address) {
  const nonce = randomBytes(16).toString('hex');
  const expiresAt = Date.now() + DEFAULT_TTL_MS;
  nonceStore.set(nonce, { address: address?.toLowerCase(), expiresAt });
  return { nonce, expiresAt };
}

function consumeNonce(nonce) {
  const entry = nonceStore.get(nonce);
  if (!entry) return null;
  nonceStore.delete(nonce);
  if (entry.expiresAt < Date.now()) return null;
  return entry;
}

function verifyWalletSignature({ address, signature, nonce, appName = 'TonPlaygram' }) {
  const nonceEntry = consumeNonce(nonce);
  if (!nonceEntry) return null;
  const message = `Login to ${appName} — nonce: ${nonce}`;
  let signer;
  try {
    signer = ethers.verifyMessage(message, signature);
  } catch {
    return null;
  }
  if (address && signer.toLowerCase() !== address.toLowerCase()) return null;
  if (nonceEntry.address && nonceEntry.address !== signer.toLowerCase()) return null;
  return signer.toLowerCase();
}

export { createNonce, verifyWalletSignature };
