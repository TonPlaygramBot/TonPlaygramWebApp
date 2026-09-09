import React from 'react';
import GiftExperience from './gifts/GiftExperience.jsx';
import { ensureAccountId } from '../utils/telegram.js';
import { giftSounds } from '../utils/giftSounds.js';
import { getGameVolume, isGameMuted } from '../utils/sound.js';
/** Legacy player/callback interface retained for all game integrations.
 * Presentation is now shared with the shop; old per-game tiny-grid class props
 * are intentionally superseded by the responsive gift dialog.
 */
export default function GiftPopup({ open, onClose, players = [], senderIndex = 0, onGiftSent, title }) {
  const complete = ({gift, playerIndex}) => {
    const source=giftSounds[gift.id];
    if(source && !isGameMuted()) {
      const audio=new Audio(source);audio.volume=getGameVolume();
      const start=()=>{audio.play().catch(()=>{});window.setTimeout(()=>{audio.pause();audio.removeAttribute('src');audio.load();},gift.id==='fireworks'?6000:gift.id==='surprise_box'?5000:4000);};
      if(gift.id==='bullseye')window.setTimeout(start,2500);else start();
    }
    onGiftSent?.({from:senderIndex,to:playerIndex,gift});
  };
  return open ? <GiftExperience resolveAccount={ensureAccountId} players={players} title={title || 'Send a gift'} onClose={onClose} onCompleted={complete}/> : null;
}
