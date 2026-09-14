import { useEffect } from 'react';
import { ArrowDownToLine, Gift, Hand, MessageCircle, Settings2, Volume2, VolumeX, X } from 'lucide-react';

import { DOMINO_ROYAL_INLINE_STYLE } from './dominoRoyalTemplate.js';
import { socket } from '../../utils/socket.js';
import {
  createRestoredSeatedHumanActor,
  applySeatedHumanRightArmIK,
  applySeatedHumanArmIK,
  applySeatedHumanHandTargets,
  applySeatedHumanReachPose,
  applySeatedHumanPose,
  loadSeatedHumanTemplate
} from './shared/seatedHumanActors.js';

const INLINE_STYLE_ID = 'domino-royal-inline-style';
const GAME_SCRIPT_SELECTOR = 'script[data-domino-royal-script="true"]';
const DOMINO_ROYAL_SCRIPT_VERSION = '2026-09-14-royal-hand-animation-portrait-v80';

export default function DominoRoyalArena() {
  useEffect(() => {
    document.body.classList.add('domino-royal-active');
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
      document.head.appendChild(styleTag);
    }
    styleTag.textContent = DOMINO_ROYAL_INLINE_STYLE;

    const existingScript = document.querySelector(GAME_SCRIPT_SELECTOR);
    if (existingScript) {
      existingScript.remove();
    }

    window.__DOMINO_ROYAL_SOCKET__ = socket;
    // The arena itself is loaded as a public ES module. Bridge the shared,
    // bundled character implementation so Domino uses the exact same restored
    // models, scale normalization and seated pose as the other royal tables.
    window.__DOMINO_ROYAL_SEATED_HUMANS__ = {
      createRestoredSeatedHumanActor,
      applySeatedHumanRightArmIK,
      applySeatedHumanArmIK,
      applySeatedHumanHandTargets,
  applySeatedHumanReachPose,
      applySeatedHumanPose,
      loadSeatedHumanTemplate
    };

    const basePath = import.meta.env.BASE_URL || '/';
    const normalizedBasePath = basePath.endsWith('/') ? basePath : `${basePath}/`;
    const script = document.createElement('script');
    script.type = 'module';
    script.src = `${normalizedBasePath}domino-royal-game.js?v=${DOMINO_ROYAL_SCRIPT_VERSION}`;
    script.dataset.dominoRoyalScript = 'true';
    script.onload = () => {
      if (statusNode?.textContent === 'Loading Domino Royal…') {
        statusNode.textContent = 'Preparing table…';
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
      styleTag.remove();
      document.body.classList.remove('domino-royal-active');
      delete window.__DOMINO_ROYAL_SOCKET__;
      delete window.__DOMINO_ROYAL_SEATED_HUMANS__;
      if (appRoot) {
        appRoot.replaceChildren();
      }
    };
  }, []);

  return (
    <div className="domino-royal-arena relative h-full w-full bg-black">
      <div id="app" />
      <div className="game-toolbar" role="group" aria-label="Table controls">
        <button id="configButton" type="button" aria-label="Open table settings" title="Table settings">
          <Settings2 aria-hidden="true" />
        </button>
        <div id="status" role="status" aria-live="polite" aria-atomic="true">Loading Domino Royal…</div>
        <div id="topRightActions" role="group" aria-label="Sound and view">
          <button id="muteButton" className="top-action" type="button" aria-label="Mute" title="Mute">
            <span id="muteIcon" className="visually-hidden" aria-hidden="true">🔊</span>
            <Volume2 className="sound-on-icon" aria-hidden="true" />
            <VolumeX className="sound-off-icon" aria-hidden="true" />
            <span id="muteLabel" className="visually-hidden">Mute</span>
          </button>
          <button id="viewToggle" type="button" aria-label="Switch to overhead view" title="Switch to overhead view">2D</button>
        </div>
      </div>
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

      <div className="game-footer">
        <div id="railControls" role="group" aria-label="Game controls">
          <button id="draw" type="button" aria-label="Draw a domino from the stock" title="Draw a domino">
            <ArrowDownToLine aria-hidden="true" />
            <span>Draw</span>
          </button>
          <button id="pass" type="button" aria-label="Pass your turn and knock on the table" title="Pass your turn">
            <Hand aria-hidden="true" />
            <span>Pass</span>
          </button>
        </div>
        <div id="quickActions" role="group" aria-label="Social actions">
          <button className="quick-action" type="button" data-action="chat" aria-label="Open quick chat" title="Quick chat">
            <MessageCircle aria-hidden="true" />
            <span>Chat</span>
          </button>
          <button className="quick-action" type="button" data-action="gift" aria-label="Send a gift" title="Send a gift">
            <Gift aria-hidden="true" />
            <span>Gift</span>
          </button>
        </div>
      </div>
      <div id="rules" role="dialog" aria-modal="true" aria-labelledby="rulesTitle">
        <div className="card">
          <h2 id="rulesTitle">Domino Royal — Rules for 2–4 players</h2>
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
            <button id="closeRules" type="button">Close</button>
          </div>
        </div>
      </div>
      <div id="chatModal" className="modal-overlay" aria-hidden="true">
        <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="chatTitle">
          <div className="modal-header">
            <h3 id="chatTitle">Quick Chat</h3>
            <button className="modal-close" id="chatClose" type="button" aria-label="Close chat"><X aria-hidden="true" /></button>
          </div>
          <div className="quick-messages" id="chatMessages" />
          <button className="modal-primary" id="chatSend" type="button">Send</button>
        </div>
      </div>
      <div id="giftModal" className="modal-overlay" aria-hidden="true">
        <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="giftTitle">
          <div className="modal-header">
            <h3 id="giftTitle">Send Gift</h3>
            <button className="modal-close" id="giftClose" type="button" aria-label="Close gifts"><X aria-hidden="true" /></button>
          </div>
          <div className="gift-players" id="giftPlayers" />
          <div id="giftTiers" />
          <div className="gift-cost">
            <span>Cost:</span>
            <span id="giftCost">0</span>
            <img src="/assets/icons/file_00000000362481f7978631c42572193f.png" alt="TPG" />
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
