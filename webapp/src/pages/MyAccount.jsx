import { useEffect, useState } from 'react';
import {
  getProfile,
  updateProfile,
  updateBalance,
  addTransaction,
  linkSocial
} from '../utils/api.js';
import {getTelegramId} from "../utils/telegram.js";

export default function MyAccount() {
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({ nickname: '', photo: '', bio: '' });
  const [social, setSocial] = useState({ twitter: '', telegram: '', discord: '' });
  const [balanceInput, setBalanceInput] = useState('');
  const [tx, setTx] = useState({ amount: '', type: '' });

  const load = async () => {
    const data = await getProfile(getTelegramId());
    setProfile(data);
    setForm({ nickname: data.nickname || '', photo: data.photo || '', bio: data.bio || '' });
    setSocial({
      twitter: data.social?.twitter || '',
      telegram: data.social?.telegram || '',
      discord: data.social?.discord || ''
    });
    setBalanceInput(data.balance ?? '');
  };

  useEffect(() => {
    load();
  }, []);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSocialChange = (e) => {
    setSocial({ ...social, [e.target.name]: e.target.value });
  };

  const handleSave = async () => {
    const res = await updateProfile({ telegramId: getTelegramId(), ...form });
    setProfile(res);
    alert('Profile updated');
  };

  const handleSaveSocial = async () => {
    await linkSocial({ telegramId: getTelegramId(), ...social });
    alert('Social accounts updated');
  };

  const handleSetBalance = async () => {
    const res = await updateBalance(getTelegramId(), Number(balanceInput));
    setProfile({ ...profile, balance: res.balance });
  };

  const handleAddTx = async () => {
    await addTransaction(getTelegramId(), Number(tx.amount), tx.type);
    const refreshed = await getProfile(getTelegramId());
    setProfile(refreshed);
    setTx({ amount: '', type: '' });
  };

  const handleLinkGoogle = () => {
    window.open('/api/profile/google', '_blank');
  };

  if (!profile) return <div className="p-4">Loading...</div>;

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-bold">Profile</h2>

      <div className="space-y-2">
        <input
          name="nickname"
          value={form.nickname}
          onChange={handleChange}
          placeholder="Nickname"
          className="w-full p-1 border"
        />
        <input
          name="photo"
          value={form.photo}
          onChange={handleChange}
          placeholder="Photo URL"
          className="w-full p-1 border"
        />
        <textarea
          name="bio"
          value={form.bio}
          onChange={handleChange}
          placeholder="Bio"
          className="w-full p-1 border"
        />
        <button className="px-3 py-1 bg-blue-500 text-white" onClick={handleSave}>
          Save Profile
        </button>
      </div>

      <div className="space-y-2">
        <h3 className="font-bold">Social Links</h3>
        <input
          name="twitter"
          value={social.twitter}
          onChange={handleSocialChange}
          placeholder="Twitter"
          className="w-full p-1 border"
        />
        <input
          name="telegram"
          value={social.telegram}
          onChange={handleSocialChange}
          placeholder="Telegram"
          className="w-full p-1 border"
        />
        <input
          name="discord"
          value={social.discord}
          onChange={handleSocialChange}
          placeholder="Discord"
          className="w-full p-1 border"
        />
        <button className="px-3 py-1 bg-blue-500 text-white" onClick={handleSaveSocial}>
          Save Social
        </button>
        <button className="px-3 py-1 bg-blue-600 text-white" onClick={handleLinkGoogle}>
          Link Google
        </button>
      </div>

      <div className="space-y-2">
        <h3 className="font-bold">Balance</h3>
        <p>Current balance: {profile.balance}</p>
        <input
          type="number"
          value={balanceInput}
          onChange={(e) => setBalanceInput(e.target.value)}
          className="w-full p-1 border"
        />
        <button className="px-3 py-1 bg-blue-500 text-white" onClick={handleSetBalance}>
          Set Balance
        </button>
      </div>

      <div className="space-y-2">
        <h3 className="font-bold">Transactions</h3>
        <ul className="space-y-1 text-sm">
          {profile.transactions?.map((t, i) => (
            <li key={i}>{t.date?.substring(0, 10)} - {t.type}: {t.amount}</li>
          ))}
        </ul>
        <input
          type="number"
          name="amount"
          value={tx.amount}
          onChange={(e) => setTx({ ...tx, amount: e.target.value })}
          placeholder="Amount"
          className="w-full p-1 border"
        />
        <input
          name="type"
          value={tx.type}
          onChange={(e) => setTx({ ...tx, type: e.target.value })}
          placeholder="Type"
          className="w-full p-1 border"
        />
        <button className="px-3 py-1 bg-blue-500 text-white" onClick={handleAddTx}>
          Add Transaction
        </button>
      </div>
    </div>
  );
}
