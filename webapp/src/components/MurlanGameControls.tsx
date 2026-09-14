import React, { useEffect, useRef, type ReactNode } from 'react';
import {
  ArrowUpRight,
  CircleHelp,
  Gift,
  Hand,
  MessageCircle,
  Settings2,
  Undo2,
  Volume2,
  VolumeX,
  X
} from 'lucide-react';
import './MurlanGameControls.css';

type MurlanGameControlsProps = {
  humanTurn: boolean;
  activePlayerName?: string;
  selectedCount: number;
  cardsLeft: number;
  canPass: boolean;
  message: string;
  tableSummary?: string;
  actionError?: string;
  muted: boolean;
  configOpen: boolean;
  onConfigChange: (open: boolean) => void;
  onChat: () => void;
  onGift: () => void;
  onInfo: () => void;
  onToggleMute: () => void;
  onPass: () => void;
  onClear: () => void;
  onPlay: () => void;
  children: ReactNode;
};

/** Screen-space controls only. The arena owns all card and character transforms. */
export default function MurlanGameControls({
  humanTurn,
  activePlayerName,
  selectedCount,
  cardsLeft,
  canPass,
  message,
  tableSummary,
  actionError,
  muted,
  configOpen,
  onConfigChange,
  onChat,
  onGift,
  onInfo,
  onToggleMute,
  onPass,
  onClear,
  onPlay,
  children
}: MurlanGameControlsProps) {
  const settingsButtonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const onConfigChangeRef = useRef(onConfigChange);
  onConfigChangeRef.current = onConfigChange;

  useEffect(() => {
    if (!configOpen) return;
    closeButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onConfigChangeRef.current(false);
      }
      if (event.key !== 'Tab') return;
      const focusable = panelRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), [tabindex="0"]'
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      settingsButtonRef.current?.focus();
    };
  }, [configOpen]);

  return (
    <>
      <nav className="murlan-toolbar" aria-label="Game tools">
        <button
          ref={settingsButtonRef}
          type="button"
          className="murlan-tool"
          aria-label="Table settings"
          aria-expanded={configOpen}
          aria-controls="murlan-table-settings"
          onClick={() => onConfigChange(!configOpen)}
        >
          <Settings2 aria-hidden="true" />
          <span>Table</span>
        </button>
        <button type="button" className="murlan-tool" onClick={onChat} aria-label="Quick chat">
          <MessageCircle aria-hidden="true" />
          <span>Chat</span>
        </button>
        <button type="button" className="murlan-tool" onClick={onGift} aria-label="Send a gift">
          <Gift aria-hidden="true" />
          <span>Gift</span>
        </button>
        <button type="button" className="murlan-tool" onClick={onInfo} aria-label="Game rules">
          <CircleHelp aria-hidden="true" />
          <span>Rules</span>
        </button>
        <button
          type="button"
          className="murlan-tool"
          onClick={onToggleMute}
          aria-label={muted ? 'Unmute game sound' : 'Mute game sound'}
          aria-pressed={muted}
        >
          {muted ? <VolumeX aria-hidden="true" /> : <Volume2 aria-hidden="true" />}
          <span>{muted ? 'Unmute' : 'Sound'}</span>
        </button>
      </nav>

      <section className="murlan-action-dock" aria-label="Your cards and actions">
        <div className="murlan-turn-status" aria-live="polite" aria-atomic="true">
          <div className="murlan-turn-heading">
            <span className={`murlan-turn-label${humanTurn ? ' is-your-turn' : ''}`}>
              <span className="murlan-turn-dot" aria-hidden="true" />
              {humanTurn ? 'Your turn' : `${activePlayerName || 'Opponent'}’s turn`}
            </span>
            <span className="murlan-selection-count">
              {selectedCount ? `${selectedCount} selected` : `${cardsLeft} cards`}
            </span>
          </div>
          <p className="murlan-turn-hint">{message}</p>
          {tableSummary ? <p className="murlan-table-summary">{tableSummary}</p> : null}
        </div>
        {actionError ? <p className="murlan-action-error" role="alert">{actionError}</p> : null}
        <div className="murlan-action-buttons">
          <button
            type="button"
            className="murlan-action murlan-action-pass"
            onClick={onPass}
            disabled={!humanTurn || !canPass}
          >
            <Hand aria-hidden="true" />
            <span>Pass</span>
          </button>
          <button
            type="button"
            className="murlan-action murlan-action-clear"
            onClick={onClear}
            disabled={!selectedCount}
            aria-label="Clear selected cards"
          >
            <Undo2 aria-hidden="true" />
            <span>Clear</span>
          </button>
          <button
            type="button"
            className="murlan-action murlan-action-play"
            onClick={onPlay}
            disabled={!humanTurn || !selectedCount}
            aria-label={selectedCount ? `Play ${selectedCount} selected ${selectedCount === 1 ? 'card' : 'cards'}` : 'Play selected cards'}
          >
            <span>Play{selectedCount ? ` (${selectedCount})` : ''}</span>
            <ArrowUpRight aria-hidden="true" />
          </button>
        </div>
      </section>

      {configOpen ? (
        <div className="murlan-settings-layer">
          <button
            type="button"
            className="murlan-settings-scrim"
            aria-label="Close table settings"
            tabIndex={-1}
            onClick={() => onConfigChange(false)}
          />
          <div
            ref={panelRef}
            id="murlan-table-settings"
            className="murlan-settings-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="murlan-settings-title"
          >
            <div className="murlan-settings-heading">
              <div>
                <h2 id="murlan-settings-title">Table settings</h2>
                <p>Make the arena yours.</p>
              </div>
              <button
                ref={closeButtonRef}
                type="button"
                className="murlan-settings-close"
                aria-label="Close settings"
                onClick={() => onConfigChange(false)}
              >
                <X aria-hidden="true" />
              </button>
            </div>
            <div className="murlan-settings-content">{children}</div>
          </div>
        </div>
      ) : null}
    </>
  );
}
