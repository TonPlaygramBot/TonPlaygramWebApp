import { useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { RoyalLanesGame } from '../../games/royallanes/Game';
import { OnlineBowlingSession } from '../../games/royallanes/onlineSession';
import { isGameMuted } from '../../utils/sound.js';
import type { BowlingSession } from '../../games/royallanes/types';
import { getTelegramFirstName } from '../../utils/telegram.js';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
const createOnlineSession = (
  tableId: string,
  onConnection: (message: string) => void
) => new OnlineBowlingSession(tableId, onConnection);
export default function RoyalLanes() {
  const [params] = useSearchParams(),
    navigate = useNavigate();
  const session = useRef<BowlingSession | null>(null);
  const mode = params.get('mode') === 'online' ? 'online' : 'ai';
  const difficulty = ['casual', 'club', 'pro'].includes(
    params.get('difficulty') || ''
  )
    ? params.get('difficulty')!
    : 'club';
  const exit = useCallback(() => {
    session.current?.leave?.();
    if (mode === 'online') {
      try {
        sessionStorage.removeItem('royallanes-match');
      } catch {}
    }
    navigate('/games/royallanes/lobby');
  }, [navigate, mode]);
  useTelegramBackButton(exit);
  return (
    <RoyalLanesGame
      createOnlineSession={createOnlineSession}
      soundEnabled={!isGameMuted()}
      mode={mode}
      tableId={params.get('tableId') || ''}
      difficulty={difficulty}
      playerName={getTelegramFirstName() || 'You'}
      onExit={exit}
      onSession={(s) => {
        session.current = s;
      }}
    />
  );
}
