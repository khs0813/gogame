import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { pointToIndex } from "./game/rules";
import { BLACK, EMPTY, type GameState, type Point } from "./game/types";

interface BoardProps {
  state: GameState;
  pending: Point | null;
  cursor: Point;
  deadStones: Set<number>;
  disabled: boolean;
  label: string;
  descriptionId: string;
  showMagnifier: boolean;
  stoneLabels: { empty: string; black: string; white: string; dead: string };
  onPoint: (point: Point) => void;
  onToggleDead: (point: Point) => void;
  onCursor: (point: Point) => void;
  onCancel: () => void;
  onPass: () => void;
}

interface ActivePointer {
  id: number;
  x: number;
  y: number;
  moved: boolean;
}

const viewSize = 1000;
const padding = 56;
const letters = "ABCDEFGHJKLMNOPQRST";

function starPoints(size: number): Point[] {
  if (size === 9) return [{ x: 2, y: 2 }, { x: 6, y: 2 }, { x: 4, y: 4 }, { x: 2, y: 6 }, { x: 6, y: 6 }];
  const low = 3;
  const high = size - 4;
  const mid = Math.floor(size / 2);
  return [
    { x: low, y: low }, { x: high, y: low }, { x: low, y: high }, { x: high, y: high },
    { x: mid, y: mid }, { x: low, y: mid }, { x: high, y: mid }, { x: mid, y: low }, { x: mid, y: high },
  ];
}

export function coordinateLabel(point: Point, size: number): string {
  return `${letters[point.x]}${size - point.y}`;
}

export default function Board({
  state,
  pending,
  cursor,
  deadStones,
  disabled,
  label,
  descriptionId,
  showMagnifier,
  stoneLabels,
  onPoint,
  onToggleDead,
  onCursor,
  onCancel,
  onPass,
}: BoardProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const pointerStart = useRef<ActivePointer | null>(null);
  const [touchPreview, setTouchPreview] = useState<Point | null>(null);
  const [hoverPoint, setHoverPoint] = useState<Point | null>(null);
  const [keyboardCursor, setKeyboardCursor] = useState(false);
  const step = (viewSize - padding * 2) / (state.size - 1);

  const toSvg = (point: Point) => ({ cx: padding + point.x * step, cy: padding + point.y * step });

  const pointFromClient = (clientX: number, clientY: number): Point | null => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return null;
    const px = ((clientX - rect.left) / rect.width) * viewSize;
    const py = ((clientY - rect.top) / rect.height) * viewSize;
    const hitMin = padding - step / 2;
    const hitMax = viewSize - padding + step / 2;
    if (px < hitMin || py < hitMin || px > hitMax || py > hitMax) return null;
    const x = Math.round((px - padding) / step);
    const y = Math.round((py - padding) / step);
    if (x < 0 || y < 0 || x >= state.size || y >= state.size) return null;
    return { x, y };
  };

  const clearPointer = (event: PointerEvent<SVGSVGElement>) => {
    if (pointerStart.current?.id !== event.pointerId) return null;
    const active = pointerStart.current;
    pointerStart.current = null;
    setTouchPreview(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    return active;
  };

  const handlePointerDown = (event: PointerEvent<SVGSVGElement>) => {
    if (disabled || !event.isPrimary || event.button !== 0) return;
    pointerStart.current = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
    setKeyboardCursor(false);
    setTouchPreview(pointFromClient(event.clientX, event.clientY));
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: PointerEvent<SVGSVGElement>) => {
    const point = pointFromClient(event.clientX, event.clientY);
    if (event.pointerType !== "touch" && !disabled) {
      setKeyboardCursor(false);
      setHoverPoint(point);
    }
    const active = pointerStart.current;
    if (!active || active.id !== event.pointerId) return;
    if (Math.hypot(event.clientX - active.x, event.clientY - active.y) > 10) active.moved = true;
    setTouchPreview(point);
  };

  const handlePointerUp = (event: PointerEvent<SVGSVGElement>) => {
    const active = clearPointer(event);
    if (!active || disabled || active.moved || !event.isPrimary) return;
    const point = pointFromClient(event.clientX, event.clientY);
    if (!point) return;
    onCursor(point);
    if (state.status === "scoring") onToggleDead(point);
    else onPoint(point);
  };

  const handlePointerCancel = (event: PointerEvent<SVGSVGElement>) => {
    clearPointer(event);
    setHoverPoint(null);
  };

  const handlePointerLeave = () => {
    if (!pointerStart.current) setHoverPoint(null);
  };

  const handleKeyDown = (event: KeyboardEvent<SVGSVGElement>) => {
    let next = cursor;
    if (event.key === "ArrowLeft") next = { x: Math.max(0, cursor.x - 1), y: cursor.y };
    else if (event.key === "ArrowRight") next = { x: Math.min(state.size - 1, cursor.x + 1), y: cursor.y };
    else if (event.key === "ArrowUp") next = { x: cursor.x, y: Math.max(0, cursor.y - 1) };
    else if (event.key === "ArrowDown") next = { x: cursor.x, y: Math.min(state.size - 1, cursor.y + 1) };
    else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setKeyboardCursor(true);
      if (!disabled) {
        if (state.status === "scoring") onToggleDead(cursor);
        else onPoint(cursor);
      }
      return;
    } else if (event.key === "Escape") {
      event.preventDefault();
      setKeyboardCursor(true);
      onCancel();
      return;
    } else if (event.key.toLowerCase() === "p") {
      event.preventDefault();
      setKeyboardCursor(true);
      if (!disabled && state.status === "playing") onPass();
      return;
    } else {
      return;
    }
    event.preventDefault();
    setKeyboardCursor(true);
    onCursor(next);
  };

  const cursorPosition = toSvg(cursor);
  const cursorIndex = pointToIndex(cursor, state.size);
  const cursorStone = state.board[cursorIndex];
  const cursorLabel = cursorStone === EMPTY
    ? stoneLabels.empty
    : cursorStone === BLACK
      ? stoneLabels.black
      : stoneLabels.white;
  const cursorDead = deadStones.has(cursorIndex) ? `, ${stoneLabels.dead}` : "";
  const canHover = !disabled && (state.status === "playing" || state.status === "scoring");
  const visibleHover = canHover && hoverPoint && !keyboardCursor ? hoverPoint : null;
  const previewPoint = showMagnifier && state.status === "playing" ? touchPreview ?? pending : null;

  return (
    <svg
      ref={svgRef}
      className="go-board"
      viewBox={`0 0 ${viewSize} ${viewSize}`}
      role="application"
      tabIndex={0}
      aria-label={`${label}. ${coordinateLabel(cursor, state.size)}, ${cursorLabel}${cursorDead}`}
      aria-describedby={descriptionId}
      aria-disabled={disabled}
      aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown Enter Space Escape P"
      onFocus={() => { if (!pointerStart.current) setKeyboardCursor(true); }}
      onBlur={() => setKeyboardCursor(false)}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onLostPointerCapture={handlePointerCancel}
      onPointerLeave={handlePointerLeave}
      onKeyDown={handleKeyDown}
    >
      <title>{label}</title>
      <defs>
        <linearGradient id="boardWood" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#e8bf78" />
          <stop offset="0.52" stopColor="#dba75a" />
          <stop offset="1" stopColor="#c89046" />
        </linearGradient>
        <radialGradient id="blackStone" cx="32%" cy="25%" r="70%">
          <stop offset="0" stopColor="#59615e" />
          <stop offset="0.35" stopColor="#252b29" />
          <stop offset="1" stopColor="#090c0b" />
        </radialGradient>
        <radialGradient id="whiteStone" cx="32%" cy="25%" r="75%">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.62" stopColor="#f0eee8" />
          <stop offset="1" stopColor="#bbb8af" />
        </radialGradient>
        <filter id="stoneShadow" x="-30%" y="-30%" width="160%" height="170%">
          <feDropShadow dx="0" dy="8" stdDeviation="7" floodColor="#4d2f16" floodOpacity=".35" />
        </filter>
      </defs>

      <rect x="0" y="0" width={viewSize} height={viewSize} rx="36" fill="url(#boardWood)" />
      {Array.from({ length: state.size }, (_, index) => {
        const position = padding + index * step;
        return (
          <g key={`line-${index}`} stroke="#563a22" strokeWidth={state.size === 19 ? 2.4 : 3.2}>
            <line x1={padding} x2={viewSize - padding} y1={position} y2={position} />
            <line y1={padding} y2={viewSize - padding} x1={position} x2={position} />
          </g>
        );
      })}

      {starPoints(state.size).map((point) => {
        const { cx, cy } = toSvg(point);
        return <circle key={`star-${point.x}-${point.y}`} cx={cx} cy={cy} r={state.size === 19 ? 7 : 9} fill="#4b321f" />;
      })}

      {Array.from({ length: state.size }, (_, index) => {
        const { cx } = toSvg({ x: index, y: 0 });
        return (
          <g key={`coord-${index}`} fill="#5b4028" fontSize={state.size === 19 ? 20 : 25} fontWeight="700" textAnchor="middle">
            <text x={cx} y="32">{letters[index]}</text>
            <text x="27" y={padding + index * step + 8}>{state.size - index}</text>
          </g>
        );
      })}

      {state.board.map((stone, index) => {
        if (stone === EMPTY) return null;
        const point = { x: index % state.size, y: Math.floor(index / state.size) };
        const { cx, cy } = toSvg(point);
        const radius = Math.min(step * 0.46, state.size === 19 ? 23 : 43);
        const isLast = state.lastMove?.x === point.x && state.lastMove?.y === point.y;
        const isDead = deadStones.has(index);
        const deadPath = `M ${cx - radius * 0.45} ${cy - radius * 0.45} L ${cx + radius * 0.45} ${cy + radius * 0.45} M ${cx + radius * 0.45} ${cy - radius * 0.45} L ${cx - radius * 0.45} ${cy + radius * 0.45}`;
        return (
          <g key={`stone-${index}`} filter="url(#stoneShadow)" opacity={isDead ? 0.5 : 1}>
            <circle
              cx={cx}
              cy={cy}
              r={radius}
              fill={stone === BLACK ? "url(#blackStone)" : "url(#whiteStone)"}
              stroke={stone === BLACK ? "#000" : "#77736a"}
              strokeWidth="2"
            />
            {isLast && <circle cx={cx} cy={cy} r={Math.max(5, radius * 0.18)} fill={stone === BLACK ? "#fff4d6" : "#8e1d14"} />}
            {isDead && (
              <>
                <path d={deadPath} stroke="#fff" strokeWidth={Math.max(16, radius * 0.42)} strokeLinecap="round" />
                <path d={deadPath} stroke="#7d140f" strokeWidth={Math.max(8, radius * 0.22)} strokeLinecap="round" />
              </>
            )}
          </g>
        );
      })}

      {pending && state.status === "playing" && (() => {
        const { cx, cy } = toSvg(pending);
        const radius = Math.min(step * 0.48, 44);
        return (
          <g className="pending-stone" pointerEvents="none">
            <circle cx={cx} cy={cy} r={Math.min(step * 0.43, 39)} fill={state.currentPlayer === BLACK ? "#171b19" : "#f7f5ed"} opacity=".76" />
            <circle cx={cx} cy={cy} r={radius} fill="none" stroke="#101d18" strokeWidth="16" />
            <circle cx={cx} cy={cy} r={radius} fill="none" stroke="#fff" strokeWidth="10" />
            <circle cx={cx} cy={cy} r={radius} fill="none" stroke="#a51e18" strokeWidth="5" />
          </g>
        );
      })()}

      {visibleHover && (() => {
        const { cx, cy } = toSvg(visibleHover);
        const index = pointToIndex(visibleHover, state.size);
        const occupied = state.board[index] !== EMPTY;
        const radius = Math.min(step * 0.42, state.size === 19 ? 22 : 38);
        return (
          <g className={`mouse-board-cursor ${occupied ? "is-blocked" : ""}`} pointerEvents="none">
            <line x1={cx - radius * 1.35} x2={cx + radius * 1.35} y1={cy} y2={cy} />
            <line x1={cx} x2={cx} y1={cy - radius * 1.35} y2={cy + radius * 1.35} />
            {!occupied && state.status === "playing" && (
              <circle
                className="cursor-stone"
                cx={cx}
                cy={cy}
                r={Math.min(step * 0.36, state.size === 19 ? 19 : 33)}
                fill={state.currentPlayer === BLACK ? "#111714" : "#f7f4ed"}
              />
            )}
            <circle className="cursor-ring" cx={cx} cy={cy} r={radius} />
          </g>
        );
      })()}

      {keyboardCursor && (
        <g pointerEvents="none">
          <circle cx={cursorPosition.cx} cy={cursorPosition.cy} r={Math.min(step * 0.49, 46)} fill="none" stroke="#10251e" strokeWidth="15" strokeDasharray="16 10" />
          <circle cx={cursorPosition.cx} cy={cursorPosition.cy} r={Math.min(step * 0.49, 46)} fill="none" stroke="#fff" strokeWidth="6" strokeDasharray="16 10" />
        </g>
      )}

      {previewPoint && (() => {
        const panelSize = 430;
        const panelX = previewPoint.x < state.size / 2 ? 540 : 30;
        const panelY = previewPoint.y < state.size / 2 ? 540 : 30;
        const gap = 70;
        const gridX = panelX + 75;
        const gridY = panelY + 90;
        const startX = Math.max(0, Math.min(state.size - 5, previewPoint.x - 2));
        const startY = Math.max(0, Math.min(state.size - 5, previewPoint.y - 2));
        const previewLocalX = previewPoint.x - startX;
        const previewLocalY = previewPoint.y - startY;
        return (
          <g className="board-magnifier" aria-hidden="true" pointerEvents="none">
            <rect x={panelX} y={panelY} width={panelSize} height={panelSize} rx="34" fill="#fffaf0" stroke="#10251e" strokeWidth="12" opacity=".97" />
            <text x={panelX + panelSize / 2} y={panelY + 48} textAnchor="middle" fill="#10251e" fontSize="30" fontWeight="900">
              {coordinateLabel(previewPoint, state.size)}
            </text>
            {Array.from({ length: 5 }, (_, index) => (
              <g key={`magnifier-line-${index}`} stroke="#684323" strokeWidth="4">
                <line x1={gridX} x2={gridX + gap * 4} y1={gridY + gap * index} y2={gridY + gap * index} />
                <line y1={gridY} y2={gridY + gap * 4} x1={gridX + gap * index} x2={gridX + gap * index} />
              </g>
            ))}
            {Array.from({ length: 25 }, (_, index) => {
              const localX = index % 5;
              const localY = Math.floor(index / 5);
              const boardX = startX + localX;
              const boardY = startY + localY;
              const stone = state.board[boardY * state.size + boardX];
              if (stone === EMPTY) return null;
              return (
                <circle
                  key={`magnifier-stone-${index}`}
                  cx={gridX + localX * gap}
                  cy={gridY + localY * gap}
                  r="29"
                  fill={stone === BLACK ? "#111714" : "#f7f4ed"}
                  stroke={stone === BLACK ? "#000" : "#77736a"}
                  strokeWidth="3"
                />
              );
            })}
            <circle cx={gridX + previewLocalX * gap} cy={gridY + previewLocalY * gap} r="36" fill={state.board[pointToIndex(previewPoint, state.size)] === EMPTY ? (state.currentPlayer === BLACK ? "#111714" : "#f7f4ed") : "none"} opacity=".78" />
            <circle cx={gridX + previewLocalX * gap} cy={gridY + previewLocalY * gap} r="39" fill="none" stroke="#10251e" strokeWidth="18" />
            <circle cx={gridX + previewLocalX * gap} cy={gridY + previewLocalY * gap} r="39" fill="none" stroke="#fff" strokeWidth="11" />
            <circle cx={gridX + previewLocalX * gap} cy={gridY + previewLocalY * gap} r="39" fill="none" stroke="#a51e18" strokeWidth="6" />
          </g>
        );
      })()}
    </svg>
  );
}
