import { useEffect } from 'react';

import { DOMINO_ROYAL_INLINE_STYLE } from './dominoRoyalTemplate.js';

const INLINE_STYLE_ID = 'domino-royal-inline-style';
const GAME_SCRIPT_SELECTOR = 'script[data-domino-royal-script="true"]';

export default function DominoRoyalArena() {
  useEffect(() => {
    const statusNode = document.getElementById('status');
    const appRoot = document.getElementById('app');
    if (statusNode) {
      statusNode.textContent = 'Loading Domino Royal…';
    }

    if (appRoot) {
      appRoot.replaceChildren();
    }

    const existingStyle = document.getElementById(INLINE_STYLE_ID);
    const styleTag = existingStyle ?? document.createElement('style');
    if (!existingStyle) {
      styleTag.id = INLINE_STYLE_ID;
      styleTag.textContent = DOMINO_ROYAL_INLINE_STYLE;
      document.head.appendChild(styleTag);
    }

    const existingScript = document.querySelector(GAME_SCRIPT_SELECTOR);
    if (existingScript) {
      existingScript.remove();
    }

    const basePath = import.meta.env.BASE_URL || '/';
    const normalizedBasePath = basePath.endsWith('/') ? basePath : `${basePath}/`;
    const script = document.createElement('script');
    script.type = 'module';
    script.src = `${normalizedBasePath}domino-royal-game.js`;
    script.dataset.dominoRoyalScript = 'true';
    script.onload = () => {
      if (statusNode) {
        statusNode.textContent = 'Ready';
      }
    };
    script.onerror = () => {
      if (statusNode) {
        statusNode.textContent = 'Game failed to load. Please refresh and try again.';
      }
    };
    document.body.appendChild(script);

    return () => {
      if (typeof window.__dominoRoyalCleanup === 'function') {
        window.__dominoRoyalCleanup('react-unmount');
      }
      script.remove();
      if (appRoot) {
        appRoot.replaceChildren();
      }
    };
  }, []);

  return (
    <div className="relative h-full w-full bg-black">
      <div id="app" />
      <div id="status" role="status">Ready</div>
      <button id="configButton" type="button" aria-label="Open game settings menu">
        <span aria-hidden="true">☰</span>
        <span>Menu</span>
      </button>
      <div id="configPanel" role="dialog" aria-modal="true" aria-labelledby="configTitle" tabIndex="-1" aria-hidden="true">
        <div className="config-close">
          <button id="configClose" type="button" aria-label="Close table setup">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="m6 6 12 12M18 6 6 18" />
            </svg>
          </button>
        </div>
        <h3 id="configTitle">Table Setup</h3>
        <div id="configSections" />
      </div>
      <style>{`
        #viewToggle {
          position: fixed !important;
          right: calc(0.38rem + env(safe-area-inset-right, 0px)) !important;
          left: auto !important;
          top: calc(8.15rem + env(safe-area-inset-top, 0px)) !important;
          margin: 0 !important;
        }
        #configButton {
          top: calc(4.55rem + env(safe-area-inset-top, 0px)) !important;
          left: calc(0.75rem + env(safe-area-inset-left, 0px)) !important;
          width: auto !important;
          padding: 0 0.95rem !important;
          display: flex !important;
          align-items: center;
          gap: 0.5rem;
        }
        #configButton span:first-child { font-size: 1.05rem; line-height: 1; }
        #configButton span:last-child { font-size: 0.72rem; letter-spacing: 0.24em; text-transform: uppercase; }
        #muteButton {
          top: calc(4.55rem + env(safe-area-inset-top, 0px)) !important;
          right: calc(0.38rem + env(safe-area-inset-right, 0px)) !important;
          left: auto !important;
          bottom: auto !important;
        }
        #railControls {
          bottom: calc(env(safe-area-inset-bottom, 0px) + clamp(1.2rem, 7vh, 2.2rem)) !important;
        }
        #quickActions {
          position: static !important;
        }
        #quickActions .quick-action {
          position: fixed !important;
          bottom: calc(env(safe-area-inset-bottom, 0px) + clamp(1.2rem, 7vh, 2.2rem) + clamp(2.8rem, 8vh, 3.4rem)) !important;
        }
        #quickActions .quick-action[data-action="gift"] {
          right: calc(0.75rem + env(safe-area-inset-right, 0px)) !important;
        }
        #quickActions .quick-action[data-action="chat"] {
          left: calc(0.75rem + env(safe-area-inset-left, 0px)) !important;
        }
        #dominoLeaderboardCard {
          position: fixed;
          top: calc(3.55rem + env(safe-area-inset-top, 0px));
          left: 56.4%;
          transform: translateX(-50%);
          width: min(72vw, 15.5rem);
          z-index: 5;
          border-radius: 12px;
          border: 1px solid rgba(148, 163, 184, 0.34);
          background: linear-gradient(180deg, rgba(15, 23, 42, 0.96), rgba(15, 23, 42, 0.86));
          box-shadow: 0 10px 20px rgba(2, 6, 23, 0.4);
          backdrop-filter: blur(8px);
          color: #f8fafc;
          padding: 0.44rem 0.48rem;
          pointer-events: none;
        }
        #dominoLeaderboardCard .leaderboard-title {
          font-size: 0.58rem;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: rgba(186, 230, 253, 0.92);
          margin-bottom: 0.3rem;
          text-align: center;
          font-weight: 800;
        }
        #dominoLeaderboardCard .leaderboard-rows {
          display: grid;
          gap: 0.2rem;
        }
        #dominoLeaderboardCard .leaderboard-row {
          display: grid;
          grid-template-columns: 1.1rem 1.1rem minmax(0, 1fr) auto auto;
          align-items: center;
          column-gap: 0.33rem;
          border-radius: 8px;
          border: 1px solid rgba(148, 163, 184, 0.2);
          background: rgba(15, 23, 42, 0.62);
          padding: 0.2rem 0.34rem;
          font-size: 0.64rem;
        }
        #dominoLeaderboardCard.is-single-game .leaderboard-row {
          grid-template-columns: 1.1rem 1.1rem minmax(0, 1fr) auto;
        }
        #dominoLeaderboardCard .leaderboard-row.is-human {
          border-color: rgba(56, 189, 248, 0.58);
          background: rgba(14, 116, 144, 0.27);
        }
        #dominoLeaderboardCard .leaderboard-rank {
          font-weight: 800;
          text-align: center;
          color: #fde68a;
          font-size: 0.62rem;
        }
        #dominoLeaderboardCard .leaderboard-avatar {
          width: 1.1rem;
          height: 1.1rem;
          border-radius: 999px;
          border: 1px solid rgba(255, 255, 255, 0.5);
          display: grid;
          place-items: center;
          overflow: hidden;
          font-size: 0.63rem;
          line-height: 1;
          background: rgba(30, 41, 59, 0.95);
          background-size: cover;
          background-position: center;
        }
        #dominoLeaderboardCard .leaderboard-avatar.has-photo {
          color: transparent;
          text-indent: -9999px;
        }
        #dominoLeaderboardCard .leaderboard-name {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-weight: 700;
          font-size: 0.63rem;
        }
        #dominoLeaderboardCard .leaderboard-stat {
          font-weight: 700;
          color: rgba(226, 232, 240, 0.92);
          white-space: nowrap;
          font-size: 0.61rem;
          letter-spacing: 0.01em;
        }
        @media (orientation: portrait) {
          #configButton {
            left: calc(0.1rem + env(safe-area-inset-left, 0px)) !important;
          }
          #dominoLeaderboardCard {
            top: calc(0.62rem + env(safe-area-inset-top, 0px));
            left: 54.9%;
          }
          #status {
            top: auto !important;
            bottom: calc(
              env(safe-area-inset-bottom, 0px) + clamp(1.2rem, 7vh, 2.2rem) +
                clamp(2.8rem, 8vh, 3.4rem) + 1.4rem
            ) !important;
            left: 50% !important;
            transform: translateX(-50%) !important;
            z-index: 7 !important;
          }
        }
        #winnerOverlay {
          position: fixed;
          inset: 0;
          z-index: 20;
          display: none;
          align-items: center;
          justify-content: center;
          background: rgba(2, 6, 23, 0.7);
          backdrop-filter: blur(6px);
          padding: 1rem;
        }
        #winnerOverlay.active { display: flex; }
        .winner-card {
          width: min(92vw, 360px);
          border-radius: 22px;
          padding: 1.1rem 1rem 1rem;
          border: 1px solid rgba(148, 163, 184, 0.4);
          background: linear-gradient(180deg, rgba(15, 23, 42, 0.96), rgba(15, 23, 42, 0.9));
          text-align: center;
          color: #f8fafc;
        }
        #winnerAvatar {
          width: 5.25rem;
          height: 5.25rem;
          margin: 0 auto 0.6rem;
          border-radius: 999px;
          display: grid;
          place-items: center;
          font-size: 2rem;
          font-weight: 800;
          background: linear-gradient(145deg, #22c55e, #38bdf8);
          border: 2px solid rgba(255, 255, 255, 0.55);
          background-size: cover;
          background-position: center;
        }
        #winnerCoinBurst { position: relative; height: 0; }
        .winner-coin {
          position: absolute;
          top: -2.8rem;
          left: 50%;
          transform: translate(-50%, 0) rotate(var(--angle)) translateY(calc(var(--distance) * -1));
          font-size: 0.54rem;
          letter-spacing: 0.06em;
          color: #fde68a;
          text-shadow: 0 0 8px rgba(251, 191, 36, 0.8);
          opacity: 0;
          animation: winner-coin-burst 740ms ease-out var(--delay) forwards;
        }
        @keyframes winner-coin-burst {
          0% { opacity: 0; }
          20% { opacity: 1; }
          100% {
            opacity: 0;
            transform: translate(-50%, 0) rotate(var(--angle)) translateY(calc((var(--distance) + 52px) * -1));
          }
        }
        .winner-actions {
          display: grid;
          gap: 0.6rem;
          margin-top: 0.95rem;
        }
        .winner-actions button { width: 100%; }
      `}</style>
      <div id="topRightActions" aria-label="Top actions">
        <button id="viewToggle" type="button" aria-label="Switch view" title="Switch view" />
        <button id="muteButton" className="top-action" type="button" aria-label="Mute" title="Mute">
          <span className="icon" id="muteIcon" aria-hidden="true">🔊</span>
          <span id="muteLabel" className="visually-hidden">Mute</span>
        </button>
      </div>
      <div id="railControls" aria-label="Game controls">
        <button id="draw" type="button">Draw</button>
        <button id="pass" type="button">Pass</button>
      </div>
      <div id="quickActions" aria-label="Quick actions">
        <button className="quick-action" type="button" data-action="gift">
          <span className="icon" aria-hidden="true">🎁</span>
          <span>Gift</span>
        </button>
        <button className="quick-action" type="button" data-action="chat">
          <span className="icon" aria-hidden="true">💬</span>
          <span>Chat</span>
        </button>
      </div>
      <div id="rules">
        <div className="card">
          <h2>Domino Royal — Rules for 2–4 players</h2>
          <ol>
            <li><b>Set:</b> Double-Six (28 tiles, 0–6). Each tile is unique (a,b) with a≤b. No duplicates.</li>
            <li><b>Dealing:</b> 7 tiles per player. The rest form the <i>stock</i> (boneyard).</li>
            <li><b>Opening:</b> The player with the highest double starts. If no double, the highest tile opens.</li>
            <li><b>On the table:</b> Every tile lies flat on the green cloth, touching end-to-end without overlapping. Keep the chain flush as you pivot at the rails so the spacing stays even.</li>
            <li><b>Matching:</b> The touching halves must show the same pip value. Doubles stand upright in place; all other tiles extend the snake in a straight line.</li>
            <li><b>No move?</b> Draw from the face-down stock stack near you (tap the Draw button below it) until you can play. If the stock is empty, pass.</li>
            <li><b>Ending:</b> The winner is the first out. If play is blocked, the lowest pip total wins.</li>
          </ol>
          <div className="row">
            <button id="closeRules">Close</button>
          </div>
        </div>
      </div>
      <div id="chatModal" className="modal-overlay" aria-hidden="true">
        <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="chatTitle">
          <div className="modal-header">
            <h3 id="chatTitle">Quick Chat</h3>
            <button className="modal-close" id="chatClose" type="button" aria-label="Close chat">✕</button>
          </div>
          <div className="quick-messages" id="chatMessages" />
          <button className="modal-primary" id="chatSend" type="button">Send</button>
        </div>
      </div>
      <div id="giftModal" className="modal-overlay" aria-hidden="true">
        <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="giftTitle">
          <div className="modal-header">
            <h3 id="giftTitle">Send Gift</h3>
            <button className="modal-close" id="giftClose" type="button" aria-label="Close gifts">✕</button>
          </div>
          <div className="gift-players" id="giftPlayers" />
          <div id="giftTiers" />
          <div className="gift-cost">
            <span>Cost:</span>
            <span id="giftCost">0</span>
            <img src="/assets/icons/ezgif-54c96d8a9b9236.webp" alt="TPC" />
          </div>
          <button className="modal-primary" id="giftSend" type="button">Send Gift</button>
          <p className="gift-note">10% charge and the amount of the gift will be deducted from your balance.</p>
        </div>
      </div>
      <div id="winnerOverlay" aria-hidden="true">
        <div className="winner-card" role="dialog" aria-modal="true" aria-labelledby="winnerName">
          <div id="winnerCoinBurst" />
          <div id="winnerAvatar">🏆</div>
          <h3 id="winnerName">Winner</h3>
          <p id="winnerReason">Round complete.</p>
          <div className="winner-actions">
            <button id="winnerPlayAgain" type="button">Play Again</button>
            <button id="winnerReturnLobby" type="button">Return Lobby</button>
          </div>
        </div>
      </div>
    </div>
  );
}
