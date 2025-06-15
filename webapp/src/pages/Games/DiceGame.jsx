import { useEffect, useState, useMemo, useRef } from 'react';
import diceSoundBase64 from '../../assets/diceSound.js';

import ConnectWallet from '../../components/ConnectWallet.jsx';

import RoomPopup from '../../components/RoomPopup.jsx';

import RollPopup from '../../components/RollPopup.jsx';

import GameResult from '../../components/GameResult.jsx';

import Board from '../../components/Board.jsx';

const opponents = [

  'CryptoKing',

  'BlockQueen',

  'MetaMage',

  'ChainMaster',

  'TokenGuru'

];

function randomInt(min, max) {

  return Math.floor(Math.random() * (max - min + 1)) + min;

}

export default function DiceGame() {

  const [selection, setSelection] = useState(null);

  const [showRoom, setShowRoom] = useState(true);

  const [phase, setPhase] = useState('lobby');

  const [timer, setTimer] = useState(3);

  const [playerDice, setPlayerDice] = useState([1, 1]);

  const [oppDice, setOppDice] = useState([1, 1]);

  const [rolling, setRolling] = useState(false);

  const [result, setResult] = useState(null);

  const [playerPos, setPlayerPos] = useState(1);

  const [oppPos, setOppPos] = useState(1);

  const [lobbyCount, setLobbyCount] = useState(1);

  const [ready, setReady] = useState(false);
  const [showRoll, setShowRoll] = useState(false);
  const diceSoundRef = useRef(null);

  const opponent = useMemo(() => {

    const name = opponents[randomInt(0, opponents.length - 1)];

    return { name, avatar: '/assets/icons/profile.svg', balance: randomInt(50, 500) };

  }, [phase]);

  useEffect(() => {
    if (phase === 'playing' && !rolling && !result) {
      setShowRoll(true);
    }
  }, [phase, rolling, result]);

  useEffect(() => {
    diceSoundRef.current = new Audio(diceSoundBase64);
    diceSoundRef.current.preload = "auto";
    return () => {
      diceSoundRef.current?.pause();
    };
  }, []);

  // Simulate lobby filling

  useEffect(() => {

    if (phase === 'waiting') {

      setLobbyCount(1);

      setReady(false);

      const lobbyInterval = setInterval(() => {

        setLobbyCount((c) => {

          const change = Math.random() > 0.7 ? 1 : Math.random() > 0.95 ? -1 : 0;

          const next = Math.max(1, c + change);

          if (next >= 2) setReady(true);

          return next;

        });

      }, 1000);

      return () => clearInterval(lobbyInterval);

    }

  }, [phase]);

  // Start countdown once lobby is full

  useEffect(() => {

    if (phase === 'waiting' && ready) {

      setTimer(3);

      const id = setInterval(() => {

        setTimer((t) => {

          if (t <= 1) {

            clearInterval(id);

            setPhase('playing');

            return 0;

          }

          return t - 1;

        });

      }, 1000);

      return () => clearInterval(id);

    }

  }, [phase, ready]);

  const startGame = () => {

    setShowRoom(false);

    setPlayerPos(1);

    setOppPos(1);

    setResult(null);

    setLobbyCount(1);

    setReady(false);

    setPhase('waiting');

  };

  const roll = () => {
    if (rolling) return;
    setRolling(true);
    setShowRoll(false);
    if (diceSoundRef.current) {
      diceSoundRef.current.currentTime = 0;
      diceSoundRef.current.play().catch(() => {});
    }

    const pd1 = randomInt(1, 6);
    const pd2 = randomInt(1, 6);
    const od1 = randomInt(1, 6);
    const od2 = randomInt(1, 6);
    setPlayerDice([pd1, pd2]);
    setOppDice([od1, od2]);

    const movePiece = (start, steps, setter) => {
      let current = start;
      const target = Math.min(start + steps, 100);
      const id = setInterval(() => {
        current += 1;
        setter(current);
        if (current >= target) clearInterval(id);
      }, 200);
    };

    movePiece(playerPos, pd1 + pd2, setPlayerPos);
    movePiece(oppPos, od1 + od2, setOppPos);

    const newPlayer = Math.min(playerPos + pd1 + pd2, 100);
    const newOpp = Math.min(oppPos + od1 + od2, 100);

    setTimeout(() => {
      setRolling(false);
      if (newPlayer >= 100 && newOpp >= 100) {
        setResult({ outcome: 'draw', pot: selection.amount * 2 });
        setPhase('result');
      } else if (newPlayer >= 100) {
        setResult({ outcome: 'win', pot: selection.amount * 2 });
        setPhase('result');
      } else if (newOpp >= 100) {
        setResult({ outcome: 'lose', pot: selection.amount * 2 });
        setPhase('result');
      } else {
        setShowRoll(true);
      }
    }, Math.max(pd1 + pd2, od1 + od2) * 200 + 500);
  };


  const rematch = () => {

    setResult(null);

    setPlayerPos(1);

    setOppPos(1);

    setLobbyCount(1);

    setReady(false);

    setPhase('waiting');

  };

  return (

    <div className="p-4 space-y-4 text-text">

      <h2 className="text-xl font-bold">Dice Duel</h2>

      <RoomPopup

        open={showRoom}

        selection={selection}

        setSelection={setSelection}

        onConfirm={startGame}

      />

      <ConnectWallet />

      {phase === 'waiting' && (

        <div className="text-center space-y-1 text-subtext">

          <p>Players in lobby: {lobbyCount}</p>

          {!ready ? (

            <p>Waiting for opponent...</p>

          ) : (

            <p>Opponent joined! Starting in {timer}</p>

          )}

        </div>

      )}

      {phase === 'playing' && (
        <div className="space-y-4">
          <div className="flex justify-between text-sm font-semibold">
            <span>You: tile {playerPos}</span>
            <span>{opponent.name}: tile {oppPos}</span>
          </div>
          <Board
            playerPos={playerPos}
            opponentPos={oppPos}
            opponentAvatar={opponent.avatar}
          />
        </div>
      )}
      <RollPopup
        open={showRoll}
        avatar={'/assets/icons/profile.svg'}
        onRoll={roll}
        rolling={rolling}
        diceValues={playerDice}
      />


      <GameResult result={result} onRematch={rematch} />

    </div>

  );

}