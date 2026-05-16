import SnookerRoyal from './SnookerRoyal.jsx';

export default function SnookerChampion() {
  return (
    <SnookerRoyal
      gameSlug="snookerchampion"
      lobbyPath="/games/snookerchampion/lobby"
      bracketPath="/snooker-champion-bracket.html"
      gameTitle="Snooker Champion"
      rulesTitle="Snooker Champion Rules"
      arenaName="Snooker Champion arena"
      tournamentStoragePrefix="snookerChampion"
      useProvidedSnookerAssets
    />
  );
}
