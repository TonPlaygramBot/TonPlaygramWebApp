import { Link, useLocation, useNavigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { unifiedEntry } from '../../games/blackwater-november/unifiedEntry.mjs';
import { TiranaLoading } from '../../games/blackwater-november/TiranaLoading';
import { GameModeBoundary } from '../../games/shared/GameModeBoundary';
import { PlayerPicker } from '../../games/tiranastreets-november/PlayerPicker';
import { selectedPlayerAsset } from '../../games/tiranastreets-november/playerCatalog.mjs';
import { loadGameMode } from '../../games/blackwater-november/loadGameMode';
import { useEffect, useState } from 'react';
import { warmSoloCity } from '../../games/tiranastreets-november/soloCityWarmup.mjs';

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
  const online = new URLSearchParams(search).get('mode') === 'online';
  useEffect(() => {
    if (!playerReady || online) return;
    const controller = new AbortController();
    void warmSoloCity({signal: controller.signal, connection: navigator.connection});
    return () => controller.abort();
  }, [playerReady, online]);
  if (online) {
    return <main><p role="status">Online matches are unavailable in this restored version.</p>
      <Link to="/games/tiranastreets/lobby">Return to Tirana Streets lobby</Link>
    </main>;
  }
  if (!playerReady) return <PlayerPicker onStart={() => setPlayerReady(true)} onBack={onExit} />;
  return <GameModeBoundary onBack={onExit}><Suspense fallback={<TiranaLoading onBack={onExit} />}>
    <StreetCareer key={operation ?? 'city'} onExit={onExit} initialOperation={operation} initialDifficulty={difficulty} />
  </Suspense></GameModeBoundary>;
}
