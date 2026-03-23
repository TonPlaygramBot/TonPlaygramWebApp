import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import useLiveVideoChat from '../hooks/useLiveVideoChat.js';

const AVATAR_ANCHOR_SELECTORS = [
  '#p1AvatarTop',
  '#dominoLeaderboardCard .leaderboard-row.is-human .leaderboard-avatar',
  '#dominoLeaderboardCard .leaderboard-row.is-human',
  '.leaderboard-row.is-human .leaderboard-avatar',
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

  useLayoutEffect(() => {
    if (typeof window === 'undefined') return undefined;

    let frameId = 0;
    let resizeObserver;
    let pollingInterval = 0;
    const iframeListeners = [];

    const listSearchDocuments = () => {
      const docs = [{ doc: document, frameRect: null }];
      const frames = Array.from(document.querySelectorAll('iframe'));
      frames.forEach((frame) => {
        try {
          if (!frame.contentDocument || !frame.contentWindow) return;
          docs.push({ doc: frame.contentDocument, frameRect: frame.getBoundingClientRect() });
        } catch (err) {
          // ignore cross-origin iframes
        }
      });
      return docs;
    };

    const toViewportRect = (rect, frameRect) => {
      if (!frameRect) return rect;
      return {
        top: rect.top + frameRect.top,
        left: rect.left + frameRect.left,
        width: rect.width,
        height: rect.height
      };
    };

    const scoreAnchor = (element, rect, frameRect = null) => {
      const viewportRect = toViewportRect(rect, frameRect);
      let score = 0;
      const marker =
        `${element.getAttributeNames().join(' ')} ${element.getAttribute('data-self-player') || ''} ${element.getAttribute('data-is-user') || ''} ${element.getAttribute('data-player-index') || ''} ${element.className || ''} ${element.getAttribute('aria-label') || ''} ${element.getAttribute('alt') || ''}`.toLowerCase();
      if (marker.includes('self')) score += 100;
      if (marker.includes('you')) score += 80;
      if (viewportRect.top > window.innerHeight * 0.45) score += 25;
      if (viewportRect.left < window.innerWidth * 0.65) score += 15;
      score += Math.min(viewportRect.width, viewportRect.height);
      return score;
    };

    const findAvatarAnchor = () => {
      let bestNode = null;
      let bestRect = null;
      let bestFrameRect = null;
      let bestScore = -Infinity;
      const docs = listSearchDocuments();
      for (const { doc, frameRect } of docs) {
        const seen = new Set();
        for (const selector of AVATAR_ANCHOR_SELECTORS) {
          const nodes = doc.querySelectorAll(selector);
          for (const candidate of nodes) {
            if (seen.has(candidate)) continue;
            seen.add(candidate);
            const rect = candidate.getBoundingClientRect();
            if (rect.width <= 8 || rect.height <= 8) continue;
            const score = scoreAnchor(candidate, rect, frameRect);
            if (score > bestScore) {
              bestScore = score;
              bestRect = rect;
              bestNode = candidate;
              bestFrameRect = frameRect;
            }
          }
        }
      }
      return { rect: bestRect, frameRect: bestFrameRect, node: bestNode };
    };

    const applyRect = () => {
      const { rect, frameRect, node } = findAvatarAnchor();
      if (!rect) return;
      const viewportRect = toViewportRect(rect, frameRect);
      const FRAME_SCALE = 1.2;
      const width = Math.max(Math.round(viewportRect.width * FRAME_SCALE), 32);
      const height = Math.max(Math.round(viewportRect.height * FRAME_SCALE), 32);
      const left = Math.max(
        Math.round(viewportRect.left - (width - viewportRect.width) / 2),
        0
      );
      const top = Math.max(
        Math.round(viewportRect.top - (height - viewportRect.height) / 2),
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

    const mutationObserver = new MutationObserver(scheduleApply);
    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true
    });

    resizeObserver = new ResizeObserver(scheduleApply);
    resizeObserver.observe(document.body);
    window.addEventListener('resize', scheduleApply);
    window.addEventListener('orientationchange', scheduleApply);
    window.addEventListener('scroll', scheduleApply, true);
    pollingInterval = window.setInterval(scheduleApply, 800);
    const iframes = Array.from(document.querySelectorAll('iframe'));
    iframes.forEach((frame) => {
      frame.addEventListener('load', scheduleApply);
      iframeListeners.push(frame);
    });

    scheduleApply();

    return () => {
      cancelAnimationFrame(frameId);
      mutationObserver.disconnect();
      resizeObserver?.disconnect();
      window.removeEventListener('resize', scheduleApply);
      window.removeEventListener('orientationchange', scheduleApply);
      window.removeEventListener('scroll', scheduleApply, true);
      window.clearInterval(pollingInterval);
      iframeListeners.forEach((frame) => frame.removeEventListener('load', scheduleApply));
    };
  }, [gameSlug, search]);

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
