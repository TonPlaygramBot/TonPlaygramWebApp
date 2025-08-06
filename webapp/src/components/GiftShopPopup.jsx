import { useState } from 'react';
import { createPortal } from 'react-dom';
import { sendGift } from '../utils/api.js';
import { NFT_GIFTS } from '../utils/nftGifts.js';
import GiftIcon from './GiftIcon.jsx';
import ConfirmPopup from './ConfirmPopup.jsx';
import InfoPopup from './InfoPopup.jsx';

export default function GiftShopPopup({ open, onClose, accountId }) {
  const [selected, setSelected] = useState(NFT_GIFTS[0]);
  const [receiver, setReceiver] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [info, setInfo] = useState('');

  if (!open) return null;

  const handleSend = async () => {
    setConfirm(false);
    try {
      await sendGift(accountId, receiver || accountId, selected.id);
      setInfo(receiver && receiver !== accountId ? 'Gift sent' : 'Gift purchased');
    } catch (err) {
      setInfo('Failed to send gift');
    }
    onClose();
  };

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70"
        onClick={onClose}
      >
        <div
          className="bg-surface border border-border rounded p-4 space-y-2 w-80"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-center font-semibold mb-2">Buy or Send Gift</p>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {NFT_GIFTS.map((g) => (
              <button
                key={g.id}
                onClick={() => setSelected(g)}
                className={`w-full flex items-center justify-between border border-border rounded px-1 py-0.5 text-sm ${selected.id === g.id ? 'bg-accent' : ''}`}
              >
                <span className="flex items-center space-x-1">
                  <GiftIcon icon={g.icon} className="w-4 h-4" />
                  <span>{g.name}</span>
                </span>
                <span className="flex items-center space-x-0.5">
                  <span>{g.price}</span>
                  <img src="/assets/icons/eab316f3-7625-42b2-9468-d421f81c4d7c.webp" alt="TPC" className="w-3 h-3" />
                </span>
              </button>
            ))}
          </div>
          <input
            type="text"
            placeholder="Recipient Account (optional)"
            value={receiver}
            onChange={(e) => setReceiver(e.target.value)}
            className="border p-1 rounded w-full text-black text-sm"
          />
          <button
            className="w-full px-3 py-1 bg-primary hover:bg-primary-hover rounded text-black"
            onClick={() => setConfirm(true)}
          >
            {receiver && receiver !== accountId ? 'Send' : 'Buy'} <GiftIcon icon={selected.icon} className="w-4 h-4 inline" /> {selected.name}
          </button>
        </div>
      </div>
      <ConfirmPopup
        open={confirm}
        message={`Spend ${selected.price} TPC to ${receiver && receiver !== accountId ? 'send' : 'buy'} ${selected.name}?`}
        onConfirm={handleSend}
        onCancel={() => setConfirm(false)}
      />
      <InfoPopup open={!!info} onClose={() => setInfo('')} title="Gift" info={info} />
    </>,
    document.body,
  );
}
