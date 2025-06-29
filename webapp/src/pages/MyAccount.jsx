import { useEffect, useRef, useState } from 'react';
import {
  getProfile,
  updateProfile,
  fetchTelegramInfo,
  getReferralInfo,
  getTransactions,
  linkGoogleAccount
} from '../utils/api.js';
import {
  getTelegramId,
  getTelegramFirstName,
  getTelegramLastName,
  getTelegramPhotoUrl
} from '../utils/telegram.js';
import LoginOptions from '../components/LoginOptions.jsx';
import { BOT_USERNAME } from '../utils/constants.js';
import BalanceSummary from '../components/BalanceSummary.jsx';
import useTelegramBackButton from '../hooks/useTelegramBackButton.js';
import AvatarPickerModal from '../components/AvatarPickerModal.jsx';
import AvatarPromptModal from '../components/AvatarPromptModal.jsx';
import { getAvatarUrl, saveAvatar, loadAvatar } from '../utils/avatarUtils.js';
import InfoPopup from '../components/InfoPopup.jsx';
import InboxWidget from '../components/InboxWidget.jsx';

export default function MyAccount() {
  useTelegramBackButton();
  let telegramId;

  try {
    telegramId = getTelegramId();
  } catch (err) {
    return <LoginOptions />;
  }

  const [profile, setProfile] = useState(null);
  const [referral, setReferral] = useState(null);
  const [autoUpdating, setAutoUpdating] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [showAvatarPrompt, setShowAvatarPrompt] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!profile || profile.googleId) return;

    function handleCredential(res) {
      try {
        const data = JSON.parse(atob(res.credential.split('.')[1]));
        linkGoogleAccount({
          telegramId,
          googleId: data.sub,
          email: data.email,
          dob: data.birthdate,
          firstName: data.given_name,
          lastName: data.family_name,
          photo: data.picture
        }).then((u) => setProfile(u));
      } catch (err) {
        console.error('google link failed', err);
      }
    }

    if (window.google && import.meta.env.VITE_GOOGLE_CLIENT_ID) {
      window.google.accounts.id.initialize({
        client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
        callback: handleCredential
      });
      window.google.accounts.id.renderButton(
        document.getElementById('g_id_link'),
        { theme: 'outline', size: 'large' }
      );
    }
  }, [profile, telegramId]);

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

  const photoUrl = loadAvatar() || profile.photo || getTelegramPhotoUrl();

  return (
    <div className="relative p-4 space-y-4 text-text">
      <img
        src="/assets/SnakeLaddersbackground.png"
        className="background-behind-board account-background object-cover"
        alt=""
      />
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
          saveAvatar(src);
          setProfile(updated);
          setShowAvatarPicker(false);
          setShowSaved(true);
          setTimeout(() => setShowSaved(false), 1500);
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
          <img src={getAvatarUrl(photoUrl)} alt="avatar" className="w-16 h-16 rounded-full object-cover" />
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
          <button
            onClick={async () => {
              const url = getTelegramPhotoUrl();
              const updated = await updateProfile({ telegramId, photo: url });
              localStorage.removeItem('profilePhoto');
              setProfile(updated);
              setShowSaved(true);
              setTimeout(() => setShowSaved(false), 1500);
              window.dispatchEvent(new Event('profilePhotoUpdated'));
            }}
            className="mt-2 ml-2 px-2 py-1 bg-primary hover:bg-primary-hover rounded text-sm"
          >
            Use Telegram Photo
          </button>
          <div className="mt-2 space-x-2">
            <a href="/friends" className="underline text-primary">
              Friends
            </a>
            <a href="/messages" className="underline text-primary">
              Inbox
            </a>
            {!profile.googleId && <div id="g_id_link"></div>}
          </div>
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
                <span className={tx.amount > 0 ? 'text-green-500' : 'text-red-500'}>
                  {tx.amount}
                </span>
                <span>{new Date(tx.date).toLocaleString()}</span>
                <span className="text-xs">{tx.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <InboxWidget />
      <InfoPopup
        open={showSaved}
        onClose={() => setShowSaved(false)}
        info="Profile saved"
      />
    </div>
  );
}
