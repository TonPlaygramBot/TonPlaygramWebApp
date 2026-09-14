export const DOMINO_ROYAL_INLINE_STYLE = `
/* The game owns its full-screen surface; scope every rule to its mounted route. */
body.domino-royal-active {
  --royal-bg: #07100f;
  --royal-panel: #0d1c1b;
  --royal-border: rgba(211, 186, 119, 0.29);
  --royal-gold: #eed697;
  --royal-fg: #f4f5ec;
  --royal-muted: #bdc9c4;
  background: var(--royal-bg);
  overflow: hidden;
}
.domino-royal-arena {
  color: var(--royal-fg);
  font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  font-size: 14px;
  line-height: 1.4;
}
.domino-royal-arena *,
body.domino-royal-active .seat-badge,
body.domino-royal-active .seat-badge *,
body.domino-royal-active .toast { box-sizing: border-box; }
.domino-royal-arena #app {
  position: fixed;
  inset: 0;
  width: 100dvw;
  height: 100dvh;
  transform: scale(0.97);
  transform-origin: center center;
}
.domino-royal-arena #app canvas {
  display: block;
  width: 100dvw;
  height: 100dvh;
  touch-action: none;
}
.domino-royal-arena button {
  min-height: 44px;
  border: 1px solid var(--royal-border);
  border-radius: 13px;
  padding: 10px 14px;
  background: linear-gradient(165deg, rgba(24, 42, 36, 0.97), rgba(8, 22, 21, 0.97));
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
  color: var(--royal-fg);
  font: inherit;
  font-weight: 650;
  cursor: pointer;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
  transition: background 150ms ease, border-color 150ms ease, opacity 150ms ease;
}
.domino-royal-arena button:focus-visible { outline: 2px solid var(--royal-gold); outline-offset: 3px; }
.domino-royal-arena button:active:not(:disabled) { background: #294738; }
.domino-royal-arena button:disabled { opacity: 0.42; cursor: default; box-shadow: none; }
.domino-royal-arena button svg { width: 20px; height: 20px; flex-shrink: 0; stroke-width: 1.8; }
.domino-royal-arena .visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
/* A single row keeps controls clear of the opposing player's avatar. */
.domino-royal-arena .game-toolbar {
  position: fixed;
  top: calc(10px + env(safe-area-inset-top, 0px));
  left: calc(8px + env(safe-area-inset-left, 0px));
  right: calc(8px + env(safe-area-inset-right, 0px));
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr) 94px;
  gap: 6px;
  align-items: start;
  pointer-events: none;
  z-index: 6;
}
.domino-royal-arena .game-toolbar button { width: 44px; height: 44px; padding: 0; pointer-events: auto; }
.domino-royal-arena #configButton,
.domino-royal-arena #muteButton { display: grid; place-items: center; color: var(--royal-gold); }
.domino-royal-arena #topRightActions { display: flex; gap: 6px; }
.domino-royal-arena #viewToggle { font-size: 14px; font-weight: 750; letter-spacing: 0.02em; color: var(--royal-gold); }
.domino-royal-arena #muteButton .sound-off-icon { display: none; }
.domino-royal-arena #muteButton[aria-label='Unmute'] .sound-on-icon { display: none; }
.domino-royal-arena #muteButton[aria-label='Unmute'] .sound-off-icon { display: block; }
.domino-royal-arena #status {
  min-height: 44px;
  padding: 7px 9px;
  border-radius: 13px;
  background: rgba(7, 19, 17, 0.9);
  border: 1px solid rgba(211, 186, 119, 0.2);
  color: var(--royal-fg);
  font-size: clamp(11px, 2.9vw, 13px);
  font-weight: 650;
  line-height: 1.35;
  text-align: center;
  overflow-wrap: anywhere;
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(10px);
  pointer-events: none;
}
/* Side clusters leave the existing self-avatar and hand anchors untouched. */
.domino-royal-arena .game-footer {
  position: fixed;
  bottom: max(8px, env(safe-area-inset-bottom, 0px));
  left: calc(8px + env(safe-area-inset-left, 0px));
  right: calc(8px + env(safe-area-inset-right, 0px));
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr) clamp(56px, 15vw, 72px) minmax(0, 1fr) 44px;
  gap: 6px;
  pointer-events: none;
  z-index: 6;
}
.domino-royal-arena #railControls,
.domino-royal-arena #quickActions { display: contents; }
.domino-royal-arena .game-footer button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  min-width: 0;
  height: 48px;
  padding: 0 5px;
  grid-row: 1;
  pointer-events: auto;
  backdrop-filter: blur(10px);
}
.domino-royal-arena #draw { grid-column: 2; color: #10291d; background: linear-gradient(145deg, #f0dca0, #c9ac69); border-color: #efd99c; }
.domino-royal-arena #draw:active:not(:disabled) { background: #f4e4b5; }
.domino-royal-arena #pass { grid-column: 4; }
.domino-royal-arena #draw svg,
.domino-royal-arena #pass svg { width: 17px; height: 17px; }
.domino-royal-arena #quickActions .quick-action { flex-direction: column; gap: 2px; color: var(--royal-gold); }
.domino-royal-arena .quick-action[data-action='chat'] { grid-column: 1; }
.domino-royal-arena .quick-action[data-action='gift'] { grid-column: 5; }
.domino-royal-arena .quick-action span { font-size: 9px; font-weight: 600; line-height: 1.1; }
.domino-royal-arena .quick-action svg { width: 19px; height: 19px; }
/* Seat badges are created by the game module outside the React arena. */
body.domino-royal-active #seatOverlay { position: fixed; inset: 0; pointer-events: none; z-index: 4; }
body.domino-royal-active .seat-badge {
  position: absolute;
  transform: translate(-50%, -50%);
  pointer-events: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  min-width: 48px;
  font-family: Inter, system-ui, sans-serif;
}
body.domino-royal-active .seat-badge-avatar { position: relative; width: 37px; height: 37px; display: grid; place-items: center; }
body.domino-royal-active .seat-badge .avatar-timer-ring {
  position: absolute;
  inset: -4%;
  border-radius: 50%;
  background: var(--timer-gradient);
  -webkit-mask: radial-gradient(farthest-side, transparent 65%, black 66%);
  mask: radial-gradient(farthest-side, transparent 65%, black 66%);
  box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.22);
}
body.domino-royal-active .seat-badge-core {
  position: relative;
  width: 31px;
  height: 31px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-size: 14px;
  font-weight: 800;
  color: #0b1224;
  background: linear-gradient(145deg, #e9d39b, #65ac8c);
  overflow: hidden;
  border: 2px solid rgba(255, 255, 255, 0.32);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.35);
}
body.domino-royal-active .seat-badge.is-self .seat-badge-avatar,
body.domino-royal-active .seat-badge.is-self .seat-badge-core { width: 3.5rem; height: 3.5rem; transform: none; }
body.domino-royal-active .seat-badge-core.has-photo { background-size: cover; background-position: center; color: transparent; text-indent: -9999px; }
body.domino-royal-active .seat-badge-name {
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  padding: 2px 7px;
  border-radius: 8px;
  background: rgba(7, 19, 17, 0.88);
  border: 1px solid rgba(211, 186, 119, 0.22);
  color: #f4f5ec;
  font-size: 11px;
  line-height: 1.4;
  font-weight: 650;
}
body.domino-royal-active .seat-badge.is-self .seat-badge-name { max-width: 68px; }
.domino-royal-arena #configPanel {
  position: fixed;
  top: calc(64px + env(safe-area-inset-top, 0px));
  left: calc(8px + env(safe-area-inset-left, 0px));
  right: calc(8px + env(safe-area-inset-right, 0px));
  width: auto;
  max-width: 400px;
  max-height: calc(100dvh - 80px - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px));
  padding: 16px;
  border: 1px solid var(--royal-border);
  border-radius: 20px;
  background: rgba(8, 22, 20, 0.98);
  color: var(--royal-fg);
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(18px);
  z-index: 12;
  display: none;
  flex-direction: column;
  gap: 12px;
}
.domino-royal-arena #configPanel.active { display: flex; }
.domino-royal-arena #configPanel h3 { margin: -42px 52px 16px 0; min-height: 26px; font-size: 16px; color: var(--royal-gold); }
.domino-royal-arena .config-close { display: flex; justify-content: flex-end; }
.domino-royal-arena .config-close button,
.domino-royal-arena .modal-close { display: grid; place-items: center; width: 44px; height: 44px; padding: 0; flex-shrink: 0; }
.domino-royal-arena #configSections { display: flex; flex-direction: column; gap: 12px; min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding: 2px; scrollbar-width: thin; }
.domino-royal-arena .config-section { display: flex; flex-direction: column; gap: 6px; }
.domino-royal-arena .config-options { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 7px; }
.domino-royal-arena .config-option { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; padding: 9px; font-size: 12px; line-height: 1.35; text-align: left; }
.domino-royal-arena .config-option span { font-size: 10px; color: var(--royal-muted); letter-spacing: 0.02em; }
.domino-royal-arena .config-option.active,
.domino-royal-arena .quick-messages button.active,
.domino-royal-arena .gift-players button.active,
.domino-royal-arena .gift-button.active { border-color: var(--royal-gold); background: #294333; color: #fff1c8; }
.domino-royal-arena .modal-overlay,
.domino-royal-arena #rules,
.domino-royal-arena #winnerOverlay { position: fixed; inset: 0; display: none; align-items: center; justify-content: center; padding: max(12px, env(safe-area-inset-top, 0px)) 12px max(12px, env(safe-area-inset-bottom, 0px)); background: rgba(0, 8, 7, 0.75); backdrop-filter: blur(8px); z-index: 20; }
.domino-royal-arena .modal-overlay.active,
.domino-royal-arena #winnerOverlay.active { display: flex; }
.domino-royal-arena .modal-card,
.domino-royal-arena #rules .card,
.domino-royal-arena .winner-card {
  width: min(100%, 380px);
  max-height: calc(100dvh - 32px - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px));
  overflow-y: auto;
  overscroll-behavior: contain;
  background: var(--royal-panel);
  border: 1px solid var(--royal-border);
  border-radius: 22px;
  padding: 16px;
  color: var(--royal-fg);
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.55);
}
.domino-royal-arena .modal-card { display: flex; flex-direction: column; gap: 12px; }
.domino-royal-arena .modal-header { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.domino-royal-arena .modal-header h3 { margin: 0; font-size: 17px; color: var(--royal-gold); }
.domino-royal-arena .quick-messages { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 7px; max-height: 250px; overflow-y: auto; }
.domino-royal-arena .quick-messages button { padding: 9px 7px; font-size: 12px; }
.domino-royal-arena .modal-primary,
.domino-royal-arena #winnerPlayAgain { width: 100%; background: linear-gradient(145deg, #f0dca0, #c9ac69); color: #10291d; border-color: #efd99c; }
.domino-royal-arena .gift-players { display: flex; flex-direction: column; gap: 6px; max-height: 180px; overflow-y: auto; flex-shrink: 0; }
.domino-royal-arena .gift-players button { display: flex; align-items: center; gap: 8px; padding: 8px 10px; font-size: 12px; }
.domino-royal-arena .gift-players img { width: 24px; height: 24px; border-radius: 50%; object-fit: cover; }
.domino-royal-arena #giftTiers { display: flex; flex-direction: column; gap: 12px; }
.domino-royal-arena .gift-tier { display: flex; flex-direction: column; gap: 6px; }
.domino-royal-arena .gift-tier h4 { margin: 0; font-size: 11px; font-weight: 600; color: var(--royal-muted); }
.domino-royal-arena .gift-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 7px; }
.domino-royal-arena .gift-button { display: flex; align-items: center; justify-content: space-between; gap: 5px; padding: 8px; font-size: 11px; }
.domino-royal-arena .gift-button img { width: 18px; height: 18px; }
.domino-royal-arena .gift-cost { display: flex; align-items: center; justify-content: center; gap: 6px; font-size: 13px; }
.domino-royal-arena .gift-cost img { width: 17px; height: 17px; }
.domino-royal-arena .gift-note { margin: 0; font-size: 11px; line-height: 1.5; text-align: center; color: var(--royal-muted); }
body.domino-royal-active .chat-bubble,
body.domino-royal-active .toast { position: fixed; padding: 8px 12px; border-radius: 14px; background: rgba(7, 19, 17, 0.96); border: 1px solid var(--royal-border); color: #f4f5ec; font: 600 12px/1.4 system-ui, sans-serif; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4); z-index: 21; pointer-events: none; }
body.domino-royal-active .chat-bubble { display: flex; align-items: center; gap: 6px; max-width: calc(100vw - 24px); }
body.domino-royal-active .chat-bubble img,
body.domino-royal-active .chat-bubble .avatar { width: 22px; height: 22px; border-radius: 50%; display: grid; place-items: center; background: #2b4538; }
body.domino-royal-active .toast { left: 50%; bottom: calc(116px + env(safe-area-inset-bottom, 0px)); transform: translateX(-50%); width: max-content; max-width: calc(100vw - 24px); text-align: center; }
.domino-royal-arena #rules .card { width: min(100%, 600px); }
.domino-royal-arena #rules h2 { margin: 0 0 12px; font-size: 18px; color: var(--royal-gold); }
.domino-royal-arena #rules ol { margin: 0; padding-left: 20px; color: var(--royal-muted); }
.domino-royal-arena #rules li + li { margin-top: 10px; }
.domino-royal-arena #rules .row { display: flex; justify-content: flex-end; margin-top: 16px; }
.domino-royal-arena .winner-card { text-align: center; }
.domino-royal-arena #winnerAvatar { width: 84px; height: 84px; margin: 8px auto 12px; border-radius: 50%; display: grid; place-items: center; font-size: 32px; font-weight: 800; background: linear-gradient(145deg, #d6bc75, #35845e); border: 2px solid var(--royal-gold); background-size: cover; background-position: center; }
.domino-royal-arena #winnerName { font-size: 23px; margin: 8px 0; color: var(--royal-gold); }
.domino-royal-arena #winnerReason { color: var(--royal-muted); font-size: 13px; }
.domino-royal-arena #winnerCoinBurst { position: relative; height: 0; }
.domino-royal-arena .winner-coin { position: absolute; top: 40px; left: 50%; transform: translate(-50%, 0) rotate(var(--angle)) translateY(calc(var(--distance) * -1)); font-size: 9px; color: var(--royal-gold); opacity: 0; animation: domino-winner-coin-burst 740ms ease-out var(--delay) forwards; }
@keyframes domino-winner-coin-burst { 0% { opacity: 0; } 20% { opacity: 1; } 100% { opacity: 0; transform: translate(-50%, 0) rotate(var(--angle)) translateY(calc((var(--distance) + 52px) * -1)); } }
.domino-royal-arena .winner-actions { display: grid; gap: 9px; margin-top: 18px; }
.domino-royal-arena .winner-actions button { width: 100%; }
@media (max-width: 359px) {
  .domino-royal-arena #draw,
  .domino-royal-arena #pass { font-size: 12px; gap: 3px; }
}
@media (orientation: landscape) and (max-height: 500px) {
  .domino-royal-arena .game-toolbar { left: max(8px, env(safe-area-inset-left, 0px)); right: max(8px, env(safe-area-inset-right, 0px)); }
  .domino-royal-arena .game-footer { left: max(8px, env(safe-area-inset-left, 0px)); right: max(8px, env(safe-area-inset-right, 0px)); grid-template-columns: 44px 100px minmax(56px, 1fr) 100px 44px; }
}
@media (prefers-reduced-motion: reduce) {
  .domino-royal-arena button { transition: none; }
  .domino-royal-arena .winner-coin { animation: none; }
}
`;

// Standalone markup mirrors the React arena for consumers of the template export.
export const DOMINO_ROYAL_MARKUP = "<div class=\"domino-royal-arena relative h-full w-full bg-black\">\n      <div id=\"app\" ></div>\n      <div class=\"game-toolbar\" role=\"group\" aria-label=\"Table controls\">\n        <button id=\"configButton\" type=\"button\" aria-label=\"Open table settings\" title=\"Table settings\">\n          <svg aria-hidden=\"true\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M20 7h-9m3 10H4m0-10h2m13 10h1\"/><circle cx=\"8\" cy=\"7\" r=\"3\"/><circle cx=\"16\" cy=\"17\" r=\"3\"/></svg>\n        </button>\n        <div id=\"status\" role=\"status\" aria-live=\"polite\" aria-atomic=\"true\">Loading Domino Royal…</div>\n        <div id=\"topRightActions\" role=\"group\" aria-label=\"Sound and view\">\n          <button id=\"muteButton\" class=\"top-action\" type=\"button\" aria-label=\"Mute\" title=\"Mute\">\n            <span id=\"muteIcon\" class=\"visually-hidden\" aria-hidden=\"true\">🔊</span>\n            <svg class=\"sound-on-icon\" aria-hidden=\"true\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"m11 5-6 4H2v6h3l6 4V5Z\"/><path d=\"M15.5 8.5a5 5 0 0 1 0 7m3.5-10.5a10 10 0 0 1 0 14\"/></svg>\n            <svg class=\"sound-off-icon\" aria-hidden=\"true\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"m11 5-6 4H2v6h3l6 4V5Z\"/><path d=\"m17 9 5 6m0-6-5 6\"/></svg>\n            <span id=\"muteLabel\" class=\"visually-hidden\">Mute</span>\n          </button>\n          <button id=\"viewToggle\" type=\"button\" aria-label=\"Switch to overhead view\" title=\"Switch to overhead view\">2D</button>\n        </div>\n      </div>\n      <div id=\"configPanel\" role=\"dialog\" aria-modal=\"true\" aria-labelledby=\"configTitle\" tabindex=\"-1\" aria-hidden=\"true\">\n        <div class=\"config-close\">\n          <button id=\"configClose\" type=\"button\" aria-label=\"Close table setup\">\n            <svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" aria-hidden=\"true\">\n              <path stroke-linecap=\"round\" stroke-linejoin=\"round\" d=\"m6 6 12 12M18 6 6 18\" />\n            </svg>\n          </button>\n        </div>\n        <h3 id=\"configTitle\">Table Setup</h3>\n        <div id=\"configSections\" ></div>\n      </div>\n\n      <div class=\"game-footer\">\n        <div id=\"railControls\" role=\"group\" aria-label=\"Game controls\">\n          <button id=\"draw\" type=\"button\" aria-label=\"Draw a domino from the stock\" title=\"Draw a domino\">\n            <svg aria-hidden=\"true\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M12 3v12m-4-4 4 4 4-4M5 17v4h14v-4\"/></svg>\n            <span>Draw</span>\n          </button>\n          <button id=\"pass\" type=\"button\" aria-label=\"Pass your turn and knock on the table\" title=\"Pass your turn\">\n            <svg aria-hidden=\"true\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M8 13V5a2 2 0 0 1 4 0v7-8a2 2 0 0 1 4 0v8-6a2 2 0 0 1 4 0v9a7 7 0 0 1-7 7h-1a7 7 0 0 1-6-3L2 13a2 2 0 0 1 3-2l3 2Z\"/></svg>\n            <span>Pass</span>\n          </button>\n        </div>\n        <div id=\"quickActions\" role=\"group\" aria-label=\"Social actions\">\n          <button class=\"quick-action\" type=\"button\" data-action=\"chat\" aria-label=\"Open quick chat\" title=\"Quick chat\">\n            <svg aria-hidden=\"true\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M7.9 20A9 9 0 1 0 4 16.1L2 22l5.9-2Z\"/></svg>\n            <span>Chat</span>\n          </button>\n          <button class=\"quick-action\" type=\"button\" data-action=\"gift\" aria-label=\"Send a gift\" title=\"Send a gift\">\n            <svg aria-hidden=\"true\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M3 8h18v4H3zM5 12v9h14v-9M12 8v13\"/><path d=\"M12 8H7.5A2.5 2.5 0 1 1 10 5.5L12 8Zm0 0h4.5A2.5 2.5 0 1 0 14 5.5L12 8Z\"/></svg>\n            <span>Gift</span>\n          </button>\n        </div>\n      </div>\n      <div id=\"rules\" role=\"dialog\" aria-modal=\"true\" aria-labelledby=\"rulesTitle\">\n        <div class=\"card\">\n          <h2 id=\"rulesTitle\">Domino Royal — Rules for 2–4 players</h2>\n          <ol>\n            <li><b>Set:</b> Double-Six (28 tiles, 0–6). Each tile is unique (a,b) with a≤b. No duplicates.</li>\n            <li><b>Dealing:</b> 7 tiles per player. The rest form the <i>stock</i> (boneyard).</li>\n            <li><b>Opening:</b> The player with the highest double starts. If no double, the highest tile opens.</li>\n            <li><b>On the table:</b> Every tile lies flat on the green cloth, touching end-to-end without overlapping. Keep the chain flush as you pivot at the rails so the spacing stays even.</li>\n            <li><b>Matching:</b> The touching halves must show the same pip value. Doubles stand upright in place; all other tiles extend the snake in a straight line.</li>\n            <li><b>No move?</b> Draw from the face-down stock stack near you (tap the Draw button below it) until you can play. If the stock is empty, pass.</li>\n            <li><b>Ending:</b> The winner is the first out. If play is blocked, the lowest pip total wins.</li>\n          </ol>\n          <div class=\"row\">\n            <button id=\"closeRules\" type=\"button\">Close</button>\n          </div>\n        </div>\n      </div>\n      <div id=\"chatModal\" class=\"modal-overlay\" aria-hidden=\"true\">\n        <div class=\"modal-card\" role=\"dialog\" aria-modal=\"true\" aria-labelledby=\"chatTitle\">\n          <div class=\"modal-header\">\n            <h3 id=\"chatTitle\">Quick Chat</h3>\n            <button class=\"modal-close\" id=\"chatClose\" type=\"button\" aria-label=\"Close chat\"><svg aria-hidden=\"true\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"m6 6 12 12M18 6 6 18\"/></svg></button>\n          </div>\n          <div class=\"quick-messages\" id=\"chatMessages\" ></div>\n          <button class=\"modal-primary\" id=\"chatSend\" type=\"button\">Send</button>\n        </div>\n      </div>\n      <div id=\"giftModal\" class=\"modal-overlay\" aria-hidden=\"true\">\n        <div class=\"modal-card\" role=\"dialog\" aria-modal=\"true\" aria-labelledby=\"giftTitle\">\n          <div class=\"modal-header\">\n            <h3 id=\"giftTitle\">Send Gift</h3>\n            <button class=\"modal-close\" id=\"giftClose\" type=\"button\" aria-label=\"Close gifts\"><svg aria-hidden=\"true\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"m6 6 12 12M18 6 6 18\"/></svg></button>\n          </div>\n          <div class=\"gift-players\" id=\"giftPlayers\" ></div>\n          <div id=\"giftTiers\" ></div>\n          <div class=\"gift-cost\">\n            <span>Cost:</span>\n            <span id=\"giftCost\">0</span>\n            <img src=\"/assets/icons/file_00000000362481f7978631c42572193f.png\" alt=\"TPG\" />\n          </div>\n          <button class=\"modal-primary\" id=\"giftSend\" type=\"button\">Send Gift</button>\n          <p class=\"gift-note\">10% charge and the amount of the gift will be deducted from your balance.</p>\n        </div>\n      </div>\n      <div id=\"winnerOverlay\" aria-hidden=\"true\">\n        <div class=\"winner-card\" role=\"dialog\" aria-modal=\"true\" aria-labelledby=\"winnerName\">\n          <div id=\"winnerCoinBurst\" ></div>\n          <div id=\"winnerAvatar\">🏆</div>\n          <h3 id=\"winnerName\">Winner</h3>\n          <p id=\"winnerReason\">Round complete.</p>\n          <div class=\"winner-actions\">\n            <button id=\"winnerPlayAgain\" type=\"button\">Play Again</button>\n            <button id=\"winnerReturnLobby\" type=\"button\">Return Lobby</button>\n          </div>\n        </div>\n      </div>\n    </div>";
