import type { CSSProperties } from 'react';
import { getFourInRowDropDuration } from '../utils/fourInRowMotion';

type Props = {
  board: (string | null)[][];
  winningCells: number[][];
  dropCell: number[] | null;
  isAnimating: boolean;
};

// Keep the same game and column controls usable when a device cannot start WebGL.
export default function FourInRowFallback({ board, winningCells, dropCell, isAnimating }: Props) {
  return (
    <div className="absolute left-1/2 top-[44%] w-[min(92vw,28rem,48vh)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border-4 border-[#9a856e] bg-[#dbc9ae] p-2 shadow-2xl">
      <div role="grid" aria-label="4 in a Row board" className="flex flex-col gap-1.5">
        {board.map((row, r) => (
          <div key={r} role="row" className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${row.length}, minmax(0, 1fr))` }}>
            {row.map((token, c) => {
              const winning = !isAnimating && winningCells.some(([wr, wc]) => wr === r && wc === c);
              const falling = isAnimating && dropCell?.[0] === r && dropCell?.[1] === c;
              return (
                <div key={c} role="gridcell" aria-label={`Row ${r + 1}, column ${c + 1}: ${token === 'player' ? 'your red chip' : token === 'ai' ? 'rival blue chip' : 'empty'}${winning ? ', winning chip' : ''}`} className="relative aspect-square rounded-full bg-[#121b2b] shadow-inner">
                  {token && (
                    <span
                      className={`absolute inset-[8%] rounded-full border-[3px] border-white/25 shadow-lg ${token === 'player' ? 'bg-red-500' : 'bg-blue-500'} ${winning ? 'ring-4 ring-yellow-300' : ''}`}
                      style={{
                        '--fall-distance': `${(r + 1.12) * 128}%`,
                        animation: falling ? `fourinrow-fallback-drop ${getFourInRowDropDuration(r + 1.12)}s cubic-bezier(.5,0,1,.5) .04s both` : undefined
                      } as CSSProperties}
                    />
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <style>{`
        @keyframes fourinrow-fallback-drop {
          from { transform: translateY(calc(-1 * var(--fall-distance))); }
          to { transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          [aria-label="4 in a Row board"] span { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
