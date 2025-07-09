import { withProxy } from './proxyAgent.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Mint an NFT representing the given gift.
 *
 * @param {string} giftId - Gift identifier
 * @param {string} toAccount - Receiver wallet/account address
 * @returns {Promise<string>} Resolves to minted NFT token ID
 */
export async function mintGiftNFT(giftId, toAccount) {
  const base = process.env.NFT_API_BASE_URL;
  // When no external service is configured we generate a dummy token ID
  if (!base) {
    return uuidv4();
  }
  const url = `${base.replace(/\/$/, '')}/mint`;
  const resp = await fetch(url, {
    method: 'POST',
    ...withProxy({
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ giftId, toAccount }),
    }),
  });
  if (!resp.ok) {
    let msg;
    try {
      msg = await resp.text();
    } catch {
      msg = resp.statusText;
    }
    throw new Error(msg || 'Mint request failed');
  }
  let data;
  try {
    data = await resp.json();
  } catch {
    throw new Error('Invalid mint response');
  }
  if (!data || !data.tokenId) {
    throw new Error('Invalid mint response');
  }
  return data.tokenId;
}

export default { mintGiftNFT };
