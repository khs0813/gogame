import { access, readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

const projectRoot = resolve(import.meta.dirname, "..");
const distRoot = resolve(projectRoot, "dist");
const siteUrl = (process.env.SITE_URL || "https://www.weiqigoplay.com").replace(/\/$/, "");
const googleSiteVerification = "43sVorkkUr7TBGfVu3khYLAtG1-110SLL7f5OqsNHZI";
const naverSiteVerification = "a0fa62b363c3d940182ce92917fef4248ef8a9bc";
const adfitSdkUrl = "https://t1.kakaocdn.net/kas/static/ba.min.js";
const adfitUnitIdPrefix = ["D", "A", "N", "-"].join("");
const pages = [
  { path: "/", lang: "ko" },
  { path: "/ko/", lang: "ko" },
  { path: "/zh-cn/", lang: "zh-CN" },
  { path: "/ko/rules/", lang: "ko", page: "rules" },
  { path: "/zh-cn/rules/", lang: "zh-CN", page: "rules" },
  { path: "/ko/course/beginner/", lang: "ko", course: "beginner" },
  { path: "/ko/course/intermediate/", lang: "ko", course: "intermediate" },
  { path: "/ko/course/advanced/", lang: "ko", course: "advanced" },
  { path: "/zh-cn/course/beginner/", lang: "zh-CN", course: "beginner" },
  { path: "/zh-cn/course/intermediate/", lang: "zh-CN", course: "intermediate" },
  { path: "/zh-cn/course/advanced/", lang: "zh-CN", course: "advanced" },
];
const gamePaths = new Set([
  "/ko/",
  "/zh-cn/",
  "/ko/course/beginner/",
  "/ko/course/intermediate/",
  "/ko/course/advanced/",
  "/zh-cn/course/beginner/",
  "/zh-cn/course/intermediate/",
  "/zh-cn/course/advanced/",
]);
const sourceScanEntries = [
  ".env.example",
  "index.html",
  "ko",
  "zh-cn",
  "src",
  "vite.config.ts",
  "scripts/validate-build.mjs",
  "render.yaml",
  "package.json",
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function htmlPath(path) {
  return path === "/" ? resolve(distRoot, "index.html") : resolve(distRoot, `.${path}`, "index.html");
}

async function collectFiles(entry) {
  const target = resolve(projectRoot, entry);
  try {
    const entries = await readdir(target, { withFileTypes: true });
    const files = [];
    for (const child of entries) {
      const childEntry = `${entry}/${child.name}`;
      if (child.isDirectory()) files.push(...await collectFiles(childEntry));
      else if (child.isFile()) files.push(resolve(projectRoot, childEntry));
    }
    return files;
  } catch {
    return [target];
  }
}

for (const page of pages) {
  const html = await readFile(htmlPath(page.path), "utf8");
  assert(!html.includes("__SITE_URL__"), `${page.path}: unresolved SITE_URL placeholder`);
  assert(html.includes(`<html lang="${page.lang}">`), `${page.path}: incorrect document language`);
  assert(html.includes("<h1"), `${page.path}: missing static H1`);
  assert(html.includes("<meta name=\"description\""), `${page.path}: missing description`);
  assert(html.includes('<meta property="og:title"'), `${page.path}: missing Open Graph title`);
  assert(html.includes('<meta property="og:description"'), `${page.path}: missing Open Graph description`);
  assert(html.includes(`<meta property="og:url" content="${siteUrl}${page.path}"`), `${page.path}: incorrect Open Graph URL`);
  assert(html.includes('name="applicable-device" content="pc,mobile"'), `${page.path}: missing Baidu mobile device hint`);
  assert(html.includes(`name="google-site-verification" content="${googleSiteVerification}"`), `${page.path}: missing Google site verification`);
  assert(html.includes(`name="naver-site-verification" content="${naverSiteVerification}"`), `${page.path}: missing Naver site verification`);
  assert(html.includes('type="application/rss+xml"'), `${page.path}: missing RSS discovery link`);
  assert(html.includes(`rel="canonical" href="${siteUrl}${page.path}"`), `${page.path}: incorrect canonical`);
  assert(html.includes('hreflang="ko"'), `${page.path}: missing Korean alternate`);
  assert(html.includes('hreflang="zh-CN"'), `${page.path}: missing Chinese alternate`);
  assert(html.includes('hreflang="x-default"'), `${page.path}: missing default alternate`);
  if (page.path === "/") {
    assert(html.includes('class="language-cards"'), "/: missing language chooser");
    assert(!html.includes('id="adfit-secondary-root"'), "/: root language chooser must not include ads");
  } else {
    assert(html.includes('id="app"'), `${page.path}: missing app mount`);
  }
  assert(!html.includes('id="adfit-mobile-root"'), `${page.path}: legacy mobile bottom ad root must not be present`);
  if (gamePaths.has(page.path)) {
    assert(html.includes('class="page-frame"'), `${page.path}: missing page-frame wrapper`);
    assert(html.includes('class="page-scroll-region"'), `${page.path}: missing page-scroll-region wrapper`);
    assert(html.includes('id="adfit-secondary-root"'), `${page.path}: missing secondary ad portal root`);
  } else {
    assert(!html.includes('id="adfit-secondary-root"'), `${page.path}: unexpected secondary ad portal root`);
  }
  if (page.course) assert(html.includes(`data-course="${page.course}"`), `${page.path}: incorrect course data`);
  if (page.page) assert(html.includes(`data-page="${page.page}"`), `${page.path}: incorrect page data`);

  for (const match of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    JSON.parse(match[1]);
  }
}

const sitemap = await readFile(resolve(distRoot, "sitemap.xml"), "utf8");
assert(sitemap.includes('xmlns:xhtml="http://www.w3.org/1999/xhtml"'), "sitemap: missing xhtml namespace");
for (const page of pages) assert(sitemap.includes(`<loc>${siteUrl}${page.path}</loc>`), `sitemap: missing ${page.path}`);
assert((sitemap.match(/<lastmod>/g) || []).length === pages.length, "sitemap: missing lastmod values");
assert((sitemap.match(/hreflang="ko"/g) || []).length === pages.length, "sitemap: incomplete Korean alternates");
assert((sitemap.match(/hreflang="zh-CN"/g) || []).length === pages.length, "sitemap: incomplete Chinese alternates");

const rssPages = pages.filter((page) => page.path !== "/");
const rss = await readFile(resolve(distRoot, "rss.xml"), "utf8");
assert(rss.includes('<rss version="2.0"'), "rss: missing RSS 2.0 root");
assert(rss.includes(`href="${siteUrl}/rss.xml"`), "rss: missing self link");
assert((rss.match(/<item>/g) || []).length === rssPages.length, "rss: incorrect item count");
assert((rss.match(/<dc:language>ko<\/dc:language>/g) || []).length === rssPages.filter((page) => page.lang === "ko").length, "rss: incomplete Korean items");
assert((rss.match(/<dc:language>zh-CN<\/dc:language>/g) || []).length === rssPages.filter((page) => page.lang === "zh-CN").length, "rss: incomplete Chinese items");
for (const page of rssPages) assert(rss.includes(`<link>${siteUrl}${page.path}</link>`), `rss: missing ${page.path}`);

const robots = await readFile(resolve(distRoot, "robots.txt"), "utf8");
assert(robots.includes(`Sitemap: ${siteUrl}/sitemap.xml`), "robots: incorrect sitemap URL");
await access(resolve(distRoot, "favicon.svg"));

const assets = await readdir(resolve(distRoot, "assets"));
assert(assets.some((file) => file.startsWith("main-") && file.endsWith(".js")), "assets: missing main bundle");
assert(assets.some((file) => file.startsWith("ai.worker-") && file.endsWith(".js")), "assets: missing AI worker");
assert(assets.some((file) => file.startsWith("styles-") && file.endsWith(".css")), "assets: missing stylesheet");

const sourceFiles = (await Promise.all(sourceScanEntries.map(collectFiles))).flat();
for (const file of sourceFiles) {
  const text = await readFile(file, "utf8");
  assert(!text.includes(adfitUnitIdPrefix), `${file}: real AdFit unit ID must not be hardcoded`);
}

let sdkUrlOccurrences = 0;
for (const asset of assets.filter((file) => file.endsWith(".js"))) {
  const text = await readFile(resolve(distRoot, "assets", asset), "utf8");
  sdkUrlOccurrences += text.split(adfitSdkUrl).length - 1;
}
assert(sdkUrlOccurrences === 1, `assets: expected one AdFit SDK loader URL, found ${sdkUrlOccurrences}`);

console.log(`Validated ${pages.length} pages, SEO files, JSON-LD and browser bundles.`);
