import { useState } from 'react';
import { ensureAccountId } from '../utils/telegram.js';
import { claimPresale } from '../utils/api.js';
import InfoPopup from './InfoPopup.jsx';

export default function ClaimPurchaseCard() {
  const [txHash, setTxHash] = useState('');
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState('');

  const handleClaim = async () => {
    const hash = txHash.trim();
    if (!hash) {
      setMsg('Enter transaction hash');
      return;
    }
    setSending(true);
    try {
      const accountId = await ensureAccountId();
      const res = await claimPresale(accountId, hash);
      if (res?.error) setMsg(res.error);
      else setMsg('Claim submitted');
      setTxHash('');
      window.dispatchEvent(new Event('presaleUpdate'));
    } catch {
      setMsg('Claim failed');
    }
    setSending(false);
  };

  return (
    <div className="prism-box p-6 space-y-3 text-center mt-4 flex flex-col items-center wide-card mx-auto">
      <label className="block font-semibold">Claim Purchase</label>
      <input
        type="text"
        placeholder="Transaction Hash"
        value={txHash}
        onChange={(e) => setTxHash(e.target.value)}
        className="border p-1 rounded w-full max-w-xs mx-auto text-black"
      />
      <button
        onClick={handleClaim}
        className="mt-1 px-3 py-1 bg-primary hover:bg-primary-hover text-background rounded"
        disabled={sending}
      >
        {sending ? 'Processing...' : 'Claim'}
      </button>
      <InfoPopup open={!!msg} onClose={() => setMsg('')} title="Claim Purchase" info={msg} />
    </div>
  );
}
