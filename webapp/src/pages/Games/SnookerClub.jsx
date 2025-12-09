import React, { useCallback, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { PoolRoyaleGame } from './PoolRoyale.jsx';
import { getTelegramUsername, getTelegramId } from '../../utils/telegram.js';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import { resolveTableSize as resolveSnookerTableSize } from '../../config/snookerClubTables.js';

function normalizeVariantKey(value) {
  if (typeof value !== 'string') return '';
  return value
    .toLowerCase()
    .replace(/[_\s-]+/g, '')
    .trim();
}

function resolveVariant(variantId) {
  const normalized = normalizeVariantKey(variantId);
  if (normalized === 'american' || normalized === 'us') return 'american';
  if (normalized === '9ball' || normalized === 'nineball' || normalized === '9') return '9ball';
  return 'uk';
}

export default function SnookerClub() {
  const navigate = useNavigate();
  const location = useLocation();
  const lobbyPath = '/games/snookerclub/lobby';

  const variantKey = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const requested = params.get('variant');
    return resolveVariant(requested);
  }, [location.search]);

  const tableSizeKey = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const requested = params.get('tableSize');
    return resolveSnookerTableSize(requested).id;
  }, [location.search]);

  const playType = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const requested = params.get('type');
    if (requested === 'training') return 'training';
    if (requested === 'tournament') return 'tournament';
    return 'regular';
  }, [location.search]);

  const mode = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const requested = params.get('mode');
    if (requested === 'online') return 'online';
    if (requested === 'local') return 'local';
    return 'ai';
  }, [location.search]);

  const trainingMode = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const requested = params.get('mode');
    return requested === 'solo' ? 'solo' : 'ai';
  }, [location.search]);

  const trainingRulesEnabled = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get('rules') !== 'off';
  }, [location.search]);

  const accountId = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get('accountId') || '';
  }, [location.search]);

  const tgId = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get('tgId') || '';
  }, [location.search]);

  const playerName = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return (
      params.get('name') ||
      getTelegramUsername() ||
      getTelegramId() ||
      'Player'
    );
  }, [location.search]);

  const stakeAmount = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return Number(params.get('amount')) || 0;
  }, [location.search]);

  const stakeToken = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get('token') || 'TPC';
  }, [location.search]);

  const exitMessage = useMemo(
    () =>
      stakeAmount > 0
        ? `Are you sure you want to exit? Your ${stakeAmount} ${stakeToken} stake will be lost.`
        : 'Are you sure you want to exit the match?',
    [stakeAmount, stakeToken]
  );

  const confirmExit = useCallback(() => {
    return new Promise((resolve) => {
      const tg = window?.Telegram?.WebApp;
      if (tg?.showPopup) {
        tg.showPopup(
          {
            title: 'Exit game?',
            message: exitMessage,
            buttons: [
              { id: 'yes', type: 'destructive', text: 'Yes' },
              { id: 'no', type: 'default', text: 'No' }
            ]
          },
          (buttonId) => resolve(buttonId === 'yes')
        );
        return;
      }

      resolve(window.confirm(exitMessage));
    });
  }, [exitMessage]);

  useTelegramBackButton(() => {
    confirmExit().then((confirmed) => {
      if (confirmed) {
        navigate(lobbyPath);
      }
    });
  });

  useEffect(() => {
    const handleBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = exitMessage;
      return exitMessage;
    };
    const handlePopState = () => {
      confirmExit().then((confirmed) => {
        if (!confirmed) {
          window.history.pushState(null, '', window.location.href);
        } else {
          navigate(lobbyPath);
        }
      });
    };
    window.history.pushState(null, '', window.location.href);
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [confirmExit, exitMessage, lobbyPath, navigate]);

  const opponentName = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get('opponent') || '';
  }, [location.search]);

  return (
    <PoolRoyaleGame
      variantKey={variantKey}
      tableSizeKey={tableSizeKey}
      playType={playType}
      mode={mode}
      trainingMode={trainingMode}
      trainingRulesEnabled={trainingRulesEnabled}
      accountId={accountId}
      tgId={tgId}
      playerName={playerName}
      opponentName={opponentName}
      gameId="snookerclub"
      lobbyPath={lobbyPath}
      tableResolver={resolveSnookerTableSize}
    />
  );
}
