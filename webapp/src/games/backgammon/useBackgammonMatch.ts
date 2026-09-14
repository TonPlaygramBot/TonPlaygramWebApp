import { useEffect, useRef, useState } from 'react';
import { pickAiSequence, scorePosition } from '../../utils/tavullEngine.js';
import {
  createMatch,
  openingRoll,
  rollTurn,
  playMove,
  endTurn,
  offerDouble,
  answerDouble,
  nextGame,
  canDouble,
  rollDie,
  otherSide
} from './match.mjs';

// Rules state advances only after its presentation promise settles. An epoch
// invalidates every pending action on reset/unmount; a ref blocks double taps.
export function useBackgammonMatch(
  sceneRef: any,
  sound: (kind: 'dice' | 'piece' | 'win') => void,
  localSide: 'white' | 'black' = 'white'
) {
  const aiSide = otherSide(localSide);
  const openingMessage = `Opening roll: each player throws one die. You play ${localSide === 'white' ? 'red' : 'cyan'}.`;
  const [match, setMatch] = useState(() => createMatch());
  const current = useRef(match);
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const epoch = useRef(0);
  const [message, setMessage] = useState(openingMessage);
  const commit = (next: any) => {
    current.current = next;
    setMatch(next);
    return next;
  };
  const run = async (work: (valid: () => boolean) => Promise<void>) => {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    const ticket = epoch.current;
    const valid = () => ticket === epoch.current;
    try {
      await work(valid);
    } catch (error) {
      if (valid()) {
        console.error(error);
        setMessage('The action could not finish. Please try again.');
      }
    } finally {
      if (valid()) {
        locked.current = false;
        setBusy(false);
      }
    }
  };
  const showResult = (state: any) => {
    if (!state.result) return false;
    sound('win');
    setMessage(
      `${state.result.winner === localSide ? 'You win' : 'AI wins'} · ${state.result.kind} · ${state.result.points} point${state.result.points === 1 ? '' : 's'}`
    );
    return true;
  };
  const animateMove = async (state: any, move: any, valid: () => boolean) => {
    const completed = await sceneRef.current?.animateCheckerMove?.(
      state.board,
      state.turn,
      move
    );
    if (!valid()) return state;
    if (completed === false)
      throw new Error('Checker presentation was interrupted');
    sound('piece');
    const next = commit(playMove(state, move));
    // React must rebuild the committed board before the AI can pick its next
    // checker (especially repeated moves of one checker or doubles from a stack).
    await sceneRef.current?.waitForBoard?.(next.board);
    return next;
  };
  const finishTurn = (state: any) => {
    if (showResult(state)) return state;
    if (!state.sequences.length) state = commit(endTurn(state));
    setMessage(
      state.turn === localSide
        ? 'Your turn. Roll the dice or offer a double.'
        : 'AI is preparing its turn…'
    );
    return state;
  };
  const roll = () =>
    run(async (valid) => {
      let state = current.current;
      if (
        !['opening', 'roll'].includes(state.phase) ||
        (state.phase === 'roll' && state.turn !== localSide)
      )
        return;
      const rolls = [rollDie(), rollDie()];
      const opening = state.phase === 'opening';
      setMessage(
        opening ? 'One opening die each…' : 'Picking up and throwing the dice…'
      );
      sound('dice');
      if (opening) {
        const localDie = localSide === 'white' ? 0 : 1;
        await sceneRef.current?.animateDiceThrow?.([rolls[localDie]], 0, [
          localDie
        ]);
        if (!valid()) return;
        await sceneRef.current?.animateDiceThrow?.([rolls[1 - localDie]], 1, [
          1 - localDie
        ]);
      } else await sceneRef.current?.animateDiceThrow?.(rolls, 0);
      if (!valid()) return;
      state = commit(
        opening ? openingRoll(state, rolls) : rollTurn(state, rolls)
      );
      if (state.phase === 'opening') {
        setMessage(`Both rolled ${rolls[0]}. Roll again.`);
        return;
      }
      if (state.turn === localSide) {
        if (!state.sequences.length) {
          setMessage('No legal move. Turn passes to AI.');
          finishTurn(state);
        } else
          setMessage(
            `You rolled ${rolls.join(' / ')}. Choose a checker, then its destination.`
          );
      } else setMessage(`AI wins the opening roll ${rolls.join(' / ')}.`);
    });
  const move = (selected: any) =>
    run(async (valid) => {
      let state = current.current;
      if (state.turn !== localSide || state.phase !== 'move') return;
      // Validate before any visible movement.
      playMove(state, selected);
      setMessage('Picking up and placing your checker…');
      state = await animateMove(state, selected, valid);
      if (!valid()) return;
      if (state.phase === 'over' || !state.sequences.length) finishTurn(state);
      else
        setMessage('Choose your next move. Every playable die must be used.');
    });
  const double = () => {
    if (!locked.current && canDouble(current.current, localSide))
      commit(offerDouble(current.current));
  };
  const respond = (accept: boolean) => {
    if (locked.current) return;
    const state = commit(answerDouble(current.current, localSide, accept));
    showResult(state);
  };
  useEffect(() => {
    if (busy || locked.current) return;
    const state = current.current;
    if (state.phase === 'double' && state.offeredBy === localSide) {
      void run(async (valid) => {
        const accepted = scorePosition(state.board, aiSide) > -100;
        if (!valid()) return;
        const next = commit(answerDouble(state, aiSide, accepted));
        if (!showResult(next))
          setMessage('AI accepts. The cube belongs to AI. Roll your dice.');
      });
      return;
    }
    if (state.turn !== aiSide || !['roll', 'move'].includes(state.phase))
      return;
    void run(async (valid) => {
      let next: any = state;
      if (state.phase === 'roll') {
        if (canDouble(state) && scorePosition(state.board, aiSide) > 75) {
          commit(offerDouble(state));
          setMessage('AI offers a double. Take or drop?');
          return;
        }
        const rolls = [rollDie(), rollDie()];
        setMessage('AI picks up and throws the dice…');
        sound('dice');
        await sceneRef.current?.animateDiceThrow?.(rolls, 1);
        if (!valid()) return;
        next = commit(rollTurn(state, rolls));
      }
      if (next.sequences.length) {
        const choice: any = pickAiSequence(next.board, next.dice, aiSide);
        // Opening and remaining legal suffixes remain the authoritative options.
        const sequence =
          next.sequences.find(
            (s: any) => JSON.stringify(s.line) === JSON.stringify(choice?.line)
          ) || next.sequences[0];
        for (const selected of sequence.line) {
          if (!valid()) return;
          setMessage('AI picks up and places a checker…');
          next = await animateMove(next, selected, valid);
          if (!valid() || next.phase === 'over') break;
        }
      }
      if (valid()) finishTurn(next);
    });
  }, [match, busy]);
  useEffect(
    () => () => {
      epoch.current++;
      locked.current = false;
    },
    []
  );
  const restart = (target = current.current.target) => {
    epoch.current++;
    sceneRef.current?.cancelActions?.();
    locked.current = false;
    setBusy(false);
    commit(createMatch(target));
    setMessage(openingMessage);
  };
  const continueMatch = () => {
    if (locked.current) return;
    commit(nextGame(current.current));
    setMessage('Next game. Roll one opening die each.');
  };
  return {
    match,
    busy,
    message,
    roll,
    move,
    double,
    respond,
    restart,
    continueMatch
  };
}
