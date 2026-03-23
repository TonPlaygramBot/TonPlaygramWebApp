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
  '[aria-label="You"]',
  '#p1AvatarTop',
  '[data-player-role="self"]'
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

    const getSearchContexts = () => {
      const contexts = [{ root: document, offsetLeft: 0, offsetTop: 0 }];
      const iframes = Array.from(document.querySelectorAll('iframe'));
      iframes.forEach((frame) => {
        let frameDoc = null;
        try {
          frameDoc = frame.contentDocument || frame.contentWindow?.document || null;
        } catch (error) {
          frameDoc = null;
        }
        if (!frameDoc?.body) return;
        const frameRect = frame.getBoundingClientRect();
        contexts.push({
          root: frameDoc,
          offsetLeft: frameRect.left,
          offsetTop: frameRect.top
        });
      });
      return contexts;
    };

    const findAvatarAnchor = () => {
      let bestNode = null;
      let bestRect = null;
      let bestScore = -Infinity;
      const contexts = getSearchContexts();
      for (const context of contexts) {
        const seen = new Set();
        for (const selector of AVATAR_ANCHOR_SELECTORS) {
          const nodes = context.root.querySelectorAll(selector);
          for (const candidate of nodes) {
            if (seen.has(candidate)) continue;
            seen.add(candidate);
            const localRect = candidate.getBoundingClientRect();
            if (localRect.width <= 8 || localRect.height <= 8) continue;
            const rect = {
              top: localRect.top + context.offsetTop,
              left: localRect.left + context.offsetLeft,
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
      const FRAME_SCALE = 1.2;
      const width = Math.max(Math.round(rect.width * FRAME_SCALE), 32);
      const height = Math.max(Math.round(rect.height * FRAME_SCALE), 32);
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
    const pollTimer = window.setInterval(scheduleApply, 1200);

    scheduleApply();

    return () => {
      cancelAnimationFrame(frameId);
      mutationObserver.disconnect();
      resizeObserver?.disconnect();
      window.clearInterval(pollTimer);
      window.removeEventListener('resize', scheduleApply);
      window.removeEventListener('orientationchange', scheduleApply);
      window.removeEventListener('scroll', scheduleApply, true);
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
