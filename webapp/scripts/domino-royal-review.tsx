import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ExternalLink, RotateCcw } from 'lucide-react';

const PHONE_SIZES = [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 430, height: 932 }
] as const;

type PhoneWidth = (typeof PHONE_SIZES)[number]['width'];
type PlayerCount = 2 | 4;
const initialParams = new URLSearchParams(window.location.search);
const initialWidth = Number(initialParams.get('width'));
const defaultWidth: PhoneWidth = PHONE_SIZES.find((size) => size.width === initialWidth)?.width ?? 390;
const defaultPlayers: PlayerCount = initialParams.get('players') === '4' ? 4 : 2;

function Review() {
  const [width, setWidth] = useState<PhoneWidth>(defaultWidth);
  const [players, setPlayers] = useState<PlayerCount>(defaultPlayers);
  const [restart, setRestart] = useState(0);
  const [availableWidth, setAvailableWidth] = useState(window.innerWidth);
  const hostRef = useRef<HTMLDivElement>(null);
  const size = PHONE_SIZES.find((entry) => entry.width === width) ?? PHONE_SIZES[1];
  const scale = Math.min(1, availableWidth / width);
  const params = new URLSearchParams(initialParams);
  params.delete('width');
  params.set('players', String(players));
  const stageUrl = `./domino-royal-stage.html?${params}`;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const observer = new ResizeObserver(([entry]) => setAvailableWidth(entry.contentRect.width));
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const next = new URLSearchParams(window.location.search);
    next.set('width', String(width));
    next.set('players', String(players));
    window.history.replaceState(null, '', `${window.location.pathname}?${next}`);
  }, [width, players]);

  return (
    <main className="review-shell">
      <style>{`
        .review-shell { max-width: 1024px; margin: 0 auto; padding: 20px 12px 24px; }
        .review-header { display: flex; justify-content: space-between; align-items: center; gap: 16px; margin: 0 auto 16px; max-width: 720px; }
        .review-header h1 { margin: 0; color: #eed697; font-size: 22px; letter-spacing: -.04em; font-weight: 700; }
        .review-header p { margin: 5px 0 0; font-size: 12px; line-height: 1.4; color: #a8beb2; }
        .review-controls { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 10px 16px; margin-bottom: 18px; }
        .review-group { display: flex; gap: 4px; padding: 4px; border: 1px solid #304536; border-radius: 15px; background: #0a1915; }
        .review-shell button, .review-shell a { display: inline-flex; min-width: 44px; min-height: 44px; align-items: center; justify-content: center; gap: 7px; padding: 0 12px; background: #10241b; border: 1px solid #354f3f; border-radius: 11px; color: #dce7df; font-family: inherit; font-size: 12px; font-weight: 600; line-height: 1.2; text-decoration: none; cursor: pointer; touch-action: manipulation; }
        .review-shell button { font-family: inherit; }
        .review-group button { border-color: transparent; background: transparent; }
        .review-group button[aria-pressed="true"] { background: #e3cb8c; color: #12271b; }
        .review-shell button:focus-visible, .review-shell a:focus-visible { outline: 2px solid #eed697; outline-offset: 3px; }
        .review-shell button:active, .review-shell a:active { filter: brightness(1.15); }
        .review-shell svg { width: 16px; height: 16px; }
        .review-host { display: flex; width: 100%; justify-content: center; }
        .review-frame { flex-shrink: 0; position: relative; border-radius: 18px; outline: 1px solid #3b5141; box-shadow: 0 24px 80px #0008; overflow: hidden; background: #07100f; }
        .review-frame iframe { display: block; border: 0; transform-origin: top left; }
        .review-dimensions { margin: 12px auto 0; text-align: center; color: #93a99b; font-size: 11px; line-height: 1.4; }
        @media (max-width: 440px) {
          .review-shell { padding: 12px 8px 16px; }
          .review-header { gap: 8px; margin-bottom: 12px; }
          .review-header h1 { font-size: 19px; }
          .review-header p { font-size: 11px; }
          .review-controls { gap: 8px; margin-bottom: 12px; }
          .review-shell button, .review-shell a { padding: 0 9px; }
        }
      `}</style>
      <header className="review-header">
        <div>
          <h1>Domino Royal</h1>
          <p>Portrait review · production game</p>
        </div>
        <a href={stageUrl} target="_blank" rel="noreferrer">
          <ExternalLink aria-hidden="true" /> Open game
        </a>
      </header>
      <div className="review-controls" role="group" aria-label="Preview controls">
        <div className="review-group" role="group" aria-label="Phone viewport width">
          {PHONE_SIZES.map((phone) => (
            <button key={phone.width} type="button" aria-pressed={width === phone.width} onClick={() => setWidth(phone.width)}>
              {phone.width}px
            </button>
          ))}
        </div>
        <div className="review-group" role="group" aria-label="Number of players">
          {([2, 4] as const).map((count) => (
            <button key={count} type="button" aria-pressed={players === count} onClick={() => setPlayers(count)}>
              {count} players
            </button>
          ))}
        </div>
        <button type="button" onClick={() => setRestart((value) => value + 1)} aria-label="Restart the game and replay the opening animation">
          <RotateCcw aria-hidden="true" /> Replay opening
        </button>
      </div>
      <div className="review-host" ref={hostRef}>
        <div className="review-frame" style={{ width: size.width * scale, height: size.height * scale }}>
          <iframe
            key={`${players}-${restart}`}
            title={`Domino Royal, ${players} players, ${size.width} by ${size.height} portrait viewport`}
            src={stageUrl}
            width={size.width}
            height={size.height}
            allow="autoplay; fullscreen"
            allowFullScreen
            style={{ width: size.width, height: size.height, transform: `scale(${scale})` }}
          />
        </div>
      </div>
      <p className="review-dimensions" role="status">{size.width} × {size.height} · {players} players</p>
    </main>
  );
}

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Domino Royal review root is missing.');
createRoot(rootElement).render(<Review />);
