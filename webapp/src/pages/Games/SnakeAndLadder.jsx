function Board({ position, highlight, photoUrl, pot }) {
  const containerRef = useRef(null);
  const tiles = [];

  for (let r = 0; r < ROWS; r++) {
    const reversed = r % 2 === 1;
    for (let c = 0; c < COLS; c++) {
      const col = reversed ? COLS - 1 - c : c;
      const num = r * COLS + col + 1;
      tiles.push(
        <div
          key={num}
          data-cell={num}
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

  const cellWidth = 100;
  const cellHeight = 50;
  const topPadding = cellHeight * 5.5;
  const zoom = 1.1 + (position / FINAL_TILE) * 0.5;

  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || position === 0) return;

    const cell = container.querySelector(`[data-cell='${position}']`);
    if (cell) {
      const cRect = container.getBoundingClientRect();
      const cellRect = cell.getBoundingClientRect();
      const offset =
        cellRect.top - cRect.top - cRect.height * CAMERA_OFFSET + cellRect.height / 2;

      const target = Math.min(
        container.scrollHeight - cRect.height,
        Math.max(0, container.scrollTop + offset)
      );

      container.scrollTo({ top: target, behavior: 'smooth' });
    }
  }, [position]);

  return (
    <div className="flex justify-center">
      <div
        ref={containerRef}
        className="overflow-y-auto"
        style={{
          height: '80vh',
          paddingTop: topPadding,
          overscrollBehaviorY: 'none',
        }}
      >
        <div className="snake-board-tilt">
          <div
            className="snake-board-grid grid gap-1 relative"
            style={{
              width: `${cellWidth * COLS}px`,
              height: `${cellHeight * ROWS}px`,
              gridTemplateColumns: `repeat(${COLS}, ${cellWidth}px)`,
              gridTemplateRows: `repeat(${ROWS}, ${cellHeight}px)`,
              '--cell-width': `${cellWidth}px`,
              '--cell-height': `${cellHeight}px`,
              transform: `rotateX(60deg) scale(${zoom})`,
            }}
          >
            {tiles}
            <div className={`pot-cell ${highlight === FINAL_TILE ? 'highlight' : ''}`}>
              <span className="font-bold">Pot</span>
              <span className="text-sm">{pot}</span>
              {position === FINAL_TILE && (
                <img src={photoUrl} alt="player" className="token" />
              )}
            </div>
            <div className="logo-wall-main" />
            <div className="logo-wall-side logo-wall-left" />
            <div className="logo-wall-side logo-wall-right" />
          </div>
        </div>
      </div>
    </div>
  );
}
