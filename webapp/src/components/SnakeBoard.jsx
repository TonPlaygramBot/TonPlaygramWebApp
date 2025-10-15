import { useState, useEffect, useRef, Fragment } from "react";
import PlayerToken from "./PlayerToken.jsx";

// Board dimensions
const ROWS = 20;
const COLS = 5;
const CHESS_TILE_LIGHT = "#e7e2d3";
const CHESS_TILE_DARK = "#776a5a";
const LIGHT_NUMBER_COLOR = "#1f2937";
const DARK_NUMBER_COLOR = "#f9fafb";
export const FINAL_TILE = ROWS * COLS + 1; // 101

function CoinBurst({ token }) {
  const coins = Array.from({ length: 30 }, () => ({
    dx: (Math.random() - 0.5) * 100,
    delay: Math.random() * 0.3,
    dur: 0.8 + Math.random() * 0.4,
  }));
  return (
    <div className="coin-burst">
      {coins.map((c, i) => (
        <img
          key={i}
          src={
            token.toUpperCase() === 'TPC'
              ? '/assets/icons/ezgif-54c96d8a9b9236.webp'
              : `/icons/${token.toLowerCase()}.svg`
          }
          alt=""
          className="coin-img"
          style={{
            "--dx": `${c.dx}px`,
            "--delay": `${c.delay}s`,
            "--dur": `${c.dur}s`,
          }}
        />
      ))}
    </div>
  );
}

export default function SnakeBoard({
  players = [],
  highlight,
  trail,
  pot,
  snakes,
  ladders,
  snakeOffsets,
  ladderOffsets,
  offsetPopup,
  celebrate,
  token,
  tokenType,
  diceCells,
  rollingIndex,
  currentTurn,
  burning = [],
}) {
  const containerRef = useRef(null);
  const gridRef = useRef(null);
  const tile1Ref = useRef(null);
  const [cellWidth, setCellWidth] = useState(80);
  const [cellHeight, setCellHeight] = useState(40);
  const tiles = [];
  const centerCol = (COLS - 1) / 2;
  const widenStep = 0.07;
  const scaleStep = 0.03;
  const finalScale = 1 + (ROWS - 3) * scaleStep;

  const rowOffsets = [0];
  for (let r = 1; r < ROWS; r++) {
    const prevScale = 1 + (r - 3) * scaleStep;
    rowOffsets[r] = rowOffsets[r - 1] + (prevScale - 1) * cellHeight;
  }
  const offsetYMax = rowOffsets[ROWS - 1];

  for (let r = 0; r < ROWS; r++) {
    const rowFactor = r - 2;
    const scale = 1 + rowFactor * scaleStep;
    const rowPos = r / (ROWS - 1);
    const scaleX = scale * (1 + rowPos * widenStep);
    const offsetX = (scaleX - 1) * cellWidth;
    const reversed = r % 2 === 1;
    for (let c = 0; c < COLS; c++) {
      const col = c;
      const num = reversed ? (r + 1) * COLS - c : r * COLS + c + 1;
      const isLightTile = (r + c) % 2 === 0;
      const tileColor = isLightTile ? CHESS_TILE_LIGHT : CHESS_TILE_DARK;
      const numberColor = isLightTile ? LIGHT_NUMBER_COLOR : DARK_NUMBER_COLOR;
      const translateX = (col - centerCol) * offsetX;
      const translateY = -rowOffsets[r];
      const isHighlight = highlight && highlight.cell === num;
      const trailHighlight = trail?.find((t) => t.cell === num);
      const highlightClass = isHighlight
        ? `${highlight.type}-highlight`
        : trailHighlight
        ? `${trailHighlight.type}-highlight`
        : "";
      const isJump = isHighlight && highlight.type === "normal";
      const cellType = ladders[num]
        ? "ladder"
        : snakes[num]
        ? "snake"
        : diceCells && diceCells[num]
        ? "dice"
        : "";
      const cellClass = cellType ? `${cellType}-cell` : "";
      const iconImage =
        cellType === "ladder"
          ? "/assets/icons/Ladder.webp"
          : cellType === "snake"
          ? "/assets/icons/snake_vector_no_bg.webp"
          : null;
      const offsetVal =
        cellType === "ladder"
          ? ladderOffsets[num]
          : cellType === "snake"
          ? snakeOffsets[num]
          : null;
      const style = {
        gridRowStart: ROWS - r,
        gridColumnStart: col + 1,
        transform: `translate(${translateX}px, ${translateY}px) scaleX(${scaleX}) scaleY(${scale}) translateZ(5px)`,
        transformOrigin: "bottom center",
        "--tile-bg": tileColor,
        "--number-color": numberColor,
      };
      if (!highlightClass) style.backgroundColor = tileColor;

      tiles.push(
        <div
          key={num}
          data-cell={num}
          ref={num === 1 ? tile1Ref : null}
          className={`board-cell ${cellClass} ${highlightClass}`}
          style={style}
        >
          {(iconImage || offsetVal != null) && (
            <span className="cell-marker">
              {iconImage && <img  src={iconImage} alt="cell icon" className="cell-icon" />}
              {offsetVal != null && (
                <span
                  className={`offset-text ${cellType === 'snake' ? 'snake-text' : 'ladder-text'}`}
                >
                  {cellType === 'snake'
                    ? `-${Math.abs(offsetVal)}`
                    : offsetVal > 0
                    ? `+${offsetVal}`
                    : offsetVal}
                </span>
              )}
            </span>
          )}
          {!cellType && <span className="cell-number">{num}</span>}
          {diceCells && diceCells[num] && (
            <span className="dice-marker">
              <img  src="/assets/icons/file_000000009160620a96f728f463de1c3f.webp" alt="dice" className="dice-icon" />
              <span className="dice-value">+{diceCells[num]}</span>
            </span>
          )}
          {players
            .map((p, i) => ({ ...p, index: i }))
            .filter((p) => p.position !== 0 && p.position === num)
            .map((p) => (
              <Fragment key={p.index}>
                <PlayerToken
                  photoUrl={p.photoUrl}
                  type={p.type || (p.index === 0 ? (isJump ? highlight.type : tokenType) : 'normal')}
                  color={p.color}
                  rolling={p.index === rollingIndex}
                  active={p.index === currentTurn}
                  photoOnly
                  className={
                    'board-token ' +
                    (p.position === 0
                      ? 'start'
                      : p.index === 0 && isJump
                      ? 'jump'
                      : '') +
                    (burning.includes(p.index) ? ' burning' : '')
                  }
                />
              </Fragment>
            ))}
          {offsetPopup && offsetPopup.cell === num && (
            <span
              className={`popup-offset italic font-bold ${offsetPopup.type === 'snake' ? 'text-red-500' : 'text-green-500'}`}
            >
              {offsetPopup.type === 'snake' ? '-' : '+'}
              {offsetPopup.amount}
            </span>
          )}
        </div>
      );
    }
  }

  useEffect(() => {
    const updateSize = () => {
      const width = window.innerWidth;
      const cw = Math.floor(width / COLS);
      setCellWidth(cw);
      const ch = Math.floor(cw / 1.7);
      setCellHeight(ch);
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);


  const angle = 58;
  const boardXOffset = 20; // pixels - align board slightly right
  const boardYOffset = 60;
  const boardZOffset = -50;
  const CAMERA_OFFSET_ROWS = 0;
  const boardScale = 0.8;

  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      const target =
        container.scrollHeight -
        container.clientHeight -
        CAMERA_OFFSET_ROWS * cellHeight;
      container.scrollTop = Math.max(0, target);
    }
  }, [cellHeight]);

  const paddingTop = 0;
  const paddingBottom = '15vh';

  return (
    <div className="relative flex justify-center items-center w-screen overflow-visible">
      <img
        src="/assets/icons/snakes_and_ladders.webp"
        className="background-behind-board object-cover"
        alt=""
        onError={(e) => {
          e.currentTarget.style.display = 'none';
        }}
      />
      <div
        ref={containerRef}
        className="overflow-y-auto"
        style={{
          overflowX: 'hidden',
          height: '100vh',
          overscrollBehaviorY: 'none',
          paddingTop,
          paddingBottom,
        }}
      >
        <div className="snake-board-tilt">
          <div
            ref={gridRef}
            className="snake-board-grid grid gap-x-1 gap-y-2 relative mx-auto"
            style={{
              width: `${cellWidth * COLS}px`,
              height: `${cellHeight * ROWS + offsetYMax}px`,
              gridTemplateColumns: `repeat(${COLS}, ${cellWidth}px)`,
              gridTemplateRows: `repeat(${ROWS}, ${cellHeight}px)`,
              '--cell-width': `${cellWidth}px`,
              '--cell-height': `${cellHeight}px`,
              '--board-width': `${cellWidth * COLS}px`,
              '--board-height': `${cellHeight * ROWS + offsetYMax}px`,
              '--board-angle': `${angle}deg`,
              '--final-scale': finalScale,
              transform: `translate(${boardXOffset}px, ${boardYOffset}px) translateZ(${boardZOffset}px) rotateX(${angle}deg) scale(${boardScale})`,
            }}
          >
            {tiles}
            <div className={`pot-cell ${highlight && highlight.cell === FINAL_TILE ? 'highlight' : ''}`}>
              <PlayerToken color="#16a34a" topColor="#ff0000" className="pot-token" />
              <div className="pot-icon">
                <img
                  src={
                    token === 'TON'
                      ? '/assets/icons/TON.webp'
                      : token === 'USDT'
                        ? '/assets/icons/Usdt.webp'
                        : '/assets/icons/ezgif-54c96d8a9b9236.webp'
                  }

                  alt={token}
                  className="coin-face front"
                />
                <img
                  src={
                    token === 'TON'
                      ? '/assets/icons/TON.webp'
                      : token === 'USDT'
                        ? '/assets/icons/Usdt.webp'
                        : '/assets/icons/ezgif-54c96d8a9b9236.webp'
                  }
                  alt=""
                  className="coin-face back"
                />
              </div>
              {players
                .map((p, i) => ({ ...p, index: i }))
                .filter((p) => p.position === FINAL_TILE)
                .map((p) => (
                  <Fragment key={`win-${p.index}`}>
                    <PlayerToken
                      photoUrl={p.photoUrl}
                      type={p.type || 'normal'}
                      color={p.color}
                      photoOnly
                      className="board-token"
                    />
                  </Fragment>
                ))}
              {celebrate && <CoinBurst token={token} />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
