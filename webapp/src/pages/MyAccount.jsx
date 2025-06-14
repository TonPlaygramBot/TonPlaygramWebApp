import { useEffect, useState } from 'react';
import {
  getProfile,
  updateProfile,
  updateBalance,
  addTransaction,
  linkSocial,
  fetchTelegramInfo
} from '../utils/api.js';
import { getTelegramId } from '../utils/telegram.js';

export default function MyAccount() {
  let telegramId;
  try {
    telegramId = getTelegramId();
  } catch (err) {
    return (
      <div className="p-4 text-text">
        Please open this application via the Telegram bot.
      </div>
    );
  }
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({ nickname: '', photo: '', bio: '' });
  const [social, setSocial] = useState({ twitter: '', telegram: '', discord: '' });
  const [balanceInput, setBalanceInput] = useState('');
  const [tx, setTx] = useState({ amount: '', type: '' });
  const [autoUpdating, setAutoUpdating] = useState(false);

  const load = async () => {
    const data = await getProfile(telegramId);
    setProfile(data);
    setForm({
      nickname: data.nickname || '',
      photo: data.photo || '',
      bio: data.bio || ''
    });
    setSocial({
      twitter: data.social?.twitter || '',
      telegram: data.social?.telegram || '',
      discord: data.social?.discord || ''
    });
    setBalanceInput(data.balance ?? '');

    if (!data.nickname || !data.photo) {
      setAutoUpdating(true);
      try {
        const tg = await fetchTelegramInfo(getTelegramId());
        const updated = await updateProfile({
          telegramId: getTelegramId(),
          nickname: data.nickname || tg.nickname,
          photo: data.photo || tg.photo
        });
        setProfile(updated);
        setForm({
          nickname: updated.nickname || '',
          photo: updated.photo || '',
          bio: updated.bio || ''
        });
      } finally {
        setAutoUpdating(false);
      }
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const handleSocialChange = (e) => setSocial({ ...social, [e.target.name]: e.target.value });

  const handleSave = async () => {
    const res = await updateProfile({ telegramId, ...form });
    setProfile(res);
    alert('Profile updated');
  };

  const handleSaveSocial = async () => {
    await linkSocial({ telegramId, ...social });
    alert('Social accounts updated');
  };

  const handleSetBalance = async () => {
    const res = await updateBalance(telegramId, Number(balanceInput));
    setProfile({ ...profile, balance: res.balance });
  };

  const handleAddTx = async () => {
    await addTransaction(telegramId, Number(tx.amount), tx.type);
    const refreshed = await getProfile(telegramId);
    setProfile(refreshed);
    setTx({ amount: '', type: '' });
  };

  const handleLinkGoogle = () => {
    window.open('/api/profile/google', '_blank');
  };

  if (!profile) return <div className="p-4 text-subtext">Loading...</div>;

  return (
    <div className="p-4 space-y-4 text-text">
      {autoUpdating && (
        <div className="p-2 text-sm text-subtext">Updating with Telegram info...</div>
      )}
      <h2 className="text-xl font-bold">My Account</h2>

      {/* Profile Info */}
      <div className="space-y-2">
        <input
          name="nickname"
          value={form.nickname}
          onChange={handleChange}
          placeholder="Nickname"
          className="w-full p-1 border rounded bg-surface text-text"
        />
        <input
          name="photo"
          value={form.photo}
          onChange={handleChange}
          placeholder="Photo URL"
          className="w-full p-1 border rounded bg-surface text-text"
        />
        <textarea
          name="bio"
          value={form.bio}
          onChange={handleChange}
          placeholder="Bio"
          className="w-full p-1 border rounded bg-surface text-text"
        />
        <button
          className="px-3 py-1 bg-primary hover:bg-primary-hover text-text rounded"
          onClick={handleSave}
        >
          Save Profile
        </button>
      </div>

      {/* Social Links */}
      <div className="space-y-2">
        <h3 className="font-bold">Social Links</h3>
        <input
          name="twitter"
          value={social.twitter}
          onChange={handleSocialChange}
          placeholder="Twitter"
          className="w-full p-1 border rounded bg-surface text-text"
        />
        <input
          name="telegram"
          value={social.telegram}
          onChange={handleSocialChange}
          placeholder="Telegram"
          className="w-full p-1 border rounded bg-surface text-text"
        />
        <input
          name="discord"
          value={social.discord}
          onChange={handleSocialChange}
          placeholder="Discord"
          className="w-full p-1 border rounded bg-surface text-text"
        />
        <button
          className="px-3 py-1 bg-primary hover:bg-primary-hover text-text rounded"
          onClick={handleSaveSocial}
        >
          Save Social
        </button>
        <button
          className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white rounded"
          onClick={handleLinkGoogle}
        >
          Link Google
        </button>
      </div>

      {/* Balance */}
      <div className="space-y-2">
        <h3 className="font-bold">Balance</h3>
        <p>
          Current balance: <span className="text-accent">{profile.balance}</span>
        </p>
        <input
          type="number"
          value={balanceInput}
          onChange={(e) => setBalanceInput(e.target.value)}
          className="w-full p-1 border rounded bg-surface text-text"
        />
        <button
          className="px-3 py-1 bg-primary hover:bg-primary-hover text-text rounded"
          onClick={handleSetBalance}
        >
          Set Balance
        </button>
      </div>

      {/* Transactions */}
      <div className="space-y-2">
        <h3 className="font-bold">Transactions</h3>
        <ul className="space-y-1 text-sm text-subtext">
          {profile.transactions?.map((t, i) => (
            <li key={i}>
              {t.date?.substring(0, 10)} - {t.type}: {t.amount}
            </li>
          ))}
        </ul>
        <input
          type="number"
          name="amount"
          value={tx.amount}
          onChange={(e) => setTx({ ...tx, amount: e.target.value })}
          placeholder="Amount"
          className="w-full p-1 border rounded bg-surface text-text"
        />
        <input
          name="type"
          value={tx.type}
          onChange={(e) => setTx({ ...tx, type: e.target.value })}
          placeholder="Type"
          className="w-full p-1 border rounded bg-surface text-text"
        />
        <button
          className="px-3 py-1 bg-primary hover:bg-primary-hover text-text rounded"
          onClick={handleAddTx}
        >
          Add Transaction
        </button>
      </div>
    </div>
  );
}
