import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import useLiveVideoChat from '../hooks/useLiveVideoChat.js';

const POOL_ROYALE_VIDEO_FRAME_SIZE = 44;

const AVATAR_ANCHOR_SELECTORS = [
  '[data-self-player="true"] .seat-badge-core',
  '[data-self-player="true"].seat-badge-core',
  '.seat-badge.is-self .seat-badge-core',
  '.seat-badge.is-self',
  '[data-self-player="true"] .score-avatar',
  '[data-self-player="true"].score-avatar',
  '[data-self-player="true"] .avatar-timer-avatar',
  '[data-self-player="true"].avatar-timer-avatar',
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
  '#p1Avatar',
  '.player-avatar.you img',
  '.player-avatar.you',
  '.hud-player-you img',
  '.hud-player-you',
  'img[alt="You"]',
  '[aria-label="You"]'
];

export default function GameLiveAvatarOverlay({ gameSlug, children }) {
  const { search } = useLocation();
  const params = useMemo(() => new URLSearchParams(search), [search]);
  const [liveMode, setLiveMode] = useState(false);
  const [anchorElement, setAnchorElement] = useState(null);
  const localVideoRef = useRef(null);
  const [overlayRect, setOverlayRect] = useState({
    top: 96,
    left: 12,
    width: 44,
    height: 44
  });

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
    const accountId =
      typeof window !== 'undefined'
        ? window.localStorage.getItem('accountId') || 'guest'
        : 'guest';
    const sessionId =
      params.get('table') ||
      params.get('tableId') ||
      params.get('room') ||
      params.get('roomId') ||
      'default';
    return `live-${gameSlug}-${sessionId}-${accountId}`;
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

  const prioritizedSelectors = useMemo(() => {
    if (gameSlug === 'goalrush') {
      return ['#p1AvatarTop', '#p1Avatar', '[data-self-player="true"]', ...AVATAR_ANCHOR_SELECTORS];
    }
    if (gameSlug === 'domino-royal') {
      return ['.seat-badge.is-self .seat-badge-core', '.seat-badge.is-self', ...AVATAR_ANCHOR_SELECTORS];
    }
    if (gameSlug === 'fourinrowroyale') {
      return ['[data-self-player="true"] .avatar-timer-avatar', '[data-self-player="true"]', ...AVATAR_ANCHOR_SELECTORS];
    }
    return AVATAR_ANCHOR_SELECTORS;
  }, [gameSlug]);

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
        for (const selector of prioritizedSelectors) {
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
      const width = Math.max(POOL_ROYALE_VIDEO_FRAME_SIZE, 32);
      const height = Math.max(POOL_ROYALE_VIDEO_FRAME_SIZE, 32);
      const left = Math.max(
        Math.round(rect.left - (width - rect.width) / 2),
        0
      );
      const top = Math.max(
        Math.round(rect.top - (height - rect.height) / 2),
        0
      );
      setAnchorElement(node);
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
  }, [gameSlug, prioritizedSelectors, search]);

  useEffect(() => {
    if (!anchorElement) return undefined;
    const onToggle = (event) => {
      event.preventDefault();
      event.stopPropagation();
      setLiveMode((prev) => !prev);
    };
    anchorElement.style.cursor = 'pointer';
    anchorElement.addEventListener('click', onToggle);
    return () => {
      anchorElement.removeEventListener('click', onToggle);
    };
  }, [anchorElement]);

  useEffect(() => {
    if (!anchorElement) return undefined;
    const previousVisibility = anchorElement.style.visibility;
    if (liveMode) anchorElement.style.visibility = 'hidden';
    else anchorElement.style.visibility = previousVisibility || '';
    return () => {
      anchorElement.style.visibility = previousVisibility || '';
    };
  }, [anchorElement, liveMode]);

  return (
    <>
      {children}
      {liveMode && anchorElement ? (
        <button
          type="button"
          aria-label="Turn off live avatar video"
          onClick={() => setLiveMode(false)}
          className="fixed z-[65] overflow-hidden rounded-full border border-emerald-300 bg-black/30"
          style={{
            top: `${overlayRect.top}px`,
            left: `${overlayRect.left}px`,
            width: `${overlayRect.width}px`,
            height: `${overlayRect.height}px`
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
    </>
  );
}
