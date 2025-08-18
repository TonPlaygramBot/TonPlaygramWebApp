// Basic Texas Hold'em decision helpers based on simplified EV rules.
// The goal is to provide a lightweight guide for an AI player to choose
// between fold/call/check/raise using hand groups and percentages.

// 1. Pot odds helper
export function potOdds(toCall, pot) {
  return toCall / (pot + toCall);
}

// 2. Pre-flop strategy using four hand groups (A–D)
// Frequencies are derived from the provided guide.
const PREFLOP_GROUPS = {
  A: { raise: 0.85, call: 0.15, fold: 0 }, // Premium
  B: { raise: 0.6, call: 0.35, fold: 0.05 }, // Strong
  C: { raise: 0.2, call: 0.6, fold: 0.2 }, // Speculative suited
  D: { raise: 0.1, call: 0.1, fold: 0.8 }, // Weak offsuit
};

export function preflopAction(group, rng = Math.random()) {
  const freqs = PREFLOP_GROUPS[group] || PREFLOP_GROUPS.D;
  if (rng < freqs.raise) return 'raise';
  if (rng < freqs.raise + freqs.call) return 'call';
  return 'fold';
}

// 3. Post-flop decision based on equity vs. pot odds.
// Position adjusts thresholds: OOP is tighter (+0.02), IP looser (-0.02).
export function postflopDecision({ equity, potOdds, position = 'IP', free = false }) {
  const adjust = position === 'OOP' ? 0.02 : position === 'IP' ? -0.02 : 0;
  const foldThresh = potOdds - 0.03 + adjust;
  const raiseThresh = potOdds + 0.06 + adjust;
  if (equity < foldThresh) return free ? 'check' : 'fold';
  if (equity > raiseThresh) return 'raise';
  return free ? 'check' : 'call';
}

export default {
  potOdds,
  preflopAction,
  postflopDecision,
};
