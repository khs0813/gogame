import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import Board, { coordinateLabel } from "./Board";
import { alternatePath, copy, getInitialDifficulty, getLanguage, type Language } from "./content";
import { chooseAiMove } from "./game/ai";
import {
  calculateScore,
  createGame,
  finishGame,
  groupAt,
  passTurn,
  resumeFromScoring,
  situationKey,
  tryPlay,
  validateGameState,
} from "./game/rules";
import {
  BLACK,
  WHITE,
  type AiResponse,
  type BoardSize,
  type Difficulty,
  type GameState,
  type Player,
  type Point,
  opponent,
} from "./game/types";

const storageKey = "baduk-one-session-v2";
const courseOrder: Difficulty[] = ["beginner", "intermediate", "advanced"];

interface Session {
  game: GameState;
  difficulty: Difficulty;
  playerColor: Player;
  deadStones: Set<number>;
  restored: boolean;
}

interface StoredSession {
  version: 2;
  game: GameState;
  difficulty: Difficulty;
  playerColor: Player;
  deadStones: number[];
}

function readSession(): Session {
  const pageCourse = document.body.dataset.course;
  const initialDifficulty = getInitialDifficulty();
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey) || "null") as StoredSession | null;
    if (
      parsed &&
      parsed.version === 2 &&
      validateGameState(parsed.game) &&
      (parsed.difficulty === "beginner" || parsed.difficulty === "intermediate" || parsed.difficulty === "advanced") &&
      (parsed.playerColor === BLACK || parsed.playerColor === WHITE) &&
      Array.isArray(parsed.deadStones) &&
      parsed.deadStones.every((index) => Number.isInteger(index) && index >= 0 && index < parsed.game.board.length) &&
      (!pageCourse || parsed.difficulty === initialDifficulty)
    ) {
      return {
        game: parsed.game,
        difficulty: parsed.difficulty,
        playerColor: parsed.playerColor,
        deadStones: new Set(parsed.deadStones),
        restored: parsed.game.moveNumber > 0,
      };
    }
  } catch {
    // Ignore malformed local-only data and begin a clean game.
  }
  const size = copy[getLanguage()].courses[initialDifficulty].size;
  return { game: createGame(size), difficulty: initialDifficulty, playerColor: BLACK, deadStones: new Set(), restored: false };
}

function samePoint(a: Point | null, b: Point): boolean {
  return Boolean(a && a.x === b.x && a.y === b.y);
}

function gameFingerprint(game: GameState): string {
  return `${situationKey(game.board, game.currentPlayer)}:${game.moveNumber}:${game.status}`;
}

function seedFor(game: GameState): number {
  let seed = game.moveNumber * 2654435761;
  for (let index = 0; index < game.board.length; index += 1) {
    seed = Math.imul(seed ^ (game.board[index] + index + 1), 16777619);
  }
  return seed >>> 0;
}

function resultText(language: Language, score: ReturnType<typeof calculateScore>): string {
  const text = copy[language];
  const color = score.winner === BLACK ? text.black : text.white;
  return language === "ko"
    ? `${color} 승 · ${score.margin.toFixed(1)} ${text.byPoints}`
    : `${color}胜 · 领先 ${score.margin.toFixed(1)} 目`;
}

export default function App() {
  const language = getLanguage();
  const text = copy[language];
  const pageCourse = document.body.dataset.course as Difficulty | undefined;
  const [initial] = useState(readSession);
  const [game, setGame] = useState<GameState>(initial.game);
  const [difficulty, setDifficulty] = useState<Difficulty>(initial.difficulty);
  const [playerColor, setPlayerColor] = useState<Player>(initial.playerColor);
  const [undoStack, setUndoStack] = useState<GameState[]>([]);
  const [pending, setPending] = useState<Point | null>(null);
  const [cursor, setCursor] = useState<Point>({ x: Math.floor(game.size / 2), y: Math.floor(game.size / 2) });
  const [deadStones, setDeadStones] = useState<Set<number>>(initial.deadStones);
  const [thinking, setThinking] = useState(false);
  const [hintBusy, setHintBusy] = useState(false);
  const [hint, setHint] = useState<{ point: Point | null; reason: AiResponse["reason"] } | null>(null);
  const [coarsePointer, setCoarsePointer] = useState(() => window.matchMedia("(pointer: coarse)").matches);
  const [announcement, setAnnouncement] = useState(initial.restored ? text.restored : text.yourTurn);
  const requestId = useRef(0);
  const hintRequestId = useRef(0);
  const hintTimer = useRef<number | null>(null);
  const hintWorker = useRef<Worker | null>(null);
  const latestFingerprint = useRef(gameFingerprint(game));
  latestFingerprint.current = gameFingerprint(game);

  const isHumanTurn = game.status === "playing" && game.currentPlayer === playerColor && !thinking;
  const mustConfirm = coarsePointer || game.size >= 13;
  const computerColor = opponent(playerColor);
  const score = useMemo(() => calculateScore(game, deadStones), [game, deadStones]);
  const canUndo = !thinking && game.status === "playing" && undoStack.length >= 2 && game.currentPlayer === playerColor;
  const pageTitle = pageCourse
    ? language === "ko"
      ? {
          beginner: "초급 바둑 코스: 규칙부터 첫 대국까지",
          intermediate: "중급 바둑 코스: 전술을 읽는 대국",
          advanced: "고급 바둑 코스: 전판을 판단하는 대국",
        }[pageCourse]
	      : {
	          beginner: "初级围棋课程：从规则到第一盘棋",
	          intermediate: "中级围棋课程：在对局中读懂战术",
	          advanced: "高级围棋课程：全局判断与实战挑战",
	        }[pageCourse]
    : text.title;

  const cancelHint = useCallback((clearDisplayed = true) => {
    hintRequestId.current += 1;
    if (hintTimer.current !== null) {
      window.clearTimeout(hintTimer.current);
      hintTimer.current = null;
    }
    hintWorker.current?.terminate();
    hintWorker.current = null;
    setHintBusy(false);
    if (clearDisplayed) setHint(null);
  }, []);

  useEffect(() => {
    const stored: StoredSession = { version: 2, game, difficulty, playerColor, deadStones: [...deadStones] };
    try {
      localStorage.setItem(storageKey, JSON.stringify(stored));
    } catch {
      // Private browsing or a full storage quota should not interrupt the game.
    }
  }, [deadStones, game, difficulty, playerColor]);

  useEffect(() => {
    const media = window.matchMedia("(pointer: coarse)");
    const update = () => setCoarsePointer(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => () => {
    hintRequestId.current += 1;
    if (hintTimer.current !== null) window.clearTimeout(hintTimer.current);
    hintWorker.current?.terminate();
  }, []);

  useEffect(() => {
    setCursor({ x: Math.floor(game.size / 2), y: Math.floor(game.size / 2) });
    setPending(null);
  }, [game.size]);

  useEffect(() => {
    if (game.status !== "playing" || game.currentPlayer === playerColor) {
      setThinking(false);
      return;
    }

    const id = ++requestId.current;
    const fingerprint = gameFingerprint(game);
    setThinking(true);
    setAnnouncement(text.computerTurn);
    const delay = difficulty === "beginner" ? 260 : difficulty === "intermediate" ? 360 : 480;
    let worker: Worker | null = null;
    let settled = false;

    const applyComputerChoice = (choice: Omit<AiResponse, "id">) => {
      if (settled || requestId.current !== id || fingerprint !== gameFingerprint(game)) return;
      settled = true;
      cancelHint();
      setUndoStack((previous) => [...previous, game]);
      if (choice.point) {
        const result = tryPlay(game, choice.point);
        if (result.ok) {
          setGame(result.state);
          setAnnouncement(`${text.computerPlayed} ${coordinateLabel(choice.point, game.size)}`);
        } else {
          setAnnouncement(text.computerPassed);
          setGame(passTurn(game));
        }
      } else {
        const passed = passTurn(game);
        setGame(passed);
        setAnnouncement(passed.status === "scoring" ? text.twoPasses : text.computerPassed);
      }
      setHint(null);
      setPending(null);
      setThinking(false);
    };

    const runFallback = () => {
      if (settled || requestId.current !== id) return;
      try {
        applyComputerChoice(chooseAiMove(game, difficulty, seedFor(game) ^ 0x51ed270b));
      } catch {
        applyComputerChoice({ point: null, reason: "pass" });
      }
    };

    const timer = window.setTimeout(() => {
      try {
        worker = new Worker(new URL("./game/ai.worker.ts", import.meta.url), { type: "module" });
        worker.onmessage = (event: MessageEvent<AiResponse>) => {
          if (event.data.id !== id || requestId.current !== id || fingerprint !== gameFingerprint(game)) return;
          applyComputerChoice(event.data);
          worker?.terminate();
        };
        worker.onerror = (event) => {
          event.preventDefault();
          runFallback();
          worker?.terminate();
        };
        worker.postMessage({ id, state: game, difficulty, seed: seedFor(game) });
      } catch {
        runFallback();
        worker?.terminate();
      }
    }, delay);

    return () => {
      window.clearTimeout(timer);
      worker?.terminate();
    };
  }, [cancelHint, difficulty, game, playerColor, text.computerPassed, text.computerPlayed, text.computerTurn, text.twoPasses]);

  const explainIllegal = (reason: "occupied" | "suicide" | "superko" | "out-of-bounds" | "not-playing") => {
    if (reason === "occupied") return text.illegalOccupied;
    if (reason === "suicide") return text.illegalSuicide;
    if (reason === "superko") return text.illegalSuperko;
    return text.yourTurn;
  };

  const commitHumanMove = (point: Point) => {
    if (!isHumanTurn) return;
    const result = tryPlay(game, point);
    if (!result.ok) {
      setAnnouncement(explainIllegal(result.reason));
      setPending(null);
      cancelHint();
      return;
    }
    cancelHint();
    setUndoStack((previous) => [...previous, game]);
    setGame(result.state);
    setPending(null);
    setAnnouncement(`${text.movePlayed} ${coordinateLabel(point, game.size)}`);
  };

  const handlePoint = (point: Point) => {
    if (!isHumanTurn) return;
    const legality = tryPlay(game, point);
    if (!legality.ok) {
      setAnnouncement(explainIllegal(legality.reason));
      setPending(null);
      setHint(null);
      return;
    }
    if (!mustConfirm || samePoint(pending, point)) commitHumanMove(point);
    else {
      setPending(point);
      setHint(null);
      setAnnouncement(`${text.selectedPoint}: ${coordinateLabel(point, game.size)}. ${text.selectAgain}`);
    }
  };

  const startNewGame = (nextSize = game.size, nextDifficulty = difficulty, nextColor = playerColor, ask = true) => {
    if (ask && game.moveNumber > 0 && !window.confirm(text.confirmReset)) return;
    requestId.current += 1;
    cancelHint();
    setDifficulty(nextDifficulty);
    setPlayerColor(nextColor);
    setGame(createGame(nextSize));
    setUndoStack([]);
    setPending(null);
    setDeadStones(new Set());
    setThinking(false);
    setAnnouncement(nextColor === BLACK ? text.yourTurn : text.computerTurn);
  };

  const selectCourse = (nextDifficulty: Difficulty) => {
    if (pageCourse && nextDifficulty !== pageCourse) {
      if (game.moveNumber > 0 && !window.confirm(text.confirmReset)) return;
      requestId.current += 1;
      cancelHint();
      window.location.assign(`/${language}/course/${nextDifficulty}/`);
      return;
    }
    const nextSize = text.courses[nextDifficulty].size;
    startNewGame(nextSize, nextDifficulty, playerColor);
  };

  const handlePass = () => {
    if (!isHumanTurn) return;
    cancelHint();
    setUndoStack((previous) => [...previous, game]);
    const passed = passTurn(game);
    setGame(passed);
    setPending(null);
    setAnnouncement(passed.status === "scoring" ? text.twoPasses : text.youPassed);
  };

  const handleUndo = () => {
    if (!canUndo) return;
    requestId.current += 1;
    cancelHint();
    const targetIndex = Math.max(0, undoStack.length - 2);
    const target = undoStack[targetIndex];
    setGame(target);
    setUndoStack((previous) => previous.slice(0, targetIndex));
    setDeadStones(new Set());
    setPending(null);
    setAnnouncement(text.yourTurn);
  };

  const handleHint = () => {
    if (!isHumanTurn || hintBusy) return;
    cancelHint();
    const id = ++hintRequestId.current;
    const fingerprint = gameFingerprint(game);
    setHintBusy(true);
    setAnnouncement(language === "ko" ? "좋은 수를 찾고 있어요…" : "正在计算推荐落点…");

    const complete = (choice: Omit<AiResponse, "id">) => {
      if (hintRequestId.current !== id || latestFingerprint.current !== fingerprint) return;
      setHint(choice);
      setPending(choice.point);
      setHintBusy(false);
      setAnnouncement(
        choice.point
          ? `${text.hintAt}: ${coordinateLabel(choice.point, game.size)}. ${text.hintReason[choice.reason]}`
          : text.hintReason.pass,
      );
      hintWorker.current?.terminate();
      hintWorker.current = null;
    };

    const fallback = () => {
      try {
        complete(chooseAiMove(game, difficulty, seedFor(game) ^ 0x9e3779b9));
      } catch {
        if (hintRequestId.current !== id) return;
        setHintBusy(false);
        setAnnouncement(language === "ko" ? "힌트를 계산하지 못했습니다. 다시 시도해 주세요." : "暂时无法计算提示，请重试。");
      }
    };

    hintTimer.current = window.setTimeout(() => {
      hintTimer.current = null;
      try {
        const worker = new Worker(new URL("./game/ai.worker.ts", import.meta.url), { type: "module" });
        hintWorker.current = worker;
        worker.onmessage = (event: MessageEvent<AiResponse>) => {
          if (event.data.id === id) complete(event.data);
        };
        worker.onerror = (event) => {
          event.preventDefault();
          worker.terminate();
          hintWorker.current = null;
          fallback();
        };
        worker.postMessage({ id, state: game, difficulty, seed: seedFor(game) ^ 0x9e3779b9 });
      } catch {
        hintWorker.current?.terminate();
        hintWorker.current = null;
        fallback();
      }
    }, 40);
  };

  const toggleDeadGroup = (point: Point) => {
    if (game.status !== "scoring") return;
    const group = groupAt(game, point);
    if (!group.length) return;
    const removingMark = group.every((index) => deadStones.has(index));
    const color = game.board[group[0]] === BLACK ? text.black : text.white;
    setDeadStones((previous) => {
      const next = new Set(previous);
      const remove = group.every((index) => next.has(index));
      for (const index of group) {
        if (remove) next.delete(index);
        else next.add(index);
      }
      return next;
    });
    setAnnouncement(language === "ko"
      ? `${coordinateLabel(point, game.size)}, ${color} ${group.length}개를 ${removingMark ? "죽은 돌 표시에서 복구했습니다." : "죽은 돌로 표시했습니다."}`
      : `${coordinateLabel(point, game.size)}，已${removingMark ? "恢复" : "标记"}${group.length}颗${color}${removingMark ? "。" : "为死子。"}`);
  };

  const confirmScore = () => {
    const summary = resultText(language, score);
    setGame(finishGame(game, deadStones));
    setDeadStones(new Set());
    setAnnouncement(summary);
  };

  const continueGame = () => {
    cancelHint();
    setGame(resumeFromScoring(game));
    setDeadStones(new Set());
    setAnnouncement(game.currentPlayer === playerColor ? text.yourTurn : text.computerTurn);
  };

  const statusLabel = game.status === "finished"
    ? text.finished
    : game.status === "scoring"
      ? text.scoring
      : thinking || game.currentPlayer === computerColor
        ? text.computerTurn
        : text.yourTurn;

  const lastMove = game.lastMove ? coordinateLabel(game.lastMove, game.size) : text.none;
  const userCaptured = playerColor === BLACK ? game.captures.black : game.captures.white;
  const computerCaptured = computerColor === BLACK ? game.captures.black : game.captures.white;
  const otherLanguage: Language = language === "ko" ? "zh-cn" : "ko";

  const handleCourseKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>, course: Difficulty) => {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const currentIndex = courseOrder.indexOf(course);
    const nextIndex = event.key === "Home"
      ? 0
      : event.key === "End"
        ? courseOrder.length - 1
        : (currentIndex + (event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1) + courseOrder.length) % courseOrder.length;
    const nextCourse = courseOrder[nextIndex];
    selectCourse(nextCourse);
    window.requestAnimationFrame(() => {
      document.querySelector<HTMLButtonElement>(`[data-course-option="${nextCourse}"]`)?.focus();
    });
  };

  return (
    <>
      <header className="site-header">
        <a className="brand" href={`/${language}/`} aria-label={text.brand}>
          <span className="brand-mark" aria-hidden="true"><i /><i /></span>
          <span>{text.brand}</span>
        </a>
        <nav className="language-nav" aria-label={text.language}>
          <span>{language === "ko" ? "한국어" : "简体中文"}</span>
          <a href={alternatePath(language, pageCourse)} lang={otherLanguage === "ko" ? "ko" : "zh-CN"}>
            {language === "ko" ? "简体中文" : "한국어"}
          </a>
        </nav>
      </header>

      <main>
        <section className="hero-copy" aria-labelledby="game-title">
          <div>
            <p className="eyebrow">{text.eyebrow}</p>
            <h1 id="game-title">{pageTitle}</h1>
            <p className="hero-lead">{text.lead}</p>
          </div>
          <div className="offline-chip"><span aria-hidden="true" />{text.offline}</div>
        </section>

        <section className="game-shell" aria-label={text.title}>
          <div className="board-column">
            <div className="game-status">
              <div className="turn-status">
                <span className={`status-dot ${thinking ? "thinking" : ""}`} aria-hidden="true" />
                <div><small>{text.courses[difficulty].label} · {game.size}×{game.size}</small><strong>{statusLabel}</strong></div>
              </div>
              <div className="move-pill">{text.moveNumber} <strong>{game.moveNumber}</strong></div>
            </div>

            <p id="board-keyboard-help" className="sr-only">
              {language === "ko"
                ? "바둑판 조작: 화살표 키로 교차점을 이동하고 Enter 또는 Space로 선택하거나 착수합니다. Esc는 선택 취소, P는 패스입니다."
                : "棋盘操作：用方向键移动交叉点，按 Enter 或空格选择或落子，Esc 取消，P 停一手。"}
            </p>
            <div className={`board-frame ${thinking ? "is-thinking" : ""}`}>
              <Board
                state={game}
                pending={pending}
                cursor={cursor}
                deadStones={deadStones}
                disabled={thinking || (game.status === "playing" && !isHumanTurn) || game.status === "finished"}
                label={`${game.size}×${game.size} ${text.boardSize}`}
                descriptionId="board-keyboard-help"
                showMagnifier={mustConfirm}
                stoneLabels={{
                  empty: language === "ko" ? "빈 점" : "空位",
                  black: language === "ko" ? "흑돌" : "黑棋",
                  white: language === "ko" ? "백돌" : "白棋",
                  dead: language === "ko" ? "죽은 돌 표시" : "已标记死子",
                }}
                onPoint={handlePoint}
                onToggleDead={toggleDeadGroup}
                onCursor={setCursor}
                onCancel={() => setPending(null)}
                onPass={handlePass}
              />
              {thinking && <div className="thinking-overlay" role="status"><span /><span /><span /><b>{text.computerTurn}</b></div>}
            </div>

            <div className="live-message" aria-live="polite">
              <span>{announcement}</span>
              {pending && game.status === "playing" && <strong>{coordinateLabel(pending, game.size)}</strong>}
            </div>

            {pending && mustConfirm && game.status === "playing" && (
              <div className="confirm-bar">
                <button className="primary" type="button" onClick={() => commitHumanMove(pending)}>{text.confirmMove} · {coordinateLabel(pending, game.size)}</button>
                <button className="ghost" type="button" onClick={() => setPending(null)}>{text.cancel}</button>
              </div>
            )}

            {game.status === "scoring" && (
              <div className="score-panel">
                <div><p className="eyebrow">{text.markDead}</p><strong>{text.deadInstruction}</strong></div>
                <div className="score-grid">
                  <span>{text.blackScore}<b>{score.black.toFixed(1)}</b></span>
                  <span>{text.whiteScore}<b>{score.white.toFixed(1)}</b></span>
                  <span>{text.neutral}<b>{score.neutral}</b></span>
                </div>
                <div className="score-actions">
                  <button className="primary" type="button" onClick={confirmScore}>{text.confirmScore}</button>
                  <button className="ghost" type="button" onClick={continueGame}>{text.continueGame}</button>
                </div>
              </div>
            )}

            {game.status === "finished" && (
              <div className="result-panel" role="status">
                <p className="eyebrow">{text.finished}</p>
                <h2>{resultText(language, score)}</h2>
                <p>{text.blackScore} {score.black.toFixed(1)} · {text.whiteScore} {score.white.toFixed(1)}</p>
                <button className="primary" type="button" onClick={() => startNewGame(game.size, difficulty, playerColor, false)}>{text.newGame}</button>
              </div>
            )}

            <div className="action-row" role="group" aria-label={language === "ko" ? "대국 조작" : "对局操作"}>
              <button type="button" onClick={handleUndo} disabled={!canUndo}>{text.undo}</button>
              <button type="button" onClick={handlePass} disabled={!isHumanTurn}>{text.pass}</button>
              <button type="button" onClick={handleHint} disabled={!isHumanTurn || hintBusy}>{hintBusy ? "…" : text.hint}</button>
              <button type="button" onClick={() => startNewGame()}>{text.newGame}</button>
            </div>
          </div>

          <aside className="control-panel" aria-label={language === "ko" ? "대국 설정" : "对局设置"}>
            <section>
              <div className="section-heading"><p className="eyebrow">01</p><h2>{text.chooseCourse}</h2></div>
              <div className="course-selector" role="radiogroup" aria-label={text.chooseCourse}>
                {(Object.keys(text.courses) as Difficulty[]).map((course) => (
                  <button
                    key={course}
                    type="button"
                    role="radio"
                    aria-checked={difficulty === course}
                    tabIndex={difficulty === course ? 0 : -1}
                    data-course-option={course}
                    className={difficulty === course ? "selected" : ""}
                    onClick={() => selectCourse(course)}
                    onKeyDown={(event) => handleCourseKeyDown(event, course)}
                  >
                    <span><b>{text.courses[course].label}</b><small>{text.courses[course].short}</small></span>
                    <em>{text.courses[course].badge}</em>
                  </button>
                ))}
              </div>
              <p className="microcopy">{text.courseHint}</p>
            </section>

            <section className="settings-grid">
              <label>
                <span>{text.boardSize}</span>
                <select value={game.size} onChange={(event) => startNewGame(Number(event.target.value) as BoardSize, difficulty, playerColor)}>
                  <option value="9">9 × 9</option>
                  <option value="13">13 × 13</option>
                  <option value="19">19 × 19</option>
                </select>
              </label>
              <label>
                <span>{text.playerColor}</span>
                <select value={playerColor} onChange={(event) => startNewGame(game.size, difficulty, Number(event.target.value) as Player)}>
                  <option value={BLACK}>{text.black} · {language === "ko" ? "선수" : "先手"}</option>
                  <option value={WHITE}>{text.white} · {language === "ko" ? "후수" : "后手"}</option>
                </select>
              </label>
            </section>

            <section className="match-card">
              <div className="player-line"><span className={`stone-icon ${playerColor === BLACK ? "black" : "white"}`} /><p><small>{text.you}</small><strong>{playerColor === BLACK ? text.black : text.white}</strong></p><b>{text.captured} {userCaptured}</b></div>
              <div className="player-line"><span className={`stone-icon ${computerColor === BLACK ? "black" : "white"}`} /><p><small>{text.computer}</small><strong>{computerColor === BLACK ? text.black : text.white}</strong></p><b>{text.captured} {computerCaptured}</b></div>
              <div className="last-move"><span>{text.lastMove}</span><strong>{lastMove}</strong></div>
            </section>

            <section className="lesson-card">
              <div className="section-heading"><p className="eyebrow">02</p><h2>{language === "ko" ? "이번 대국의 관찰 포인트" : "本局观察重点"}</h2></div>
              <ol>{text.courses[difficulty].tips.map((tip) => <li key={tip}>{tip}</li>)}</ol>
              {hint && <p className="hint-note"><b>{text.hintAt}{hint.point ? ` ${coordinateLabel(hint.point, game.size)}` : ""}</b>{text.hintReason[hint.reason]}</p>}
            </section>

            <details className="rules-card">
              <summary>{text.rules}</summary>
              <p>{text.ruleSummary}</p>
              <p>{text.aiNotice}</p>
              <p>{text.localNotice}</p>
              <p>{text.keyboardHelp}</p>
            </details>
          </aside>
        </section>
      </main>
    </>
  );
}
