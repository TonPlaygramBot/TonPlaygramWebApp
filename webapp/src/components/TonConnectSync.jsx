import { useEffect } from 'react';
import { useTonConnectUI, useTonWallet } from '@tonconnect/ui-react';

export default function TonConnectSync() {
  const [tonConnectUI] = useTonConnectUI();
  const wallet = useTonWallet();

  const getConnectedAddress = () => tonConnectUI?.wallet?.account?.address || wallet?.account?.address || '';

  const closeModalIfConnected = () => {
    if (getConnectedAddress() && tonConnectUI?.modalState?.status === 'opened') {
      tonConnectUI.closeModal();
    }
  };

  const syncWalletAddress = (address) => {
    if (address) {
      localStorage.setItem('walletAddress', address);
      closeModalIfConnected();
    } else {
      localStorage.removeItem('walletAddress');
    }
  };

  useEffect(() => {
    const address = getConnectedAddress();
    syncWalletAddress(address);
    // TonConnect can restore session asynchronously after returning from wallet app.
    tonConnectUI.connectionRestored.finally(() => {
      syncWalletAddress(getConnectedAddress());
      closeModalIfConnected();
    });
  }, [tonConnectUI, wallet]);

  useEffect(() => {
    const unsubscribeStatus = tonConnectUI.onStatusChange((nextWallet) => {
      const address = nextWallet?.account?.address || '';
      syncWalletAddress(address);
      closeModalIfConnected();
    });

    const unsubscribeModal = tonConnectUI.onModalStateChange(() => {
      closeModalIfConnected();
    });

    return () => {
      unsubscribeStatus();
      unsubscribeModal();
    };
  }, [tonConnectUI, wallet]);

  useEffect(() => {
    const closeOnReturn = () => {
      closeModalIfConnected();
      let attempts = 0;
      const maxAttempts = 10;
      const interval = window.setInterval(() => {
        attempts += 1;
        closeModalIfConnected();
        if (attempts >= maxAttempts || getConnectedAddress()) {
          window.clearInterval(interval);
        }
      }, 400);
    };

    const events = ['visibilitychange', 'focus', 'pageshow'];
    events.forEach((eventName) => window.addEventListener(eventName, closeOnReturn));

    return () => {
      events.forEach((eventName) => window.removeEventListener(eventName, closeOnReturn));
    };
  }, [tonConnectUI, wallet]);

  return null;
}
