import React from 'react';
import GiftExperience from './gifts/GiftExperience.jsx';
export default function GiftShopPopup({ open, onClose, accountId, onGiftSent }) {
  return open ? <GiftExperience accountId={accountId} onClose={onClose} onCompleted={onGiftSent}/> : null;
}
