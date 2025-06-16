function Board({ position, highlight, photoUrl, pot }) {
  const tiles = [];
  for (let r = 0; r < ROWS; r++) {
    const reversed = r % 2 === 1;
    for (let c = 0; c < COLS; c++) {
      const col = reversed ? COLS - 1 - c : c;
      const num = r * COLS + col + 1;
      tiles.push(
        <div
          key={num}
          className={`board-cell ${highlight === num ? "highlight" : ""}`}
          style={{ gridRowStart: ROWS - r, gridColumnStart: col + 1 }}
        >
          {num}
          {snakes[num] && (
            <div className="absolute inset-0 flex items-center justify-center text-red-500 text-xl pointer-events-none">🐍</div>
          )}
          {ladders[num] && (
            <div className="absolute inset-0 flex items-center justify-center text-green-500 text-xl pointer-events-none">🪜</div>
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
    <div className="flex justify-center overflow-y-auto max-h-screen">
      <div
        className="grid gap-1 relative"
        style={{
          width: `${cellWidth * COLS}px`,
          height: `${cellHeight * ROWS}px`,
          gridTemplateColumns: `repeat(${COLS}, ${cellWidth}px)`,
          gridTemplateRows: `repeat(${ROWS}, ${cellHeight}px)`,
        }}
      >
        {/* Pot above the board */}
        <div
          className={`pot-cell absolute -top-20 left-1/2 transform -translate-x-1/2 ${highlight === FINAL_TILE ? 'highlight' : ''}`}
        >
          <span className="font-bold">Pot</span>
          <span className="text-sm">{pot}</span>
          {position === FINAL_TILE && (
            <img src={photoUrl} alt="player" className="token" />
          )}
        </div>

        {tiles}
      </div>
    </div>
  );
}
