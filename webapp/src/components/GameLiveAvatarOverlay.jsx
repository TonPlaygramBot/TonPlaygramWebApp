import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import useLiveVideoChat from '../hooks/useLiveVideoChat.js';
import { buildGameLiveChatRoomId } from '../utils/liveVideoRoom.js';

function RemoteVideo({ peer }) {
  const videoRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;
    video.srcObject = peer.stream || null;

    const play = () => {
      if (!video.srcObject) return;
      video.play().catch(() => {
        // Mobile WebViews can defer audible playback until the next touch.
        // The one-time listeners below retry without muting the opponent.
      });
    };
    play();
    video.addEventListener('loadedmetadata', play);
    document.addEventListener('pointerdown', play, { once: true });
    document.addEventListener('touchend', play, { once: true });
    return () => {
      video.removeEventListener('loadedmetadata', play);
      document.removeEventListener('pointerdown', play);
      document.removeEventListener('touchend', play);
      video.srcObject = null;
    };
  }, [peer.stream]);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-2xl bg-slate-950 shadow-2xl ring-2 ring-emerald-300/80">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={false}
        aria-label={`${peer.displayName || 'Opponent'} live video`}
        className="h-full w-full object-cover"
      />
      {!peer.stream || peer.mediaState?.camera === false ? (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950/95 px-2 text-center text-[10px] font-semibold text-white/75">
          {peer.stream ? 'Opponent camera off' : 'Connecting to opponent…'}
        </div>
      ) : null}
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/90 to-transparent px-2 pb-1 pt-5 text-[9px] font-semibold text-white">
        <span className="max-w-[75%] truncate">{peer.displayName || 'Opponent'}</span>
        <span aria-label={peer.mediaState?.microphone === false ? 'Opponent microphone off' : 'Opponent microphone on'}>
          {peer.mediaState?.microphone === false ? '🔇' : '🔊'}
        </span>
      </div>
    </div>
  );
}

const AVATAR_ANCHOR_SELECTORS = [
  '[data-self-player="true"] .seat-badge-core',
  '[data-self-player="true"] .score-avatar',
  '[data-self-player="true"] .avatar-timer-avatar',
  '[data-self-player="true"] img',
  '[data-self-player="true"] .avatar',
  '[data-self-player="true"]',
  '[data-is-user="true"] img',
  '[data-is-user="true"]',
  '[data-you="true"] img',
  '[data-you="true"]',
  '[data-player-index="0"] img',
  '[data-player-index="0"] .avatar',
  '[data-player-index="0"]',
  '#p1AvatarTop',
  '.player-avatar.you img',
  '.player-avatar.you',
  '.hud-player-you img',
  '.hud-player-you',
  'img[alt="You"]',
  '[aria-label="You"]'
];

const FRAME_SCALE = 1;
const BLOCKING_OVERLAY_SELECTORS = [
  '#configPanel.active',
  '#chatModal.active',
  '#giftModal.active',
  '.modal-overlay.active',
  '[role="dialog"][aria-hidden="false"]',
  '#rules[style*="display: flex"]',
  '#rules[style*="display:flex"]'
];
const AVATAR_FRAME_STYLES = Object.freeze({
  borderRadius: '999px',
  border: '2px solid rgba(255,255,255,.32)',
  boxShadow: '0 8px 18px rgba(0,0,0,.35),0 0 0 2px rgba(6,12,24,.45)',
  background:
    'radial-gradient(circle at 30% 30%,rgba(255,255,255,.2),rgba(0,0,0,.12)),linear-gradient(135deg,#0ea5e9,#22c55e)'
});

export default function GameLiveAvatarOverlay({ gameSlug, children }) {
  const { search } = useLocation();
  const params = useMemo(() => new URLSearchParams(search), [search]);
  const [liveMode, setLiveMode] = useState(false);
  const [anchorElement, setAnchorElement] = useState(null);
  const [opponentAnchorElement, setOpponentAnchorElement] = useState(null);
  const localVideoRef = useRef(null);
  const [overlayRect, setOverlayRect] = useState({
    top: 96,
    left: 12,
    width: 44,
    height: 44
  });
  const [activationRect, setActivationRect] = useState({
    top: 96,
    left: 12,
    width: 44,
    height: 44
  });
  const [opponentRect, setOpponentRect] = useState(null);
  const [groupOpponentRects, setGroupOpponentRects] = useState([]);
  const [groupOpponentAnchorElements, setGroupOpponentAnchorElements] = useState([]);
  const [hasBlockingOverlay, setHasBlockingOverlay] = useState(false);

  const displayName = useMemo(() => {
    if (typeof window === 'undefined') return 'Player';
    const username = window.localStorage.getItem('telegramUsername');
    const firstName = window.localStorage.getItem('telegramFirstName');
    const lastName = window.localStorage.getItem('telegramLastName');
    return (
      username || `${firstName || ''} ${lastName || ''}`.trim() || 'Player'
    );
  }, []);

  const roomId = useMemo(() => {
    // A live-chat room belongs to the match, not to an account. Including the
    // local account ID here put the two online players in different signaling
    // rooms, so their camera tracks could never be negotiated reliably.
    return buildGameLiveChatRoomId(gameSlug, params);
  }, [gameSlug, params]);

  const liveChat = useLiveVideoChat({
    roomId,
    displayName,
    enabled: liveMode
  });

  useEffect(() => {
    if (liveMode) {
      liveChat.startLiveChat();
      return;
    }
    liveChat.stopLiveChat();
  }, [liveMode, liveChat.startLiveChat, liveChat.stopLiveChat]);

  useEffect(() => {
    if (!localVideoRef.current) return;
    localVideoRef.current.srcObject = liveChat.localStream || null;
  }, [liveChat.localStream]);

  useLayoutEffect(() => {
    if (typeof window === 'undefined') return undefined;

    let frameId = 0;
    const resizeObservers = [];
    const mutationObservers = [];

    const getIframeContexts = (rootDocument = document, offset = { x: 0, y: 0 }) => {
      const contexts = [{ doc: rootDocument, offsetX: offset.x, offsetY: offset.y }];
      const iframes = rootDocument.querySelectorAll('iframe');
      iframes.forEach((iframe) => {
        try {
          const childDoc = iframe.contentDocument;
          if (!childDoc?.body) return;
          const rect = iframe.getBoundingClientRect();
          contexts.push(
            ...getIframeContexts(childDoc, {
              x: offset.x + rect.left,
              y: offset.y + rect.top
            })
          );
        } catch {
          // Cross-origin iframe; ignore.
        }
      });
      return contexts;
    };

    const scoreAnchor = (element, rect) => {
      let score = 0;
      const marker =
        `${element.getAttributeNames().join(' ')} ${element.getAttribute('data-self-player') || ''} ${element.getAttribute('data-is-user') || ''} ${element.getAttribute('data-player-index') || ''} ${element.className || ''} ${element.getAttribute('aria-label') || ''} ${element.getAttribute('alt') || ''}`.toLowerCase();
      if (marker.includes('self')) score += 100;
      if (marker.includes('you')) score += 80;
      if (rect.top > window.innerHeight * 0.45) score += 25;
      if (rect.left < window.innerWidth * 0.65) score += 15;
      score += Math.min(rect.width, rect.height);
      return score;
    };

    const findAvatarAnchor = () => {
      let bestNode = null;
      let bestRect = null;
      let bestScore = -Infinity;
      const seen = new Set();
      const contexts = getIframeContexts();
      for (const context of contexts) {
        for (const selector of AVATAR_ANCHOR_SELECTORS) {
          const nodes = context.doc.querySelectorAll(selector);
          for (const candidate of nodes) {
            if (seen.has(candidate)) continue;
            seen.add(candidate);
            const localRect = candidate.getBoundingClientRect();
            if (localRect.width <= 8 || localRect.height <= 8) continue;
            const rect = {
              top: localRect.top + context.offsetY,
              left: localRect.left + context.offsetX,
              width: localRect.width,
              height: localRect.height
            };
            const score = scoreAnchor(candidate, rect);
            if (score > bestScore) {
              bestScore = score;
              bestRect = rect;
              bestNode = candidate;
            }
          }
        }
      }
      return { rect: bestRect, node: bestNode };
    };

    const applyRect = () => {
      const { rect, node } = findAvatarAnchor();
      if (!rect) return;
      const avatarDiameter = Math.min(rect.width, rect.height);
      const frameDiameter = Math.max(Math.round(avatarDiameter * FRAME_SCALE), 32);
      const width = frameDiameter;
      const height = frameDiameter;
      const left = Math.max(
        Math.round(rect.left - (width - rect.width) / 2),
        0
      );
      const top = Math.max(
        Math.round(rect.top - (height - rect.height) / 2),
        0
      );
      const activationSize = Math.max(Math.round(avatarDiameter), 20);
      const activationLeft = Math.max(
        Math.round(rect.left + rect.width / 2 - activationSize / 2),
        0
      );
      const activationTop = Math.max(
        Math.round(rect.top + rect.height / 2 - activationSize / 2),
        0
      );
      setAnchorElement(node);
      if (gameSlug === 'domino-royal' || gameSlug === 'murlanroyale') {
        const opponentNodes = [];
        const opponentBoundsList = [];
        for (const context of getIframeContexts()) {
          const selector = gameSlug === 'domino-royal'
            ? '[data-player-index]:not([data-self-player="true"]) .seat-badge-core'
            : '[data-self-player="false"] [data-player-index] img';
          context.doc.querySelectorAll(selector).forEach((candidate) => {
            if (opponentNodes.length >= 3) return;
            const localRect = candidate.getBoundingClientRect();
            if (localRect.width <= 8 || localRect.height <= 8) return;
            const diameter = Math.min(localRect.width, localRect.height);
            opponentNodes.push(candidate);
            opponentBoundsList.push({
              top: Math.round(localRect.top + context.offsetY + (localRect.height - diameter) / 2),
              left: Math.round(localRect.left + context.offsetX + (localRect.width - diameter) / 2),
              width: Math.round(diameter),
              height: Math.round(diameter)
            });
          });
        }
        setGroupOpponentAnchorElements((previous) => (
          previous.length === opponentNodes.length &&
          previous.every((element, index) => element === opponentNodes[index])
            ? previous
            : opponentNodes
        ));
        setGroupOpponentRects((previous) => (
          previous.length === opponentBoundsList.length &&
          previous.every((bounds, index) => {
            const nextBounds = opponentBoundsList[index];
            return bounds.top === nextBounds.top &&
              bounds.left === nextBounds.left &&
              bounds.width === nextBounds.width &&
              bounds.height === nextBounds.height;
          })
            ? previous
            : opponentBoundsList
        ));
        setOpponentAnchorElement(gameSlug === 'domino-royal' ? opponentNodes[0] || null : null);
        setOpponentRect(gameSlug === 'domino-royal' ? opponentBoundsList[0] || null : null);
      }
      setOverlayRect((prev) => {
        if (
          Math.abs(prev.top - top) <= 1 &&
          Math.abs(prev.left - left) <= 1 &&
          Math.abs(prev.width - width) <= 1 &&
          Math.abs(prev.height - height) <= 1
        ) {
          return prev;
        }
        return { top, left, width, height };
      });
      setActivationRect((prev) => {
        if (
          Math.abs(prev.top - activationTop) <= 1 &&
          Math.abs(prev.left - activationLeft) <= 1 &&
          Math.abs(prev.width - activationSize) <= 1 &&
          Math.abs(prev.height - activationSize) <= 1
        ) {
          return prev;
        }
        return {
          top: activationTop,
          left: activationLeft,
          width: activationSize,
          height: activationSize
        };
      });
    };

    const scheduleApply = () => {
      cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(applyRect);
    };

    const observeContexts = () => {
      mutationObservers.forEach((observer) => observer.disconnect());
      resizeObservers.forEach((observer) => observer.disconnect());
      mutationObservers.length = 0;
      resizeObservers.length = 0;

      const contexts = getIframeContexts();
      contexts.forEach((context) => {
        if (!context.doc?.body) return;
        const mutationObserver = new MutationObserver(scheduleApply);
        mutationObserver.observe(context.doc.body, {
          childList: true,
          subtree: true,
          attributes: true
        });
        mutationObservers.push(mutationObserver);

        const resizeObserver = new ResizeObserver(scheduleApply);
        resizeObserver.observe(context.doc.body);
        resizeObservers.push(resizeObserver);
      });
    };

    observeContexts();
    window.addEventListener('resize', scheduleApply);
    window.addEventListener('orientationchange', scheduleApply);
    window.addEventListener('scroll', scheduleApply, true);
    const reobserveTimer = window.setTimeout(observeContexts, 450);

    scheduleApply();

    return () => {
      cancelAnimationFrame(frameId);
      mutationObservers.forEach((observer) => observer.disconnect());
      resizeObservers.forEach((observer) => observer.disconnect());
      window.clearTimeout(reobserveTimer);
      window.removeEventListener('resize', scheduleApply);
      window.removeEventListener('orientationchange', scheduleApply);
      window.removeEventListener('scroll', scheduleApply, true);
    };
  }, [gameSlug, search]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const hasOpenOverlay = () =>
      BLOCKING_OVERLAY_SELECTORS.some((selector) => {
        const node = document.querySelector(selector);
        if (!node) return false;
        if (node.id === 'rules') {
          const display = window.getComputedStyle(node).display;
          return display !== 'none';
        }
        return true;
      });
    const syncOverlayState = () => setHasBlockingOverlay(hasOpenOverlay());
    const observer = new MutationObserver(syncOverlayState);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style', 'aria-hidden']
    });
    syncOverlayState();
    window.addEventListener('resize', syncOverlayState);
    window.addEventListener('orientationchange', syncOverlayState);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', syncOverlayState);
      window.removeEventListener('orientationchange', syncOverlayState);
    };
  }, []);

  useEffect(() => {
    if (!anchorElement) return undefined;
    const previousVisibility = anchorElement.style.visibility;
    if (liveMode) anchorElement.style.visibility = 'hidden';
    else anchorElement.style.visibility = previousVisibility || '';
    return () => {
      anchorElement.style.visibility = previousVisibility || '';
    };
  }, [anchorElement, liveMode]);

  useEffect(() => {
    if (!opponentAnchorElement) return undefined;
    const previousVisibility = opponentAnchorElement.style.visibility;
    if (liveMode) opponentAnchorElement.style.visibility = 'hidden';
    else opponentAnchorElement.style.visibility = previousVisibility || '';
    return () => {
      opponentAnchorElement.style.visibility = previousVisibility || '';
    };
  }, [opponentAnchorElement, liveMode]);

  useEffect(() => {
    const previousVisibility = groupOpponentAnchorElements.map((element) => element.style.visibility);
    groupOpponentAnchorElements.forEach((element) => {
      if (liveMode) element.style.visibility = 'hidden';
    });
    return () => {
      groupOpponentAnchorElements.forEach((element, index) => {
        element.style.visibility = previousVisibility[index] || '';
      });
    };
  }, [groupOpponentAnchorElements, liveMode]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handleStartEvent = (event) => {
      const eventSlug = event?.detail?.gameSlug;
      if (eventSlug && eventSlug !== gameSlug) return;
      setLiveMode(true);
    };
    window.addEventListener('tonplaygram:live-avatar:start', handleStartEvent);
    return () => {
      window.removeEventListener('tonplaygram:live-avatar:start', handleStartEvent);
    };
  }, [gameSlug]);

  return (
    <>
      {children}
      {!liveMode && anchorElement ? (
        <button
          type="button"
          aria-label="Turn on live avatar video"
          onClick={() => setLiveMode(true)}
          className="fixed z-[18] rounded-full bg-transparent touch-manipulation"
          style={{
            top: `${activationRect.top}px`,
            left: `${activationRect.left}px`,
            width: `${activationRect.width}px`,
            height: `${activationRect.height}px`,
            pointerEvents: hasBlockingOverlay ? 'none' : 'auto'
          }}
        />
      ) : null}
      {liveMode && anchorElement ? (
        <button
          type="button"
          aria-label="Turn off live avatar video"
          onClick={() => setLiveMode(false)}
          className="fixed z-[18] overflow-hidden touch-manipulation"
          style={{
            top: `${overlayRect.top}px`,
            left: `${overlayRect.left}px`,
            width: `${overlayRect.width}px`,
            height: `${overlayRect.height}px`,
            pointerEvents: hasBlockingOverlay ? 'none' : 'auto',
            ...(gameSlug === 'domino-royal' ? AVATAR_FRAME_STYLES : {}),
            ...(gameSlug !== 'domino-royal'
              ? {
                  borderRadius: '999px',
                  border: '1px solid rgb(110 231 183 / 1)',
                  background: 'rgb(0 0 0 / 0.3)'
                }
              : {})
          }}
        >
          <video
            ref={(node) => {
              localVideoRef.current = node;
            }}
            autoPlay
            muted
            playsInline
            className="h-full w-full object-cover scale-x-[-1]"
          />
        </button>
      ) : null}
      {liveMode && gameSlug === 'domino-royal' && opponentRect ? (
        <div
          className="fixed z-[18] overflow-hidden pointer-events-none"
          style={{
            top: `${opponentRect.top}px`,
            left: `${opponentRect.left}px`,
            width: `${opponentRect.width}px`,
            height: `${opponentRect.height}px`,
            opacity: hasBlockingOverlay ? 0 : 1,
            ...AVATAR_FRAME_STYLES
          }}
        >
          {liveChat.remotePeers[0] ? (
            <RemoteVideo peer={liveChat.remotePeers[0]} />
          ) : (
            <div className="flex h-full items-center justify-center bg-slate-950 text-center text-[8px] font-semibold text-white/70">
              Waiting…
            </div>
          )}
        </div>
      ) : null}
      {liveMode && gameSlug === 'murlanroyale'
        ? groupOpponentRects.map((rect, index) => (
            <div
              key={`murlan-live-seat-${index}`}
              className="fixed z-[25] overflow-hidden rounded-full pointer-events-none"
              style={{
                top: `${rect.top}px`,
                left: `${rect.left}px`,
                width: `${rect.width}px`,
                height: `${rect.height}px`,
                opacity: hasBlockingOverlay ? 0 : 1,
                ...AVATAR_FRAME_STYLES
              }}
            >
              {liveChat.remotePeers[index] ? (
                <RemoteVideo peer={liveChat.remotePeers[index]} />
              ) : (
                <div className="flex h-full items-center justify-center bg-slate-950 text-center text-[8px] font-semibold text-white/70">
                  Waiting…
                </div>
              )}
            </div>
          ))
        : null}
      {liveMode ? (
        <div
          className={`fixed right-3 z-[18] flex flex-col gap-2 pointer-events-auto ${gameSlug === 'domino-royal' ? 'w-auto' : 'w-28'}`}
          style={{
            top: 'max(4.75rem, env(safe-area-inset-top))',
            opacity: hasBlockingOverlay ? 0 : 1,
            pointerEvents: hasBlockingOverlay ? 'none' : 'auto'
          }}
          aria-live="polite"
        >
          {gameSlug !== 'domino-royal' && gameSlug !== 'murlanroyale' ? <div className="h-36 w-28">
            {liveChat.remotePeers[0] ? (
              <RemoteVideo peer={liveChat.remotePeers[0]} />
            ) : (
              <div className="flex h-full items-center justify-center rounded-2xl bg-slate-950/90 px-3 text-center text-[10px] font-semibold text-white/70 shadow-xl ring-1 ring-white/20">
                {liveChat.error || 'Waiting for opponent to activate live video…'}
              </div>
            )}
          </div> : null}
          <div className="flex justify-center gap-2">
            <button
              type="button"
              onClick={liveChat.toggleMicrophone}
              className={`flex h-9 w-9 items-center justify-center rounded-full text-sm text-white shadow-lg ${liveChat.mediaState.microphone ? 'bg-emerald-600' : 'bg-rose-600'}`}
              aria-label={liveChat.mediaState.microphone ? 'Turn microphone off' : 'Turn microphone on'}
            >
              {liveChat.mediaState.microphone ? '🎙️' : '🔇'}
            </button>
            <button
              type="button"
              onClick={liveChat.toggleCamera}
              className={`flex h-9 w-9 items-center justify-center rounded-full text-sm text-white shadow-lg ${liveChat.mediaState.camera ? 'bg-emerald-600' : 'bg-rose-600'}`}
              aria-label={liveChat.mediaState.camera ? 'Turn camera off' : 'Turn camera on'}
            >
              {liveChat.mediaState.camera ? '📹' : '🚫'}
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
