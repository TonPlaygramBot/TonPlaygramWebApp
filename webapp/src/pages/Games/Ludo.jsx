import React, { useState, useEffect, useRef } from "react";
import { Ludo, initializeTokenPosition } from "@ayshrj/ludo.js";
import DiceRoller from "../../components/DiceRoller.jsx";
import PlayerToken from "../../components/PlayerToken.jsx";

const COLOR_MAP = {
  red: "#ef4444",
  green: "#4ade80",
  yellow: "#fde047",
  blue: "#60a5fa",
};

const COLOR_ORDER = ["blue", "red", "green", "yellow"];

export default function LudoPage() {
  const [ludo, setLudo] = useState(null);
  const [state, setState] = useState({
    turn: "blue",
    ranking: [],
    tokenPositions: initializeTokenPosition(),
    boardStatus: "",
    diceRoll: null,
    lastDiceRoll: null,
    gameState: "playerHasToRollADice",
    players: COLOR_ORDER,
  });

  const boardRef = useRef(null);

  useEffect(() => {
    const game = new Ludo(4);
    game.players = COLOR_ORDER;
    game.reset();
    setState(game.getCurrentState());
    setLudo(game);
    const handle = (s) => setState({ ...s });
    game.on("stateChange", handle);
    return () => game.off("stateChange", handle);
  }, []);

  const handleRoll = () => {
    if (!ludo) return;
    if (state.gameState !== "playerHasToRollADice") return;
    ludo.rollDiceForCurrentPiece();
  };

  const handleTokenClick = (color, index) => {
    if (!ludo) return;
    if (color !== state.turn) return;
    if (!ludo.validTokenIndices.includes(index)) return;
    ludo.selectToken(index);
  };

  const cellTokens = (row, col) => {
    if (!ludo) return [];
    const tokens = [];
    state.players.forEach((color) => {
      state.tokenPositions[color].forEach((pos, i) => {
        if (pos !== -1) {
          const [r, c] = ludo.colorPaths[color][pos];
          if (r === row && c === col) tokens.push({ color, index: i });
        }
      });
    });
    return tokens;
  };

  const renderBoard = () => {
    if (!ludo) return null;
    return (
      <div
        ref={boardRef}
        className="relative grid grid-cols-15 grid-rows-15 gap-px bg-gray-300"
        style={{ width: "90vmin", height: "90vmin" }}
      >
        {ludo.board.map((row, ri) =>
          row.map((cell, ci) => {
            const tokens = cellTokens(ri, ci);
            return (
              <div
                key={`${ri}-${ci}`}
                className="relative flex items-center justify-center bg-white"
                style={{ border: "1px solid #ccc" }}
              >
                {tokens.map((t, i) => (
                  <div
                    key={i}
                    onClick={() => handleTokenClick(t.color, t.index)}
                    style={{ position: "absolute", transform: `translate(${i * 6 - 6}px, ${i * 6 - 6}px)` }}
                  >
                    <PlayerToken color={COLOR_MAP[t.color]} />
                  </div>
                ))}
              </div>
            );
          })
        )}
      </div>
    );
  };

  return (
    <div className="relative p-4 space-y-4 text-text flex flex-col items-center">
      <img src="/assets/SnakeLaddersbackground.png" className="background-behind-board object-cover" alt="" />
      <div className="absolute inset-0 flex justify-center items-center pointer-events-none">
        <img src="/icons/TON.png" alt="logo" className="absolute top-0 w-24" />
        <img src="/icons/TON.png" alt="logo" className="absolute bottom-0 w-24" />
        <img src="/icons/TON.png" alt="logo" className="absolute left-0 h-24" />
        <img src="/icons/TON.png" alt="logo" className="absolute right-0 h-24" />
      </div>
      <h2 className="text-xl font-bold">Ludo Game</h2>
      {renderBoard()}
      <DiceRoller
        onRollEnd={() => {}}
        onRollStart={handleRoll}
        clickable
        numDice={1}
        showButton={false}
      />
      {state.ranking.length === state.players.length && (
        <div className="text-center font-bold">Game Over</div>
      )}
    </div>
  );
}
