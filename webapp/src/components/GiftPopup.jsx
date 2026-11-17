import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import GiftExperience from './gifts/GiftExperience.jsx';
import GiftIcon from './GiftIcon.jsx';
import { ensureAccountId } from '../utils/telegram.js';
/** Legacy player/callback interface retained for all game integrations. */
export default function GiftPopup({ open, onClose, players = [], senderIndex = 0, onGiftSent, title }) {
  const [receipt, setReceipt] = useState(null);
  useEffect(() => {
    if (!receipt) return;
    const timer = window.setTimeout(() => setReceipt(null), 2200);
    return () => window.clearTimeout(timer);
  }, [receipt]);
  const complete = ({ gift, playerIndex, recipientName }) => {
    setReceipt({ gift, recipientName });
    onGiftSent?.({ from: senderIndex, to: playerIndex, gift });
  };
  return <>
    {open && <GiftExperience resolveAccount={ensureAccountId} players={players} title={title || 'Send a gift'} onClose={onClose} onCompleted={complete}/>}
    {receipt && createPortal(<div className="gift-receipt" role="status" aria-live="polite"><GiftIcon gift={receipt.gift}/><div><strong>{receipt.gift.name} delivered</strong><span>To {receipt.recipientName}</span></div><span aria-hidden="true">✦</span></div>, document.body)}
  </>;
}
