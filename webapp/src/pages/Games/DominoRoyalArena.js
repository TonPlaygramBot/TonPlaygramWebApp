import { createElement, useEffect } from 'react';

import { DOMINO_ROYAL_INLINE_STYLE } from './dominoRoyalTemplate.js';

const INLINE_STYLE_ID = 'domino-royal-inline-style';
const GAME_SCRIPT_SELECTOR = 'script[data-domino-royal-script="true"]';
const ROOT_ID = 'domino-royal-arena-root';

const ARENA_LAYOUT_HTML = `
  <div id="app"></div>
  <div id="status" role="status">Ready</div>
  <button id="configButton" type="button" aria-label="Open game settings menu">
    <span aria-hidden="true">☰</span>
    <span>Menu</span>
  </button>
  <div id="configPanel" role="dialog" aria-modal="true" aria-labelledby="configTitle" tabindex="-1" aria-hidden="true">
    <div class="config-close">
      <button id="configClose" type="button" aria-label="Close table setup">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" d="m6 6 12 12M18 6 6 18" />
        </svg>
      </button>
    </div>
    <h3 id="configTitle">Table Setup</h3>
    <div id="configSections"></div>
  </div>
  <style>
    #viewToggle { position: fixed !important; right: calc(0.75rem + env(safe-area-inset-right, 0px)) !important; left: auto !important; top: calc(8.15rem + env(safe-area-inset-top, 0px)) !important; margin: 0 !important; }
    #configButton { top: calc(4.55rem + env(safe-area-inset-top, 0px)) !important; left: calc(0.75rem + env(safe-area-inset-left, 0px)) !important; width: auto !important; padding: 0 0.95rem !important; display: flex !important; align-items: center; gap: 0.5rem; }
    #configButton span:first-child { font-size: 1.05rem; line-height: 1; }
    #configButton span:last-child { font-size: 0.72rem; letter-spacing: 0.24em; text-transform: uppercase; }
    #muteButton { top: calc(4.55rem + env(safe-area-inset-top, 0px)) !important; right: calc(0.75rem + env(safe-area-inset-right, 0px)) !important; left: auto !important; bottom: auto !important; }
    #railControls { bottom: calc(env(safe-area-inset-bottom, 0px) + clamp(1.2rem, 7vh, 2.2rem)) !important; }
    #quickActions { position: static !important; }
    #quickActions .quick-action { position: fixed !important; bottom: calc(env(safe-area-inset-bottom, 0px) + clamp(1.2rem, 7vh, 2.2rem) + clamp(2.8rem, 8vh, 3.4rem)) !important; }
    #quickActions .quick-action[data-action="gift"] { right: calc(0.75rem + env(safe-area-inset-right, 0px)) !important; }
    #quickActions .quick-action[data-action="chat"] { left: calc(0.75rem + env(safe-area-inset-left, 0px)) !important; }
  </style>
  <div id="topRightActions" aria-label="Top actions">
    <button id="viewToggle" type="button" aria-label="Switch view" title="Switch view"></button>
    <button id="muteButton" class="top-action" type="button" aria-label="Mute" title="Mute">
      <span class="icon" id="muteIcon" aria-hidden="true">🔊</span>
      <span id="muteLabel" class="visually-hidden">Mute</span>
    </button>
  </div>
  <div id="railControls" aria-label="Game controls"><button id="draw" type="button">Draw</button><button id="pass" type="button">Pass</button></div>
  <div id="quickActions" aria-label="Quick actions">
    <button class="quick-action" type="button" data-action="gift"><span class="icon" aria-hidden="true">🎁</span><span>Gift</span></button>
    <button class="quick-action" type="button" data-action="chat"><span class="icon" aria-hidden="true">💬</span><span>Chat</span></button>
  </div>

  <div id="rules">
    <div class="card">
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
      <div class="row"><button id="closeRules">Close</button></div>
    </div>
  </div>
  <div id="chatModal" class="modal-overlay" aria-hidden="true">
    <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="chatTitle">
      <div class="modal-header"><h3 id="chatTitle">Quick Chat</h3><button class="modal-close" id="chatClose" type="button" aria-label="Close chat">✕</button></div>
      <div class="quick-messages" id="chatMessages"></div>
      <button class="modal-primary" id="chatSend" type="button">Send</button>
    </div>
  </div>
  <div id="giftModal" class="modal-overlay" aria-hidden="true">
    <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="giftTitle">
      <div class="modal-header"><h3 id="giftTitle">Send Gift</h3><button class="modal-close" id="giftClose" type="button" aria-label="Close gifts">✕</button></div>
      <div class="gift-players" id="giftPlayers"></div>
      <div id="giftTiers"></div>
      <div class="gift-cost"><span>Cost:</span><span id="giftCost">0</span><img src="/assets/icons/ezgif-54c96d8a9b9236.webp" alt="TPC" /></div>
      <button class="modal-primary" id="giftSend" type="button">Send Gift</button>
      <p class="gift-note">10% charge and the amount of the gift will be deducted from your balance.</p>
    </div>
  </div>
`;

export default function DominoRoyalArena() {
  useEffect(() => {
    const root = document.getElementById(ROOT_ID);
    if (root) {
      root.innerHTML = ARENA_LAYOUT_HTML;
    }
    const statusNode = document.getElementById('status');
    const appRoot = document.getElementById('app');
    if (statusNode) statusNode.textContent = 'Loading Domino Royal…';
    if (appRoot) appRoot.replaceChildren();

    const existingStyle = document.getElementById(INLINE_STYLE_ID);
    const styleTag = existingStyle ?? document.createElement('style');
    if (!existingStyle) {
      styleTag.id = INLINE_STYLE_ID;
      styleTag.textContent = DOMINO_ROYAL_INLINE_STYLE;
      document.head.appendChild(styleTag);
    }

    const existingScript = document.querySelector(GAME_SCRIPT_SELECTOR);
    if (existingScript) existingScript.remove();

    const basePath = import.meta.env.BASE_URL || '/';
    const normalizedBasePath = basePath.endsWith('/') ? basePath : `${basePath}/`;
    const script = document.createElement('script');
    script.type = 'module';
    script.src = `${normalizedBasePath}domino-royal-game.js`;
    script.dataset.dominoRoyalScript = 'true';
    script.onload = () => {
      if (statusNode) statusNode.textContent = 'Ready';
    };
    script.onerror = () => {
      if (statusNode) statusNode.textContent = 'Game failed to load. Please refresh and try again.';
    };
    document.body.appendChild(script);

    return () => {
      script.remove();
      if (root) root.replaceChildren();
      if (appRoot) appRoot.replaceChildren();
    };
  }, []);

  return createElement('div', { id: ROOT_ID, className: 'relative h-full w-full bg-black' });
}
