export function simulateRoundAI(st, round) {
  const next = st.rounds[round + 1];
  const userSeed = st.userSeed;
  st.rounds[round].forEach((pair, idx) => {
    if (pair.includes(userSeed)) return;
    if (next && next[Math.floor(idx / 2)][idx % 2]) return;
    const s1 = pair[0];
    const s2 = pair[1];
    const p1 = st.seedToPlayer[s1];
    const p2 = st.seedToPlayer[s2];
    let w;
    if (p1 && p1.name === 'BYE') w = s2;
    else if (p2 && p2.name === 'BYE') w = s1;
    else w = Math.random() < 0.5 ? s1 : s2;
    if (next) {
      next[Math.floor(idx / 2)][idx % 2] = w;
    } else {
      st.championSeed = w;
      st.complete = true;
    }
  });
}

export function simulateRemaining(st, startRound) {
  for (let r = startRound; r < st.rounds.length; r++) {
    simulateRoundAI(st, r);
    if (st.complete) break;
  }
  st.currentRound = st.rounds.length - 1;
  st.complete = true;
}

export async function handleTournamentResult(winner, opts) {
  const {
    stateKey,
    oppKey,
    bracketPage,
    stake = 0,
    players = 0,
    accountId,
    awardPrize
  } = opts;
  try {
    const st = JSON.parse(localStorage.getItem(stateKey) || '{}');
    if (!st.pendingMatch) {
      window.location.href = `${bracketPage}?${window.location.search.slice(1)}`;
      return;
    }
    const r = Number(st.pendingMatch.round);
    const m = Number(st.pendingMatch.match);
    if (typeof st.currentRound === 'number' && st.currentRound !== r) {
      window.location.href = `${bracketPage}?${window.location.search.slice(1)}`;
      return;
    }
    const pair = st.rounds && st.rounds[r] && st.rounds[r][m];
    if (
      !pair ||
      Number(pair[0]) !== Number(st.pendingMatch.pair[0]) ||
      Number(pair[1]) !== Number(st.pendingMatch.pair[1])
    ) {
      window.location.href = `${bracketPage}?${window.location.search.slice(1)}`;
      return;
    }
    const userSeedNum = Number(st.userSeed);
    const oppSeed = Number(
      st.pendingMatch.pair[0] === st.userSeed
        ? st.pendingMatch.pair[1]
        : st.pendingMatch.pair[0]
    );
    const winnerSeed = Number(winner) === 1 ? userSeedNum : oppSeed;
    const next = st.rounds[r + 1];
    if (next) {
      next[Math.floor(m / 2)][m % 2] = winnerSeed;
    } else {
      st.championSeed = winnerSeed;
      st.complete = true;
    }
    if (winnerSeed !== userSeedNum) {
      simulateRemaining(st, r);
    } else {
      simulateRoundAI(st, r);
      if (
        next &&
        st.rounds[r].every((p, idx) => next[Math.floor(idx / 2)][idx % 2])
      ) {
        st.currentRound++;
      }
    }
    if (st.complete && winnerSeed === userSeedNum && stake > 0 && accountId) {
      const total = stake * players;
      if (typeof awardPrize === 'function') {
        try {
          await awardPrize(total);
        } catch {
          // ignore payout errors
        }
      }
    }
    delete st.pendingMatch;
    localStorage.setItem(stateKey, JSON.stringify(st));
    if (oppKey) localStorage.removeItem(oppKey);
  } catch (err) {
    console.error(err);
  }
  window.location.href = `${bracketPage}?${window.location.search.slice(1)}`;
}
