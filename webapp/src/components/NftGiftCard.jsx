import { useEffect, useState } from 'react';
import { createAccount, getAccountInfo } from '../utils/api.js';
import { getTelegramId } from '../utils/telegram.js';
import { NFT_GIFTS } from '../utils/nftGifts.js';
import GiftShopPopup from './GiftShopPopup.jsx';

export default function NftGiftCard({ accountId: propAccountId }) {
  const [accountId, setAccountId] = useState(propAccountId || '');
  const [gifts, setGifts] = useState([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    async function ensureAccount() {
      let id = propAccountId || localStorage.getItem('accountId');
      if (!id) {
        try {
          const acc = await createAccount(getTelegramId());
          if (acc?.accountId) {
            id = acc.accountId;
            localStorage.setItem('accountId', id);
          }
        } catch {}
      }
      if (id) setAccountId(id);
    }
    ensureAccount();
  }, [propAccountId]);

  useEffect(() => {
    if (!accountId) return;
    getAccountInfo(accountId)
      .then((info) => {
        if (info && Array.isArray(info.gifts)) setGifts(info.gifts);
      })
      .catch(() => {});
  }, [accountId, open]);

  return (
    <div className="relative bg-surface border border-border rounded-xl p-4 space-y-2 overflow-hidden wide-card">
      <img
        src="/assets/SnakeLaddersbackground.png"
        className="background-behind-board object-cover"
        alt=""
      />
      <h3 className="text-lg font-bold text-center">NFT Gifts</h3>
      <div className="max-h-32 overflow-y-auto text-sm space-y-1">
        {gifts.length ? (
          gifts.map((g) => {
            const info = NFT_GIFTS.find((x) => x.id === g.gift) || {};
            return (
              <div key={g._id} className="flex justify-between items-center">
                <span className="flex items-center space-x-1">
                  <span>{info.icon}</span>
                  <span>{info.name || g.gift}</span>
                </span>
                <span className="text-xs">{g.price} TPC</span>
              </div>
            );
          })
        ) : (
          <p className="text-center text-subtext">No NFTs</p>
        )}
      </div>
      <button
        onClick={() => setOpen(true)}
        className="mx-auto block px-3 py-1 bg-primary hover:bg-primary-hover rounded text-white-shadow"
      >
        Buy / Send Gift
      </button>
      <GiftShopPopup open={open} onClose={() => setOpen(false)} accountId={accountId} />
    </div>
  );
}
