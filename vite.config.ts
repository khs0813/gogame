import { resolve } from "node:path";
import { writeFileSync } from "node:fs";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

const defaultSiteUrl = "https://baduk-ai-course.onrender.com";
const siteUrl = (process.env.SITE_URL || defaultSiteUrl).replace(/\/$/, "");

const languageGroups = [
  { entries: ["/", "/ko/", "/zh-cn/"], ko: "/ko/", zh: "/zh-cn/", fallback: "/" },
  { entries: ["/ko/rules/", "/zh-cn/rules/"], ko: "/ko/rules/", zh: "/zh-cn/rules/", fallback: "/ko/rules/" },
  { entries: ["/ko/course/beginner/", "/zh-cn/course/beginner/"], ko: "/ko/course/beginner/", zh: "/zh-cn/course/beginner/", fallback: "/ko/course/beginner/" },
  { entries: ["/ko/course/intermediate/", "/zh-cn/course/intermediate/"], ko: "/ko/course/intermediate/", zh: "/zh-cn/course/intermediate/", fallback: "/ko/course/intermediate/" },
  { entries: ["/ko/course/advanced/", "/zh-cn/course/advanced/"], ko: "/ko/course/advanced/", zh: "/zh-cn/course/advanced/", fallback: "/ko/course/advanced/" },
];

const rssItems = [
  {
    path: "/ko/",
    language: "ko",
    title: "바둑 한 수 | 무료 온라인 컴퓨터 바둑",
    description: [
      "로그인 없이 9·13·19줄 바둑판에서 초급·중급·고급 컴퓨터와 대국하며 단수, 연결, 사활과 집 계산을 배웁니다.",
      "바둑 한 수는 설명만 읽는 대신 직접 돌을 놓으며 규칙과 전술을 익히는 무료 연습장입니다.",
      "작은 9줄 바둑부터 넓은 19줄 바둑까지 단계적으로 도전하고, 활로, 단수, 돌 잡기, 연결, 사활과 집 계산을 실전으로 배울 수 있습니다.",
      "대국 계산은 브라우저 안에서 진행되며 대국 기록과 설정은 현재 기기에만 저장됩니다.",
    ].join(" "),
  },
  {
    path: "/zh-cn/",
    language: "zh-CN",
    title: "在线人机围棋｜初级·中级·高级免费下围棋",
    description: [
      "无需登录，选择初级、中级或高级电脑，在9路、13路或19路棋盘上免费对弈。",
      "围棋一手不是只读说明，而是让你直接落子练习规则与战术的免费训练场。",
      "从节奏明快的9路棋盘开始，再逐步挑战13路和19路，在实战中学习气、打吃、连接、死活和计分。",
      "页面首次载入后，电脑计算在浏览器内完成，对局记录与设置也只保存在当前设备。",
    ].join(" "),
  },
  {
    path: "/ko/rules/",
    language: "ko",
    title: "바둑 규칙 완전 입문 가이드 | 바둑 한 수",
    description: [
      "바둑을 처음 보는 사람도 이해할 수 있도록 착수 위치, 활로, 연결, 단수, 돌 잡기, 자살수 금지, 패와 슈퍼코를 그림 예시와 함께 설명합니다.",
      "중국식 면적 계가에서는 살아 있는 돌과 둘러싼 빈 점을 합산하며, 백은 7.5집 덤을 받습니다.",
      "두 선수가 연속으로 패스하면 계가 단계로 넘어가고, 죽은 돌을 표시한 뒤 흑 면적과 백 면적을 비교해 승자를 결정합니다.",
    ].join(" "),
  },
  {
    path: "/zh-cn/rules/",
    language: "zh-CN",
    title: "围棋规则完整入门图解｜围棋一手",
    description: [
      "从零基础开始，用图解说明围棋的落子位置、气、连接、打吃、提子、自杀禁手、劫与超级劫。",
      "中国规则面积计分会把存活棋子和围住的空点一起计算，白棋另加7.5目贴目。",
      "双方连续停一手后进入计分阶段，标记死棋并比较黑方面积与白方面积来决定胜负。",
    ].join(" "),
  },
  {
    path: "/ko/course/beginner/",
    language: "ko",
    title: "초급 바둑 코스 | 컴퓨터와 배우는 9줄 바둑 입문",
    description: [
      "바둑을 처음 배우는 분을 위한 무료 초급 코스입니다.",
      "9줄 바둑은 판이 작아 한 수의 결과를 빠르게 확인할 수 있습니다.",
      "돌에 상하좌우로 붙은 빈 교차점을 활로라고 하며, 활로가 하나만 남은 돌은 단수 상태입니다.",
      "상대 돌의 마지막 활로를 막아 돌을 잡고, 내 돌이 단수라면 빈 곳으로 달아나거나 가까운 내 돌과 연결하세요.",
      "모서리에서 작은 집을 완성하며 기본 계가 흐름도 익혀 볼 수 있습니다.",
    ].join(" "),
  },
  {
    path: "/zh-cn/course/beginner/",
    language: "zh-CN",
    title: "初级围棋课程｜9路人机对弈入门",
    description: [
      "面向零基础学习者的免费初级围棋课程。",
      "9路棋盘较小，每一步的结果都能很快看清。",
      "与棋子上下左右相邻的空交叉点叫作气，只剩一口气的棋子处于打吃状态，完全没有气时就会被提走。",
      "占据对方最后一口气就可以提子，自己的棋被打吃时可以延伸增加气，也可以与附近的己方棋子连接。",
      "从角上开始学习围地，并逐步熟悉基础计分方法。",
    ].join(" "),
  },
  {
    path: "/ko/course/intermediate/",
    language: "ko",
    title: "중급 바둑 코스 | 연결·끊기와 전술 컴퓨터 대국",
    description: [
      "기본 규칙을 익힌 분을 위한 무료 중급 바둑 코스입니다.",
      "13줄 바둑에서는 국지전과 넓은 곳의 선택이 함께 나타납니다.",
      "약한 내 돌 두 무리를 연결하면 공격받을 표적이 줄어들고, 상대 돌 사이의 연결점이 비어 있다면 끊어서 각각을 압박할 수 있습니다.",
      "축은 단수를 연속해서 몰아가는 잡기 방법이고, 장문은 상대 돌이 빠져나갈 길을 넓게 둘러막는 전술입니다.",
      "패의 가치와 팻감, 두 눈과 기초 사활을 함께 연습하며 한 수 앞의 전술을 읽어 봅니다.",
    ].join(" "),
  },
  {
    path: "/zh-cn/course/intermediate/",
    language: "zh-CN",
    title: "中级围棋课程｜连接、切断与战术训练",
    description: [
      "适合已经掌握基本规则的免费中级围棋课程。",
      "13路棋盘既有频繁的局部战斗，也需要选择全盘的大场。",
      "连接两块弱棋可以减少被攻击的目标，对方棋子之间如果留下断点，则可以考虑切断后分别施压。",
      "征子是连续打吃，把对方棋子沿斜线追赶的手段；枷吃则是不紧贴对方，而是从外侧封住逃跑路线。",
      "通过劫争价值、先手、真眼、假眼与基础死活练习，提高局部计算能力。",
    ].join(" "),
  },
  {
    path: "/ko/course/advanced/",
    language: "ko",
    title: "고급 바둑 코스 | 사활·형세·끝내기 컴퓨터 대국",
    description: [
      "기초 전술을 익힌 분을 위한 무료 고급 바둑 코스입니다.",
      "19줄 바둑의 좋은 수는 한 곳의 이득만으로 결정되지 않습니다.",
      "실리와 두터움, 공격과 수비, 선후수와 끝내기 가치를 함께 비교하며 가장 급한 곳과 가장 큰 곳을 구분해 봅니다.",
      "상대 진영이 지나치게 넓다면 깊은 침입과 가벼운 삭감 중 하나를 선택하고, 공격 중에도 내 약한 돌이 생기지 않는지 계속 확인하세요.",
      "후수로 끝나는 큰 수와 작더라도 선수를 유지하는 수의 순서를 판단하며 끝내기 가치를 계산합니다.",
    ].join(" "),
  },
  {
    path: "/zh-cn/course/advanced/",
    language: "zh-CN",
    title: "高级围棋课程｜死活、形势与官子挑战",
    description: [
      "面向掌握基础战术的免费高级围棋课程。",
      "19路围棋中的好手不能只看一个局部，要同时比较实地与厚势、进攻与防守、先手与后手。",
      "已经围住的实地可以直接计算，厚势则通过未来的攻击和扩张产生价值。",
      "对方模样过大时，可以深入其中求活，也可以从外围限制规模；选择前要预先规划撤退路线。",
      "比较候选着法对双方目数造成的变化，同时判断落子后是先手还是后手，才能安排正确的官子次序。",
    ].join(" "),
  },
];

function escapeXml(value: string): string {
  return value.replace(/[<>&"']/g, (character) => {
    if (character === "<") return "&lt;";
    if (character === ">") return "&gt;";
    if (character === "&") return "&amp;";
    if (character === '"') return "&quot;";
    return "&apos;";
  });
}

function seoPlugin(): Plugin {
  return {
    name: "baduk-seo-files",
    transformIndexHtml(html) {
      const mobileMeta = '    <meta name="applicable-device" content="pc,mobile" />';
      const rssLink = `    <link rel="alternate" type="application/rss+xml" title="바둑 한 수 RSS" href="${siteUrl}/rss.xml" />`;
      return html
        .replaceAll("__SITE_URL__", siteUrl)
        .replace("  </head>", `${mobileMeta}\n${rssLink}\n  </head>`);
    },
    closeBundle() {
      const now = new Date();
      const buildDate = now.toUTCString();
      const buildDateIso = now.toISOString();
      const entries = languageGroups
        .flatMap((group) => group.entries.map((path) => ({ path, group })))
        .map(({ path, group }) => [
          "  <url>",
          `    <loc>${siteUrl}${path}</loc>`,
          `    <lastmod>${buildDateIso}</lastmod>`,
          `    <xhtml:link rel="alternate" hreflang="ko" href="${siteUrl}${group.ko}" />`,
          `    <xhtml:link rel="alternate" hreflang="zh-CN" href="${siteUrl}${group.zh}" />`,
          `    <xhtml:link rel="alternate" hreflang="x-default" href="${siteUrl}${group.fallback}" />`,
          "  </url>",
        ].join("\n"))
        .join("\n");
      writeFileSync(
        resolve(import.meta.dirname, "dist/sitemap.xml"),
        `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${entries}\n</urlset>\n`,
      );
      const rssEntries = rssItems
        .map((item) => [
          "    <item>",
          `      <title>${escapeXml(item.title)}</title>`,
          `      <link>${siteUrl}${item.path}</link>`,
          `      <guid isPermaLink="true">${siteUrl}${item.path}</guid>`,
          `      <dc:language>${item.language}</dc:language>`,
          `      <description>${escapeXml(item.description)}</description>`,
          `      <pubDate>${buildDate}</pubDate>`,
          "    </item>",
        ].join("\n"))
        .join("\n");
      writeFileSync(
        resolve(import.meta.dirname, "dist/rss.xml"),
        [
          '<?xml version="1.0" encoding="UTF-8"?>',
          '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">',
          "  <channel>",
          "    <title>바둑 한 수 | 围棋一手</title>",
          `    <link>${siteUrl}/</link>`,
          "    <description>한국어와 간체 중국어로 제공하는 무료 온라인 바둑 대국·학습 콘텐츠 피드</description>",
          `    <atom:link href="${siteUrl}/rss.xml" rel="self" type="application/rss+xml" />`,
          `    <lastBuildDate>${buildDate}</lastBuildDate>`,
          "    <ttl>1440</ttl>",
          rssEntries,
          "  </channel>",
          "</rss>",
          "",
        ].join("\n"),
      );
      writeFileSync(
        resolve(import.meta.dirname, "dist/robots.txt"),
        `User-agent: *\nAllow: /\nSitemap: ${siteUrl}/sitemap.xml\n`,
      );
    },
  };
}

export default defineConfig({
  plugins: [react(), seoPlugin()],
  build: {
    target: "es2022",
    rollupOptions: {
      input: {
        root: resolve(import.meta.dirname, "index.html"),
        ko: resolve(import.meta.dirname, "ko/index.html"),
        zh: resolve(import.meta.dirname, "zh-cn/index.html"),
        koRules: resolve(import.meta.dirname, "ko/rules/index.html"),
        zhRules: resolve(import.meta.dirname, "zh-cn/rules/index.html"),
        koBeginner: resolve(import.meta.dirname, "ko/course/beginner/index.html"),
        koIntermediate: resolve(import.meta.dirname, "ko/course/intermediate/index.html"),
        koAdvanced: resolve(import.meta.dirname, "ko/course/advanced/index.html"),
        zhBeginner: resolve(import.meta.dirname, "zh-cn/course/beginner/index.html"),
        zhIntermediate: resolve(import.meta.dirname, "zh-cn/course/intermediate/index.html"),
        zhAdvanced: resolve(import.meta.dirname, "zh-cn/course/advanced/index.html"),
      },
    },
  },
});
