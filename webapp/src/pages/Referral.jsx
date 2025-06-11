import { useEffect, useState } from 'react';
import { getReferralInfo, claimReferral } from '../utils/api.js';
import { getTelegramId } from '../utils/telegram.js';

export default function Referral() {
  const [info, setInfo] = useState(null);
  const [claim, setClaim] = useState('');
  const telegramId = getTelegramId();

  const load = async () => {
    const data = await getReferralInfo(telegramId);
    setInfo(data);
  };

  useEffect(() => { load(); }, []);

  const handleClaim = async () => {
    if (!claim.trim()) return;
    const res = await claimReferral(telegramId, claim.trim());
    alert(res.message || 'Claimed');
    load();
  };

  if (!info) return <div className="p-4">Loading...</div>;

  return (
    <div className="p-4 space-y-2">
      <h2 className="text-xl font-bold">Referral</h2>
      <p>Your code: <span className="font-mono">{info.code}</span></p>
      <p>Total referrals: {info.referrals}</p>
      <div className="space-x-2">
        <input
          className="border p-1 rounded text-black"
          value={claim}
          onChange={(e) => setClaim(e.target.value)}
          placeholder="Enter code"
        />
        <button className="px-2 py-1 bg-blue-500 text-white" onClick={handleClaim}>Claim</button>
      </div>
    </div>
  );
}
