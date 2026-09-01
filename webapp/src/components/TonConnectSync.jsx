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
    const normalizedAddress = address || '';

    if (normalizedAddress) {
      localStorage.setItem('walletAddress', normalizedAddress);
      closeModalIfConnected();
    } else {
      localStorage.removeItem('walletAddress');
    }

    window.dispatchEvent(
      new CustomEvent('walletAddressUpdated', {
        detail: { address: normalizedAddress },
      }),
    );
  };

  useEffect(() => {
    // TonConnect can restore session asynchronously after returning from wallet app.
    // Do not clear the last known address before restoration finishes: mobile
    // wallets briefly return an empty SDK state while the Telegram webview is
    // being brought back to the foreground.
    const address = getConnectedAddress();
    if (address) syncWalletAddress(address);

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
      const maxAttempts = 20;
      const interval = window.setInterval(() => {
        attempts += 1;
        const address = getConnectedAddress();
        if (address) {
          syncWalletAddress(address);
          closeModalIfConnected();
        }
        if (attempts >= maxAttempts || address) {
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
