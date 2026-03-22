import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import useLiveVideoChat from '../hooks/useLiveVideoChat.js';

const AVATAR_ANCHOR_SELECTORS = [
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

    const scoreAnchor = (element, rect) => {
      let score = 0;
      const marker =
        `${element.getAttribute('data-self-player') || ''} ${element.getAttribute('data-player-index') || ''} ${element.className || ''} ${element.getAttribute('aria-label') || ''} ${element.getAttribute('alt') || ''}`.toLowerCase();
      if (marker.includes('self')) score += 100;
      if (marker.includes('you')) score += 80;
      if (marker.includes('player-index') || marker.includes('0')) score += 40;
      if (rect.top > window.innerHeight * 0.45) score += 25;
      if (rect.left < window.innerWidth * 0.65) score += 15;
      score += Math.min(rect.width, rect.height);
      return score;
    };

    const bindAvatarToggle = (node) => {
      if (!node || node.dataset.liveAvatarBound === '1') return;
      node.dataset.liveAvatarBound = '1';
      const toggleFromAvatar = (event) => {
        event.preventDefault();
        event.stopPropagation();
        setLiveMode((prev) => !prev);
      };
      node.addEventListener('click', toggleFromAvatar, true);
    };

    const findAvatarAnchor = () => {
      let bestRect = null;
      let bestScore = -Infinity;
      let bestNode = null;
      const seen = new Set();
      for (const selector of AVATAR_ANCHOR_SELECTORS) {
        const nodes = document.querySelectorAll(selector);
        for (const candidate of nodes) {
          if (seen.has(candidate)) continue;
          seen.add(candidate);
          const rect = candidate.getBoundingClientRect();
          if (rect.width <= 8 || rect.height <= 8) continue;
          const score = scoreAnchor(candidate, rect);
          if (score > bestScore) {
            bestScore = score;
            bestRect = rect;
            bestNode = candidate;
          }
        }
      }
      if (bestNode) {
        bindAvatarToggle(bestNode);
      }
      return bestRect;
    };

    const applyRect = () => {
      const rect = findAvatarAnchor();
      if (!rect) return;
      const width = Math.max(Math.round(rect.width), 24);
      const height = Math.max(Math.round(rect.height), 24);
      const left = Math.max(Math.round(rect.left), 0);
      const top = Math.max(Math.round(rect.top), 0);
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

    scheduleApply();

    return () => {
      cancelAnimationFrame(frameId);
      mutationObserver.disconnect();
      resizeObserver?.disconnect();
      window.removeEventListener('resize', scheduleApply);
      window.removeEventListener('orientationchange', scheduleApply);
      window.removeEventListener('scroll', scheduleApply, true);
    };
  }, [gameSlug, search]);

  return (
    <>
      {children}
      {liveMode ? (
        <button
          type="button"
          onClick={() => setLiveMode(false)}
          className="fixed z-[65] overflow-hidden rounded-full border border-emerald-300/80 bg-black/20"
          aria-label="Turn off live avatar video"
          style={{
            top: `${overlayRect.top}px`,
            left: `${overlayRect.left}px`,
            width: `${overlayRect.width}px`,
            height: `${overlayRect.height}px`
          }}
        >
          <span className="sr-only">Live avatar video</span>
          {liveChat.localStream ? (
            <video
              ref={(node) => {
                localVideoRef.current = node;
              }}
              autoPlay
              muted
              playsInline
              className="h-full w-full object-cover scale-x-[-1]"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-black/50 text-[9px] font-semibold text-white">
              Live…
            </div>
          )}
        </button>
      ) : null}
    </>
  );
}
