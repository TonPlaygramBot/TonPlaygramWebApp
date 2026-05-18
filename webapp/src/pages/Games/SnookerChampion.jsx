import SnookerRoyal from './SnookerRoyal.jsx';

export default function SnookerChampion() {
  // Snooker Champion now runs on the full Snooker Royal scene implementation so
  // gameplay, table rendering, scoring, camera, replay, AI, training, and HUD
  // parity stay maintained from one shared JSX source.
  return (
    <SnookerRoyal
      gameTitle="Snooker Champion"
      routeSlug="snookerchampion"
      lobbyPath="/games/snookerchampion/lobby"
      tournamentStoragePrefix="snookerChampion"
      tournamentBracketPath="/snooker-champion-bracket.html"
    />
  );
}
