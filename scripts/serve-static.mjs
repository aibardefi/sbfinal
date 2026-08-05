/**
 * Serve the static export the way Cloudflare will, on a port a phone can reach.
 *
 * `next dev` is not this site. It ships React's development build, the devtools
 * overlay and HMR, and none of those are in what visitors get — so a bug found
 * against `next dev` may not exist in production, and a bug in production may
 * not show up in dev. This serves `out/` — the exact bytes `next build` writes
 * and Cloudflare uploads — which is the only local thing worth trusting.
 *
 * **It applies `public/_headers`.** That file is plain text to Cloudflare and no
 * build step touches it, so anything that serves `out/` as bare files sends a
 * *different* policy than production does. That asymmetry is the specific
 * failure `scripts/check-csp.mjs` exists to prevent, and a preview server that
 * quietly drops the header would reintroduce it one layer down: the meta policy
 * permits a call, the header blocks it, and only the deployed site is broken.
 * So the rules are parsed and replayed here, including `frame-ancestors`, which
 * a <meta> tag cannot carry and which therefore CANNOT be tested any other way.
 *
 * **It binds 0.0.0.0, deliberately.** The whole point is opening it on a phone,
 * and a server on 127.0.0.1 is not reachable from one. It prints the LAN URL it
 * expects you to use.
 *
 * One thing it cannot fix: `http://` on a LAN address is not a *secure context*,
 * and neither is it under `next dev`. `navigator.clipboard` does not exist
 * there, so the copy-the-contract button does nothing on a phone however the
 * files are served — while working on a desktop, because `localhost` is granted
 * secure-context status and a LAN IP is not. That is the environment, not the
 * site. Test that one button over HTTPS or on the deployed branch URL.
 *
 * No dependency: `serve`, `http-server` and friends all pull a tree of packages
 * to do what forty lines of `node:http` do, and none of them read `_headers`.
 *
 *   npm run preview   # build, then serve
 *   npm run serve     # serve whatever is already in out/
 */

import { createServer } from "node:http";
import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { networkInterfaces } from "node:os";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(root, "out");
const port = Number(process.env.PORT ?? 6677);
const host = process.env.HOST ?? "0.0.0.0";

if (!existsSync(dir)) {
  console.error(
    `serve — there is no out/ to serve.\n\n  Run \`npm run build\` first, or \`npm run preview\` to do both.\n`
  );
  process.exit(1);
}

/* ---------------------------------------------------------------- _headers */

/**
 * Cloudflare's `_headers` format: a path pattern in column zero, its headers
 * indented under it, `#` for comments, blank lines between blocks. Only a
 * trailing `*` is supported here, which is all this file uses — a wildcard in
 * the middle would silently match nothing rather than half-work.
 */
function parseHeaders(text) {
  const blocks = [];
  let current = null;
  for (const raw of text.split("\n")) {
    const line = raw.replace(/\s+$/, "");
    if (!line.trim() || line.trim().startsWith("#")) continue;
    if (!/^\s/.test(line)) {
      current = { pattern: line.trim(), headers: [] };
      blocks.push(current);
      continue;
    }
    if (!current) continue;
    const at = line.indexOf(":");
    if (at === -1) continue;
    current.headers.push([line.slice(0, at).trim(), line.slice(at + 1).trim()]);
  }
  return blocks;
}

const headerFile = join(root, "public", "_headers");
const blocks = existsSync(headerFile) ? parseHeaders(readFileSync(headerFile, "utf8")) : [];

const matches = (pattern, path) =>
  pattern.endsWith("*") ? path.startsWith(pattern.slice(0, -1)) : pattern === path;

/**
 * Every matching block applies, in file order, so a later, more specific rule
 * overwrites an earlier general one — `/_next/static/*` beats `/*` on
 * Cache-Control while still inheriting its CSP. Same precedence Cloudflare uses.
 */
function headersFor(path) {
  const out = new Map();
  for (const b of blocks) {
    if (!matches(b.pattern, path)) continue;
    for (const [k, v] of b.headers) out.set(k, v);
  }
  return out;
}

/* ------------------------------------------------------------------ serving */

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ttf": "font/ttf",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
};

/** `out/` is a static export, so `/x` may be `x.html` or `x/index.html`. */
function resolveFile(path) {
  const candidates =
    path.endsWith("/")
      ? [join(dir, path, "index.html")]
      : [join(dir, path), join(dir, `${path}.html`), join(dir, path, "index.html")];
  for (const c of candidates) {
    // Never let a crafted path climb out of out/. `normalize` first, because
    // `..` inside the string is what does the climbing.
    const full = normalize(c);
    if (full !== dir && !full.startsWith(dir + sep)) continue;
    if (existsSync(full) && statSync(full).isFile()) return full;
  }
  return null;
}

const server = createServer((req, res) => {
  let path;
  try {
    path = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  } catch {
    res.writeHead(400).end("Bad request");
    return;
  }

  const file = resolveFile(path === "/" ? "/index.html" : path);
  const found = file !== null;
  const target = found ? file : join(dir, "404.html");

  // The header rules are keyed on the REQUEST path, the way Cloudflare matches
  // them — not on whatever file the path resolved to.
  const head = Object.fromEntries(headersFor(path));
  head["Content-Type"] = TYPES[extname(target).toLowerCase()] ?? "application/octet-stream";

  if (!found && !existsSync(target)) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("404");
    return;
  }

  head["Content-Length"] = statSync(target).size;
  res.writeHead(found ? 200 : 404, head);
  if (req.method === "HEAD") {
    res.end();
    return;
  }
  createReadStream(target).pipe(res);
});

server.listen(port, host, () => {
  const lan = Object.values(networkInterfaces())
    .flat()
    .filter((n) => n && n.family === "IPv4" && !n.internal)
    .map((n) => n.address);

  console.log(`\n  Serving out/ — the production build, with public/_headers applied.\n`);
  console.log(`    local    http://localhost:${port}`);
  for (const a of lan) console.log(`    network  http://${a}:${port}`);
  console.log(
    `\n  On a phone use a network URL. Note it is http, so it is not a secure\n` +
      `  context: navigator.clipboard is unavailable and the copy-contract button\n` +
      `  will do nothing there. Everything else is what production serves.\n`
  );
});
