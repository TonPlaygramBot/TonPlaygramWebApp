import { useEffect } from 'react';
import { useTonConnectUI, useTonWallet } from '@tonconnect/ui-react';

export default function TonConnectSync() {
  const [tonConnectUI] = useTonConnectUI();
  const wallet = useTonWallet();

  const getConnectedAddress = () => tonConnectUI?.wallet?.account?.address || wallet?.account?.address || '';

  const syncWalletAddress = (address) => {
    if (address) {
      localStorage.setItem('walletAddress', address);
      tonConnectUI.closeModal();
    } else {
      localStorage.removeItem('walletAddress');
    }
  };

  useEffect(() => {
    const address = wallet?.account?.address || '';
    if (address) syncWalletAddress(address);
  }, [wallet]);

  useEffect(() => {
    const unsubscribeStatus = tonConnectUI.onStatusChange((nextWallet) => {
      const address = nextWallet?.account?.address || '';
      syncWalletAddress(address);
    });

    const unsubscribeModal = tonConnectUI.onModalStateChange(() => {
      const address = getConnectedAddress();
      if (address) tonConnectUI.closeModal();
    });

    tonConnectUI.connectionRestored
      .then(() => {
        const address = getConnectedAddress();
        if (address) syncWalletAddress(address);
      })
      .catch(() => {});

    return () => {
      unsubscribeStatus();
      unsubscribeModal();
    };
  }, [tonConnectUI, wallet]);

  useEffect(() => {
    const closeIfConnected = () => {
      const address = getConnectedAddress();
      if (address) tonConnectUI.closeModal();
    };

    const events = ['visibilitychange', 'focus', 'pageshow'];
    events.forEach((eventName) => window.addEventListener(eventName, closeIfConnected));

    return () => {
      events.forEach((eventName) => window.removeEventListener(eventName, closeIfConnected));
    };
  }, [tonConnectUI, wallet]);

  return null;
}
