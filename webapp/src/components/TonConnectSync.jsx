import { useEffect } from 'react';
import { useTonConnectUI } from '@tonconnect/ui-react';

export default function TonConnectSync() {
  const [tonConnectUI] = useTonConnectUI();

  useEffect(() => {
    const unsubscribe = tonConnectUI.onStatusChange((wallet) => {
      const address = wallet?.account?.address || '';
      if (address) {
        localStorage.setItem('walletAddress', address);
        tonConnectUI.closeModal();
      } else {
        localStorage.removeItem('walletAddress');
      }
    });

    return () => unsubscribe();
  }, [tonConnectUI]);

  useEffect(() => {
    let restoring = false;

    const syncFromWallet = () => {
      const address = tonConnectUI.wallet?.account?.address;
      if (address) {
        localStorage.setItem('walletAddress', address);
        tonConnectUI.closeModal();
      }
    };

    const restore = async () => {
      if (restoring) return;
      restoring = true;
      try {
        await tonConnectUI.restoreConnection();
        syncFromWallet();
      } catch (err) {
        console.warn('TON connection restore failed', err);
      } finally {
        restoring = false;
      }
    };

    restore();
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        restore();
      }
    };

    window.addEventListener('focus', restore);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('focus', restore);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [tonConnectUI]);

  return null;
}
