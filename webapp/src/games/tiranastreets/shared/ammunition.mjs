/** Shared arcade inventory limits and quotes. These use street cash only;
 * persistent TPG weapon unlocks stay on the authenticated store API. */
export function reserveCapacity(weapon) {
  if (!weapon || weapon.category === 'melee') return 0;
  const magazines = weapon.radius || ['launcher', 'throwable'].includes(weapon.category) ? 8 : 20;
  return Math.max(0, Math.floor(weapon.magazine || 0)) * magazines;
}

export function ammunitionQuote(weapon, inventory, amount = 'box') {
  const capacity = reserveCapacity(weapon);
  if (!inventory || !capacity || !['mag', 'box', 'max'].includes(amount))
    return { rounds: 0, price: 0, capacity };
  const reserve = Number.isFinite(inventory.reserve) ? Math.max(0, Math.floor(inventory.reserve)) : capacity;
  const missing = Math.max(0, capacity - reserve);
  const rounds = Math.min(missing, amount === 'max' ? missing : weapon.magazine * (amount === 'mag' ? 1 : 3));
  const boxPrice = Math.max(30, Math.round(weapon.price * .2));
  return { rounds, price: rounds ? Math.ceil(rounds * boxPrice / (weapon.magazine * 3)) : 0, capacity };
}
