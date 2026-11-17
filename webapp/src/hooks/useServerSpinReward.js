import { useCallback, useEffect, useRef, useState } from 'react';
import { spinRewardStatus, startServerSpin, claimServerSpin, hasPendingServerSpin } from '../utils/serverSpinRewards.js';
import { rewardIdentity, rewardIdentityEvents, affectsRewardIdentity } from '../utils/rewardIdentity.js';

export default function useServerSpinReward(kind, onClaimed) {
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [showAd, setShowAd] = useState(false);
  const [error, setError] = useState('');
  const [remaining, setRemaining] = useState(0);
  const [revision, setRevision] = useState(0);
  const identity = rewardIdentity();
  const pending = useRef(null);
  const lock = useRef(false);
  const generation = useRef(0);
  const refreshNeeded = useRef(false);
  const mounted = useRef(true);
  const callback = useRef(onClaimed);
  callback.current = onClaimed;
  const current = (ticket, owner) => mounted.current && generation.current === ticket && rewardIdentity() === owner;
  const loadStatus = useCallback(() => {
    const ticket = generation.current, owner = rewardIdentity();
    spinRewardStatus(kind).then((value) => {
      if (current(ticket, owner) && !lock.current) { setStatus(value); pending.current = value.pending; }
    }).catch((err) => { if (current(ticket, owner)) setError(err.message); });
  }, [kind]);
  useEffect(() => {
    const changed = (event) => {
      if (!affectsRewardIdentity(event)) return;
      generation.current += 1; pending.current = null; lock.current = false;
      setStatus(null); setBusy(false); setShowAd(false); setError('');
      setRevision((value) => value + 1);
    };
    rewardIdentityEvents.forEach((event) => window.addEventListener(event, changed));
    return () => rewardIdentityEvents.forEach((event) => window.removeEventListener(event, changed));
  }, []);
  useEffect(() => {
    mounted.current = true; generation.current += 1;
    pending.current = null; lock.current = false;
    setStatus(null); setBusy(false); setShowAd(false); setError('');
    loadStatus();
    return () => { mounted.current = false; generation.current += 1; };
  }, [kind, identity, revision, loadStatus]);
  useEffect(() => {
    // This is a display refresh only, never authorization or a new claim.
    const refresh = () => { if (kind !== 'spin') return; if (lock.current) refreshNeeded.current = true; else loadStatus(); };
    window.addEventListener('serverSpinRewardsUpdated', refresh);
    return () => window.removeEventListener('serverSpinRewardsUpdated', refresh);
  }, [kind, loadStatus]);
  useEffect(() => {
    const update = () => setRemaining(Math.max(0, (status?.nextSpinAt || 0) - Date.now()));
    update(); const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [status?.nextSpinAt]);
  const claim = useCallback(async () => {
    if (lock.current || !pending.current) return;
    lock.current = true; const ticket = ++generation.current, owner = rewardIdentity();
    setBusy(true); setError(''); setShowAd(false);
    try {
      const result = await claimServerSpin(kind, pending.current.id);
      if (!current(ticket, owner)) return;
      pending.current = null;
      setStatus({ nextSpinAt: result.nextSpinAt, freeSpins: result.freeSpins, pending: null });
      callback.current(result);
    } catch (err) { if (current(ticket, owner)) setError(err.message); }
    finally { if (current(ticket, owner)) { lock.current = false; setBusy(false); if (refreshNeeded.current) { refreshNeeded.current = false; loadStatus(); } } }
  }, [kind, loadStatus]);
  const begin = useCallback(async () => {
    if (lock.current) return;
    lock.current = true; const ticket = ++generation.current, owner = rewardIdentity();
    setBusy(true); setError('');
    try {
      const grant = await startServerSpin(kind);
      if (!current(ticket, owner)) return;
      pending.current = grant;
      setStatus({ nextSpinAt: grant.nextSpinAt, freeSpins: grant.freeSpins, pending: grant });
      lock.current = false;
      if (grant.claimed || grant.readyAt <= Date.now()) await claim();
      else setShowAd(true);
    } catch (err) { if (current(ticket, owner)) setError(err.message); }
    finally { if (current(ticket, owner)) { lock.current = false; setBusy(false); if (refreshNeeded.current) { refreshNeeded.current = false; loadStatus(); } } }
  }, [kind, claim, loadStatus]);
  return { begin, claim, busy, showAd, closeAd: () => setShowAd(false), error, remaining, identity,
    freeSpins: status?.freeSpins || 0,
    ready: Boolean(error || (status && (pending.current || hasPendingServerSpin(kind) || status.freeSpins > 0 || remaining === 0))) };
}
