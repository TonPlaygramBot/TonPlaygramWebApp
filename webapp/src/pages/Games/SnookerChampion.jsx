import SnookerRoyalProvided from './SnookerRoyalProvided.jsx';

export default function SnookerChampion() {
  // Keep Snooker Champion mounted on the Snooker Royal scene implementation so
  // the GLB table, ball rack, table mapping, camera rig, broadcast flow, power,
  // and spin physics stay identical between the two games.
  return <SnookerRoyalProvided gameTitle="Snooker Champion" />;
}
