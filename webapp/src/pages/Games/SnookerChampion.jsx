import SnookerRoyal from './SnookerRoyal.jsx';

export default function SnookerChampion() {
  // Snooker Champion now mounts the production Snooker Royal arena directly so
  // the GLB table mapping, cloth contact height, table finishes, menus, HUD,
  // power slider, spin controller, avatars, and ball physics are identical.
  return (
    <SnookerRoyal
      lobbyPath="/games/snookerchampion/lobby"
      bracketPath="/snooker-champion-bracket.html"
      documentTitle="Snooker Champion 3D"
    />
  );
}
