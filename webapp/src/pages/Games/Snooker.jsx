import React, { useCallback, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { PoolRoyaleGame } from './PoolRoyale.jsx';
import { resolveTableSize } from '../../config/poolRoyaleTables.js';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import { getTelegramId, getTelegramUsername } from '../../utils/telegram.js';

const SNOOKER_VARIANT_ID = 'snooker';
const SNOOKER_TABLE_ID = 'snooker';

export default function Snooker() {
  const location = useLocation();
  const navigate = useNavigate();

  const playType = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const requested = params.get('type');
    if (requested === 'training') return 'training';
    if (requested === 'tournament') return 'tournament';
    return 'regular';
  }, [location.search]);

  const mode = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get('mode') || 'ai';
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

  const opponentName = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get('opponent') || '';
  }, [location.search]);

  const tableSizeKey = useMemo(() => resolveTableSize(SNOOKER_TABLE_ID).id, []);

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
        navigate('/games/snooker/lobby');
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
          navigate('/games/snooker/lobby');
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
  }, [confirmExit, exitMessage, navigate]);

  return (
    <PoolRoyaleGame
      variantKey={SNOOKER_VARIANT_ID}
      tableSizeKey={tableSizeKey}
      playType={playType}
      mode={mode}
      trainingMode={mode}
      trainingRulesEnabled={trainingRulesEnabled}
      accountId={accountId}
      tgId={tgId}
      playerName={playerName}
      opponentName={opponentName}
    />
  );
}
