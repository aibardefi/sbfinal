/**
 * The device audit named in CLAUDE.md, as a script you can actually run.
 *
 * Every screen is a `scroll-snap-stop: always` panel of `min-height: 100dvh`, so
 * a panel taller than the viewport is not merely ugly — the overflow is close to
 * unreachable. `next build` is green either way. This measures the thing the
 * build cannot see.
 *
 * Two assertions per screen per viewport:
 *
 *   FIT     the panel is no taller than the viewport
 *   BOTTOM  the lowest line of text clears the bottom edge by >= 18px
 *
 * Both are measured only after the entrance animations have settled. Mid
 * entrance, content is still translated down and every reading is wrong — that
 * is how an earlier version of this script reported 17px of clearance on a
 * screen that actually had 79px.
 *
 * Usage:
 *   npm run build
 *   npm run audit               # every viewport
 *   npm run audit -- 320x568    # one
 *
 * Needs a Chromium on disk, and `playwright-core` to drive it — neither of which
 * `npm ci && next build` has any use for, which is why this is a script you run
 * rather than a CI gate. It looks for CHROME_PATH first, then the usual
 * Playwright cache locations.
 */
import { createServer } from "http";
import { readFileSync, existsSync, statSync, writeFileSync, unlinkSync } from "fs";
import { join, extname, dirname } from "path";
import { fileURLToPath } from "url";
import { tmpdir } from "os";
import { globSync } from "fs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "out");

let chromium;
try {
  ({ chromium } = await import("playwright-core"));
} catch {
  console.error("This needs playwright-core:  npm i -D playwright-core");
  process.exit(2);
}

/** The client's spec, plus the short landscape cases that caught real bugs. */
const VIEWPORTS = [
  // iPhone, every model still in use
  [320, 568, "iPhone SE 1 / 5s"],
  [375, 667, "iPhone SE 2-3 / 8"],
  [390, 844, "iPhone 12-14 / 15 / 16"],
  [393, 852, "iPhone 15-16 Pro"],
  [402, 874, "iPhone 16 Pro"],
  [414, 736, "iPhone 8 Plus"],
  [428, 926, "iPhone 12-14 Pro Max"],
  [430, 932, "iPhone 15-16 Plus / Pro Max"],
  // Android, the popular sizes
  [360, 640, "Galaxy S5-S8 / budget Android"],
  [360, 800, "Galaxy A-series / S22"],
  [384, 854, "Pixel 7-8"],
  [412, 915, "Pixel 6-8 Pro / S21-S24"],
  [412, 883, "Pixel 5 / 4a"],
  [480, 1067, "Galaxy S24 Ultra"],
  // Tablets, both ways up
  [768, 1024, "iPad mini / 9.7 portrait"],
  [810, 1080, "iPad 10.2 portrait"],
  [834, 1112, "iPad Air 10.5 portrait"],
  [1024, 768, "iPad 9.7 landscape"],
  [1080, 810, "iPad 10.2 landscape"],
  // Laptops and the short windows that never got a width-keyed rule
  [1024, 600, "netbook / short laptop window"],
  [1280, 720, "720p laptop"],
  [1440, 900, "MacBook Air"],
  [1920, 1080, "desktop"],
];

const MIN_BOTTOM = 18;

const TYPES = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
  ".woff2": "font/woff2",
  ".png": "image/png",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".json": "application/json",
  ".txt": "text/plain",
};

function findChromium() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const roots = [
    process.env.PLAYWRIGHT_BROWSERS_PATH,
    join(process.env.HOME ?? "", ".cache/ms-playwright"),
  ].filter(Boolean);
  for (const root of roots) {
    for (const p of [
      "chromium",
      "chromium-*/chrome-linux/chrome",
      "chromium-*/chrome-mac/Chromium.app/Contents/MacOS/Chromium",
    ]) {
      const hit = globSync(join(root, p)).sort().pop();
      if (hit) return hit;
    }
  }
  return undefined;
}

if (!existsSync(OUT)) {
  console.error("No out/. Run `npm run build` first.");
  process.exit(2);
}

/**
 * Serve out/ over HTTP. The export links its stylesheets at root-absolute paths
 * (/_next/static/...), which resolve to nothing over file:// — the page renders
 * in Times New Roman with no layout and every measurement is meaningless.
 */
const srv = createServer((req, res) => {
  const p = decodeURIComponent(req.url.split("?")[0]);
  let f = join(OUT, p);
  if (existsSync(f) && statSync(f).isDirectory()) f = join(f, "index.html");
  if (!existsSync(f)) f = join(OUT, p + ".html");
  if (!existsSync(f)) {
    res.writeHead(404);
    res.end("not found");
    return;
  }
  res.writeHead(200, { "content-type": TYPES[extname(f)] ?? "application/octet-stream" });
  res.end(readFileSync(f));
});
await new Promise((r) => srv.listen(0, "127.0.0.1", r));
const SITE = `http://127.0.0.1:${srv.address().port}/`;

const only = process.argv[2];
const list = only ? VIEWPORTS.filter((v) => `${v[0]}x${v[1]}` === only) : VIEWPORTS;
if (!list.length) {
  console.error(`No viewport ${only}. Known: ${VIEWPORTS.map((v) => `${v[0]}x${v[1]}`).join(" ")}`);
  process.exit(2);
}

const browser = await chromium.launch({
  executablePath: findChromium(),
  // The sandbox routes outbound HTTPS through a proxy; a loopback server is not
  // reachable through it.
  args: ["--no-proxy-server"],
});

const shell = join(tmpdir(), `cb-audit-${process.pid}.html`);
const failures = [];
let checked = 0;

for (const [w, h, name] of list) {
  /**
   * The panel is measured inside an iframe, not by setting the window to 390px:
   * headless Chrome enforces a ~500px minimum window and silently reports 485px,
   * so a narrow-phone run would test a width no phone has.
   */
  writeFileSync(
    shell,
    `<body style="margin:0"><iframe src="${SITE}" style="width:${w}px;height:${h}px;border:0;display:block"></iframe></body>`
  );
  const page = await browser.newPage({
    viewport: { width: Math.min(w + 12, 1936), height: h + 12 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("file://" + shell);
  await page.waitForTimeout(900);
  const frame = page.frames()[1];

  const sheets = await frame.evaluate(() => document.styleSheets.length);
  if (sheets < 2) {
    failures.push(`${w}x${h} ${name}: only ${sheets} stylesheet(s) loaded — measurements void`);
    await page.close();
    continue;
  }

  const count = await frame.evaluate(() => document.querySelectorAll("main > section").length);
  for (let i = 0; i < count; i++) {
    await frame.evaluate((n) => {
      document.querySelectorAll("main > section")[n].scrollIntoView();
    }, i);
    // Long enough for the entrance ladder (top 0 / head 90 / middle 240, each
    // 760ms) plus each section's own opening choreography.
    await page.waitForTimeout(2400);

    const m = await frame.evaluate((n) => {
      const sec = document.querySelectorAll("main > section")[n];
      const box = sec.getBoundingClientRect();
      // Leaf elements with text only. A wrapper's box includes children that may
      // be positioned anywhere, so wrappers say nothing about where the type is.
      let low = null;
      for (const el of sec.querySelectorAll("*")) {
        if (el.children.length || !el.textContent.trim()) continue;
        const st = getComputedStyle(el);
        if (st.visibility === "hidden" || st.display === "none") continue;
        if (parseFloat(st.opacity) < 0.05) continue;
        const r = el.getBoundingClientRect();
        if (!r.height) continue;
        if (!low || r.bottom > low.bottom) {
          low = { bottom: r.bottom, text: el.textContent.trim().slice(0, 28) };
        }
      }
      return {
        counter: sec.querySelector(".count")?.textContent?.trim() ?? `#${n}`,
        height: Math.round(box.height),
        low: low ? { bottom: Math.round(low.bottom), text: low.text } : null,
      };
    }, i);

    checked++;
    const where = `${w}x${h} ${name} — ${m.counter}`;
    if (m.height > h + 1) {
      failures.push(`FIT    ${where}: panel ${m.height}px in a ${h}px viewport (+${m.height - h})`);
    }
    if (m.low) {
      const clear = h - m.low.bottom;
      if (clear < MIN_BOTTOM) {
        failures.push(
          `BOTTOM ${where}: "${m.low.text}" clears the edge by ${clear}px, want ${MIN_BOTTOM}`
        );
      }
    }
  }

  if (errors.length) failures.push(`ERROR  ${w}x${h} ${name}: ${errors.slice(0, 3).join(" | ")}`);
  await page.close();
  process.stdout.write(`  ${w}x${h} ${name}\n`);
}

await browser.close();
srv.close();
try {
  unlinkSync(shell);
} catch {}

console.log(`\n${checked} panel measurements across ${list.length} viewport(s).`);
if (failures.length) {
  console.log(`\n${failures.length} failure(s):\n`);
  for (const f of failures) console.log("  " + f);
  process.exit(1);
}
console.log("All panels fit, and every lowest line clears the bottom edge.");
