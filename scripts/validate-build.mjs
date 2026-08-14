import { access, readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

const projectRoot = resolve(import.meta.dirname, "..");
const distRoot = resolve(projectRoot, "dist");
const siteUrl = (process.env.SITE_URL || "https://baduk-ai-course.onrender.com").replace(/\/$/, "");
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

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function htmlPath(path) {
  return path === "/" ? resolve(distRoot, "index.html") : resolve(distRoot, `.${path}`, "index.html");
}

for (const page of pages) {
  const html = await readFile(htmlPath(page.path), "utf8");
  assert(!html.includes("__SITE_URL__"), `${page.path}: unresolved SITE_URL placeholder`);
  assert(html.includes(`<html lang="${page.lang}">`), `${page.path}: incorrect document language`);
  assert(html.includes("<h1"), `${page.path}: missing static H1`);
  assert(html.includes("<meta name=\"description\""), `${page.path}: missing description`);
  assert(html.includes('name="applicable-device" content="pc,mobile"'), `${page.path}: missing Baidu mobile device hint`);
  assert(html.includes('type="application/rss+xml"'), `${page.path}: missing RSS discovery link`);
  assert(html.includes(`rel="canonical" href="${siteUrl}${page.path}"`), `${page.path}: incorrect canonical`);
  assert(html.includes('hreflang="ko"'), `${page.path}: missing Korean alternate`);
  assert(html.includes('hreflang="zh-CN"'), `${page.path}: missing Chinese alternate`);
  assert(html.includes('hreflang="x-default"'), `${page.path}: missing default alternate`);
  if (page.path === "/") assert(html.includes('class="language-cards"'), "/: missing language chooser");
  else assert(html.includes('id="app"'), `${page.path}: missing app mount`);
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

console.log(`Validated ${pages.length} pages, SEO files, JSON-LD and browser bundles.`);
