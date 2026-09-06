import type { ReactNode } from 'react';
import './game.css';
type Props = {
  mode: 'ai' | 'online';
  onMode: (mode: 'ai' | 'online') => void;
  difficulty: number;
  onDifficulty: (n: number) => void;
  onStart: () => void;
  onBack?: () => void;
  matching?: boolean;
  onCancel?: () => void;
  onlinePanel?: ReactNode;
  status?: string;
  error?: string;
  preview?: boolean;
};
export default function BowlingLobby({
  mode,
  onMode,
  difficulty,
  onDifficulty,
  onStart,
  onBack,
  matching,
  onCancel,
  onlinePanel,
  status,
  error,
  preview
}: Props) {
  return (
    <main className="br-lobby">
      <div className="br-lobby-inner">
        {onBack && (
          <button className="br-back" onClick={onBack}>
            ‹ Games
          </button>
        )}
        <span className="br-eyebrow">
          {preview ? 'PLAYABLE AI PREVIEW' : 'TONPLAYGRAM'}
        </span>
        <h1>Bowling Royal</h1>
        <img
          className="br-lobby-cover"
          src="/assets/bowling-royal/cover.webp"
          alt="Blue bowling ball striking a rack of pins"
          width="1000"
          height="667"
        />
        <section className="br-lobby-section">
          <h2>Your match</h2>
          <div className="br-choice-grid">
            <button
              disabled={matching}
              aria-pressed={mode === 'ai'}
              onClick={() => onMode('ai')}
            >
              <b>Vs AI</b>
              <span>Free · three levels</span>
            </button>
            <button
              disabled={matching || preview}
              aria-pressed={mode === 'online'}
              onClick={() => onMode('online')}
            >
              <b>Online</b>
              <span>
                {preview ? 'Inside TonPlaygram' : 'Same-stake opponent'}
              </span>
            </button>
          </div>
        </section>
        {mode === 'ai' ? (
          <section className="br-lobby-section">
            <h2>Opponent</h2>
            <div className="br-choice-grid three">
              {['Club', 'Tour', 'Pro'].map((label, i) => (
                <button
                  key={label}
                  aria-pressed={difficulty === i}
                  onClick={() => onDifficulty(i)}
                >
                  <b>{label}</b>
                  <span>{['Relaxed', 'Balanced', 'Precise'][i]}</span>
                </button>
              ))}
            </div>
          </section>
        ) : (
          onlinePanel
        )}
        <section className="br-lobby-section">
          <h2>Ten frames. Every pin counts.</h2>
          <p>
            Swipe up and release to bowl. Swipe farther for power; move left or
            right to aim and curve the ball. Strikes and spares earn bonus
            rolls. Highest score wins.
          </p>
        </section>
        {(status || error) && (
          <p
            className={error ? 'br-error' : 'br-notice'}
            role={error ? 'alert' : 'status'}
          >
            {error || status}
          </p>
        )}
        <button className="br-primary" disabled={matching} onClick={onStart}>
          {matching
            ? 'Finding your opponent…'
            : mode === 'online'
              ? 'Find same-stake match'
              : 'Play vs AI'}
        </button>
        {matching && (
          <button className="br-secondary" onClick={onCancel}>
            Cancel matchmaking
          </button>
        )}
        {preview && (
          <p>
            Online lobbies and TPG matches are part of the TonPlaygramWebApp
            integration. This preview plays against AI.
          </p>
        )}
      </div>
    </main>
  );
}
