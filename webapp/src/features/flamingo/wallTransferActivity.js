// A reload would discard native phone file handles and pending download grants.
// Keep this independent of routes so the update checker can consult it too.
export const WALL_TRANSFER_ACTIVITY = 'wall-transfer-activity';
const retained = new Set();

export function retainWallTransfer(key, active) {
  const changed = active ? !retained.has(key) : retained.has(key);
  if (active) retained.add(key);
  else retained.delete(key);
  if (changed && typeof window !== 'undefined') {
    window.dispatchEvent(new Event(WALL_TRANSFER_ACTIVITY));
  }
}

export const hasWallTransfers = () => retained.size > 0;
