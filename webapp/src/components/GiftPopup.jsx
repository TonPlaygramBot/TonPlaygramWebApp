import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import GiftExperience from './gifts/GiftExperience.jsx';
import GiftIcon from './GiftIcon.jsx';
import { getGiftSession } from '../utils/api.js';
/** Legacy player/callback interface retained for all game integrations. */
export default function GiftPopup({ open, onClose, players = [], senderIndex = 0, onGiftSent, title }) {
  const [receipt, setReceipt] = useState(null);
  const [session, setSession] = useState(null);
  const [sessionError, setSessionError] = useState('');
  useEffect(() => {
    if (!open) { setSession(null); return; }
    let active = true, generation = 0;
    const refresh = async () => {
      const current = ++generation;
      setSession(null); setSessionError(''); setReceipt(null);
      try {
        const next = await getGiftSession();
        if (!active || current !== generation) return;
        if (next?.error || !next?.accountId || !next.purchasingEnabled) throw new Error(next?.error || 'Sign in with Telegram or Google before sending gifts.');
        setSession(next);
      } catch (error) {
        if (active && current === generation) setSessionError(error?.message || 'Could not verify your gift account. Sign in again.');
      }
    };
    void refresh();
    const identityEvents = ['social-auth-changed', 'telegramAuthUpdated', 'accountUpdated', 'googleProfileUpdated', 'storage'];
    identityEvents.forEach(event => window.addEventListener(event, refresh));
    return () => { active = false; ++generation; identityEvents.forEach(event => window.removeEventListener(event, refresh)); };
  }, [open]);
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
    {open && <GiftExperience accountId={session?.accountId || ''} accountStatus={sessionError || (!session ? 'Verifying gift account…' : '')} players={players} title={title || 'Send a gift'} onClose={onClose} onCompleted={complete}/>}
    {receipt && createPortal(<div className="gift-receipt" role="status" aria-live="polite"><GiftIcon gift={receipt.gift}/><div><strong>{receipt.gift.name} delivered</strong><span>To {receipt.recipientName}</span></div><span aria-hidden="true">✦</span></div>, document.body)}
  </>;
}
