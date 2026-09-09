import React from 'react';
import { NFT_GIFTS, GIFT_BY_ID } from '../utils/nftGifts.js';
import { giftArtworkUrl } from './gifts/giftArtwork.js';
const byIcon = new Map(NFT_GIFTS.map(g => [g.icon, g]));
const artCache = new Map();
export default function GiftIcon({ icon, gift, className = '', alt = '', ...props }) {
  const definition = gift?.id ? GIFT_BY_ID[gift.id] : byIcon.get(icon);
  if (definition) {
    if (!artCache.has(definition.id)) artCache.set(definition.id, giftArtworkUrl(definition));
    return <img {...props} src={artCache.get(definition.id)} className={`${className} object-contain`} alt={alt} loading="lazy" decoding="async" draggable={false} />;
  }
  if (typeof icon === 'string' && /^(\/|https?:\/\/)/.test(icon)) return <img {...props} src={icon} className={`${className} object-contain`} alt={alt} loading="lazy" decoding="async" />;
  return <span {...props} className={className} aria-label={alt || undefined}>{icon || '◇'}</span>;
}
