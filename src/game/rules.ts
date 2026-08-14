import {
  BLACK,
  EMPTY,
  WHITE,
  type BoardSize,
  type GameState,
  type GroupInfo,
  type MoveResult,
  type Player,
  type Point,
  type ScoreResult,
  type Stone,
  opponent,
} from "./types";

export function pointToIndex(point: Point, size: number): number {
  return point.y * size + point.x;
}

export function indexToPoint(index: number, size: number): Point {
  return { x: index % size, y: Math.floor(index / size) };
}

export function isInside(point: Point, size: number): boolean {
  return Number.isInteger(point.x) && Number.isInteger(point.y) && point.x >= 0 && point.y >= 0 && point.x < size && point.y < size;
}

export function neighborIndices(index: number, size: number): number[] {
  const x = index % size;
  const y = Math.floor(index / size);
  const result: number[] = [];
  if (x > 0) result.push(index - 1);
  if (x < size - 1) result.push(index + 1);
  if (y > 0) result.push(index - size);
  if (y < size - 1) result.push(index + size);
  return result;
}

export function situationKey(board: Stone[], nextPlayer: Player): string {
  return `${board.join("")}:${nextPlayer}`;
}

export function createGame(size: BoardSize = 9, komi = 7.5): GameState {
  const board = Array<Stone>(size * size).fill(EMPTY);
  return {
    size,
    board,
    currentPlayer: BLACK,
    moveNumber: 0,
    consecutivePasses: 0,
    captures: { black: 0, white: 0 },
    status: "playing",
    komi,
    lastMove: null,
    lastAction: null,
    moves: [],
    situationHistory: [situationKey(board, BLACK)],
  };
}

export function collectGroup(board: Stone[], start: number, size: number): GroupInfo {
  const color = board[start];
  if (color === EMPTY) {
    throw new Error("collectGroup requires a stone");
  }

  const stones: number[] = [];
  const liberties = new Set<number>();
  const visited = new Set<number>([start]);
  const queue = [start];

  while (queue.length) {
    const current = queue.pop() as number;
    stones.push(current);
    for (const neighbor of neighborIndices(current, size)) {
      const value = board[neighbor];
      if (value === EMPTY) {
        liberties.add(neighbor);
      } else if (value === color && !visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }
  }

  return { color, stones, liberties };
}

export function tryPlay(state: GameState, point: Point): MoveResult {
  if (state.status !== "playing") return { ok: false, reason: "not-playing" };
  if (!isInside(point, state.size)) return { ok: false, reason: "out-of-bounds" };

  const index = pointToIndex(point, state.size);
  if (state.board[index] !== EMPTY) return { ok: false, reason: "occupied" };

  const player = state.currentPlayer;
  const enemy = opponent(player);
  const board = [...state.board];
  board[index] = player;

  const capturedGroups = new Map<number, number[]>();
  for (const neighbor of neighborIndices(index, state.size)) {
    if (board[neighbor] !== enemy) continue;
    const group = collectGroup(board, neighbor, state.size);
    if (group.liberties.size === 0) {
      const groupKey = Math.min(...group.stones);
      capturedGroups.set(groupKey, group.stones);
    }
  }

  let captured = 0;
  for (const stones of capturedGroups.values()) {
    for (const stone of stones) board[stone] = EMPTY;
    captured += stones.length;
  }

  const ownGroup = collectGroup(board, index, state.size);
  if (ownGroup.liberties.size === 0) return { ok: false, reason: "suicide" };

  const nextPlayer = opponent(player);
  const key = situationKey(board, nextPlayer);
  if (state.situationHistory.includes(key)) return { ok: false, reason: "superko" };

  return {
    ok: true,
    captured,
    state: {
      ...state,
      board,
      currentPlayer: nextPlayer,
      moveNumber: state.moveNumber + 1,
      consecutivePasses: 0,
      captures: {
        black: state.captures.black + (player === BLACK ? captured : 0),
        white: state.captures.white + (player === WHITE ? captured : 0),
      },
      lastMove: { ...point },
      lastAction: "play",
      moves: [...state.moves, { type: "play", player, point: { ...point }, captured }],
      situationHistory: [...state.situationHistory, key],
    },
  };
}

export function passTurn(state: GameState): GameState {
  if (state.status !== "playing") return state;
  const player = state.currentPlayer;
  const nextPlayer = opponent(player);
  const passes = state.consecutivePasses + 1;
  const key = situationKey(state.board, nextPlayer);
  return {
    ...state,
    currentPlayer: nextPlayer,
    moveNumber: state.moveNumber + 1,
    consecutivePasses: passes,
    status: passes >= 2 ? "scoring" : "playing",
    lastMove: null,
    lastAction: "pass",
    moves: [...state.moves, { type: "pass", player, captured: 0 }],
    situationHistory: state.situationHistory.includes(key) ? state.situationHistory : [...state.situationHistory, key],
  };
}

export function resumeFromScoring(state: GameState): GameState {
  if (state.status !== "scoring") return state;
  return { ...state, status: "playing", consecutivePasses: 0 };
}

export function finishGame(state: GameState, deadStones: Set<number> = new Set()): GameState {
  if (state.status !== "scoring") return state;
  const board = [...state.board];
  for (const index of deadStones) {
    if (index >= 0 && index < board.length) board[index] = EMPTY;
  }
  return { ...state, board, status: "finished" };
}

export function legalMoves(state: GameState): Point[] {
  if (state.status !== "playing") return [];
  const moves: Point[] = [];
  for (let index = 0; index < state.board.length; index += 1) {
    if (state.board[index] !== EMPTY) continue;
    const point = indexToPoint(index, state.size);
    if (tryPlay(state, point).ok) moves.push(point);
  }
  return moves;
}

export function groupAt(state: GameState, point: Point): number[] {
  if (!isInside(point, state.size)) return [];
  const index = pointToIndex(point, state.size);
  if (state.board[index] === EMPTY) return [];
  return collectGroup(state.board, index, state.size).stones;
}

export function calculateScore(state: GameState, deadStones: Set<number> = new Set()): ScoreResult {
  const board = [...state.board];
  for (const index of deadStones) {
    if (Number.isInteger(index) && index >= 0 && index < board.length) board[index] = EMPTY;
  }

  let blackStones = 0;
  let whiteStones = 0;
  for (const stone of board) {
    if (stone === BLACK) blackStones += 1;
    if (stone === WHITE) whiteStones += 1;
  }

  let blackTerritory = 0;
  let whiteTerritory = 0;
  let neutral = 0;
  const visited = new Set<number>();

  for (let start = 0; start < board.length; start += 1) {
    if (board[start] !== EMPTY || visited.has(start)) continue;
    const region: number[] = [];
    const borders = new Set<Player>();
    const queue = [start];
    visited.add(start);

    while (queue.length) {
      const current = queue.pop() as number;
      region.push(current);
      for (const neighbor of neighborIndices(current, state.size)) {
        const value = board[neighbor];
        if (value === EMPTY && !visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        } else if (value === BLACK || value === WHITE) {
          borders.add(value);
        }
      }
    }

    if (borders.size === 1 && borders.has(BLACK)) blackTerritory += region.length;
    else if (borders.size === 1 && borders.has(WHITE)) whiteTerritory += region.length;
    else neutral += region.length;
  }

  const black = blackStones + blackTerritory;
  const white = whiteStones + whiteTerritory + state.komi;
  const winner: Player = black > white ? BLACK : WHITE;
  return {
    black,
    white,
    blackStones,
    whiteStones,
    blackTerritory,
    whiteTerritory,
    neutral,
    winner,
    margin: Math.abs(black - white),
  };
}

export function validateGameState(value: unknown): value is GameState {
  if (!value || typeof value !== "object") return false;
  const state = value as Partial<GameState>;
  if (state.size !== 9 && state.size !== 13 && state.size !== 19) return false;
  if (!Array.isArray(state.board) || state.board.length !== state.size * state.size) return false;
  if (!state.board.every((stone) => stone === EMPTY || stone === BLACK || stone === WHITE)) return false;
  if (state.currentPlayer !== BLACK && state.currentPlayer !== WHITE) return false;
  if (state.status !== "playing" && state.status !== "scoring" && state.status !== "finished") return false;
  if (!Number.isInteger(state.moveNumber) || (state.moveNumber as number) < 0) return false;
  if (!Number.isInteger(state.consecutivePasses) || (state.consecutivePasses as number) < 0 || (state.consecutivePasses as number) > 2) return false;
  if (typeof state.komi !== "number" || !Number.isFinite(state.komi) || state.komi < 0 || state.komi > 100) return false;
  if (!state.captures || typeof state.captures !== "object") return false;
  if (!Number.isInteger(state.captures.black) || state.captures.black < 0) return false;
  if (!Number.isInteger(state.captures.white) || state.captures.white < 0) return false;
  if (state.lastAction !== null && state.lastAction !== "play" && state.lastAction !== "pass") return false;

  const validPoint = (point: unknown): point is Point => {
    if (!point || typeof point !== "object") return false;
    const candidate = point as Partial<Point>;
    return typeof candidate.x === "number" && typeof candidate.y === "number" && isInside(candidate as Point, state.size as number);
  };

  if (state.lastMove !== null && !validPoint(state.lastMove)) return false;
  if (!Array.isArray(state.moves) || state.moves.length !== state.moveNumber) return false;
  if (!state.moves.every((move) => {
    if (!move || typeof move !== "object") return false;
    if (move.player !== BLACK && move.player !== WHITE) return false;
    if (!Number.isInteger(move.captured) || move.captured < 0) return false;
    if (move.type === "pass") return move.point === undefined;
    return move.type === "play" && validPoint(move.point);
  })) return false;
  if (!Array.isArray(state.situationHistory) || state.situationHistory.length === 0) return false;
  if (!state.situationHistory.every((entry) => typeof entry === "string" && entry.length > 0)) return false;
  return true;
}
