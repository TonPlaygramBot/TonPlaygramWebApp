import { useEffect } from 'react';
import { useTonConnectUI, useTonWallet } from '@tonconnect/ui-react';
import { registerWallet } from '../utils/api.js';

export default function useTonConnect() {
  const [tonConnectUI] = useTonConnectUI();
  const wallet = useTonWallet();

  useEffect(() => {
    if (wallet?.account?.address) {
      registerWallet(wallet.account.address).catch(() => {});
    }
  }, [wallet]);

  return { tonConnectUI, wallet };
}
