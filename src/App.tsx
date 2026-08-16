import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { createPortal } from "react-dom";
import Board, { coordinateLabel } from "./Board";
import ResponsiveAdFit from "./ResponsiveAdFit";
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
const homeDesktopUnit = import.meta.env.VITE_ADFIT_HOME_DESKTOP?.trim() ?? "";
const homeMobileUnit = import.meta.env.VITE_ADFIT_HOME_MOBILE?.trim() ?? "";
const courseDesktopUnit = import.meta.env.VITE_ADFIT_COURSE_DESKTOP?.trim() ?? "";
const courseMobileUnit = import.meta.env.VITE_ADFIT_COURSE_MOBILE?.trim() ?? "";

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

type RuleStoneColor = "black" | "white";
type RuleMarkerKind = "liberty" | "move" | "forbidden" | "removed" | "blackTerritory" | "whiteTerritory" | "neutral";
type RuleLegendKind = RuleMarkerKind | "blackStone" | "whiteStone" | "deadStone";

interface RuleStoneExample {
  x: number;
  y: number;
  color: RuleStoneColor;
  dead?: boolean;
  faded?: boolean;
  label?: string;
}

interface RuleMarkerExample {
  x: number;
  y: number;
  kind: RuleMarkerKind;
  label?: string;
}

interface RuleBoardExample {
  title: string;
  ariaLabel: string;
  stones?: RuleStoneExample[];
  markers?: RuleMarkerExample[];
  note?: string;
  size?: number;
}

interface RuleDiagramCopy {
  label: string;
  boards: RuleBoardExample[];
  legend?: { kind: RuleLegendKind; label: string }[];
}

interface RuleSectionCopy {
  eyebrow: string;
  heading: string;
  body: string[];
  bullets: string[];
  diagram?: RuleDiagramCopy;
}

interface RulePageCopy {
  title: string;
  lead: string;
  languageName: string;
  rulesLink: string;
  quick: { label: string; value: string }[];
  sections: RuleSectionCopy[];
  glossaryTitle: string;
  glossary: { term: string; definition: string }[];
}

const rulePages = {
  ko: {
    title: "바둑 규칙 완전 입문 가이드",
    lead: "처음 보는 사람도 한 판을 끝까지 둘 수 있도록 착수 위치, 활로, 돌 잡기, 금지수, 패스와 계가를 그림과 함께 순서대로 설명합니다. 이 사이트는 중국식 면적 계가, 백 덤 7.5집, 자살수 금지, 상황적 슈퍼코를 적용합니다.",
    languageName: "한국어",
    rulesLink: "바둑 규칙",
    quick: [
      { label: "목표", value: "살아 있는 내 돌과 내 돌이 둘러싼 빈 점의 합을 크게 만듭니다." },
      { label: "차례", value: "흑부터 한 수씩 교대로 두며, 둘 곳이 작다고 판단하면 패스할 수 있습니다." },
      { label: "종료", value: "두 사람이 연속으로 패스하면 죽은 돌을 확인하고 점수를 계산합니다." },
    ],
    sections: [
      {
        eyebrow: "01",
        heading: "바둑판과 착수 위치",
        body: [
          "바둑돌은 칸 안이 아니라 선과 선이 만나는 교차점 위에 놓습니다. 9줄 바둑판에는 81개, 13줄에는 169개, 19줄에는 361개의 착수점이 있습니다.",
          "한 번 놓은 돌은 직접 움직이지 않습니다. 상대에게 잡히면 판에서 들어내고, 그 전까지는 그 자리에서 주변 돌과 연결되거나 집을 만드는 데 쓰입니다.",
        ],
        bullets: [
          "흑이 먼저 둡니다. 이후 흑과 백이 한 수씩 번갈아 둡니다.",
          "모서리의 돌은 기본 활로가 2개, 변은 3개, 중앙은 4개라서 위치마다 위험도가 다릅니다.",
          "이 사이트의 9줄, 13줄, 19줄 판은 크기만 다르고 적용 규칙은 같습니다.",
        ],
        diagram: {
          label: "착수는 교차점 위에",
          boards: [
            {
              title: "올바른 착수",
              ariaLabel: "5줄 바둑판 중앙 교차점에 흑돌이 놓인 예시",
              stones: [{ x: 2, y: 2, color: "black", label: "흑" }],
              markers: [{ x: 2, y: 2, kind: "move", label: "점" }],
              note: "돌은 네모 칸 안이 아니라 선이 만나는 점 위에 놓습니다.",
            },
          ],
          legend: [
            { kind: "move", label: "선택한 교차점" },
            { kind: "blackStone", label: "흑돌" },
          ],
        },
      },
      {
        eyebrow: "02",
        heading: "대국의 목표: 집과 면적",
        body: [
          "바둑의 목표는 대국이 끝났을 때 내 점수를 상대보다 크게 만드는 것입니다. 점수는 살아 있는 내 돌과 내 돌이 둘러싼 빈 교차점을 합쳐 셉니다.",
          "이 방식이 중국식 면적 계가입니다. 초보자는 우선 “내 돌이 살아 남아 빈 공간을 둘러싸면 점수가 된다”고 이해하면 충분합니다.",
        ],
        bullets: [
          "내 돌로 완전히 둘러싼 빈 점은 내 집이 됩니다.",
          "흑과 백이 모두 닿아 있는 빈 곳은 보통 어느 쪽 집도 아닌 중립점으로 봅니다.",
          "상대 돌을 많이 잡는 것도 좋지만, 결국 마지막 점수는 살아 있는 돌과 확보한 영역으로 결정됩니다.",
        ],
        diagram: {
          label: "면적 계가의 기본",
          boards: [
            {
              title: "돌 + 둘러싼 빈 점",
              ariaLabel: "흑과 백이 각각 빈 점 하나를 둘러싼 면적 계가 예시",
              stones: [
                { x: 1, y: 0, color: "black" },
                { x: 0, y: 1, color: "black" },
                { x: 2, y: 1, color: "black" },
                { x: 1, y: 2, color: "black" },
                { x: 3, y: 2, color: "white" },
                { x: 2, y: 3, color: "white" },
                { x: 4, y: 3, color: "white" },
                { x: 3, y: 4, color: "white" },
              ],
              markers: [
                { x: 1, y: 1, kind: "blackTerritory", label: "집" },
                { x: 3, y: 3, kind: "whiteTerritory", label: "집" },
              ],
              note: "표시된 빈 점은 주변을 둘러싼 색의 집입니다. 실제 점수에는 살아 있는 돌도 함께 들어갑니다.",
            },
          ],
          legend: [
            { kind: "blackTerritory", label: "흑이 둘러싼 빈 점" },
            { kind: "whiteTerritory", label: "백이 둘러싼 빈 점" },
          ],
        },
      },
      {
        eyebrow: "03",
        heading: "활로와 연결된 돌무리",
        body: [
          "활로는 돌의 상하좌우에 바로 붙어 있는 빈 교차점입니다. 돌은 활로가 남아 있어야 판 위에 살아 있을 수 있습니다.",
          "돌 여러 개가 상하좌우로 붙어 있으면 하나의 돌무리입니다. 돌무리는 활로를 함께 쓰지만, 대각선으로만 닿은 돌은 연결된 것이 아닙니다.",
        ],
        bullets: [
          "중앙의 돌 하나는 보통 활로 4개로 시작합니다.",
          "연결된 돌 두 개는 서로 닿은 쪽을 활로로 세지 않고, 바깥쪽 빈 점을 함께 씁니다.",
          "상대가 내 돌 사이를 끊으면 돌무리가 나뉘어 각각 따로 공격받을 수 있습니다.",
        ],
        diagram: {
          label: "초록 점이 활로",
          boards: [
            {
              title: "돌 하나의 활로",
              ariaLabel: "중앙 흑돌 하나와 상하좌우 활로 네 개",
              stones: [{ x: 2, y: 2, color: "black" }],
              markers: [
                { x: 2, y: 1, kind: "liberty" },
                { x: 1, y: 2, kind: "liberty" },
                { x: 3, y: 2, kind: "liberty" },
                { x: 2, y: 3, kind: "liberty" },
              ],
              note: "대각선 빈 점은 활로가 아닙니다. 상하좌우만 봅니다.",
            },
            {
              title: "연결된 돌무리",
              ariaLabel: "가로로 연결된 흑돌 두 개와 공유 활로 여섯 개",
              stones: [
                { x: 1, y: 2, color: "black" },
                { x: 2, y: 2, color: "black" },
              ],
              markers: [
                { x: 1, y: 1, kind: "liberty" },
                { x: 2, y: 1, kind: "liberty" },
                { x: 0, y: 2, kind: "liberty" },
                { x: 3, y: 2, kind: "liberty" },
                { x: 1, y: 3, kind: "liberty" },
                { x: 2, y: 3, kind: "liberty" },
              ],
              note: "상하좌우로 붙은 돌은 하나의 돌무리로 활로를 공유합니다.",
            },
          ],
          legend: [
            { kind: "liberty", label: "활로" },
            { kind: "blackStone", label: "연결된 흑돌" },
          ],
        },
      },
      {
        eyebrow: "04",
        heading: "단수와 돌 잡기",
        body: [
          "상대 돌무리의 활로가 하나만 남은 상태를 단수라고 합니다. 단수인 돌무리의 마지막 활로를 막으면 그 돌무리는 잡혀서 판에서 사라집니다.",
          "내 돌이 단수라면 먼저 도망갈 수 있는지 봅니다. 빈 점으로 한 칸 더 뻗거나, 가까운 내 돌과 연결해 활로를 늘리는 것이 기본 대응입니다.",
        ],
        bullets: [
          "상대 돌을 잡는 수는 마지막 활로를 정확히 막는 수입니다.",
          "잡힌 돌은 즉시 판에서 들어내며, 이 사이트의 대국 정보에는 잡은 돌 수가 기록됩니다.",
          "단수를 발견했더라도 더 큰 곳이 있을 수 있지만, 초보 단계에서는 잡을 수 있는 돌을 놓치지 않는 습관이 중요합니다.",
        ],
        diagram: {
          label: "마지막 활로를 막으면 잡힘",
          boards: [
            {
              title: "착수 전: 백 단수",
              ariaLabel: "백돌 하나가 흑돌 세 개에 둘러싸여 마지막 활로 하나만 남은 모습",
              stones: [
                { x: 2, y: 1, color: "black" },
                { x: 1, y: 2, color: "black" },
                { x: 3, y: 2, color: "black" },
                { x: 2, y: 2, color: "white" },
              ],
              markers: [{ x: 2, y: 3, kind: "move", label: "착수" }],
              note: "흑이 빨간 원 자리에 두면 백의 마지막 활로가 사라집니다.",
            },
            {
              title: "착수 후: 백 제거",
              ariaLabel: "흑돌 네 개가 놓이고 잡힌 백돌 위치가 비어 있는 모습",
              stones: [
                { x: 2, y: 1, color: "black" },
                { x: 1, y: 2, color: "black" },
                { x: 3, y: 2, color: "black" },
                { x: 2, y: 3, color: "black", label: "마지막 수" },
              ],
              markers: [{ x: 2, y: 2, kind: "removed", label: "잡힘" }],
              note: "잡힌 돌은 판에서 없어지고, 빈 자리는 다시 활로가 될 수 있습니다.",
            },
          ],
          legend: [
            { kind: "move", label: "이번에 둘 자리" },
            { kind: "removed", label: "잡혀서 비워진 자리" },
          ],
        },
      },
      {
        eyebrow: "05",
        heading: "둘 수 없는 자리와 예외",
        body: [
          "이미 돌이 놓인 교차점에는 둘 수 없습니다. 또한 내 돌을 놓은 뒤 그 돌무리의 활로가 하나도 없고 상대 돌도 잡지 못한다면 자살수라서 둘 수 없습니다.",
          "예외가 있습니다. 겉보기에는 활로가 없어 보여도, 그 수로 상대 돌을 잡아서 빈 자리가 생기면 합법입니다. 판정 순서는 “내가 둔다 → 상대 돌 중 활로 0인 돌을 들어낸다 → 내 활로를 확인한다”입니다.",
        ],
        bullets: [
          "금지: 돌이 있는 자리, 순수 자살수, 반복 국면을 만드는 수.",
          "허용: 착수와 동시에 상대 돌을 잡아 내 돌무리에 새 활로가 생기는 수.",
          "헷갈릴 때는 내가 둔 뒤 상대 돌이 잡히는지 먼저 확인하세요.",
        ],
        diagram: {
          label: "자살수와 잡는 수의 차이",
          boards: [
            {
              title: "금지: 순수 자살수",
              ariaLabel: "백이 중앙에 두면 흑돌 네 개에 둘러싸여 활로가 없어지는 금지수",
              stones: [
                { x: 2, y: 1, color: "black" },
                { x: 1, y: 2, color: "black" },
                { x: 3, y: 2, color: "black" },
                { x: 2, y: 3, color: "black" },
              ],
              markers: [{ x: 2, y: 2, kind: "forbidden", label: "금지" }],
              note: "백이 중앙에 두면 백돌의 활로가 0이고 잡는 돌도 없습니다.",
            },
            {
              title: "허용: 잡아서 활로 생성",
              ariaLabel: "백이 흑돌의 마지막 활로에 두면 흑돌을 잡아 합법이 되는 예시",
              stones: [
                { x: 2, y: 2, color: "black" },
                { x: 2, y: 1, color: "white" },
                { x: 1, y: 2, color: "white" },
                { x: 3, y: 2, color: "white" },
              ],
              markers: [{ x: 2, y: 3, kind: "move", label: "백" }],
              note: "백이 빨간 원에 두면 흑돌이 잡히므로 중앙 빈 자리가 백의 새 활로가 됩니다.",
            },
          ],
          legend: [
            { kind: "forbidden", label: "둘 수 없는 자리" },
            { kind: "move", label: "합법 착수" },
          ],
        },
      },
      {
        eyebrow: "06",
        heading: "패와 상황적 슈퍼코",
        body: [
          "패는 한 점을 바로 되잡으면 직전 모양이 끝없이 반복되는 형태입니다. 그래서 패에서는 방금 잡힌 쪽이 같은 자리를 즉시 되잡을 수 없습니다.",
          "이 사이트는 더 넓게, 과거에 나온 같은 차례의 판 모양을 반복하지 못하게 하는 상황적 슈퍼코를 적용합니다. 반복을 피하려면 다른 곳에 먼저 한 수를 두거나 패스해야 합니다.",
        ],
        bullets: [
          "패를 바로 되따는 수는 금지됩니다.",
          "다른 곳에 먼저 둔 수를 팻감이라고 부릅니다. 상대가 응수하면 다시 패를 둘 기회가 생길 수 있습니다.",
          "슈퍼코는 긴 반복 싸움을 막아 대국이 실제로 끝날 수 있게 해 줍니다.",
        ],
        diagram: {
          label: "즉시 되따기 금지",
          boards: [
            {
              title: "패 모양",
              ariaLabel: "백이 중앙 빈 점에 즉시 되따면 이전 국면이 반복되는 패 모양",
              stones: [
                { x: 2, y: 0, color: "white" },
                { x: 1, y: 1, color: "white" },
                { x: 3, y: 1, color: "white" },
                { x: 2, y: 1, color: "black" },
                { x: 1, y: 2, color: "black" },
                { x: 3, y: 2, color: "black" },
                { x: 2, y: 3, color: "black" },
              ],
              markers: [{ x: 2, y: 2, kind: "forbidden", label: "즉시 금지" }],
              note: "백이 표시된 자리를 바로 되잡으면 같은 모양이 반복되므로 먼저 다른 곳에 둬야 합니다.",
            },
          ],
          legend: [
            { kind: "forbidden", label: "반복 때문에 금지된 착수" },
            { kind: "blackStone", label: "방금 잡은 돌" },
          ],
        },
      },
      {
        eyebrow: "07",
        heading: "패스, 죽은 돌 표시, 계가",
        body: [
          "더 둘 곳이 없거나 남은 곳의 가치가 작다고 판단하면 패스할 수 있습니다. 흑과 백이 연속으로 패스하면 대국은 계가 단계로 넘어갑니다.",
          "계가 단계에서는 죽은 돌을 표시합니다. 죽은 돌은 살아날 길이 없고 상대 집 안에 남아 있는 돌입니다. 잘못 눌렀다면 같은 돌무리를 다시 눌러 복구할 수 있습니다.",
        ],
        bullets: [
          "아직 큰 빈 곳이 있거나 잡힐 수 있는 돌이 남아 있으면 패스하지 말고 계속 두세요.",
          "최종 점수는 흑 면적과 백 면적을 비교합니다.",
          "백은 후수 불리함을 보정하기 위해 7.5집 덤을 받습니다. 0.5집 때문에 동점은 나오지 않습니다.",
        ],
        diagram: {
          label: "계가 단계에서 보는 것",
          boards: [
            {
              title: "죽은 돌과 집",
              ariaLabel: "흑 집 안의 죽은 백돌을 표시하고 흑의 집을 세는 계가 예시",
              stones: [
                { x: 0, y: 0, color: "black" },
                { x: 1, y: 0, color: "black" },
                { x: 2, y: 0, color: "black" },
                { x: 0, y: 1, color: "black" },
                { x: 2, y: 1, color: "black" },
                { x: 0, y: 2, color: "black" },
                { x: 1, y: 2, color: "black" },
                { x: 2, y: 2, color: "black" },
                { x: 3, y: 2, color: "white" },
                { x: 2, y: 3, color: "white" },
                { x: 4, y: 4, color: "white" },
                { x: 3, y: 4, color: "white" },
                { x: 4, y: 3, color: "white" },
                { x: 1, y: 1, color: "white", dead: true, faded: true },
              ],
              markers: [
                { x: 1, y: 1, kind: "blackTerritory", label: "흑 집" },
                { x: 3, y: 3, kind: "whiteTerritory", label: "백 집" },
                { x: 2, y: 4, kind: "neutral", label: "중립" },
              ],
              note: "죽은 백돌은 흑 집 안에서 제거 대상으로 표시하고, 중립점은 어느 쪽 점수에도 넣지 않습니다.",
            },
          ],
          legend: [
            { kind: "deadStone", label: "죽은 돌 표시" },
            { kind: "blackTerritory", label: "흑 집" },
            { kind: "neutral", label: "중립점" },
          ],
        },
      },
      {
        eyebrow: "08",
        heading: "초보자가 매 수 확인할 순서",
        body: [
          "처음에는 모든 수를 깊게 읽으려 하지 않아도 됩니다. 착수 전마다 아래 순서만 확인해도 실수가 크게 줄어듭니다.",
          "이 사이트의 힌트와 한 수 무르기는 학습 보조 기능입니다. 힌트를 본 뒤에도 왜 그 자리가 활로, 연결, 잡기, 집 중 어느 목적에 맞는지 직접 확인해 보세요.",
        ],
        bullets: [
          "1단계: 내 돌이나 상대 돌 중 단수인 돌무리가 있는지 봅니다.",
          "2단계: 내 약한 돌을 연결하거나 활로를 늘릴 수 있는지 봅니다.",
          "3단계: 상대가 넓게 집을 만들려는 곳을 줄일 수 있는지 봅니다.",
          "4단계: 둘 곳이 정말 작아졌을 때만 패스를 누릅니다.",
        ],
        diagram: {
          label: "한 수 전 점검",
          boards: [
            {
              title: "위험한 돌 먼저 보기",
              ariaLabel: "흑돌 두 개가 연결하면 활로가 늘어나고 백돌 하나는 단수인 예시",
              stones: [
                { x: 1, y: 1, color: "black" },
                { x: 1, y: 3, color: "black" },
                { x: 3, y: 2, color: "white" },
                { x: 3, y: 1, color: "black" },
                { x: 4, y: 2, color: "black" },
                { x: 3, y: 3, color: "black" },
              ],
              markers: [
                { x: 1, y: 2, kind: "move", label: "연결" },
                { x: 2, y: 2, kind: "liberty", label: "활로" },
                { x: 3, y: 2, kind: "removed", label: "단수" },
              ],
              note: "초보자는 먼저 단수와 연결점을 찾고, 그 다음 큰 집을 만드는 곳을 비교하면 됩니다.",
            },
          ],
          legend: [
            { kind: "move", label: "후보 수" },
            { kind: "liberty", label: "활로 확인" },
            { kind: "removed", label: "단수인 돌" },
          ],
        },
      },
    ],
    glossaryTitle: "자주 나오는 말",
    glossary: [
      { term: "활로", definition: "돌무리의 상하좌우에 붙어 있는 빈 교차점입니다. 활로가 0이면 잡힙니다." },
      { term: "단수", definition: "돌무리의 활로가 1개만 남은 상태입니다. 다음에 막히면 잡힙니다." },
      { term: "돌무리", definition: "상하좌우로 이어진 같은 색 돌의 집합입니다. 대각선은 연결이 아닙니다." },
      { term: "집", definition: "내 살아 있는 돌이 둘러싼 빈 교차점입니다. 면적 계가에서는 살아 있는 돌도 점수에 들어갑니다." },
      { term: "덤", definition: "흑이 먼저 두는 이점을 보정하기 위해 백에게 주는 추가 점수입니다. 이 사이트는 7.5집입니다." },
      { term: "패", definition: "즉시 되잡으면 같은 모양이 반복되는 형태입니다. 바로 되따지 못합니다." },
    ],
  },
  "zh-cn": {
    title: "围棋规则图解入门指南",
    lead: "面向零基础初学者，按照落子位置、气、提子、禁手、停一手和计分的顺序，用小棋盘图示说明一盘棋如何从开局走到终局。本站采用中国规则面积计分法、白棋贴7.5目、禁止自杀着法和情境超级劫规则。",
    languageName: "简体中文",
    rulesLink: "围棋规则",
    quick: [
      { label: "目标", value: "让自己的活棋和围住的空点合计面积大于对方。" },
      { label: "轮次", value: "黑棋先行，双方轮流下一手；认为没有大棋可下时可以停一手。" },
      { label: "结束", value: "双方连续停一手后，标记死棋并计算最终分数。" },
    ],
    sections: [
      {
        eyebrow: "01",
        heading: "棋盘与落子位置",
        body: [
          "围棋子不是下在格子里，而是下在线与线相交的交叉点上。9路棋盘有81个落点，13路有169个，19路有361个。",
          "棋子一旦落下就不会移动。除非被对方提走，否则它会一直留在原处，用来连接己方棋子或围住地盘。",
        ],
        bullets: [
          "黑棋先下，然后黑白双方一手一手轮流落子。",
          "角上的棋通常只有2口气，边上3口气，中央4口气，所以位置不同，危险程度也不同。",
          "本站的9路、13路、19路棋盘只改变大小，基本规则完全相同。",
        ],
        diagram: {
          label: "棋子下在交叉点",
          boards: [
            {
              title: "正确落子",
              ariaLabel: "5路棋盘中央交叉点上有一颗黑棋",
              stones: [{ x: 2, y: 2, color: "black", label: "黑" }],
              markers: [{ x: 2, y: 2, kind: "move", label: "点" }],
              note: "请看线与线相交的位置，不是方格内部。",
            },
          ],
          legend: [
            { kind: "move", label: "选中的交叉点" },
            { kind: "blackStone", label: "黑棋" },
          ],
        },
      },
      {
        eyebrow: "02",
        heading: "对局目标：地盘与面积",
        body: [
          "围棋的目标是在终局时让自己的分数比对方大。分数由存活棋子和被己方围住的空交叉点共同组成。",
          "这就是中国规则面积计分。初学者可以先记住：棋子要活下来，同时用活棋围住空点。",
        ],
        bullets: [
          "完全被己方活棋围住的空点就是自己的地盘。",
          "同时接触黑棋和白棋的空点通常是中立点，不算任何一方的地盘。",
          "提子有价值，但胜负最终取决于活棋和地盘组成的总面积。",
        ],
        diagram: {
          label: "面积计分基础",
          boards: [
            {
              title: "棋子 + 围住的空点",
              ariaLabel: "黑白双方各自围住一个空点的面积计分示例",
              stones: [
                { x: 1, y: 0, color: "black" },
                { x: 0, y: 1, color: "black" },
                { x: 2, y: 1, color: "black" },
                { x: 1, y: 2, color: "black" },
                { x: 3, y: 2, color: "white" },
                { x: 2, y: 3, color: "white" },
                { x: 4, y: 3, color: "white" },
                { x: 3, y: 4, color: "white" },
              ],
              markers: [
                { x: 1, y: 1, kind: "blackTerritory", label: "地" },
                { x: 3, y: 3, kind: "whiteTerritory", label: "地" },
              ],
              note: "图中标出的空点属于围住它的颜色。实际面积还要把活棋本身也计入。",
            },
          ],
          legend: [
            { kind: "blackTerritory", label: "黑棋围住的空点" },
            { kind: "whiteTerritory", label: "白棋围住的空点" },
          ],
        },
      },
      {
        eyebrow: "03",
        heading: "气与相连的棋块",
        body: [
          "气是棋子上下左右相邻的空交叉点。棋子必须有气才能留在棋盘上。",
          "多个同色棋子通过上下左右相连时，视为同一块棋，共用所有气。只有斜着接触的棋子并没有连接。",
        ],
        bullets: [
          "中央一颗棋通常有4口气。",
          "两颗棋相连后，不再把它们互相接触的位置算作气，而是共用外侧的空点。",
          "如果被对方切断，原本的一块棋会变成两块，可能分别受到攻击。",
        ],
        diagram: {
          label: "绿色点是气",
          boards: [
            {
              title: "单颗棋的气",
              ariaLabel: "中央一颗黑棋和上下左右四口气",
              stones: [{ x: 2, y: 2, color: "black" }],
              markers: [
                { x: 2, y: 1, kind: "liberty" },
                { x: 1, y: 2, kind: "liberty" },
                { x: 3, y: 2, kind: "liberty" },
                { x: 2, y: 3, kind: "liberty" },
              ],
              note: "斜方向的空点不是气，只看上下左右。",
            },
            {
              title: "相连的棋块",
              ariaLabel: "横向相连的两颗黑棋和六口共享的气",
              stones: [
                { x: 1, y: 2, color: "black" },
                { x: 2, y: 2, color: "black" },
              ],
              markers: [
                { x: 1, y: 1, kind: "liberty" },
                { x: 2, y: 1, kind: "liberty" },
                { x: 0, y: 2, kind: "liberty" },
                { x: 3, y: 2, kind: "liberty" },
                { x: 1, y: 3, kind: "liberty" },
                { x: 2, y: 3, kind: "liberty" },
              ],
              note: "上下左右相连的同色棋子是一块棋，共用所有外侧的气。",
            },
          ],
          legend: [
            { kind: "liberty", label: "气" },
            { kind: "blackStone", label: "相连黑棋" },
          ],
        },
      },
      {
        eyebrow: "04",
        heading: "打吃与提子",
        body: [
          "一块棋只剩一口气时，就处于打吃状态。占住对方最后一口气后，这块棋会被提走。",
          "如果自己的棋被打吃，要先看能不能逃跑。向空点延伸，或与附近的己方棋子连接，是最基本的应对方式。",
        ],
        bullets: [
          "提子的关键是准确占住对方最后一口气。",
          "被提走的棋子会立即离开棋盘，本站也会记录提子数量。",
          "入门阶段先养成习惯：看到可以提的棋，不要轻易漏掉。",
        ],
        diagram: {
          label: "占住最后一口气",
          boards: [
            {
              title: "落子前：白棋被打吃",
              ariaLabel: "一颗白棋被三颗黑棋包围，只剩最后一口气",
              stones: [
                { x: 2, y: 1, color: "black" },
                { x: 1, y: 2, color: "black" },
                { x: 3, y: 2, color: "black" },
                { x: 2, y: 2, color: "white" },
              ],
              markers: [{ x: 2, y: 3, kind: "move", label: "下" }],
              note: "黑棋下在红圈处，白棋最后一口气消失。",
            },
            {
              title: "落子后：白棋被提",
              ariaLabel: "黑棋四颗围住中央，被提走的白棋位置已经变为空点",
              stones: [
                { x: 2, y: 1, color: "black" },
                { x: 1, y: 2, color: "black" },
                { x: 3, y: 2, color: "black" },
                { x: 2, y: 3, color: "black", label: "最后一手" },
              ],
              markers: [{ x: 2, y: 2, kind: "removed", label: "提" }],
              note: "被提走的位置变成空点，也可能成为己方的新气。",
            },
          ],
          legend: [
            { kind: "move", label: "本手落点" },
            { kind: "removed", label: "被提后变空的位置" },
          ],
        },
      },
      {
        eyebrow: "05",
        heading: "禁手与例外",
        body: [
          "已经有棋子的交叉点不能再落子。如果落子后自己的棋块没有任何气，并且没有提掉对方棋子，这就是自杀，也不能下。",
          "但有一个重要例外：如果这一手能先提掉对方棋子，提子后产生新的气，那么这一手合法。判断顺序是“我落子 → 提掉无气的对方棋 → 检查自己的气”。",
        ],
        bullets: [
          "禁止：已有棋子的位置、纯自杀、造成重复局面的着法。",
          "允许：落子同时提掉对方棋子，使己方获得新气的着法。",
          "不确定时，先判断这一手能不能提掉对方棋子。",
        ],
        diagram: {
          label: "自杀与提子的区别",
          boards: [
            {
              title: "禁止：纯自杀",
              ariaLabel: "白棋如果下在中央，会被四颗黑棋包围且没有气",
              stones: [
                { x: 2, y: 1, color: "black" },
                { x: 1, y: 2, color: "black" },
                { x: 3, y: 2, color: "black" },
                { x: 2, y: 3, color: "black" },
              ],
              markers: [{ x: 2, y: 2, kind: "forbidden", label: "禁" }],
              note: "白棋下在中央后没有气，也没有提掉任何黑棋。",
            },
            {
              title: "允许：提子后有气",
              ariaLabel: "白棋下在黑棋最后一口气处，可以提掉黑棋，因此合法",
              stones: [
                { x: 2, y: 2, color: "black" },
                { x: 2, y: 1, color: "white" },
                { x: 1, y: 2, color: "white" },
                { x: 3, y: 2, color: "white" },
              ],
              markers: [{ x: 2, y: 3, kind: "move", label: "白" }],
              note: "白棋下在红圈处会提掉黑棋，中央空点成为白棋的新气。",
            },
          ],
          legend: [
            { kind: "forbidden", label: "不能下的位置" },
            { kind: "move", label: "合法落子" },
          ],
        },
      },
      {
        eyebrow: "06",
        heading: "劫与情境超级劫",
        body: [
          "劫是立即回提会让棋盘回到刚才形状的局面。因此在劫中，被提的一方不能马上在同一点回提。",
          "本站进一步采用情境超级劫：如果某一手让棋盘回到过去同一方行棋时已经出现过的局面，就不能下。要避免重复，可以先在别处下一手，或选择停一手。",
        ],
        bullets: [
          "刚被提的一方不能立即回提这个劫。",
          "先在别处下的一手叫劫材；对方应了之后，可能重新获得争劫机会。",
          "超级劫能阻止长时间重复，让对局可以正常结束。",
        ],
        diagram: {
          label: "禁止立即回提",
          boards: [
            {
              title: "劫形",
              ariaLabel: "白棋如果立刻下在中央空点回提，会重复之前局面的劫形",
              stones: [
                { x: 2, y: 0, color: "white" },
                { x: 1, y: 1, color: "white" },
                { x: 3, y: 1, color: "white" },
                { x: 2, y: 1, color: "black" },
                { x: 1, y: 2, color: "black" },
                { x: 3, y: 2, color: "black" },
                { x: 2, y: 3, color: "black" },
              ],
              markers: [{ x: 2, y: 2, kind: "forbidden", label: "禁回提" }],
              note: "白棋不能马上在标记点回提，必须先在别处下一手。",
            },
          ],
          legend: [
            { kind: "forbidden", label: "因重复而禁止的落点" },
            { kind: "blackStone", label: "刚完成提子的棋" },
          ],
        },
      },
      {
        eyebrow: "07",
        heading: "停一手、标记死棋与计分",
        body: [
          "当你认为棋盘上没有更有价值的落点时，可以停一手。黑白双方连续停一手后，对局进入计分阶段。",
          "计分阶段需要标记死棋。死棋通常是留在对方地盘中、已经没有活路的棋块。标错时再次点击同一块棋即可恢复。",
        ],
        bullets: [
          "如果还有大的空点，或还有能被攻击的棋块，就不要急着停一手。",
          "最终比较黑方面积和白方面积。",
          "白棋获得7.5目贴目，用来补偿黑棋先行优势；0.5目也避免了平局。",
        ],
        diagram: {
          label: "计分阶段看什么",
          boards: [
            {
              title: "死棋与地盘",
              ariaLabel: "黑地中的白色死棋被标记，同时显示黑地、白地和中立点",
              stones: [
                { x: 0, y: 0, color: "black" },
                { x: 1, y: 0, color: "black" },
                { x: 2, y: 0, color: "black" },
                { x: 0, y: 1, color: "black" },
                { x: 2, y: 1, color: "black" },
                { x: 0, y: 2, color: "black" },
                { x: 1, y: 2, color: "black" },
                { x: 2, y: 2, color: "black" },
                { x: 3, y: 2, color: "white" },
                { x: 2, y: 3, color: "white" },
                { x: 4, y: 4, color: "white" },
                { x: 3, y: 4, color: "white" },
                { x: 4, y: 3, color: "white" },
                { x: 1, y: 1, color: "white", dead: true, faded: true },
              ],
              markers: [
                { x: 1, y: 1, kind: "blackTerritory", label: "黑地" },
                { x: 3, y: 3, kind: "whiteTerritory", label: "白地" },
                { x: 2, y: 4, kind: "neutral", label: "中立" },
              ],
              note: "黑地中的白棋被标记为死棋；中立点不计入任何一方分数。",
            },
          ],
          legend: [
            { kind: "deadStone", label: "死棋标记" },
            { kind: "blackTerritory", label: "黑地" },
            { kind: "neutral", label: "中立点" },
          ],
        },
      },
      {
        eyebrow: "08",
        heading: "初学者每一手的检查顺序",
        body: [
          "刚开始不用试图读清所有变化。每次落子前按下面顺序检查，就能明显减少失误。",
          "本站的提示和悔棋都是学习辅助。看完提示后，也建议自己判断这个点是为了补气、连接、提子，还是为了围地。",
        ],
        bullets: [
          "第1步：找出自己或对方是否有只剩一口气的棋块。",
          "第2步：看自己的弱棋能不能连接，或增加气。",
          "第3步：看能不能限制对方正在扩大的地盘。",
          "第4步：确认真的没有大棋可下时，再选择停一手。",
        ],
        diagram: {
          label: "落子前检查",
          boards: [
            {
              title: "先看危险棋",
              ariaLabel: "两颗黑棋通过连接点可以增加气，一颗白棋处于打吃状态",
              stones: [
                { x: 1, y: 1, color: "black" },
                { x: 1, y: 3, color: "black" },
                { x: 3, y: 2, color: "white" },
                { x: 3, y: 1, color: "black" },
                { x: 4, y: 2, color: "black" },
                { x: 3, y: 3, color: "black" },
              ],
              markers: [
                { x: 1, y: 2, kind: "move", label: "连" },
                { x: 2, y: 2, kind: "liberty", label: "气" },
                { x: 3, y: 2, kind: "removed", label: "打吃" },
              ],
              note: "初学者先找打吃和连接点，再比较哪里能围更大的地盘。",
            },
          ],
          legend: [
            { kind: "move", label: "候选点" },
            { kind: "liberty", label: "气" },
            { kind: "removed", label: "被打吃的棋" },
          ],
        },
      },
    ],
    glossaryTitle: "常见术语",
    glossary: [
      { term: "气", definition: "棋块上下左右相邻的空交叉点。没有气的棋会被提走。" },
      { term: "打吃", definition: "一块棋只剩一口气的状态。下一手被占住就会被提。" },
      { term: "棋块", definition: "通过上下左右相连的同色棋子。斜着接触不算连接。" },
      { term: "地", definition: "己方活棋围住的空点。中国规则还会把活棋本身计入面积。" },
      { term: "贴目", definition: "为了补偿黑棋先行优势，给白棋的额外分数。本站为7.5目。" },
      { term: "劫", definition: "如果立即回提就会重复棋形的局面。不能马上回提。" },
    ],
  },
} satisfies Record<Language, RulePageCopy>;

const ruleBoardViewSize = 420;
const ruleBoardPadding = 50;

function ruleMarkerClass(kind: RuleLegendKind): string {
  return `rule-swatch ${kind}`;
}

function RuleLegend({ items }: { items?: { kind: RuleLegendKind; label: string }[] }) {
  if (!items?.length) return null;
  return (
    <ul className="rule-legend">
      {items.map((item) => (
        <li key={`${item.kind}-${item.label}`}>
          <span className={ruleMarkerClass(item.kind)} aria-hidden="true" />
          <span>{item.label}</span>
        </li>
      ))}
    </ul>
  );
}

function RuleBoard({ board }: { board: RuleBoardExample }) {
  const size = board.size ?? 5;
  const step = (ruleBoardViewSize - ruleBoardPadding * 2) / (size - 1);
  const pointCenter = (x: number, y: number) => ({ cx: ruleBoardPadding + x * step, cy: ruleBoardPadding + y * step });
  const territoryMarkers = board.markers?.filter((marker) => marker.kind === "blackTerritory" || marker.kind === "whiteTerritory") ?? [];
  const foregroundMarkers = board.markers?.filter((marker) => marker.kind !== "blackTerritory" && marker.kind !== "whiteTerritory") ?? [];

  return (
    <figure className="rule-board-figure">
      <figcaption>{board.title}</figcaption>
      <svg className="rule-board-image" viewBox={`0 0 ${ruleBoardViewSize} ${ruleBoardViewSize}`} role="img" aria-label={board.ariaLabel}>
        <title>{board.ariaLabel}</title>
        <rect x="0" y="0" width={ruleBoardViewSize} height={ruleBoardViewSize} rx="22" fill="#d9a058" />
        <rect x="14" y="14" width={ruleBoardViewSize - 28} height={ruleBoardViewSize - 28} rx="16" fill="#e0b36d" opacity=".82" />
        {Array.from({ length: size }, (_, index) => {
          const position = ruleBoardPadding + index * step;
          return (
            <g key={`rule-line-${index}`} stroke="#563a22" strokeWidth="3.4">
              <line x1={ruleBoardPadding} x2={ruleBoardViewSize - ruleBoardPadding} y1={position} y2={position} />
              <line y1={ruleBoardPadding} y2={ruleBoardViewSize - ruleBoardPadding} x1={position} x2={position} />
            </g>
          );
        })}
        {territoryMarkers.map((marker) => {
          const { cx, cy } = pointCenter(marker.x, marker.y);
          return (
            <g key={`territory-${marker.x}-${marker.y}-${marker.kind}`}>
              <rect
                x={cx - 28}
                y={cy - 28}
                width="56"
                height="56"
                rx="12"
                fill={marker.kind === "blackTerritory" ? "#1e3f34" : "#fff7ea"}
                stroke={marker.kind === "blackTerritory" ? "#0f261f" : "#8e8272"}
                strokeWidth="3"
                opacity={marker.kind === "blackTerritory" ? ".78" : ".9"}
              />
              {marker.label && (
                <text
                  x={cx}
                  y={cy + 6}
                  textAnchor="middle"
                  fill={marker.kind === "blackTerritory" ? "#fffaf0" : "#25332c"}
                  fontSize="23"
                  fontWeight="900"
                >
                  {marker.label}
                </text>
              )}
            </g>
          );
        })}
        {board.stones?.map((stone, index) => {
          const { cx, cy } = pointCenter(stone.x, stone.y);
          const radius = 30;
          const crossPath = `M ${cx - 14} ${cy - 14} L ${cx + 14} ${cy + 14} M ${cx + 14} ${cy - 14} L ${cx - 14} ${cy + 14}`;
          return (
            <g key={`rule-stone-${index}`} opacity={stone.faded ? ".58" : "1"}>
              <circle
                cx={cx}
                cy={cy}
                r={radius}
                fill={stone.color === "black" ? "#111714" : "#fffaf0"}
                stroke={stone.color === "black" ? "#020403" : "#8b8377"}
                strokeWidth="3"
              />
              <circle cx={cx - 8} cy={cy - 9} r="9" fill={stone.color === "black" ? "#5f6763" : "#ffffff"} opacity={stone.color === "black" ? ".36" : ".82"} />
              {stone.label && (
                <text
                  x={cx}
                  y={cy + 7}
                  textAnchor="middle"
                  fill={stone.color === "black" ? "#fffaf0" : "#172720"}
                  fontSize="19"
                  fontWeight="900"
                >
                  {stone.label}
                </text>
              )}
              {stone.dead && (
                <>
                  <path d={crossPath} stroke="#fffaf0" strokeWidth="13" strokeLinecap="round" />
                  <path d={crossPath} stroke="#a51e18" strokeWidth="7" strokeLinecap="round" />
                </>
              )}
            </g>
          );
        })}
        {foregroundMarkers.map((marker) => {
          const { cx, cy } = pointCenter(marker.x, marker.y);
          const labelY = marker.y === 0 ? cy + 47 : cy - 36;
          return (
            <g key={`marker-${marker.x}-${marker.y}-${marker.kind}-${marker.label ?? ""}`} className={`rule-marker ${marker.kind}`}>
              {marker.kind === "liberty" && <circle cx={cx} cy={cy} r="13" fill="#2f9368" stroke="#fffaf0" strokeWidth="5" />}
              {marker.kind === "move" && (
                <>
                  <circle cx={cx} cy={cy} r="34" fill="none" stroke="#fffaf0" strokeWidth="12" />
                  <circle cx={cx} cy={cy} r="34" fill="none" stroke="#a51e18" strokeWidth="6" />
                </>
              )}
              {marker.kind === "forbidden" && (
                <>
                  <circle cx={cx} cy={cy} r="34" fill="#fff4ec" stroke="#a51e18" strokeWidth="6" />
                  <path d={`M ${cx - 15} ${cy - 15} L ${cx + 15} ${cy + 15} M ${cx + 15} ${cy - 15} L ${cx - 15} ${cy + 15}`} stroke="#a51e18" strokeWidth="9" strokeLinecap="round" />
                </>
              )}
              {marker.kind === "removed" && (
                <>
                  <circle cx={cx} cy={cy} r="28" fill="rgba(255,250,240,.62)" stroke="#8b1f16" strokeWidth="5" strokeDasharray="8 7" />
                  <path d={`M ${cx - 12} ${cy - 12} L ${cx + 12} ${cy + 12} M ${cx + 12} ${cy - 12} L ${cx - 12} ${cy + 12}`} stroke="#8b1f16" strokeWidth="6" strokeLinecap="round" />
                </>
              )}
              {marker.kind === "neutral" && <rect x={cx - 14} y={cy - 14} width="28" height="28" rx="5" fill="#706b62" stroke="#fffaf0" strokeWidth="4" transform={`rotate(45 ${cx} ${cy})`} />}
              {marker.label && marker.kind !== "blackTerritory" && marker.kind !== "whiteTerritory" && (
                <text x={cx} y={labelY} textAnchor="middle" fill="#172720" fontSize="19" fontWeight="900" stroke="#fffaf0" strokeWidth="6" paintOrder="stroke">
                  {marker.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {board.note && <p>{board.note}</p>}
    </figure>
  );
}

function RuleDiagram({ diagram }: { diagram: RuleDiagramCopy }) {
  return (
    <figure className="rules-diagram">
      <div className="rules-diagram-title">{diagram.label}</div>
      <div className={`rule-board-grid ${diagram.boards.length > 1 ? "has-pair" : ""}`}>
        {diagram.boards.map((board) => <RuleBoard key={board.title} board={board} />)}
      </div>
      <RuleLegend items={diagram.legend} />
    </figure>
  );
}

function rulesPath(language: Language): string {
  return `/${language}/rules/`;
}

function SiteHeader({
  language,
  text,
  alternateHref,
  rulesCurrent = false,
}: {
  language: Language;
  text: (typeof copy)[Language];
  alternateHref: string;
  rulesCurrent?: boolean;
}) {
  const otherLanguage: Language = language === "ko" ? "zh-cn" : "ko";
  return (
    <header className="site-header">
      <a className="brand" href={`/${language}/`} aria-label={text.brand}>
        <span className="brand-mark" aria-hidden="true"><i /><i /></span>
        <span>{text.brand}</span>
      </a>
      <div className="header-actions">
        <nav className="site-nav" aria-label={language === "ko" ? "주요 메뉴" : "主菜单"}>
          <a href={rulesPath(language)} aria-current={rulesCurrent ? "page" : undefined}>
            {rulePages[language].rulesLink}
          </a>
        </nav>
        <nav className="language-nav" aria-label={text.language}>
          <span>{rulePages[language].languageName}</span>
          <a href={alternateHref} lang={otherLanguage === "ko" ? "ko" : "zh-CN"}>
            {rulePages[otherLanguage].languageName}
          </a>
        </nav>
      </div>
    </header>
  );
}

function RulesPage() {
  const language = getLanguage();
  const text = copy[language];
  const page = rulePages[language];
  const otherLanguage: Language = language === "ko" ? "zh-cn" : "ko";
  return (
    <>
      <SiteHeader language={language} text={text} alternateHref={rulesPath(otherLanguage)} rulesCurrent />
      <main className="rules-page">
        <section className="rules-hero" aria-labelledby="rules-title">
          <p className="eyebrow">{language === "ko" ? "BADUK RULES" : "GO RULES"}</p>
          <h1 id="rules-title">{page.title}</h1>
          <p>{page.lead}</p>
        </section>
        <section className="rules-quick-grid" aria-label={language === "ko" ? "규칙 핵심 요약" : "规则核心摘要"}>
          {page.quick.map((item) => (
            <div key={item.label} className="rules-quick-item">
              <strong>{item.label}</strong>
              <p>{item.value}</p>
            </div>
          ))}
        </section>
        <article className="rules-article">
          {page.sections.map((section) => (
            <section className="rules-section" key={section.heading}>
              <div className="rules-section-copy">
                <p className="eyebrow">{section.eyebrow}</p>
                <h2>{section.heading}</h2>
                {section.body.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                <ul>
                  {section.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}
                </ul>
              </div>
              {section.diagram && <RuleDiagram diagram={section.diagram} />}
            </section>
          ))}
          <section className="rules-glossary" aria-labelledby="rules-glossary-title">
            <h2 id="rules-glossary-title">{page.glossaryTitle}</h2>
            <dl>
              {page.glossary.map((item) => (
                <div key={item.term}>
                  <dt>{item.term}</dt>
                  <dd>{item.definition}</dd>
                </div>
              ))}
            </dl>
          </section>
          <nav aria-label={language === "ko" ? "규칙 관련 이동" : "规则相关链接"}>
            <a href={`/${language}/`}>{language === "ko" ? "대국 시작하기" : "开始对局"}</a>
            <a href={`/${language}/course/beginner/`}>{language === "ko" ? "초급 코스" : "初级课程"}</a>
            <a href={`/${language}/course/intermediate/`}>{language === "ko" ? "중급 코스" : "中级课程"}</a>
            <a href={`/${language}/course/advanced/`}>{language === "ko" ? "고급 코스" : "高级课程"}</a>
          </nav>
        </article>
      </main>
    </>
  );
}

export default function App() {
  if (document.body.dataset.page === "rules") return <RulesPage />;
  return <GameApp />;
}

function GameApp() {
  const language = getLanguage();
  const text = copy[language];
  const pageCourse = document.body.dataset.course as Difficulty | undefined;
  const secondaryAdRoot = document.getElementById("adfit-secondary-root");
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
  const mustConfirm = !coarsePointer && game.size >= 13;
  const adUnits = pageCourse
    ? { desktop: courseDesktopUnit, mobile: courseMobileUnit }
    : { desktop: homeDesktopUnit, mobile: homeMobileUnit };
  const adLabel = language === "ko" ? "광고" : "广告";
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
      <SiteHeader language={language} text={text} alternateHref={alternatePath(language, pageCourse)} />

      <main>
        <section className="hero-copy" aria-labelledby="game-title">
          <div>
            <p className="eyebrow">{text.eyebrow}</p>
            <h1 id="game-title">{pageTitle}</h1>
            <p className="hero-lead">{text.lead}</p>
            {!pageCourse && (
              <a className="hero-cta" href="#learn-title">
                {language === "ko" ? "바둑 코스 살펴보기" : "查看围棋课程"}
              </a>
            )}
          </div>
          <div className="offline-chip"><span aria-hidden="true" />{text.offline}</div>
        </section>

        <ResponsiveAdFit
          desktopUnit={adUnits.desktop}
          mobileUnit={adUnits.mobile}
          placement={pageCourse ? "course-primary" : "home-primary"}
          label={adLabel}
        />

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
      {secondaryAdRoot
        ? createPortal(
            <ResponsiveAdFit
              desktopUnit={adUnits.desktop}
              mobileUnit={adUnits.mobile}
              placement={pageCourse ? "course-secondary" : "home-secondary"}
              label={adLabel}
            />,
            secondaryAdRoot,
          )
        : null}
    </>
  );
}
