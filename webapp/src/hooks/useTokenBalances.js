import { useEffect, useState } from 'react';
import { createAccount, getAccountBalance, getTonBalance } from '../utils/api.js';
import { getTelegramId } from '../utils/telegram.js';
import { useTonAddress } from '@tonconnect/ui-react';
import { loadGoogleProfile } from '../utils/google.js';

export default function useTokenBalances() {
  let telegramId;
  try {
    telegramId = getTelegramId();
  } catch (err) {
    telegramId = undefined;
  }
  const [googleProfile, setGoogleProfile] = useState(() => (telegramId ? null : loadGoogleProfile()));

  const [tpcBalance, setTpcBalance] = useState(null);
  const [tonBalance, setTonBalance] = useState(null);
  const [tpcWalletBalance, setTpcWalletBalance] = useState(null);

  const connectedWalletAddress = useTonAddress(true);
  const [storedWalletAddress, setStoredWalletAddress] = useState(() => {
    try {
      return localStorage.getItem('walletAddress') || '';
    } catch {
      return '';
    }
  });
  const walletAddress = connectedWalletAddress || storedWalletAddress;

  useEffect(() => {
    async function loadTpc() {
      if (!telegramId && !googleProfile?.id) return;
      try {
        const acc = await createAccount(telegramId, googleProfile);
        if (acc?.error) throw new Error(acc.error);
        if (acc.walletAddress) {
          localStorage.setItem('walletAddress', acc.walletAddress);
        }
        const bal = await getAccountBalance(acc.accountId);
        if (bal?.error) throw new Error(bal.error);
        setTpcBalance(bal.balance ?? 0);
      } catch (err) {
        console.error('Failed to load TPC balance:', err);
        setTpcBalance(0);
      }
    }
    loadTpc();
  }, [telegramId, googleProfile?.id]);

  useEffect(() => {
    if (telegramId) return undefined;
    const refresh = () => setGoogleProfile(loadGoogleProfile());
    window.addEventListener('googleProfileUpdated', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('googleProfileUpdated', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, [telegramId]);

  useEffect(() => {
    const syncStoredWallet = () => {
      try {
        setStoredWalletAddress(localStorage.getItem('walletAddress') || '');
      } catch {
        setStoredWalletAddress('');
      }
    };

    window.addEventListener('storage', syncStoredWallet);
    window.addEventListener('walletAddressUpdated', syncStoredWallet);
    window.addEventListener('focus', syncStoredWallet);
    window.addEventListener('pageshow', syncStoredWallet);

    return () => {
      window.removeEventListener('storage', syncStoredWallet);
      window.removeEventListener('walletAddressUpdated', syncStoredWallet);
      window.removeEventListener('focus', syncStoredWallet);
      window.removeEventListener('pageshow', syncStoredWallet);
    };
  }, []);

  useEffect(() => {
    async function loadExternal() {
      if (!walletAddress) {
        setTonBalance(null);
        setTpcWalletBalance(null);
        return;
      }
      try {
        const tonapiRes = await fetch(
          `https://tonapi.io/v2/accounts/${encodeURIComponent(walletAddress)}`
        );
        if (!tonapiRes.ok) throw new Error(`tonapi account request failed (${tonapiRes.status})`);
        const tonapiData = await tonapiRes.json();
        const nanoTonBalance = Number(tonapiData?.balance ?? 0);
        setTonBalance(Number.isFinite(nanoTonBalance) ? nanoTonBalance / 1e9 : 0);
      } catch (err) {
        console.error('Failed to load TON balance from tonapi:', err);
        try {
          const ton = await getTonBalance(walletAddress);
          if (ton?.error) throw new Error(ton.error);
          setTonBalance(ton.balance ?? 0);
        } catch (fallbackErr) {
          console.error('Failed to load TON balance from backend fallback:', fallbackErr);
          setTonBalance(0);
        }
      }
      try {
        const res = await fetch(
          `https://tonapi.io/v2/accounts/${encodeURIComponent(walletAddress)}/jettons/EQDY3qbfGN6IMI5d4MsEoprhuMTz09OkqjyhPKX6DVtzbi6X`
        );
        if (!res.ok) throw new Error('request failed');
        const data = await res.json();
        const decimals = Number(data.jetton?.decimals) || 0;
        setTpcWalletBalance(Number(data.balance) / 10 ** decimals);
      } catch (err) {
        console.error('Failed to load TPC balance:', err);
        setTpcWalletBalance(0);
      }
    }
    loadExternal();
  }, [walletAddress]);

  return { tpcBalance, tonBalance, tpcWalletBalance, telegramId };
}
