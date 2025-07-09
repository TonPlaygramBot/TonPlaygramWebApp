import { useEffect, useState } from 'react';
import { createAccount, getAccountInfo, convertGifts } from '../utils/api.js';
import { getTelegramId } from '../utils/telegram.js';
import { NFT_GIFTS } from '../utils/nftGifts.js';
import GiftIcon from './GiftIcon.jsx';
import GiftShopPopup from './GiftShopPopup.jsx';
import InfoPopup from './InfoPopup.jsx';
import ConfirmPopup from './ConfirmPopup.jsx';

export default function NftGiftCard({ accountId: propAccountId }) {
  const [accountId, setAccountId] = useState(propAccountId || '');
  const [gifts, setGifts] = useState([]);
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState(null);
  const [confirmConvert, setConfirmConvert] = useState(false);
  const [infoMsg, setInfoMsg] = useState('');

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
    <div className="relative prism-box p-6 space-y-3 flex flex-col items-center text-center overflow-hidden min-h-40 wide-card mx-auto">
      <img
        src="/assets/SnakeLaddersbackground.png"
        className="background-behind-board object-cover"
        alt=""
      />
      <h3 className="text-lg font-bold text-center">NFT Gifts</h3>
      <div className="flex space-x-2 overflow-x-auto pb-2 text-sm w-full flex-grow justify-center">
        {gifts.length ? (
          gifts.map((g) => {
            const info = NFT_GIFTS.find((x) => x.id === g.gift) || {};
            return (
              <div
                key={g._id}
                onClick={() => setPreview({ info, gift: g })}
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
        className="mt-auto px-3 py-1 bg-primary hover:bg-primary-hover rounded text-white-shadow w-full max-w-xs"
      >
        Buy / Send Gift
      </button>
      <GiftShopPopup open={open} onClose={() => setOpen(false)} accountId={accountId} />
      <InfoPopup
        open={!!preview}
        onClose={() => setPreview(null)}
        title={preview?.info?.name || 'NFT Gift'}
      >
        {preview && (
          <>
            <GiftIcon icon={preview.info.icon} className="w-24 h-24 mx-auto" />
            <p className="text-center text-sm mt-2">{preview.info.price} TPC</p>
            <button
              onClick={() => setConfirmConvert(true)}
              className="mt-2 px-3 py-1 bg-primary hover:bg-primary-hover rounded text-white-shadow w-full max-w-xs"
            >
              Convert
            </button>
          </>
        )}
      </InfoPopup>
      <ConfirmPopup
        open={confirmConvert}
        message="Convert this gift for TPC?"
        onConfirm={async () => {
          if (!preview?.gift?._id) return;
          setConfirmConvert(false);
          try {
            const res = await convertGifts(accountId, [preview.gift._id], 'burn');
            if (!res?.error) {
              setGifts(res.gifts);
              setPreview(null);
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
