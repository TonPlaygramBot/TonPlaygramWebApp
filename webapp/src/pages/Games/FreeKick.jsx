import { useLocation } from 'react-router-dom';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import FreeKick3DGame from '../../components/FreeKick3DGame.jsx';
import { addTransaction, depositAccount } from '../../utils/api.js';

function simulateRoundAI(st, round) {
  const next = st.rounds[round + 1];
  const { userSeed } = st;
  st.rounds[round].forEach((pair, idx) => {
    if (pair.includes(userSeed)) return;
    if (next && next[Math.floor(idx / 2)][idx % 2]) return;
    const [s1, s2] = pair;
    const p1 = st.seedToPlayer[s1];
    const p2 = st.seedToPlayer[s2];
    let winnerSeed;
    if (p1 && p1.name === 'BYE') winnerSeed = s2;
    else if (p2 && p2.name === 'BYE') winnerSeed = s1;
    else winnerSeed = Math.random() < 0.5 ? s1 : s2;
    if (next) {
      next[Math.floor(idx / 2)][idx % 2] = winnerSeed;
    } else {
      st.championSeed = winnerSeed;
      st.complete = true;
    }
  });
}

function simulateRemaining(st, startRound) {
  for (let r = startRound; r < st.rounds.length; r += 1) {
    simulateRoundAI(st, r);
    if (st.complete) break;
  }
  st.currentRound = st.rounds.length - 1;
  st.complete = true;
}

function buildConfig(search) {
  const params = new URLSearchParams(search);
  const duration = params.get('duration');
  const playerName =
    params.get('name') || params.get('username') || params.get('player') || '';
  return {
    playType: params.get('type') || 'regular',
    tgKey: params.get('tgId') || 'anon',
    tournamentPlayers: Number(params.get('players') || '0'),
    stakeAmount: Number(params.get('amount') || '0'),
    token: params.get('token') || 'TPC',
    tgId: params.get('tgId') || undefined,
    accountId: params.get('accountId') || undefined,
    devAccount: params.get('dev') || undefined,
    devAccount1: params.get('dev1') || undefined,
    devAccount2: params.get('dev2') || undefined,
    searchString: params.toString(),
    duration: duration ? Number(duration) : undefined,
    playerName: playerName || undefined
  };
}

export default function FreeKick() {
  useTelegramBackButton();
  const { search } = useLocation();
  const [liveScore, setLiveScore] = useState(0);
  const [opponentScore, setOpponentScore] = useState(0);
  const [gameComplete, setGameComplete] = useState(false);
  const [currentRound, setCurrentRound] = useState(0);
  const opponentTargetRef = useRef(null);
  const opponentIntervalRef = useRef(null);
  const configRef = useRef(null);
  const config = useMemo(() => buildConfig(search), [search]);
  configRef.current = config;
  const isTournament = config.playType === 'tournament';
  const stateKey = useMemo(
    () => `freeKickTournamentState_${config.tgKey}`,
    [config.tgKey]
  );
  const opponentKey = useMemo(
    () => `freeKickTournamentOpponent_${config.tgKey}`,
    [config.tgKey]
  );
  const searchSuffix = config.searchString ? `?${config.searchString}` : '';

  const opponentName = useMemo(() => {
    if (!isTournament) return '';
    try {
      const saved = JSON.parse(localStorage.getItem(opponentKey) || '{}');
      return saved.name || saved.flag || 'CPU Rival';
    } catch {
      return 'CPU Rival';
    }
  }, [isTournament, opponentKey]);

  useEffect(() => {
    if (!isTournament) return undefined;
    try {
      const st = JSON.parse(localStorage.getItem(stateKey) || '{}');
      setCurrentRound(st.currentRound || 0);
    } catch {
      setCurrentRound(0);
    }
  }, [isTournament, stateKey]);

  useEffect(() => {
    if (!isTournament || gameComplete) return undefined;
    const duration = config.duration || 60;
    const base = duration * 1.4 + currentRound * 24;
    const spread = Math.max(18, duration * 0.6);
    const target = Math.max(
      10,
      Math.round(base + (Math.random() - 0.5) * spread)
    );
    opponentTargetRef.current = target;
    setOpponentScore(0);
    const tick = () => {
      setOpponentScore((prev) => {
        const maxScore = opponentTargetRef.current ?? prev;
        if (gameComplete || prev >= maxScore) return prev;
        const step = Math.max(1, Math.round((maxScore - prev) * 0.08));
        return Math.min(maxScore, prev + step);
      });
    };
    opponentIntervalRef.current = window.setInterval(tick, 2200);
    return () => {
      if (opponentIntervalRef.current) {
        clearInterval(opponentIntervalRef.current);
        opponentIntervalRef.current = null;
      }
    };
  }, [config.duration, currentRound, gameComplete, isTournament]);

  useEffect(() => {
    if (!gameComplete || !opponentIntervalRef.current) return undefined;
    clearInterval(opponentIntervalRef.current);
    opponentIntervalRef.current = null;
    return undefined;
  }, [gameComplete]);

  const resolveTournamentResult = useCallback(
    async (playerWon) => {
      if (!isTournament) return;
      const { stakeAmount, accountId, tgId, devAccount, devAccount1, devAccount2 } =
        configRef.current || {};
      try {
        const st = JSON.parse(localStorage.getItem(stateKey) || '{}');
        if (!st.pendingMatch) {
          window.location.href = `/free-kick-bracket.html${searchSuffix}`;
          return;
        }
        const { round: r, match: m, pair } = st.pendingMatch;
        const oppSeed = pair[0] === st.userSeed ? pair[1] : pair[0];
        const winnerSeed = playerWon ? st.userSeed : oppSeed;
        const next = st.rounds[r + 1];
        if (next) {
          next[Math.floor(m / 2)][m % 2] = winnerSeed;
        } else {
          st.championSeed = winnerSeed;
          st.complete = true;
        }
        if (winnerSeed !== st.userSeed) {
          simulateRemaining(st, r);
        } else {
          simulateRoundAI(st, r);
          if (
            next &&
            st.rounds[r].every((_, idx) => next[Math.floor(idx / 2)][idx % 2])
          ) {
            st.currentRound += 1;
          }
        }
        if (st.complete && winnerSeed === st.userSeed && stakeAmount > 0 && accountId) {
          const total = stakeAmount * (configRef.current?.tournamentPlayers || 0);
          const prize = Math.round(total * 0.91);
          const ops = [depositAccount(accountId, prize, { game: 'freekick-win' })];
          if (tgId) {
            ops.push(
              addTransaction(tgId, 0, 'win', {
                game: 'freekick',
                players: configRef.current?.tournamentPlayers || 0,
                accountId
              })
            );
          }
          if (devAccount1 || devAccount2) {
            if (devAccount) ops.push(depositAccount(devAccount, Math.round(total * 0.09), { game: 'freekick-dev' }));
            if (devAccount1)
              ops.push(
                depositAccount(devAccount1, Math.round(total * 0.01), {
                  game: 'freekick-dev1'
                })
              );
            if (devAccount2)
              ops.push(
                depositAccount(devAccount2, Math.round(total * 0.02), {
                  game: 'freekick-dev2'
                })
              );
          } else if (devAccount) {
            ops.push(
              depositAccount(devAccount, Math.round(total * 0.1), {
                game: 'freekick-dev'
              })
            );
          }
          if (ops.length) await Promise.allSettled(ops);
        }
        delete st.pendingMatch;
        localStorage.setItem(stateKey, JSON.stringify(st));
        localStorage.removeItem(opponentKey);
      } catch (err) {
        console.error(err);
      }
      window.location.href = `/free-kick-bracket.html${searchSuffix}`;
    },
    [isTournament, opponentKey, searchSuffix, stateKey]
  );

  const handleComplete = useCallback(
    ({ score, shots, goals }) => {
      setLiveScore(score);
      setGameComplete(true);
      const rivalScore = opponentTargetRef.current ?? opponentScore;
      setOpponentScore(rivalScore);
      try {
        localStorage.setItem(
          `freeKickLastResult_${configRef.current?.tgKey || 'anon'}`,
          JSON.stringify({ p1: score, p2: rivalScore, shots, goals })
        );
      } catch {}
      if (isTournament) {
        resolveTournamentResult(score >= rivalScore);
      }
    },
    [isTournament, opponentScore, resolveTournamentResult]
  );

  return (
    <div className="relative h-[100dvh] w-full bg-[#07130f]">
      {isTournament && (
        <div className="pointer-events-none absolute left-4 right-4 top-4 z-20 grid grid-cols-2 gap-3 text-xs sm:text-sm">
          <div className="rounded-xl bg-black/45 px-3 py-2">
            <div className="text-[10px] uppercase tracking-wide text-white/60">You</div>
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-semibold">{config.playerName || 'Player'}</span>
              <span className="text-lg font-bold">{liveScore}</span>
            </div>
          </div>
          <div className="rounded-xl bg-black/45 px-3 py-2 text-right">
            <div className="text-[10px] uppercase tracking-wide text-white/60">Opponent</div>
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-semibold">{opponentName}</span>
              <span className="text-lg font-bold">{opponentScore}</span>
            </div>
          </div>
        </div>
      )}
      <FreeKick3DGame
        config={config}
        disableRestart={isTournament}
        onComplete={handleComplete}
        onScoreChange={setLiveScore}
      />
    </div>
  );
}
