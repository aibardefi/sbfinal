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

/**
 * Every phone appears twice, and the second number is the point.
 *
 * A device's screen resolution is not the viewport a browser hands the page. On a
 * 320x568 iPhone SE, Safari gives about 460px with both bars showing and 548px
 * with one — never 568. This list used to carry resolutions only, so it passed
 * while five of eight screens overflowed at the height that phone actually has.
 *
 * So: the browser height first, because that is the honest one, then the device
 * height as the generous reading still worth holding.
 */
const PHONES = [
  // [width, browser height with both bars, device height, name]
  [320, 460, 568, "iPhone SE 1 / 5s"],
  [375, 553, 667, "iPhone SE 2-3 / 8"],
  [375, 629, 812, "iPhone X / XS / 11 Pro / 12-13 mini"],
  [390, 659, 844, "iPhone 12-14 / 15 / 16"],
  [393, 664, 852, "iPhone 15-16 Pro"],
  [402, 680, 874, "iPhone 16 Pro"],
  [414, 622, 736, "iPhone 8 Plus"],
  [428, 745, 926, "iPhone 12-14 Pro Max"],
  [430, 745, 932, "iPhone 15-16 Plus / Pro Max"],
  [360, 512, 640, "Galaxy S5-S8 / budget Android"],
  [360, 672, 800, "Galaxy A-series / S22"],
  [384, 726, 854, "Pixel 7-8"],
  [412, 787, 915, "Pixel 6-8 Pro / S21-S24"],
  [412, 755, 883, "Pixel 5 / 4a"],
  [480, 939, 1067, "Galaxy S24 Ultra"],
];

/**
 * Portrait only, deliberately.
 *
 * Turned sideways these screens do overflow, and badly — at 844x312 seven of the
 * eight run past the bottom edge. That is a known, measured, accepted gap: the
 * client's call is that nobody reads this site with their phone on its side. It
 * is written down here rather than left as an absence so the next person to read
 * this list knows it is a decision and not an oversight.
 */
const VIEWPORTS = [
  ...PHONES.flatMap(([w, browser, device, name]) => [
    [w, browser, `${name} — browser height`],
    [w, device, `${name} — full height`],
  ]),
  // Tablets, both ways up: a tablet on its side is a normal way to hold one.
  [768, 1024, "iPad mini / 9.7 portrait"],
  [810, 1080, "iPad 10.2 portrait"],
  [834, 1112, "iPad Air 10.5 portrait"],
  [1024, 768, "iPad 9.7 landscape"],
  [1080, 810, "iPad 10.2 landscape"],
  // Laptops, and the short windows no width-keyed rule ever reached.
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
        // Page 1 carries no `NN / 08` counter — it is the app, not part of the
        // story — so fall back to its headline rather than an index nobody can
        // place.
        counter:
          sec.querySelector(".count")?.textContent?.trim() ??
          sec.querySelector("h1")?.textContent?.trim().slice(0, 28) ??
          `#${n}`,
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
// Named, not just "all panels fit". A green run is quoted later as evidence, and
// it should carry what it actually covered — an unqualified pass was cited once
// for a case this list had never run.
console.log(
  `All panels fit and every lowest line clears the bottom edge, ` +
    `across ${list.length} portrait phone and tablet/desktop viewport(s). ` +
    `Phones held sideways are not covered — see the note above VIEWPORTS.`
);
