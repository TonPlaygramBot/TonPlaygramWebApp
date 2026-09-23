/** Fixed 60 Hz physics with bounded catch-up. An overloaded frame must not
 * schedule an ever-growing physics burst before the next touch/render pass. */
export function fixedStepBudget(pending, delta, maxSteps = 4, hz = 60) {
  const step = 1 / hz;
  const total = Math.max(0, Number.isFinite(pending) ? pending : 0) +
    Math.max(0, Number.isFinite(delta) ? delta : 0);
  const due = Math.floor((total + 1e-9) / step);
  const steps = Math.min(due, maxSteps);
  return { steps, step, remainder: Math.max(0, total - due * step), dropped: (due - steps) * step };
}

/** Stable nearest K without repeated square roots inside a full-list sort.
 * The small sorted result is bounded by the render budget, never population. */
export function nearestActors(items, viewer, radius, limit, eligible = () => true) {
  if (!viewer || !Number.isFinite(viewer.x) || !Number.isFinite(viewer.z) || limit <= 0) return [];
  const selected = [], max = radius * radius;
  for (const entity of items) {
    if (!eligible(entity)) continue;
    const distance = (entity.x - viewer.x) ** 2 + (entity.z - viewer.z) ** 2;
    if (!(distance < max)) continue;
    const last = selected[selected.length - 1];
    if (selected.length === limit && (distance > last.distance ||
      distance === last.distance && String(entity.id).localeCompare(String(last.entity.id)) >= 0)) continue;
    let lo = 0, hi = selected.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1, other = selected[mid];
      if (distance > other.distance || distance === other.distance &&
        String(entity.id).localeCompare(String(other.entity.id)) > 0) lo = mid + 1;
      else hi = mid;
    }
    selected.splice(lo, 0, { entity, distance });
    if (selected.length > limit) selected.pop();
  }
  return selected.map(item => item.entity);
}
