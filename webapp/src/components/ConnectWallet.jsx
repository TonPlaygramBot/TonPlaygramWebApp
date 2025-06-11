import { useEffect, useState } from 'react';
 imw5g8-codex/suggest-next-steps-for-the-project
import { TonConnectButton, useTonWallet } from '@tonconnect/ui-react';
import { getWalletAddress, setWalletAddress, getWalletBalance } from '../utils/api.js';
import { getTelegramId } from '../utils/telegram.js';

export default function ConnectWallet() {
  const wallet = useTonWallet();
  const telegramId = getTelegramId();
  const [balance, setBalance] = useState(null);

  useEffect(() => {
    const saveAndFetch = async () => {
      const res = await getWalletAddress(telegramId);
      const saved = res.address;
      const current = wallet?.account?.address;
      if (current && current !== saved) {
        await setWalletAddress(telegramId, current);
      }
      if (current) {
        const bal = await getWalletBalance(telegramId);
        if (bal.balance !== undefined) setBalance(bal.balance);
      }
    };
    saveAndFetch();
  }, [wallet]);

  return (
    <div className="flex items-center space-x-2">
      <TonConnectButton />
      {wallet?.account?.address && balance !== null && (
        <span className="text-xs">{balance} TON</span>
      )}
    </div>
  );
}

