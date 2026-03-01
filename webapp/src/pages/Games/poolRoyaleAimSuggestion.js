export const buildPoolSuggestionKey = (plan) => {
  if (!plan || !plan.targetBall) return null;
  const targetId = String(plan.targetBall.id ?? 'unknown');
  const pocketId = String(plan.pocketId ?? 'NA');
  const type = String(plan.type ?? 'pot');
  return `${type}:${targetId}:${pocketId}`;
};

export const shouldApplyPoolSuggestion = ({
  preferAutoAim = false,
  currentKey = null,
  nextKey = null,
  forceRefresh = false
} = {}) => {
  if (preferAutoAim) return true;
  if (forceRefresh) return true;
  if (!nextKey) return currentKey !== null;
  return currentKey !== nextKey;
};
