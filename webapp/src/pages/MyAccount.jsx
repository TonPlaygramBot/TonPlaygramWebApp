import { useEffect, useRef, useState } from 'react';
import {
  getProfile,
  updateProfile,
  fetchTelegramInfo,
  getReferralInfo,
  getTransactions
} from '../utils/api.js';
import {
  getTelegramId,
  getTelegramFirstName,
  getTelegramLastName,
  getTelegramPhotoUrl
} from '../utils/telegram.js';
import OpenInTelegram from '../components/OpenInTelegram.jsx';
import { BOT_USERNAME } from '../utils/constants.js';
import BalanceSummary from '../components/BalanceSummary.jsx';
import useTelegramBackButton from '../hooks/useTelegramBackButton.js';
import AvatarPickerModal from '../components/AvatarPickerModal.jsx';
import AvatarPromptModal from '../components/AvatarPromptModal.jsx';

export default function MyAccount() {
  useTelegramBackButton();
  let telegramId;

  try {
    telegramId = getTelegramId();
  } catch (err) {
    return <OpenInTelegram />;
  }

  const [profile, setProfile] = useState(null);
  const [referral, setReferral] = useState(null);
  const [autoUpdating, setAutoUpdating] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [showAvatarPrompt, setShowAvatarPrompt] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    async function load() {
      const data = await getProfile(telegramId);
      let finalProfile = data;
      const ref = await getReferralInfo(telegramId);
      setReferral(ref);
      const tx = await getTransactions(telegramId);
      setTransactions(tx.transactions || []);

      if (!data.photo || !data.firstName || !data.lastName) {
        setAutoUpdating(true);

        try {
          let tg;
          try {
            tg = await fetchTelegramInfo(telegramId);
          } catch (err) {
            console.error('fetchTelegramInfo failed', err);
          }

          const firstName = data.firstName || tg?.firstName || getTelegramFirstName();
          const lastName = data.lastName || tg?.lastName || getTelegramLastName();
          const photo = data.photo || tg?.photoUrl || getTelegramPhotoUrl();

          const updated = await updateProfile({
            telegramId,
            nickname: data.nickname || firstName,
            photo,
            firstName,
            lastName
          });

          const hasRealPhoto = updated.photo || tg?.photoUrl;
          const mergedProfile = {
            ...updated,
            photo: hasRealPhoto || getTelegramPhotoUrl()
          };

          finalProfile = mergedProfile;
        } finally {
          setAutoUpdating(false);
        }
      }

      setProfile(finalProfile);
      if (!localStorage.getItem('avatarPromptShown')) {
        setShowAvatarPrompt(true);
      }
    }

    load();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [telegramId]);

  if (!profile) return <div className="p-4 text-subtext">Loading...</div>;

  const photoUrl = profile.photo || getTelegramPhotoUrl();

  return (
    <div className="p-4 space-y-4 text-text">
      <AvatarPromptModal
        open={showAvatarPrompt}
        onPick={() => {
          localStorage.setItem('avatarPromptShown', 'true');
          setShowAvatarPrompt(false);
          setShowAvatarPicker(true);
        }}
        onKeep={() => {
          localStorage.setItem('avatarPromptShown', 'true');
          setShowAvatarPrompt(false);
        }}
      />
      <AvatarPickerModal
        open={showAvatarPicker}
        onClose={() => setShowAvatarPicker(false)}
        onSave={async (src) => {
          const updated = await updateProfile({ telegramId, photo: src });
          setProfile(updated);
          setShowAvatarPicker(false);
          window.dispatchEvent(new Event('profilePhotoUpdated'));
        }}
      />
      {autoUpdating && (
        <div className="p-2 text-sm text-subtext">Updating with Telegram info...</div>
      )}

      <div className="flex items-center space-x-2">
        <h2 className="text-xl font-bold">My Account</h2>
      </div>

      <div className="flex items-center space-x-4">
        {photoUrl && (
          <img src={photoUrl} alt="avatar" className="w-16 h-16 rounded-full" />
        )}
        <div>
          <p className="font-semibold">
            {profile.firstName} {profile.lastName}
          </p>
          <p className="text-sm text-subtext">ID: {profile.telegramId}</p>
          <button
            onClick={() => setShowAvatarPicker(true)}
            className="mt-2 px-2 py-1 bg-primary hover:bg-primary-hover rounded text-sm"
          >
            Change Avatar
          </button>
        </div>
      </div>

      <BalanceSummary />

      {referral && (
        <div className="space-y-1">
          <p className="font-semibold">Referral Link</p>
          <div className="flex items-center space-x-2">
            <input
              type="text"
              readOnly
              value={`https://t.me/${BOT_USERNAME}?start=${referral.code}`}
              onClick={(e) => e.target.select()}
              className="flex-1 bg-surface border border-border rounded px-2 py-1 text-sm"
            />
            <button
              onClick={() => navigator.clipboard.writeText(`https://t.me/${BOT_USERNAME}?start=${referral.code}`)}
              className="px-2 py-1 bg-primary hover:bg-primary-hover text-text rounded text-sm"
            >
              Copy
            </button>
          </div>
          <p className="text-sm text-subtext">{referral.referrals} referrals</p>
        </div>
      )}

      <div>
        <p className="font-semibold">Transaction History</p>
        {transactions.length === 0 ? (
          <p className="text-sm text-subtext">No transactions</p>
        ) : (
          <div className="space-y-1 text-sm">
            {transactions.map((tx, i) => (
              <div
                key={i}
                className="flex justify-between border-b border-border pb-1"
              >
                <span>{tx.type}</span>
                <span>{tx.amount}</span>
                <span>{new Date(tx.date).toLocaleString()}</span>
                <span className="text-xs">{tx.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
