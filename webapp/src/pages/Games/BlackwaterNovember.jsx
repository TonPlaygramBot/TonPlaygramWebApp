import { Link, useLocation, useNavigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { unifiedEntry } from '../../games/blackwater-november/unifiedEntry.mjs';
import { TiranaLoading } from '../../games/blackwater-november/TiranaLoading';
import { GameModeBoundary } from '../../games/shared/GameModeBoundary';
import { PlayerPicker } from '../../games/tiranastreets-november/PlayerPicker';
import { selectedPlayerAsset } from '../../games/tiranastreets-november/playerCatalog.mjs';
import { loadGameMode } from '../../games/blackwater-november/loadGameMode';
import { useState } from 'react';

const StreetCareer = lazy(() => loadGameMode('street-career', () =>
  import('../../games/tiranastreets-november/street-career/StreetCareerGame')
    .then(m => ({ default: m.StreetCareerGame }))
));

export default function BlackwaterNovember() {
  const { search } = useLocation();
  const navigate = useNavigate();
  const [playerReady, setPlayerReady] = useState(() => !!selectedPlayerAsset());
  const onExit = () => navigate('/games/tiranastreets/lobby');
  const { operation, difficulty } = unifiedEntry(search);
  if (new URLSearchParams(search).get('mode') === 'online') {
    return <main><p role="status">Online matches are unavailable in this restored version.</p>
      <Link to="/games/tiranastreets/lobby">Return to Tirana Streets lobby</Link>
    </main>;
  }
  if (!playerReady) return <PlayerPicker onStart={() => setPlayerReady(true)} onBack={onExit} />;
  return <GameModeBoundary onBack={onExit}><Suspense fallback={<TiranaLoading onBack={onExit} />}>
    <StreetCareer key={operation ?? 'city'} onExit={onExit} initialOperation={operation} initialDifficulty={difficulty} />
  </Suspense></GameModeBoundary>;
}
