import { useState, useEffect, useRef } from "react";
import DiceRoller from "../../components/DiceRoller.jsx";
import RoomPopup from "../../components/RoomPopup.jsx";
import useTelegramBackButton from "../../hooks/useTelegramBackButton.js";
import { getTelegramPhotoUrl } from "../../utils/telegram.js";
import { getSnakeLobbies } from "../../utils/api.js";

// Snake and ladder layout
const snakes = {
  17: 4, 19: 7, 21: 9, 27: 1, 54: 34,
  62: 18, 64: 60, 87: 24, 93: 73,
  95: 75, 98: 79, 99: 7,
};
const ladders = {
  3: 22, 5: 8, 11: 26, 20: 29,
  27: 56, 36: 44, 51: 67,
  71: 91, 80: 101, // final tile is the Pot
};

function Board({ position, highlight, photoUrl, pot }) {
  const tiles = [];
  for (let r = 0; r < 10; r++) {
    const reversed = r % 2 === 1;
    for (let c = 0; c < 10; c++) {
      const col = reversed ? 9 - c : c;
      const num = r * 10 + col + 1;
      tiles.push(
        <div
          key={num}
          className={`board-cell ${highlight === num ? "highlight" : ""}`}
          style={{ gridRowStart: 10 - r, gridColumnStart: col + 1 }}
        >
          {num}
          {snakes[num] && (
            <div className="absolute inset-0 flex items-center justify-center text-red-500 text-xl pointer-events-none">
              🐍
            </div>
          )}
          {ladders[num] && (
            <div className="absolute inset-0 flex items-center justify-center text-green-500 text-xl pointer-events-none">
              🪜
            </div>
          )}
          {position === num && (
            <img src={photoUrl} alt="player" className="token" />
          )}
        </div>
      );
    }
  }

  const cellWidth = 135;
  const cellHeight = 68;

  return (
    <div className="flex justify-center">
      <div
        className="grid grid-rows-10 grid-cols-10 gap-1 relative"
        style={{
          width: `${cellWidth * 10}px`,
          height: `${cellHeight * 10}px`,
          gridTemplateColumns: `repeat(10, ${cellWidth}px)`,
          gridTemplateRows: `repeat(10, ${cellHeight}px)`,
          '--cell-width': `${cellWidth}px`,
          '--cell-height': `${cellHeight}px`,
        }}
      >
        {tiles}
        <div className={`pot-cell ${highlight === 101 ? 'highlight' : ''}`}>
          <span className="font-bold">Pot</span>
          <span className="text-sm">{pot}</span>
          {position === 101 && (
            <img src={photoUrl} alt="player" className="token" />
          )}
        </div>
      </div>
    </div>
  );
}

e
