import {
  BLACK,
  EMPTY,
  type AiResponse,
  type Difficulty,
  type GameState,
  type Player,
  type Point,
  opponent,
} from "./types";
import {
  calculateScore,
  collectGroup,
  indexToPoint,
  neighborIndices,
  pointToIndex,
  tryPlay,
} from "./rules";

interface Candidate {
  point: Point;
  score: number;
  captured: number;
  reason: AiResponse["reason"];
}

export function mulberry32(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

function starCoordinates(size: number): Point[] {
  if (size === 9) return [{ x: 2, y: 2 }, { x: 6, y: 2 }, { x: 4, y: 4 }, { x: 2, y: 6 }, { x: 6, y: 6 }];
  const low = size === 13 ? 3 : 3;
  const high = size - 1 - low;
  const mid = Math.floor(size / 2);
  return [
    { x: low, y: low }, { x: high, y: low }, { x: low, y: high }, { x: high, y: high },
    { x: mid, y: mid }, { x: low, y: mid }, { x: high, y: mid }, { x: mid, y: low }, { x: mid, y: high },
  ];
}

function candidatePoints(state: GameState): Point[] {
  const occupied = state.board.reduce<number>((count, stone) => count + (stone === EMPTY ? 0 : 1), 0);
  const indices = new Set<number>();
  for (const point of starCoordinates(state.size)) {
    if (state.board[pointToIndex(point, state.size)] === EMPTY) indices.add(pointToIndex(point, state.size));
  }

  if (occupied === 0) return [...indices].map((index) => indexToPoint(index, state.size));

  for (let index = 0; index < state.board.length; index += 1) {
    if (state.board[index] === EMPTY) continue;
    const { x, y } = indexToPoint(index, state.size);
    for (let dy = -2; dy <= 2; dy += 1) {
      for (let dx = -2; dx <= 2; dx += 1) {
        if (Math.abs(dx) + Math.abs(dy) > 2) continue;
        const nextX = x + dx;
        const nextY = y + dy;
        if (nextX < 0 || nextY < 0 || nextX >= state.size || nextY >= state.size) continue;
        const candidate = nextY * state.size + nextX;
        if (state.board[candidate] === EMPTY) indices.add(candidate);
      }
    }
  }

  const strategicStride = state.size === 19 ? 4 : 3;
  for (let y = 2; y < state.size - 2; y += strategicStride) {
    for (let x = 2; x < state.size - 2; x += strategicStride) {
      const index = y * state.size + x;
      if (state.board[index] === EMPTY) indices.add(index);
    }
  }

  if (indices.size < Math.min(50, state.board.length)) {
    for (let index = 0; index < state.board.length; index += 1) {
      if (state.board[index] === EMPTY) indices.add(index);
    }
  }
  return [...indices].map((index) => indexToPoint(index, state.size));
}

function isOwnEye(state: GameState, point: Point, player: Player): boolean {
  const index = pointToIndex(point, state.size);
  const neighbors = neighborIndices(index, state.size);
  if (neighbors.some((neighbor) => state.board[neighbor] !== player)) return false;
  const diagonals = [
    { x: point.x - 1, y: point.y - 1 }, { x: point.x + 1, y: point.y - 1 },
    { x: point.x - 1, y: point.y + 1 }, { x: point.x + 1, y: point.y + 1 },
  ].filter(({ x, y }) => x >= 0 && y >= 0 && x < state.size && y < state.size);
  const friendly = diagonals.filter(({ x, y }) => state.board[y * state.size + x] === player).length;
  return diagonals.length < 4 ? friendly === diagonals.length : friendly >= 3;
}

function localFeatures(state: GameState, point: Point, player: Player): Candidate | null {
  const beforeBoard = state.board;
  const index = pointToIndex(point, state.size);
  let savedAtari = 0;
  let adjacentFriendly = 0;
  let adjacentEnemy = 0;
  const seenFriendly = new Set<number>();

  for (const neighbor of neighborIndices(index, state.size)) {
    if (beforeBoard[neighbor] === player) {
      adjacentFriendly += 1;
      const group = collectGroup(beforeBoard, neighbor, state.size);
      const key = Math.min(...group.stones);
      if (!seenFriendly.has(key) && group.liberties.size === 1) savedAtari += group.stones.length;
      seenFriendly.add(key);
    } else if (beforeBoard[neighbor] === opponent(player)) {
      adjacentEnemy += 1;
    }
  }

  const result = tryPlay(state, point);
  if (!result.ok) return null;
  const after = result.state;
  const ownGroup = collectGroup(after.board, index, state.size);
  const liberties = ownGroup.liberties.size;
  let enemyAtari = 0;
  const seenEnemy = new Set<number>();
  for (const neighbor of neighborIndices(index, state.size)) {
    if (after.board[neighbor] !== opponent(player)) continue;
    const group = collectGroup(after.board, neighbor, state.size);
    const key = Math.min(...group.stones);
    if (!seenEnemy.has(key) && group.liberties.size === 1) enemyAtari += group.stones.length;
    seenEnemy.add(key);
  }

  const edge = Math.min(point.x, point.y, state.size - 1 - point.x, state.size - 1 - point.y);
  const early = state.moveNumber < state.size * 1.8;
  const eyePenalty = isOwnEye(state, point, player) ? 90 : 0;
  const selfAtariPenalty = liberties === 1
    ? 80 + ownGroup.stones.length * 10 - Math.min(result.captured * 10, 30)
    : 0;
  const firstLinePenalty = early && edge === 0 ? 22 : 0;
  const openingBonus = early ? Math.max(0, 3 - Math.abs(edge - (state.size >= 13 ? 3 : 2))) * 3 : 0;
  const friendlyGroups = seenFriendly.size;
  const connectionBonus = friendlyGroups > 1 ? friendlyGroups * 10 : adjacentFriendly * 2;
  const pressureBonus = adjacentEnemy * 2;

  const score =
    result.captured * 120 +
    savedAtari * 85 +
    enemyAtari * 24 +
    connectionBonus +
    pressureBonus +
    liberties * 2 +
    openingBonus -
    eyePenalty -
    selfAtariPenalty -
    firstLinePenalty;

  let reason: Candidate["reason"] = "territory";
  if (result.captured > 0) reason = "capture";
  else if (enemyAtari > 0 || savedAtari > 0) reason = "atari";
  else if (adjacentFriendly > 0) reason = "connect";
  else if (early) reason = "opening";
  return { point, score, captured: result.captured, reason };
}

function positionValue(state: GameState, player: Player): number {
  let stoneBalance = 0;
  let localInfluence = 0;
  let libertyBalance = 0;
  const visited = new Set<number>();
  for (let index = 0; index < state.board.length; index += 1) {
    const stone = state.board[index];
    if (stone === EMPTY) {
      for (const neighbor of neighborIndices(index, state.size)) {
        if (state.board[neighbor] === player) localInfluence += 1;
        else if (state.board[neighbor] === opponent(player)) localInfluence -= 1;
      }
      continue;
    }
    stoneBalance += stone === player ? 1 : -1;
    if (visited.has(index)) continue;
    const group = collectGroup(state.board, index, state.size);
    group.stones.forEach((item) => visited.add(item));
    const sign = stone === player ? 1 : -1;
    libertyBalance += sign * Math.min(group.liberties.size, 4) * Math.sqrt(group.stones.length);
  }
  const captureBalance = player === BLACK
    ? state.captures.black - state.captures.white
    : state.captures.white - state.captures.black;
  return stoneBalance * 1.2 + libertyBalance * 0.4 + localInfluence * 0.08 + captureBalance * 0.25;
}

function rankedCandidates(state: GameState, random: () => number): Candidate[] {
  const player = state.currentPlayer;
  return candidatePoints(state)
    .map((point) => localFeatures(state, point, player))
    .filter((candidate): candidate is Candidate => candidate !== null)
    .map((candidate) => ({ ...candidate, score: candidate.score + random() * 0.01 }))
    .sort((a, b) => b.score - a.score || pointToIndex(a.point, state.size) - pointToIndex(b.point, state.size));
}

function selectBeginner(candidates: Candidate[], random: () => number): Candidate {
  if (random() < 0.34) {
    const safe = candidates.filter((candidate) => candidate.score > -45);
    return (safe.length ? safe : candidates)[Math.floor(random() * (safe.length || candidates.length))];
  }
  const pool = candidates.slice(0, Math.min(8, candidates.length));
  return pool[Math.floor(random() * pool.length)];
}

function selectIntermediate(state: GameState, candidates: Candidate[], random: () => number): Candidate {
  const top = candidates.slice(0, Math.min(18, candidates.length));
  const reviewed = top.map((candidate) => {
    const played = tryPlay(state, candidate.point);
    if (!played.ok) return candidate;
    const replies = rankedCandidates(played.state, random).slice(0, 10);
    const threat = replies[0]?.score ?? 0;
    return { ...candidate, score: candidate.score - threat * 0.72 + positionValue(played.state, state.currentPlayer) * 0.45 };
  });
  reviewed.sort((a, b) => b.score - a.score);
  const pool = reviewed.slice(0, Math.min(3, reviewed.length));
  return pool[Math.floor(random() * pool.length)];
}

function selectAdvanced(state: GameState, candidates: Candidate[], random: () => number): Candidate {
  const top = candidates.slice(0, Math.min(state.size === 19 ? 20 : 28, candidates.length));
  const reviewed = top.map((candidate) => {
    const played = tryPlay(state, candidate.point);
    if (!played.ok) return candidate;
    const replies = rankedCandidates(played.state, random).slice(0, state.size === 19 ? 8 : 12);
    let worstReply = 0;
    for (const reply of replies) {
      const answered = tryPlay(played.state, reply.point);
      if (!answered.ok) continue;
      const replyValue = reply.score - positionValue(answered.state, state.currentPlayer) * 0.35;
      worstReply = Math.max(worstReply, replyValue);
    }
    return {
      ...candidate,
      score: candidate.score - worstReply * 0.82 + positionValue(played.state, state.currentPlayer) * 0.7,
    };
  });
  reviewed.sort((a, b) => b.score - a.score);
  return reviewed[0];
}

export function chooseAiMove(
  state: GameState,
  difficulty: Difficulty,
  seed = state.moveNumber * 2654435761,
): Omit<AiResponse, "id"> {
  const random = mulberry32(seed);
  const candidates = rankedCandidates(state, random);
  if (candidates.length === 0) return { point: null, reason: "pass" };

  const boardProgress = state.moveNumber / state.board.length;
  const best = candidates[0];
  const score = calculateScore(state);
  const playerAhead = state.currentPlayer === BLACK ? score.black > score.white + 2 : score.white > score.black + 2;
  const bestResult = tryPlay(state, best.point);
  if (bestResult.ok) {
    const nextScore = calculateScore(bestResult.state);
    const currentArea = state.currentPlayer === BLACK ? score.black - score.white : score.white - score.black;
    const nextArea = state.currentPlayer === BLACK ? nextScore.black - nextScore.white : nextScore.white - nextScore.black;
    const meaningfulAreaGain = nextArea - currentArea > 0.1;
    const tacticalMove = best.reason === "capture" || best.reason === "atari";
    const answerOpponentPass = state.consecutivePasses === 1 && boardProgress > 0.22;
    const leadAndSettled = playerAhead && boardProgress > 0.5;
    const longGameSettled = state.consecutivePasses === 1 && boardProgress > 1.35 && best.captured === 0;
    if (longGameSettled || (!tacticalMove && !meaningfulAreaGain && (answerOpponentPass || leadAndSettled))) {
      return { point: null, reason: "pass" };
    }
  }

  let selected: Candidate;
  if (difficulty === "beginner") selected = selectBeginner(candidates, random);
  else if (difficulty === "intermediate") selected = selectIntermediate(state, candidates, random);
  else selected = selectAdvanced(state, candidates, random);
  return { point: selected.point, reason: selected.reason };
}
