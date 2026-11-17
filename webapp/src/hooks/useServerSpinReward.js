import { useEffect, useRef, useState } from 'react';
import { spinRewardStatus, startServerSpin, claimServerSpin, hasPendingServerSpin } from '../utils/serverSpinRewards.js';

export default function useServerSpinReward(kind, onClaimed) {
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [showAd, setShowAd] = useState(false);
  const [error, setError] = useState('');
  const [remaining, setRemaining] = useState(0);
  const pending = useRef(null);
  const lock = useRef(false);
  const generation = useRef(0);
  const mounted = useRef(true);
  const callback = useRef(onClaimed);
  callback.current = onClaimed;
  useEffect(() => {
    mounted.current = true;
    const ticket = generation.current;
    spinRewardStatus(kind).then((value) => {
      if (mounted.current && generation.current === ticket) { setStatus(value); pending.current = value.pending; }
    }).catch((err) => { if (mounted.current && generation.current === ticket) setError(err.message); });
    return () => { mounted.current = false; };
  }, [kind]);
  useEffect(() => {
    const update = () => setRemaining(Math.max(0, (status?.nextSpinAt || 0) - Date.now()));
    update(); const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [status?.nextSpinAt]);
  const claim = async () => {
    if (lock.current || !pending.current) return;
    lock.current = true; generation.current += 1; setBusy(true); setError(''); setShowAd(false);
    try {
      const result = await claimServerSpin(kind, pending.current.id);
      pending.current = null;
      if (mounted.current) {
        setStatus({ nextSpinAt: result.nextSpinAt, freeSpins: result.freeSpins, pending: null });
        callback.current(result);
      }
    } catch (err) { if (mounted.current) setError(err.message); }
    finally { lock.current = false; if (mounted.current) setBusy(false); }
  };
  const begin = async () => {
    if (lock.current) return;
    lock.current = true; generation.current += 1; setBusy(true); setError('');
    try {
      // Always ask the server. The saved request id recovers a lost start/claim response.
      const grant = await startServerSpin(kind);
      pending.current = grant;
      if (!mounted.current) return;
      setStatus({ nextSpinAt: grant.nextSpinAt, freeSpins: grant.freeSpins, pending: grant });
      lock.current = false;
      if (grant.claimed || grant.readyAt <= Date.now()) await claim();
      else setShowAd(true);
    } catch (err) { if (mounted.current) setError(err.message); }
    finally { lock.current = false; if (mounted.current) setBusy(false); }
  };
  return { begin, claim, busy, showAd, closeAd: () => setShowAd(false), error, remaining,
    freeSpins: status?.freeSpins || 0,
    ready: Boolean(error || (status && (pending.current || hasPendingServerSpin(kind) || status.freeSpins > 0 || remaining === 0))) };
}
