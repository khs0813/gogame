export const EMPTY = 0 as const;
export const BLACK = 1 as const;
export const WHITE = 2 as const;

export type Stone = 0 | 1 | 2;
export type Player = 1 | 2;
export type BoardSize = 9 | 13 | 19;
export type Difficulty = "beginner" | "intermediate" | "advanced";
export type GameStatus = "playing" | "scoring" | "finished";

export interface Point {
  x: number;
  y: number;
}

export interface MoveRecord {
  type: "play" | "pass";
  player: Player;
  point?: Point;
  captured: number;
}

export interface GameState {
  size: BoardSize;
  board: Stone[];
  currentPlayer: Player;
  moveNumber: number;
  consecutivePasses: number;
  captures: { black: number; white: number };
  status: GameStatus;
  komi: number;
  lastMove: Point | null;
  lastAction: "play" | "pass" | null;
  moves: MoveRecord[];
  situationHistory: string[];
}

export type IllegalReason = "occupied" | "suicide" | "superko" | "out-of-bounds" | "not-playing";

export type MoveResult =
  | { ok: true; state: GameState; captured: number }
  | { ok: false; reason: IllegalReason };

export interface GroupInfo {
  color: Player;
  stones: number[];
  liberties: Set<number>;
}

export interface ScoreResult {
  black: number;
  white: number;
  blackStones: number;
  whiteStones: number;
  blackTerritory: number;
  whiteTerritory: number;
  neutral: number;
  winner: Player;
  margin: number;
}

export interface AiRequest {
  id: number;
  state: GameState;
  difficulty: Difficulty;
  seed: number;
}

export interface AiResponse {
  id: number;
  point: Point | null;
  reason: "capture" | "atari" | "connect" | "opening" | "territory" | "pass";
}

export function opponent(player: Player): Player {
  return player === BLACK ? WHITE : BLACK;
}
