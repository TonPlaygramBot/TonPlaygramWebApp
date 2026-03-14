import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';

const OFFICIAL_STK_CODE_URL = 'https://github.com/supertuxkart/stk-code';

export default function GoKart() {
  useTelegramBackButton();
  const { search } = useLocation();

  const session = useMemo(() => {
    const params = new URLSearchParams(search);
    return {
      mode: params.get('mode') || 'solo',
      track: params.get('track') || 'grasslands'
    };
  }, [search]);

  return (
    <div className="relative min-h-screen bg-[#060c18] p-4 text-text">
      <div className="absolute inset-0 tetris-grid-bg opacity-60" />
      <div className="relative z-10 mx-auto mt-4 max-w-xl space-y-4 rounded-2xl border border-white/10 bg-white/5 p-5">
        <h1 className="text-xl font-bold text-white">GoKart</h1>
        <p className="text-sm text-white/80">
          Lobby configured. Next step is integrating a runtime client compatible with the official
          SuperTuxKart codebase.
        </p>
        <div className="rounded-xl border border-white/10 bg-[#0f172a]/60 p-3 text-sm text-white/80">
          <p>
            <span className="font-semibold text-white">Mode:</span> {session.mode}
          </p>
          <p>
            <span className="font-semibold text-white">Track:</span> {session.track}
          </p>
        </div>
        <a
          href={OFFICIAL_STK_CODE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center rounded-xl border border-cyan-300/50 bg-cyan-300/10 px-3 py-2 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-300/20"
        >
          View official source code
        </a>
      </div>
    </div>
  );
}
