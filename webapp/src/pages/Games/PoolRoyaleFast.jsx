import React, { Suspense, useEffect, useState } from 'react';

const PoolRoyaleHeavy = React.lazy(() => import('./PoolRoyale.jsx'));

function PoolRoyaleFastBoot() {
  return (
    <div className="relative flex h-[100vh] w-full items-center justify-center overflow-hidden bg-slate-950 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_25%,rgba(34,211,238,0.22),transparent_34%),radial-gradient(circle_at_50%_75%,rgba(16,185,129,0.18),transparent_42%)]" />
      <div className="relative w-[min(86vw,22rem)] rounded-[2rem] border border-cyan-200/25 bg-black/45 p-5 text-center shadow-[0_24px_80px_rgba(0,0,0,0.65)] backdrop-blur">
        <div className="mx-auto aspect-[9/16] w-44 rounded-[1.7rem] border-[10px] border-slate-800 bg-slate-900 p-3 shadow-inner">
          <div className="relative h-full rounded-[1.15rem] border-4 border-amber-700 bg-emerald-700 shadow-[inset_0_0_24px_rgba(0,0,0,0.45)]">
            <span className="absolute left-2 top-2 h-4 w-4 rounded-full bg-black" />
            <span className="absolute right-2 top-2 h-4 w-4 rounded-full bg-black" />
            <span className="absolute left-2 bottom-2 h-4 w-4 rounded-full bg-black" />
            <span className="absolute right-2 bottom-2 h-4 w-4 rounded-full bg-black" />
            <span className="absolute left-1/2 top-2 h-4 w-4 -translate-x-1/2 rounded-full bg-black" />
            <span className="absolute left-1/2 bottom-2 h-4 w-4 -translate-x-1/2 rounded-full bg-black" />
            <span className="absolute left-1/2 top-[38%] h-5 w-5 -translate-x-1/2 rounded-full bg-white shadow" />
            <span className="absolute left-[42%] top-[54%] h-4 w-4 rounded-full bg-yellow-300 shadow" />
            <span className="absolute left-[52%] top-[58%] h-4 w-4 rounded-full bg-red-500 shadow" />
            <span className="absolute left-[47%] top-[62%] h-4 w-4 rounded-full bg-blue-500 shadow" />
          </div>
        </div>
        <p className="mt-5 text-xs font-black uppercase tracking-[0.32em] text-cyan-100">
          Pool Royal
        </p>
        <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/60">
          Fast table booting…
        </p>
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div className="h-full w-2/3 animate-pulse rounded-full bg-cyan-300" />
        </div>
      </div>
    </div>
  );
}

export default function PoolRoyaleFast() {
  const [loadGame, setLoadGame] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setLoadGame(true), 2500);
    return () => window.clearTimeout(timer);
  }, []);

  if (!loadGame) {
    return <PoolRoyaleFastBoot />;
  }

  return (
    <Suspense fallback={<PoolRoyaleFastBoot />}>
      <PoolRoyaleHeavy />
    </Suspense>
  );
}
