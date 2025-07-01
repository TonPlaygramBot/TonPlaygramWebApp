import { useEffect, useRef, useState } from 'react';
import {
  getProfile,
  updateProfile,
  fetchTelegramInfo,
  getReferralInfo,
  getTransactions,
  linkGoogleAccount,
  getLeaderboard
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
import TransactionDetailsPopup from '../components/TransactionDetailsPopup.jsx';
import TransactionCard from '../components/TransactionCard.jsx';
import { AiOutlineCalendar } from 'react-icons/ai';

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
  const [filterDate, setFilterDate] = useState('');
  const [sortOrder, setSortOrder] = useState('desc');
  const [selectedTx, setSelectedTx] = useState(null);
  const [users, setUsers] = useState([]);
  const dateInputRef = useRef(null);

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
      const lb = await getLeaderboard();
      setUsers(lb?.users || []);

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

  const filteredTransactions = transactions.filter((tx) => {
    if (!filterDate) return true;
    const d = new Date(tx.date).toISOString().slice(0, 10);
    return d === filterDate;
  });
  const sortedTransactions = [...filteredTransactions].sort((a, b) =>
    sortOrder === 'desc'
      ? new Date(b.date) - new Date(a.date)
      : new Date(a.date) - new Date(b.date)
  );

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
          <p className="text-sm text-subtext">Account: {profile.accountId}</p>
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
        <div className="flex items-center justify-between mb-1">
          <p className="font-semibold">Transaction History</p>
          <div className="flex items-center space-x-1">
            <input
              type="date"
              ref={dateInputRef}
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="hidden"
            />
            <AiOutlineCalendar
              className="w-5 h-5 cursor-pointer"
              onClick={() => dateInputRef.current?.showPicker && dateInputRef.current.showPicker()}
            />
            {filterDate && (
              <button
                onClick={() => setFilterDate('')}
                className="text-xs text-subtext"
              >
                Clear
              </button>
            )}
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className="border border-border rounded text-black text-xs px-1"
            >
              <option value="desc">Newest</option>
              <option value="asc">Oldest</option>
            </select>
          </div>
        </div>
        {sortedTransactions.length === 0 ? (
          <p className="text-sm text-subtext">No transactions</p>
        ) : (
          <div className="space-y-1 text-sm">
            {sortedTransactions.map((tx, i) => {
              const acc = tx.type === 'send' ? tx.toAccount : tx.fromAccount;
              const prof = users.find((u) => u.accountId === acc);
              return (
                <TransactionCard
                  key={i}
                  tx={tx}
                  profile={prof}
                  onClick={() => setSelectedTx(tx)}
                />
              );
            })}
          </div>
        )}
      </div>
      <InboxWidget />
      <InfoPopup
        open={showSaved}
        onClose={() => setShowSaved(false)}
        info="Profile saved"
      />
      <TransactionDetailsPopup tx={selectedTx} onClose={() => setSelectedTx(null)} />
    </div>
  );
}
