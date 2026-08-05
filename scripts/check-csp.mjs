/**
 * Keep the two Content-Security-Policies from drifting apart.
 *
 * The policy is written twice and has to be: `src/app/layout.tsx` emits a <meta>
 * copy that works on any host, and `public/_headers` is a real response header
 * so Cloudflare can also send `frame-ancestors`, which a meta tag cannot carry.
 * Only the first is built from `src/lib/rpc.ts`; the second is plain text no
 * build step touches.
 *
 * That asymmetry fails in the worst available way. Widen the meta policy alone
 * and every local check passes — `next build` is green, `npm run dev` can reach
 * the chain, the page works — while the deployed site cannot read the contract,
 * because the header is the stricter of the two and the browser takes the
 * intersection. The failure appears only on the domain, only in production, and
 * looks like an RPC outage.
 *
 * So: one origin, asserted in three places, plus a check that the widening was
 * done narrowly. Run by `npm run check:csp`; cheap enough to run before any
 * push that touches the policy.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(root, p), "utf8");

const problems = [];
const note = (m) => problems.push(m);

// --- the one source of truth ----------------------------------------------

const rpc = read("src/lib/rpc.ts");
const originMatch = rpc.match(/RPC_ORIGIN\s*=\s*"([^"]+)"/);
if (!originMatch) {
  console.error("check:csp — could not find RPC_ORIGIN in src/lib/rpc.ts");
  process.exit(1);
}
const origin = originMatch[1];

if (origin.endsWith("/")) note(`RPC_ORIGIN has a trailing slash (${origin}). A CSP origin has no path.`);
if (!origin.startsWith("https://")) note(`RPC_ORIGIN is not https (${origin}).`);

// --- what each policy actually says ---------------------------------------

/** Pull one directive out of a policy string. */
function directive(policy, name) {
  const found = policy
    .split(";")
    .map((d) => d.trim())
    .find((d) => d === name || d.startsWith(`${name} `));
  return found ? found.slice(name.length).trim() : undefined;
}

const headers = read("public/_headers");
const headerPolicy = headers.match(/^\s*Content-Security-Policy:\s*(.+)$/m)?.[1];
if (!headerPolicy) note("public/_headers has no Content-Security-Policy line.");

const layout = read("src/app/layout.tsx");

// connect-src is now exactly 'self' plus the RPC, and no wildcard is permitted
// anywhere in it. It used to also carry five WalletConnect wildcards, which the
// widening check below had to be taught to tolerate; removing the wallet
// integration removed the only reason that exemption existed, so it is gone from
// here too. Re-adding a connector means re-adding both halves — the origins
// here, and the strip in the widening check — deliberately, because a wildcard
// that slips into this directive unnoticed is the failure this file exists for.
const expected = `'self' ${origin}`;

// The header copy is literal text, so it is compared literally.
if (headerPolicy) {
  const connect = directive(headerPolicy, "connect-src");
  if (connect === undefined) note("public/_headers: CSP has no connect-src at all.");
  else if (connect !== expected)
    note(`public/_headers: connect-src is "${connect}", expected "${expected}".`);

  if (!directive(headerPolicy, "frame-ancestors"))
    note("public/_headers: frame-ancestors is missing — that is the whole reason this file exists.");
}

// The layout copy is built from the constant, so what matters is that it still
// interpolates it rather than having been flattened to a hard-coded string.
if (!/connect-src 'self' \$\{RPC_ORIGIN\}/.test(layout))
  note("src/app/layout.tsx: connect-src is no longer built from RPC_ORIGIN.");

// --- the widening that would undo the point of all this --------------------

for (const [label, policy] of [
  ["public/_headers", headerPolicy],
  ["src/app/layout.tsx", layout],
]) {
  if (!policy) continue;
  // No exemptions any more: with the wallet stack gone there is no third party
  // that gets to be wildcarded, so the policy is checked as written.
  const cleaned = policy;
  // A bare `*`, a scheme-wildcard, or a wildcard host in connect-src or
  // default-src. `'self'` and named https origins are the only acceptable forms.
  const risky = /(connect-src|default-src)[^;"'`]*?(\*|https?:(?!\/\/[a-z0-9])|\bdata:)/i;
  if (risky.test(cleaned)) note(`${label}: connect-src or default-src has been widened with a wildcard.`);
}

// --- report ----------------------------------------------------------------

if (problems.length) {
  console.error("check:csp FAILED\n");
  for (const p of problems) console.error(`  • ${p}`);
  console.error("");
  process.exit(1);
}

console.log(
  `check:csp ok — connect-src is 'self' plus ${origin}, and nothing else, in both copies.`
);
