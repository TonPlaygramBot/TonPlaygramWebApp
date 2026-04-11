import { useState, useEffect, useRef, Fragment, useMemo } from "react";
import PlayerToken from "./PlayerToken.jsx";

const PLAYABLE_TILE_COUNT = 50;
const GRID_SCALE = 2;
const EXTRA_COLUMN_FRACTION = 0.6;
const CELL_HEIGHT_RATIO = 1.9;
const BOARD_SCALE = 1.12;
const FLOOR_COUNT = 3;
const FLOOR_RISE = 1.05;
const FLOOR_RAMP = 0.34;

function buildPyramidLayout() {
  const gridSize = 8;
  const ringSpecs = [
    { size: 8, offset: 0 },
    { size: 5, offset: 1.5 },
    { size: 3, offset: 2.5 },
  ];

  const ringPath = ({ size, offset }) => {
    const points = [];
    const left = offset;
    const right = offset + size - 1;
    const top = offset;
    const bottom = offset + size - 1;
    for (let c = left; c <= right; c++) points.push({ col: c, row: top });
    for (let r = top + 1; r <= bottom; r++) points.push({ col: right, row: r });
    for (let c = right - 1; c >= left; c--) points.push({ col: c, row: bottom });
    for (let r = bottom - 1; r > top; r--) points.push({ col: left, row: r });
    return points;
  };

  const allPoints = [];
  ringSpecs.forEach((ring, ringIndex) => {
    const ringPoints = ringPath(ring);
    const startIndex = ringIndex === 0 ? 0 : Math.floor(ringPoints.length * 0.14);
    const orderedRingPoints = [...ringPoints.slice(startIndex), ...ringPoints.slice(0, startIndex)];
    if (allPoints.length) {
      const prev = allPoints[allPoints.length - 1];
      const next = orderedRingPoints[0];
      allPoints.push({
        col: prev.col + (next.col - prev.col) * 0.35,
        row: prev.row + (next.row - prev.row) * 0.35,
        floorBlend: ringIndex - 0.65,
      });
      allPoints.push({
        col: prev.col + (next.col - prev.col) * 0.7,
        row: prev.row + (next.row - prev.row) * 0.7,
        floorBlend: ringIndex - 0.25,
      });
    }
    orderedRingPoints.forEach((point) => allPoints.push({ ...point, floorBlend: ringIndex }));
  });

  const tiles = allPoints.slice(0, PLAYABLE_TILE_COUNT).map((point, index) => ({
    cell: index + 1,
    ...point,
  }));
  const totalCells = tiles.length;

  const withElevation = tiles.map((tile) => {
    const floorBase = Math.max(0, tile.floorBlend ?? tile.levelIndex ?? 0);
    const floorIndex = Math.min(FLOOR_COUNT - 1, Math.floor(floorBase));
    const floorProgress = Math.max(0, floorBase - floorIndex);
    return {
      ...tile,
      levelIndex: floorIndex,
      elevation: floorIndex * FLOOR_RISE + floorProgress * FLOOR_RAMP,
    };
  });

  const widthUnits = gridSize;
  const heightUnits = gridSize;
  const centerColumn = gridSize / 2;
  const levels = Array.from({ length: FLOOR_COUNT }, (_, levelIndex) => {
    const levelTiles = withElevation.filter((tile) => tile.levelIndex === levelIndex);
    return {
      levelIndex,
      startCell: levelTiles[0]?.cell ?? 1,
      endCell: levelTiles[levelTiles.length - 1]?.cell ?? totalCells,
      size: ringSpecs[levelIndex]?.size ?? 3,
      xOffset: ringSpecs[levelIndex]?.offset ?? levelIndex,
      yOffset: ringSpecs[levelIndex]?.offset ?? levelIndex,
    };
  });

  return {
    tiles: withElevation,
    levels,
    totalCells,
    widthUnits,
    heightUnits,
    minX: 0,
    maxX: gridSize,
    centerColumn,
  };
}

const BOARD_LAYOUT = buildPyramidLayout();
export const BOARD_CELL_COUNT = BOARD_LAYOUT.totalCells;
export const FINAL_TILE = BOARD_CELL_COUNT + 1;
const BOARD_WIDTH_UNITS = BOARD_LAYOUT.widthUnits;
const BOARD_HEIGHT_UNITS = BOARD_LAYOUT.heightUnits;
const CENTER_COLUMN = BOARD_LAYOUT.centerColumn;
const FINAL_SCALE = 1.45;

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
  const touchStateRef = useRef({
    active: false,
    lastY: 0,
    cameraDragProgress: 0,
  });
  const [cellWidth, setCellWidth] = useState(80);
  const [cellHeight, setCellHeight] = useState(40);
  const [cameraDragProgress, setCameraDragProgress] = useState(0);
  const layoutTiles = BOARD_LAYOUT.tiles;
  const scaledCols = BOARD_WIDTH_UNITS * GRID_SCALE;
  const scaledRows = BOARD_HEIGHT_UNITS * GRID_SCALE;

  const maxElevation = useMemo(
    () => layoutTiles.reduce((best, tile) => Math.max(best, tile.elevation ?? 0), 0),
    [layoutTiles],
  );
  const offsetYMax = maxElevation * cellHeight;

  const tileElements = layoutTiles.map((tile) => {
    const num = tile.cell;
    const scale = 1 + (tile.elevation ?? 0) * 0.2;
    const scaleX = scale;
    const offsetX = (scaleX - 1) * cellWidth * 0.9;
    const translateX = (tile.col + 0.5 - CENTER_COLUMN) * offsetX;
    const translateY = -(tile.elevation ?? 0) * cellHeight;
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
      gridRowStart: scaledRows - tile.row * GRID_SCALE - (GRID_SCALE - 1),
      gridRowEnd: `span ${GRID_SCALE}`,
      gridColumnStart: Math.round(tile.col * GRID_SCALE) + 1,
      gridColumnEnd: `span ${GRID_SCALE}`,
      transform: `translate(${translateX}px, ${translateY}px) scaleX(${scaleX}) scaleY(${scale}) translateZ(5px)`,
      transformOrigin: "bottom center",
    };
    if (!highlightClass) style.backgroundColor = "#6db0ad";

    return (
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
              <span className={`offset-text ${cellType === 'snake' ? 'snake-text' : 'ladder-text'}`}>
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
  });

  useEffect(() => {
    const updateSize = () => {
      const width = window.innerWidth;
      const cw = Math.floor(width / (BOARD_WIDTH_UNITS + EXTRA_COLUMN_FRACTION));
      setCellWidth(cw);
      const ch = Math.floor(cw / CELL_HEIGHT_RATIO);
      setCellHeight(ch);
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);


  const angle = 63;
  const boardXOffset = 8;
  const boardYOffset = 48;
  const boardZOffset = -64;
  const CAMERA_DRAG_LIMIT = 1;
  const CAMERA_DRAG_SENSITIVITY = 0.0048;
  const cameraSyncProgress = Math.max(-CAMERA_DRAG_LIMIT, Math.min(CAMERA_DRAG_LIMIT, cameraDragProgress));
  const syncedBoardYOffset = boardYOffset + cameraSyncProgress * 22;
  const syncedBoardZOffset = boardZOffset + cameraSyncProgress * 34;
  const syncedBoardAngle = angle + cameraSyncProgress * 5;
  const CAMERA_OFFSET_ROWS = 0;

  const handleTouchStart = (event) => {
    const touchY = event.touches?.[0]?.clientY;
    if (typeof touchY !== 'number') return;
    touchStateRef.current.active = true;
    touchStateRef.current.lastY = touchY;
  };

  const handleTouchMove = (event) => {
    const touchY = event.touches?.[0]?.clientY;
    if (typeof touchY !== 'number' || !touchStateRef.current.active) return;
    const deltaY = touchY - touchStateRef.current.lastY;
    touchStateRef.current.lastY = touchY;
    const nextProgress = Math.max(
      -CAMERA_DRAG_LIMIT,
      Math.min(
        CAMERA_DRAG_LIMIT,
        touchStateRef.current.cameraDragProgress + deltaY * CAMERA_DRAG_SENSITIVITY,
      ),
    );
    touchStateRef.current.cameraDragProgress = nextProgress;
    setCameraDragProgress(nextProgress);
  };

  const handleTouchEnd = () => {
    touchStateRef.current.active = false;
  };

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

  const finalTile = layoutTiles[layoutTiles.length - 1];
  const potRowIndex = finalTile?.row ?? 0;
  const potCol = finalTile?.col ?? CENTER_COLUMN;
  const potScale = 1 + (finalTile?.elevation ?? 0) * 0.2;
  const potScaleX = potScale;
  const potOffsetX = (potScaleX - 1) * cellWidth;
  const potTranslateX = (potCol + 0.5 - CENTER_COLUMN) * potOffsetX;
  const potTranslateY = -((finalTile?.elevation ?? 0) * cellHeight) - cellHeight * 1.65;
  const potStyle = {
    gridRowStart: scaledRows - potRowIndex * GRID_SCALE - (GRID_SCALE - 1),
    gridRowEnd: `span ${GRID_SCALE}`,
    gridColumnStart: Math.round((potCol - 0.5) * GRID_SCALE) + 1,
    gridColumnEnd: `span ${GRID_SCALE * 2}`,
    transform: `translate(${potTranslateX}px, ${potTranslateY}px) scaleX(${potScaleX * 1.1}) scaleY(${potScale}) translateZ(12px)`,
    transformOrigin: "bottom center",
  };

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
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        style={{
          overflowX: 'hidden',
          height: '100vh',
          overscrollBehaviorY: 'none',
          touchAction: 'none',
          paddingTop,
          paddingBottom,
        }}
      >
        <div className="snake-board-tilt">
          <div
            ref={gridRef}
            className="snake-board-grid grid gap-x-0.5 gap-y-0.5 relative mx-auto"
            style={{
              width: `${cellWidth * BOARD_WIDTH_UNITS}px`,
              height: `${cellHeight * BOARD_HEIGHT_UNITS + offsetYMax}px`,
              gridTemplateColumns: `repeat(${scaledCols}, ${cellWidth / GRID_SCALE}px)`,
              gridTemplateRows: `repeat(${scaledRows}, ${cellHeight / GRID_SCALE}px)`,
              '--cell-width': `${cellWidth}px`,
              '--cell-height': `${cellHeight}px`,
              '--board-width': `${cellWidth * BOARD_WIDTH_UNITS}px`,
              '--board-height': `${cellHeight * BOARD_HEIGHT_UNITS + offsetYMax}px`,
              '--board-angle': `${syncedBoardAngle}deg`,
              '--final-scale': FINAL_SCALE,
              '--board-scale': BOARD_SCALE,
              transform: `translate(${boardXOffset}px, ${syncedBoardYOffset}px) translateZ(${syncedBoardZOffset}px) rotateX(${syncedBoardAngle}deg) scale(${BOARD_SCALE})`,
            }}
          >
            {tileElements}
            <div
              className={`pot-cell ${highlight && highlight.cell === FINAL_TILE ? 'highlight' : ''}`}
              style={potStyle}
            >
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
