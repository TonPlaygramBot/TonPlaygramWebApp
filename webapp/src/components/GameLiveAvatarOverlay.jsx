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
  const [anchorBox, setAnchorBox] = useState(null);
  const [anchorRadius, setAnchorRadius] = useState('9999px');
  const localVideoRef = useRef(null);
  const avatarElementRef = useRef(null);

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

  useEffect(() => {
    const avatarNode = avatarElementRef.current;
    if (!avatarNode) return undefined;

    if (liveMode) {
      avatarNode.style.visibility = 'hidden';
      return () => {
        avatarNode.style.visibility = '';
      };
    }

    avatarNode.style.visibility = '';
    return undefined;
  }, [liveMode, anchorBox]);

  useLayoutEffect(() => {
    if (typeof window === 'undefined') return undefined;

    let frameId = 0;
    let resizeObserver;
    let mutationObserver;

    const scoreAnchor = (element, rect) => {
      let score = 0;
      const marker =
        `${element.getAttribute('data-self-player') || ''} ${element.getAttribute('data-player-index') || ''} ${element.className || ''} ${element.getAttribute('aria-label') || ''} ${element.getAttribute('alt') || ''}`.toLowerCase();
      if (marker.includes('self')) score += 100;
      if (marker.includes('you')) score += 80;
      if (marker.includes('player-index') || marker.includes('0')) score += 40;
      score += Math.min(rect.width, rect.height);
      return score;
    };

    const findAvatarAnchor = () => {
      let best = null;
      let bestScore = -Infinity;
      const seen = new Set();

      for (const selector of AVATAR_ANCHOR_SELECTORS) {
        const nodes = document.querySelectorAll(selector);
        for (const node of nodes) {
          if (seen.has(node)) continue;
          seen.add(node);
          const rect = node.getBoundingClientRect();
          if (rect.width <= 8 || rect.height <= 8) continue;
          const score = scoreAnchor(node, rect);
          if (score > bestScore) {
            bestScore = score;
            best = node;
          }
        }
      }
      return best;
    };

    const handleAvatarClick = (event) => {
      event.preventDefault();
      event.stopPropagation();
      setLiveMode((prev) => !prev);
    };

    const applyAnchor = () => {
      const nextAvatarNode = findAvatarAnchor();
      if (!nextAvatarNode) return;

      if (avatarElementRef.current !== nextAvatarNode) {
        if (avatarElementRef.current) {
          avatarElementRef.current.removeEventListener(
            'click',
            handleAvatarClick,
            true
          );
          avatarElementRef.current.style.cursor = '';
        }
        avatarElementRef.current = nextAvatarNode;
        avatarElementRef.current.style.cursor = 'pointer';
        avatarElementRef.current.addEventListener(
          'click',
          handleAvatarClick,
          true
        );
      }

      const rect = avatarElementRef.current.getBoundingClientRect();
      const computed = window.getComputedStyle(avatarElementRef.current);
      setAnchorRadius(computed.borderRadius || '9999px');
      setAnchorBox((prev) => {
        const next = {
          top: Math.round(rect.top),
          left: Math.round(rect.left),
          width: Math.round(rect.width),
          height: Math.round(rect.height)
        };
        if (
          prev &&
          Math.abs(prev.top - next.top) <= 1 &&
          Math.abs(prev.left - next.left) <= 1 &&
          Math.abs(prev.width - next.width) <= 1 &&
          Math.abs(prev.height - next.height) <= 1
        ) {
          return prev;
        }
        return next;
      });
    };

    const scheduleApply = () => {
      cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(applyAnchor);
    };

    mutationObserver = new MutationObserver(scheduleApply);
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
      mutationObserver?.disconnect();
      resizeObserver?.disconnect();
      window.removeEventListener('resize', scheduleApply);
      window.removeEventListener('orientationchange', scheduleApply);
      window.removeEventListener('scroll', scheduleApply, true);
      if (avatarElementRef.current) {
        avatarElementRef.current.removeEventListener(
          'click',
          handleAvatarClick,
          true
        );
        avatarElementRef.current.style.cursor = '';
        avatarElementRef.current.style.visibility = '';
      }
    };
  }, [gameSlug, search]);

  return (
    <>
      {children}
      {liveMode && anchorBox ? (
        <button
          type="button"
          className="fixed z-[80] overflow-hidden border border-emerald-300 bg-black/20"
          style={{
            top: `${anchorBox.top}px`,
            left: `${anchorBox.left}px`,
            width: `${anchorBox.width}px`,
            height: `${anchorBox.height}px`,
            borderRadius: anchorRadius
          }}
          aria-label="Disable live video and switch back to avatar"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setLiveMode(false);
          }}
        >
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            className="h-full w-full object-cover"
          />
        </button>
      ) : null}
    </>
  );
}
