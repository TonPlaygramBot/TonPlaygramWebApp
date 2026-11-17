import { useEffect, useRef, useState } from 'react';
import SpinWheel from './SpinWheel.tsx';
import RewardPopup from './RewardPopup.tsx';
import SpinRewardVideo from './SpinRewardVideo.tsx';
import { numericSegments } from '../utils/rewardLogic';
import { rewardIdentity } from '../utils/rewardIdentity.js';
import useServerSpinReward from '../hooks/useServerSpinReward.js';

export default function SpinGame({ reelUrl = null }) {
  const [spinning, setSpinning] = useState(false);
  const [reward, setReward] = useState(null);
  const [bonus, setBonus] = useState(null);
  const [bombed, setBombed] = useState(false);
  const result = useRef(null);
  const resultOwner = useRef(null);
  const main = useRef(null); const left = useRef(null); const right = useRef(null);
  const completed = useRef(0);
  const server = useServerSpinReward('spin', (grant) => {
    resultOwner.current = rewardIdentity();
    result.current = grant;
    main.current?.spin(grant.outcome);
  });
  useEffect(() => {
    result.current = null; resultOwner.current = null; completed.current = 0;
    setSpinning(false); setReward(null); setBonus(null); setBombed(false);
  }, [server.identity]);
  const ownsAnimation = () => server.identity === rewardIdentity() && resultOwner.current === server.identity;
  const finish = () => {
    if (!ownsAnimation()) return;
    const grant = result.current;
    if (!grant) return;
    if (grant.outcome === 'BONUS_X3') { setBonus(grant.bonusOutcomes); return; }
    if (grant.outcome === 'BOMB') setBombed(true);
    else setReward(grant.outcome === 'FREE_SPIN' ? 'FREE_SPIN' : grant.amount);
    setSpinning(false);
  };
  useEffect(() => {
    if (!bonus || !ownsAnimation()) return;
    completed.current = 0;
    left.current?.spin(bonus[0]); main.current?.spin(bonus[1]); right.current?.spin(bonus[2]);
    setSpinning(true);
  }, [bonus]);
  const finishBonus = () => {
    if (!ownsAnimation() || !result.current) return;
    completed.current += 1;
    if (completed.current !== 3) return;
    setReward(result.current.amount); setBonus(null); setSpinning(false);
  };
  const seconds = Math.ceil(server.remaining / 1000);
  return <div id="spin-game" className="relative bg-surface border border-border rounded-xl p-4 flex flex-col items-center space-y-2 overflow-hidden wide-card">
    <img src="/assets/icons/snakes_and_ladders.webp" className="background-behind-board object-cover" alt="" onError={(event) => { event.currentTarget.style.display = 'none'; }} />
    <h3 className="text-lg font-bold text-white">Spin &amp; Win</h3>
    <SpinRewardVideo reelUrl={reelUrl} rewardOpen={server.showAd} onRewardComplete={server.claim} onRewardClose={server.closeAd} />
    <p className="text-sm text-subtext">Try your luck and win rewards!</p>
    {bonus ? <div key={`bonus:${server.identity}`} className="flex items-start justify-center space-x-2">
      {[left, main, right].map((ref, index) => <SpinWheel key={index} ref={ref} onFinish={finishBonus} spinning={false} setSpinning={() => {}} segments={numericSegments} showButton={false} />)}
    </div> : <SpinWheel key={`single:${server.identity}`} ref={main} onFinish={finish} spinning={spinning} setSpinning={(value) => { if (server.identity === rewardIdentity()) setSpinning(value); }} showButton={false} />}
    {server.freeSpins > 0 && <p className="text-xs text-accent font-bold">Free Spins: {server.freeSpins}</p>}
    <button onClick={server.begin} disabled={server.busy || spinning || !server.ready} className="mt-2 px-6 py-2 bg-green-600 text-white text-sm font-bold rounded disabled:bg-gray-500">{server.busy ? 'Confirming…' : server.error ? 'Retry spin' : 'Spin'}</button>
    {!server.ready && <p className="text-sm text-yellow-400">Next spin in {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}</p>}
    <p className="text-xs text-subtext">New Lucky Card bonuses are server-issued. Older locally stored bonuses still need server verification.</p>
    {server.error && <p role="status" className="text-sm text-yellow-300">Could not confirm the reward. Retry safely; the same spin will not be credited twice. {server.error}</p>}
    <RewardPopup reward={reward} onClose={() => setReward(null)} />
    {bombed && <div role="status" className="text-white"><span>💥 Try Again Later</span><button onClick={() => setBombed(false)} className="ml-3">Close</button></div>}
  </div>;
}
