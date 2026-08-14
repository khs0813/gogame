import { describe, expect, it } from "vitest";
import { chooseAiMove } from "./ai";
import {
  calculateScore,
  collectGroup,
  createGame,
  finishGame,
  passTurn,
  resumeFromScoring,
  situationKey,
  tryPlay,
  validateGameState,
} from "./rules";
import { BLACK, EMPTY, WHITE, type GameState, type Player, type Point, type Stone } from "./types";

function withBoard(rows: string[], currentPlayer: Player = BLACK): GameState {
  const size = rows.length as 9 | 13 | 19;
  const symbols: Record<string, Stone> = { ".": EMPTY, X: BLACK, O: WHITE };
  const board = rows.flatMap((row) => [...row].map((char) => symbols[char]));
  const game = createGame(size);
  return {
    ...game,
    board,
    currentPlayer,
    situationHistory: [situationKey(board, currentPlayer)],
  };
}

const empty9 = () => Array.from({ length: 9 }, () => ".........");

describe("Go rules", () => {
  it("captures a surrounded stone", () => {
    const rows = empty9();
    rows[0] = ".X.......";
    rows[1] = "XO.......";
    rows[2] = ".X.......";
    const game = withBoard(rows, BLACK);
    const result = tryPlay(game, { x: 2, y: 1 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.captured).toBe(1);
    expect(result.state.board[10]).toBe(EMPTY);
  });

  it("rejects suicide", () => {
    const rows = empty9();
    rows[0] = ".O.......";
    rows[1] = "O.O......";
    rows[2] = ".O.......";
    const result = tryPlay(withBoard(rows, BLACK), { x: 1, y: 1 });
    expect(result).toEqual({ ok: false, reason: "suicide" });
  });

  it("allows a capturing move that would otherwise look like suicide", () => {
    const rows = empty9();
    rows[0] = "XOX......";
    rows[1] = "O.OX.....";
    rows[2] = "XOX......";
    rows[3] = ".X.......";
    const result = tryPlay(withBoard(rows, BLACK), { x: 1, y: 1 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.captured).toBe(4);
  });

  it("rejects a repeated situation under superko", () => {
    const game = createGame(9);
    const point: Point = { x: 4, y: 4 };
    const first = tryPlay(game, point);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const repeatedKey = situationKey(first.state.board, first.state.currentPlayer);
    const manipulated: GameState = { ...game, situationHistory: [repeatedKey] };
    const result = tryPlay(manipulated, point);
    expect(result).toEqual({ ok: false, reason: "superko" });
  });

  it("enters scoring after two consecutive passes", () => {
    const game = createGame(9);
    const once = passTurn(game);
    const twice = passTurn(once);
    expect(once.status).toBe("playing");
    expect(once.currentPlayer).toBe(WHITE);
    expect(once.moveNumber).toBe(1);
    expect(once.situationHistory).toContain(situationKey(once.board, WHITE));
    expect(twice.status).toBe("scoring");
    expect(twice.moveNumber).toBe(2);
    expect(resumeFromScoring(twice).consecutivePasses).toBe(0);
  });

  it("calculates enclosed territory with Chinese area scoring", () => {
    const rows = empty9();
    rows[0] = "XXX......";
    rows[1] = "X.X......";
    rows[2] = "XXX......";
    const score = calculateScore(withBoard(rows, BLACK));
    expect(score.blackStones).toBe(8);
    expect(score.blackTerritory).toBeGreaterThanOrEqual(1);
  });

  it("calculates exact stones, territory and neutral points", () => {
    const rows = [
      "XXX......",
      "X.X......",
      "XXX......",
      ".........",
      "OOOOOOOOO",
      ".........",
      ".........",
      ".........",
      ".........",
    ];
    const score = calculateScore(withBoard(rows));
    expect(score).toMatchObject({
      blackStones: 8,
      blackTerritory: 1,
      whiteStones: 9,
      whiteTerritory: 36,
      neutral: 27,
      black: 9,
      white: 52.5,
    });
  });

  it("collects connected stones once", () => {
    const rows = empty9();
    rows[0] = "XX.......";
    rows[1] = "XX.......";
    const group = collectGroup(withBoard(rows).board, 0, 9);
    expect(group.stones).toHaveLength(4);
  });

  it("AI always returns a legal move and does not pass on an empty board", () => {
    for (const difficulty of ["beginner", "intermediate", "advanced"] as const) {
      const game = createGame(9);
      const choice = chooseAiMove(game, difficulty, 42);
      expect(choice.point).not.toBeNull();
      expect(tryPlay(game, choice.point as Point).ok).toBe(true);
    }
  });

  it("enforces ko, then allows a recapture after ko threats", () => {
    const rows = [
      ".........",
      "..X......",
      ".XOX.....",
      ".O.O.....",
      "..O......",
      ".........",
      ".........",
      ".........",
      ".........",
    ];
    const capture = tryPlay(withBoard(rows, BLACK), { x: 2, y: 3 });
    expect(capture.ok).toBe(true);
    if (!capture.ok) return;
    expect(capture.captured).toBe(1);
    expect(tryPlay(capture.state, { x: 2, y: 2 })).toEqual({ ok: false, reason: "superko" });

    const threat = tryPlay(capture.state, { x: 8, y: 8 });
    expect(threat.ok).toBe(true);
    if (!threat.ok) return;
    const answer = tryPlay(threat.state, { x: 7, y: 8 });
    expect(answer.ok).toBe(true);
    if (!answer.ok) return;
    const recapture = tryPlay(answer.state, { x: 2, y: 2 });
    expect(recapture.ok).toBe(true);
    if (!recapture.ok) return;
    expect(recapture.captured).toBe(1);
  });

  it("allows a snapback recapture instead of mistaking it for ko", () => {
    const rows = [
      "XO.......",
      "OXO......",
      "O.X......",
      "XX.......",
      ".........",
      ".........",
      ".........",
      ".........",
      ".........",
    ];
    const first = tryPlay(withBoard(rows, WHITE), { x: 1, y: 2 });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.captured).toBe(1);
    const snapback = tryPlay(first.state, { x: 1, y: 1 });
    expect(snapback.ok).toBe(true);
    if (!snapback.ok) return;
    expect(snapback.captured).toBe(3);
  });

  it("persists a confirmed dead-stone score in the finished board", () => {
    const rows = empty9();
    rows[0] = "XXX......";
    rows[1] = "XOX......";
    rows[2] = "XXX......";
    const scoring = passTurn(passTurn(withBoard(rows)));
    const dead = new Set([10]);
    const selectedScore = calculateScore(scoring, dead);
    const finished = finishGame(scoring, dead);
    expect(finished.status).toBe("finished");
    expect(finished.board[10]).toBe(EMPTY);
    expect(calculateScore(finished)).toEqual(selectedScore);
  });

  it("keeps stored points immutable and rejects fractional coordinates", () => {
    const point = { x: 4, y: 4 };
    const result = tryPlay(createGame(9), point);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    point.x = 0;
    expect(result.state.lastMove).toEqual({ x: 4, y: 4 });
    expect(result.state.moves[0].point).toEqual({ x: 4, y: 4 });
    expect(tryPlay(createGame(9), { x: 0.5, y: 1 })).toEqual({ ok: false, reason: "out-of-bounds" });
  });

  it("rejects corrupted saved states", () => {
    const valid = createGame(9);
    expect(validateGameState(valid)).toBe(true);
    for (const field of ["captures", "komi", "moveNumber", "consecutivePasses", "lastMove", "lastAction"] as const) {
      const corrupted = structuredClone(valid) as unknown as Record<string, unknown>;
      delete corrupted[field];
      expect(validateGameState(corrupted), field).toBe(false);
    }
  });

  it("AI self-play reaches scoring without filling almost every point", { timeout: 20_000 }, () => {
    for (const difficulty of ["beginner", "intermediate", "advanced"] as const) {
      let game = createGame(9);
      for (let turn = 0; turn < 140 && game.status === "playing"; turn += 1) {
        const choice = chooseAiMove(game, difficulty, 10_000 + turn);
        if (!choice.point) {
          game = passTurn(game);
          continue;
        }
        const result = tryPlay(game, choice.point);
        expect(result.ok).toBe(true);
        if (result.ok) game = result.state;
      }
      const occupied = game.board.filter((stone) => stone !== EMPTY).length;
      expect(game.status, difficulty).toBe("scoring");
      expect(occupied, difficulty).toBeLessThan(Math.floor(game.board.length * 0.9));
    }
  });
});
