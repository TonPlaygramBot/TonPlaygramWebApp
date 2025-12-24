import { useEffect, useState } from 'react';
import { getAccountInfo, convertGifts } from '../utils/api.js';
import { getTelegramId } from '../utils/telegram.js';
import { NFT_GIFTS } from '../utils/nftGifts.js';
import GiftIcon from './GiftIcon.jsx';
import GiftShopPopup from './GiftShopPopup.jsx';
import InfoPopup from './InfoPopup.jsx';
import ConfirmPopup from './ConfirmPopup.jsx';
import { provisionAccount } from '../utils/account.js';

export default function NftGiftCard({ accountId: propAccountId }) {
  const [accountId, setAccountId] = useState(propAccountId || '');
  const [gifts, setGifts] = useState([]);
  const [open, setOpen] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(null);
  const [touchX, setTouchX] = useState(null);
  const [confirmConvert, setConfirmConvert] = useState(false);
  const [infoMsg, setInfoMsg] = useState('');

  useEffect(() => {
    async function ensureAccount() {
      let id = propAccountId || localStorage.getItem('accountId');
      if (!id) {
        try {
          const acc = await provisionAccount({
            telegramId: getTelegramId(),
            googleId: localStorage.getItem('googleId')
          });
          if (acc?.accountId) {
            id = acc.accountId;
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

  const previewGift =
    previewIndex != null && gifts[previewIndex] ? gifts[previewIndex] : null;
  const previewInfo =
    previewGift &&
    (NFT_GIFTS.find((x) => x.id === previewGift.gift) || {});

  return (
    <div className="relative prism-box p-6 space-y-3 flex flex-col items-center text-center overflow-hidden min-h-40 wide-card mx-auto">
      <img
        src="/assets/icons/snakes_and_ladders.webp"
        className="background-behind-board object-cover"
        alt=""
        onError={(e) => {
          e.currentTarget.style.display = 'none';
        }}
      />
      <h3 className="text-lg font-bold text-center">NFT Gifts</h3>
      <div className="flex space-x-2 overflow-x-auto pb-2 text-sm w-full flex-grow justify-center">
        {gifts.length ? (
          gifts.map((g, idx) => {
            const info = NFT_GIFTS.find((x) => x.id === g.gift) || {};
            return (
              <div
                key={g._id}
                onClick={() => setPreviewIndex(idx)}
                className="flex-shrink-0 flex flex-col items-center space-y-1 border border-border rounded p-2 min-w-[72px] cursor-pointer"
              >
                <GiftIcon icon={info.icon} className="w-12 h-12" />
                <span className="text-center">{info.name || g.gift}</span>
                <span className="text-xs">{g.price} TPC</span>
              </div>
            );
          })
        ) : (
          <p className="text-center text-subtext w-full">No NFTs</p>
        )}
      </div>
      <button
        onClick={() => setOpen(true)}
        className="mt-auto w-48 mx-auto px-3 py-1 bg-primary hover:bg-primary-hover rounded text-white-shadow"
      >
        Buy / Send Gift
      </button>
      <GiftShopPopup open={open} onClose={() => setOpen(false)} accountId={accountId} />
      <InfoPopup
        open={previewIndex != null}
        onClose={() => setPreviewIndex(null)}
        widthClass="w-[28rem]"
      >
        {previewInfo && (
          <div
            className="flex flex-col items-center h-80"
            onTouchStart={(e) => setTouchX(e.touches[0].clientX)}
            onTouchEnd={(e) => {
              if (touchX != null) {
                const diff = e.changedTouches[0].clientX - touchX;
                if (Math.abs(diff) > 30) {
                  if (diff < 0) {
                    setPreviewIndex((i) => (i + 1) % gifts.length);
                  } else {
                    setPreviewIndex((i) => (i - 1 + gifts.length) % gifts.length);
                  }
                }
              }
              setTouchX(null);
            }}
          >
            <p className="font-bold text-lg mb-2 text-center w-full">
              {previewInfo.name}
            </p>
            <div className="flex-grow flex items-center justify-center w-full">
              <GiftIcon
                icon={previewInfo.icon}
                className="max-h-48 w-auto object-contain"
              />
            </div>
            <div className="mt-auto flex flex-col items-center space-y-2 w-full">
              <span className="flex items-center space-x-1 text-lg">
                <span>{previewInfo.price}</span>
                <img src="/assets/icons/ezgif-54c96d8a9b9236.webp" alt="TPC" className="w-6 h-6" />
              </span>
              <button
                onClick={() => setConfirmConvert(true)}
                className="w-full max-w-xs px-4 py-2 bg-primary hover:bg-primary-hover rounded text-white-shadow text-lg"
              >
                Convert
              </button>
            </div>
          </div>
        )}
      </InfoPopup>
      <ConfirmPopup
        open={confirmConvert}
        message="Convert this gift for TPC?"
        onConfirm={async () => {
          if (!previewGift?._id) return;
          setConfirmConvert(false);
          try {
            const res = await convertGifts(accountId, [previewGift._id], 'burn');
            if (!res?.error) {
              setGifts(res.gifts);
              setPreviewIndex(null);
              setInfoMsg('Converted');
            } else {
              setInfoMsg(res.error);
            }
          } catch {
            setInfoMsg('Conversion failed');
          }
        }}
        onCancel={() => setConfirmConvert(false)}
      />
      <InfoPopup
        open={!!infoMsg}
        onClose={() => setInfoMsg('')}
        title="Gift"
        info={infoMsg}
      />
    </div>
  );
}
