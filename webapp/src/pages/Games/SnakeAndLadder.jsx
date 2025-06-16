function Board({ position, highlight, photoUrl }) {
  const containerRef = useRef(null);
  const tiles = [];
  for (let r = 0; r < 10; r++) {
    const reversed = r % 2 === 1;
    for (let c = 0; c < 10; c++) {
      const col = reversed ? 9 - c : c;
      const num = r * 10 + col + 1;
      tiles.push(
        <div
          key={num}
          id={`tile-${num}`}
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
        </div>,
      );
    }
  }

  const cellWidth = 135; // px
  const cellHeight = 68; // px

  // ✅ Smooth scroll to active tile
  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current.querySelector(`#tile-${position}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
    }
  }, [position]);

  return (
    <div
      ref={containerRef}
      className="board-wrapper overflow-auto flex justify-center items-center"
      style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
    >
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
      </div>
    </div>
  );
}
