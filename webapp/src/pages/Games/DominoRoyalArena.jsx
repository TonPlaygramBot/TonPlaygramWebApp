import { useEffect } from 'react';

import './dominoRoyal.css';

export default function DominoRoyalArena() {
  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      try {
        await import('./dominoRoyalRuntime.js');
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to load Domino Royal runtime', error);
        }
      }
    };

    boot();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="relative h-full w-full bg-[#050812]">
      <div id="app" />
      <div id="status" role="status">
        Ready
      </div>
      <button id="configButton" type="button" aria-label="Table setup">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z" />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="m19.4 13.5-.44 1.74a1 1 0 0 1-1.07.75l-1.33-.14a7.03 7.03 0 0 1-1.01.59l-.2 1.32a1 1 0 0 1-.98.84h-1.9a1 1 0 0 1-.98-.84l-.2-1.32a7.03 7.03 0 0 1-1.01-.59l-1.33.14a1 1 0 0 1-1.07-.75L4.6 13.5a1 1 0 0 1 .24-.96l1-.98a6.97 6.97 0 0 1 0-1.12l-1-.98a1 1 0 0 1-.24-.96l.44-1.74a1 1 0 0 1 1.07-.75l1.33.14c.32-.23.66-.43 1.01-.6l.2-1.31a1 1 0 0 1 .98-.84h1.9a1 1 0 0 1 .98.84l.2 1.31c.35.17.69.37 1.01.6l1.33-.14a1 1 0 0 1 1.07.75l.44 1.74a1 1 0 0 1-.24.96l-1 .98c.03.37.03.75 0 1.12l1 .98a1 1 0 0 1 .24.96z"
          />
        </svg>
      </button>
      <div
        id="configPanel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="configTitle"
        tabIndex={-1}
        aria-hidden="true"
      >
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
      <div id="topRightActions" aria-label="Top actions">
        <button id="btnRules" className="top-action" type="button" aria-label="Rules" title="Rules">
          <span aria-hidden="true">ℹ️</span>
        </button>
        <button id="muteButton" className="top-action" type="button" aria-label="Mute" title="Mute">
          <span className="icon" id="muteIcon" aria-hidden="true">
            🔊
          </span>
          <span id="muteLabel" className="visually-hidden">
            Mute
          </span>
        </button>
      </div>
      <div id="railControls" aria-label="Game controls">
        <button id="draw" type="button">
          Draw
        </button>
        <button id="pass" type="button">
          Pass
        </button>
      </div>
      <button id="viewToggle" type="button" aria-label="Switch view" title="Switch view" />
      <div id="quickActions" aria-label="Quick actions">
        <button className="quick-action" type="button" data-action="chat">
          <span className="icon" aria-hidden="true">
            💬
          </span>
          <span>Chat</span>
        </button>
        <button className="quick-action" type="button" data-action="gift">
          <span className="icon" aria-hidden="true">
            🎁
          </span>
          <span>Gift</span>
        </button>
      </div>
      <div id="rules">
        <div className="card">
          <h2>Domino Royal — Rules for 2–4 players</h2>
          <ol>
            <li>
              <b>Set:</b> Double-Six (28 tiles, 0–6). Each tile is unique (a,b) with a≤b. No duplicates.
            </li>
            <li>
              <b>Dealing:</b> 7 tiles per player. The rest form the <i>stock</i> (boneyard).
            </li>
            <li>
              <b>Opening:</b> The player with the highest double starts. If no double, the highest tile opens.
            </li>
            <li>
              <b>On the table:</b> Every tile lies flat on the green cloth, touching end-to-end without overlapping. Keep the
              chain flush as you pivot at the rails so the spacing stays even.
            </li>
            <li>
              <b>Matching:</b> The touching halves must show the same pip value. Doubles stand upright in place; all other tiles
              extend the snake in a straight line.
            </li>
            <li>
              <b>No move?</b> Draw from the face-down stock stack near you (tap the Draw button below it) until you can play. If
              the stock is empty, pass.
            </li>
            <li>
              <b>Ending:</b> The winner is the first out. If play is blocked, the lowest pip total wins.
            </li>
          </ol>
          <div className="row">
            <button id="closeRules" type="button">
              Close
            </button>
          </div>
        </div>
      </div>
      <div id="chatModal" className="modal-overlay" aria-hidden="true">
        <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="chatTitle">
          <div className="modal-header">
            <h3 id="chatTitle">Quick Chat</h3>
            <button className="modal-close" id="chatClose" type="button" aria-label="Close chat">
              ✕
            </button>
          </div>
          <div className="quick-messages" id="chatMessages" />
          <button className="modal-primary" id="chatSend" type="button">
            Send
          </button>
        </div>
      </div>
      <div id="giftModal" className="modal-overlay" aria-hidden="true">
        <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="giftTitle">
          <div className="modal-header">
            <h3 id="giftTitle">Send Gift</h3>
            <button className="modal-close" id="giftClose" type="button" aria-label="Close gifts">
              ✕
            </button>
          </div>
          <div className="gift-players" id="giftPlayers" />
          <div id="giftTiers" />
          <div className="gift-cost">
            <span>Cost:</span>
            <span id="giftCost">0</span>
            <img src="/assets/icons/ezgif-54c96d8a9b9236.webp" alt="TPC" />
          </div>
          <button className="modal-primary" id="giftSend" type="button">
            Send Gift
          </button>
          <p className="gift-note">10% charge and the amount of the gift will be deducted from your balance.</p>
        </div>
      </div>
    </div>
  );
}
