import type { BoardSize, Difficulty } from "./game/types";

export type Language = "ko" | "zh-cn";

export interface CourseCopy {
  label: string;
  short: string;
  badge: string;
  size: BoardSize;
  tips: string[];
}

export interface Copy {
  brand: string;
  eyebrow: string;
  title: string;
  lead: string;
  offline: string;
  language: string;
  chooseCourse: string;
  courseHint: string;
  boardSize: string;
  playerColor: string;
  black: string;
  white: string;
  you: string;
  computer: string;
  yourTurn: string;
  computerTurn: string;
  scoring: string;
  finished: string;
  moveNumber: string;
  captured: string;
  lastMove: string;
  none: string;
  undo: string;
  pass: string;
  hint: string;
  newGame: string;
  confirmMove: string;
  cancel: string;
  selectedPoint: string;
  selectAgain: string;
  illegalOccupied: string;
  illegalSuicide: string;
  illegalSuperko: string;
  movePlayed: string;
  computerPlayed: string;
  computerPassed: string;
  youPassed: string;
  twoPasses: string;
  markDead: string;
  deadInstruction: string;
  confirmScore: string;
  continueGame: string;
  blackScore: string;
  whiteScore: string;
  neutral: string;
  winner: string;
  byPoints: string;
  hintAt: string;
  hintReason: Record<"capture" | "atari" | "connect" | "opening" | "territory" | "pass", string>;
  restored: string;
  confirmReset: string;
  rules: string;
  ruleSummary: string;
  aiNotice: string;
  localNotice: string;
  keyboardHelp: string;
  courses: Record<Difficulty, CourseCopy>;
}

export const copy: Record<Language, Copy> = {
  ko: {
    brand: "바둑 한 수",
    eyebrow: "회원가입 없이 바로 시작",
    title: "컴퓨터와 두는 무료 온라인 바둑",
    lead: "9·13·19줄 바둑판에서 초급·중급·고급 컴퓨터와 대국하며 단수, 연결, 사활과 집 계산을 익혀 보세요.",
    offline: "브라우저 안에서 작동하는 연습용 AI",
    language: "언어",
    chooseCourse: "난이도 코스",
    courseHint: "코스를 바꾸면 권장 판 크기로 새 대국이 시작됩니다.",
    boardSize: "바둑판",
    playerColor: "내 돌",
    black: "흑",
    white: "백",
    you: "나",
    computer: "컴퓨터",
    yourTurn: "당신의 차례입니다",
    computerTurn: "컴퓨터가 수를 읽고 있어요…",
    scoring: "죽은 돌을 확인하고 계가하세요",
    finished: "대국이 끝났습니다",
    moveNumber: "착수",
    captured: "잡은 돌",
    lastMove: "마지막 수",
    none: "없음",
    undo: "한 수 무르기",
    pass: "패스",
    hint: "힌트 보기",
    newGame: "새 대국",
    confirmMove: "이곳에 착수",
    cancel: "선택 취소",
    selectedPoint: "선택한 자리",
    selectAgain: "모바일과 큰 판에서는 확대 미리보기를 확인한 뒤 같은 자리를 한 번 더 누르거나 아래 버튼으로 확정하세요.",
    illegalOccupied: "이미 돌이 놓인 자리입니다.",
    illegalSuicide: "자기 돌의 활로가 없어 둘 수 없습니다.",
    illegalSuperko: "반복되는 판 모양이라 둘 수 없습니다.",
    movePlayed: "착수했습니다.",
    computerPlayed: "컴퓨터가 착수했습니다.",
    computerPassed: "컴퓨터가 패스했습니다.",
    youPassed: "패스했습니다.",
    twoPasses: "두 번 연속 패스했습니다. 죽은 돌을 표시한 뒤 계가하세요.",
    markDead: "죽은 돌 표시",
    deadInstruction: "죽었다고 판단한 돌을 누르면 연결된 돌 전체가 빠집니다. 다시 누르면 복구됩니다.",
    confirmScore: "계가 확정",
    continueGame: "계속 두기",
    blackScore: "흑 면적",
    whiteScore: "백 면적·덤 포함",
    neutral: "중립",
    winner: "승자",
    byPoints: "집 차이",
    hintAt: "추천 수",
    hintReason: {
      capture: "상대 돌을 잡을 수 있는 자리입니다.",
      atari: "단수를 만들거나 내 돌을 구하는 자리입니다.",
      connect: "내 돌을 연결해 모양을 튼튼하게 합니다.",
      opening: "초반 균형과 확장을 고려한 자리입니다.",
      territory: "집과 활로의 균형이 좋은 자리입니다.",
      pass: "현재는 패스를 고려할 수 있습니다.",
    },
    restored: "이 기기에 저장된 대국을 이어서 시작했습니다.",
    confirmReset: "진행 중인 대국을 끝내고 새로 시작할까요?",
    rules: "적용 규칙",
    ruleSummary: "중국식 면적 계가 · 백 덤 7.5집 · 자살수 금지 · 상황적 슈퍼코 · 연속 2회 패스 후 계가",
    aiNotice: "고급 코스도 전문 기사급이 아닌 강한 캐주얼 연습용 AI입니다.",
    localNotice: "대국과 설정은 이 브라우저에만 저장되며 외부로 전송되지 않습니다.",
    keyboardHelp: "키보드: 화살표로 이동, Enter로 선택·착수, Esc로 취소",
    courses: {
      beginner: {
        label: "초급",
        short: "활로와 단수부터 천천히",
        badge: "9줄 권장",
        size: 9,
        tips: ["돌의 활로를 먼저 확인하세요.", "상대가 단수라면 마지막 활로를 막아 보세요.", "모서리와 변은 적은 돌로 집을 만들기 쉽습니다."],
      },
      intermediate: {
        label: "중급",
        short: "연결·끊기와 기본 전술",
        badge: "13줄 권장",
        size: 13,
        tips: ["약한 돌을 연결하고 상대의 연결점을 끊어 보세요.", "잡기 전에 내 돌의 퇴로도 함께 읽으세요.", "국지전뿐 아니라 큰 곳의 선수를 찾으세요."],
      },
      advanced: {
        label: "고급",
        short: "형세·침입·끝내기 도전",
        badge: "19줄 권장",
        size: 19,
        tips: ["실리와 두터움의 교환을 판단하세요.", "상대 모양에 깊이 들어가기 전 삭감을 검토하세요.", "끝내기에서는 한 수의 집 가치를 비교하세요."],
      },
    },
  },
  "zh-cn": {
    brand: "围棋一手",
    eyebrow: "无需登录，即开即下",
    title: "免费在线人机围棋",
    lead: "在9路、13路和19路棋盘上与初级、中级或高级电脑对弈，边下边学习打吃、连接、死活和计分。",
    offline: "在浏览器内运行的练习型AI",
    language: "语言",
    chooseCourse: "难度课程",
    courseHint: "切换课程后，将使用推荐棋盘开始新对局。",
    boardSize: "棋盘",
    playerColor: "我的棋子",
    black: "黑棋",
    white: "白棋",
    you: "玩家",
    computer: "电脑",
    yourTurn: "轮到你落子",
    computerTurn: "电脑正在思考…",
    scoring: "请确认死子并计分",
    finished: "对局结束",
    moveNumber: "手数",
    captured: "提子",
    lastMove: "最后一手",
    none: "无",
    undo: "悔棋一步",
    pass: "停一手",
    hint: "查看提示",
    newGame: "重新开局",
    confirmMove: "确认落子",
    cancel: "取消选择",
    selectedPoint: "已选位置",
    selectAgain: "在手机或大棋盘上，请查看放大预览，再次点击同一位置或按下方按钮确认。",
    illegalOccupied: "这个位置已经有棋子。",
    illegalSuicide: "落子后没有气，不能下在这里。",
    illegalSuperko: "此手会重复之前的局面，不能落子。",
    movePlayed: "已经落子。",
    computerPlayed: "电脑已经落子。",
    computerPassed: "电脑停一手。",
    youPassed: "你选择停一手。",
    twoPasses: "双方连续停一手。请标记死子后计分。",
    markDead: "标记死子",
    deadInstruction: "点击判断为死棋的棋子，会移除整块相连棋子；再次点击可恢复。",
    confirmScore: "确认计分",
    continueGame: "继续对局",
    blackScore: "黑方面积",
    whiteScore: "白方面积·含贴目",
    neutral: "中立点",
    winner: "胜者",
    byPoints: "目数差",
    hintAt: "推荐位置",
    hintReason: {
      capture: "这里可以提掉对方棋子。",
      atari: "这里可以制造打吃或救出自己的棋。",
      connect: "这里能连接己方棋子，使棋形更稳固。",
      opening: "这是兼顾开局平衡与发展的落点。",
      territory: "这里在实地与气之间较为均衡。",
      pass: "当前可以考虑停一手。",
    },
    restored: "已恢复保存在本设备上的对局。",
    confirmReset: "要结束当前对局并重新开始吗？",
    rules: "对局规则",
    ruleSummary: "中国规则面积计分 · 白贴7.5目 · 禁止自杀 · 情境超级劫 · 连续两次停一手后计分",
    aiNotice: "高级课程仍是较强的休闲练习AI，并非职业棋手水平。",
    localNotice: "对局与设置只保存在当前浏览器中，不会上传。",
    keyboardHelp: "键盘：方向键移动，Enter选择或落子，Esc取消",
    courses: {
      beginner: {
        label: "初级",
        short: "从气和打吃开始",
        badge: "推荐9路",
        size: 9,
        tips: ["落子前先查看棋子的气。", "对方只剩一口气时，占据最后一口气即可提子。", "角和边通常更容易围成实地。"],
      },
      intermediate: {
        label: "中级",
        short: "连接、切断与基础战术",
        badge: "推荐13路",
        size: 13,
        tips: ["连接弱棋，并寻找切断对方的机会。", "进攻前也要读清自己棋子的退路。", "局部战斗之外，还要寻找全盘的大场和先手。"],
      },
      advanced: {
        label: "高级",
        short: "形势、打入与官子挑战",
        badge: "推荐19路",
        size: 19,
        tips: ["判断实地与厚势的交换是否合理。", "深入打入之前，先考虑较轻的侵消。", "官子阶段要比较每一手的目数价值。"],
      },
    },
  },
};

export function getLanguage(): Language {
  return document.documentElement.lang.toLowerCase().startsWith("zh") ? "zh-cn" : "ko";
}

export function getInitialDifficulty(): Difficulty {
  const value = document.body.dataset.course;
  if (value === "intermediate" || value === "advanced") return value;
  return "beginner";
}

export function alternatePath(language: Language, difficulty?: Difficulty): string {
  const target = language === "ko" ? "zh-cn" : "ko";
  return difficulty ? `/${target}/course/${difficulty}/` : `/${target}/`;
}
