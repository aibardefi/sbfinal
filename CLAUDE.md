# Working on this repo

Nine full-screen sections, scroll-snapped: the borrow screen, then eight of
story. Next 16 static export (`output: "export"`), CSS Modules per section,
design tokens in `globals.css`.

The borrow screen is the odd one out and stays that way. It has its own palette
and its own typeface, declared on its own `.stage` — **not** on `:root`, because
one unscoped theme toggle would repaint eight hand-coloured screens with it. It
is also outside the `NN / 08` count: it is the product, the eight are the story
about it.

**Pushing to `main` is deploying.** Cloudflare Pages watches this repo and
rebuilds `cykablyat.vip` in 2–3 minutes. There is no separate publish step. To
let someone look before it goes live, push a branch — Pages builds every
non-production branch to its own URL and leaves the domain alone.

## Where things are

| | |
| --- | --- |
| Screen order | `src/app/page.tsx` — counters (`03 / 08`) live in each component |
| Shared coins | `src/components/coins.tsx` — never redraw one, import it |
| Shared safe | `src/components/Vault.tsx` — screen 04 only, since 02 went |
| Entrance / replay | `src/lib/useEntrance.ts`, `useReplay.ts`, `useAutoRearm.ts` |
| Response headers | `public/_headers` — Cloudflare reads this at deploy |
| Artwork budget | `--art` on `.stage` in `globals.css`; each section converts it |
| Borrow screen | `src/components/ProtocolSection.tsx` + `protocol/`; `LIVE` arms it |
| Chain layer | `src/lib/` — `chain` `rpc` `abi` `protocol` `wallet` `tx`; viem, no wagmi |
| Thresholds | `src/lib/health.ts` — 80 / 90, and every mark is computed from them |
| Handover | `public/design/` — what page 1 is pointed at and what not to change |
| Device audit | `npm run audit` — 39 viewports x 9 screens; see "Checks" below |
| CSP check | `npm run check:csp` — the meta and header policies must agree |

## Checks that have caught real bugs here

Each of these is a mistake that actually shipped or nearly shipped in this repo.
They are cheap; run them.

**`npm run audit` before shipping anything that changes a size.** Every screen is
a `scroll-snap-stop: always` panel of `min-height: 100dvh`, so a panel one pixel
taller than the viewport hides its bottom where nobody can scroll to it. The
audit asserts the fit and 18px of clearance under the lowest line, and it needs
`npm i -D playwright-core` plus a Chromium — which is why it is a script and not
part of `next build`. It has found: Join 790px on a 568px screen, a 70px coin
disc in a 600px-tall window, and the scroll cue 7px *below* the bottom edge of a
landscape iPad.

**A phone's screen size is not the viewport it gives you.** The audit lists each
phone twice for this reason. An iPhone SE advertises 568px and hands Safari about
460; at that height five of eight screens overflowed while a list of device
resolutions reported everything green. **Phones on their side are deliberately
out of scope** — that is a decision, written into the script above `VIEWPORTS`,
not an omission to be tidied up.

**Look at it. A clean build proves nothing.** `next build` was green while the
travelling coin landed *below* the safe, the "20%" wore a fat black outline it
inherited from a parent `<g stroke>`, and the mascot had a pale halo on dark
backgrounds. All three were invisible to tooling and obvious in a screenshot.

**Run the check that would fail.** Testing for semi-transparent pixels "proved"
there was no halo — the halo was fully-opaque pale pixels. `grep -c` counts
lines, and minified CSS is one line, so it reported 1 font-face out of 6. If a
check passes first time, ask what it would have to see to fail.

**One asset is usually several files.** The hat text lived in the mascot, the OG
card *and* the favicon. The favicon is a crop of his head and is easy to forget.

**Measure anything spatial the client describes in words.** "In the middle"
became a measured fraction (0.5 = midway) tested across three viewport heights,
rather than a gap tuned until it looked right on one screen.

**Deleting decoration can delete function.** The combination dial was ornament
on three safes and the part that answered the drag on the repay screen.

**`git fetch` before editing.** Other sessions push here. A push was rejected
after another agent changed the same two files; merging kept both.

**Shipped ≠ seen.** Everything in `public/` keeps its filename when its contents
change, so caches serve stale art. `_headers` now sets `must-revalidate` on
`/assets/*` and `/og.png`. Cloudflare's *Browser Cache TTL* must stay on
**Respect Existing Headers** or it overrides that.

**When something "doesn't work", find the test that halves the problem before
applying any fix.** `…/assets/kapibara.webp?v=2` is a URL no cache can hold, so
it proves server-vs-cache in five seconds. That test was reached after a
Cloudflare purge and a settings change — wrong order, and it cost an hour.

**Say what you did not verify.** `cykablyat.vip` is unreachable from the agent
sandbox (proxy 403). Local checks are not live checks; report the difference.
The chain, unlike the website, *is* reachable: `curl` the RPC and read the
contract before believing a manifest. Doing that is how we learned chain 4663 is
mainnet, that only one collateral token is whitelisted where the page listed
six, and that the lent token calls itself `WN`.

**Page 1 can spend money now.** The borrow screen signs real transactions
against `CBLending` on chain 4663. Two rules follow. Anything that changes an
amount is arithmetic on `bigint` — a `uint256` through a double silently loses
its low digits, which is why `exactAmount` exists beside `formatAmount` and why
"Max" uses the former. And every write simulates first, so the contract's own
revert reaches the visitor as a sentence instead of a paid-for failure; do not
replace that with a client-side guess at the limit.

## Facts that are settled

- 1,000,000,000 $CB · fair launch · no presale · no team allocation
- Treasury holds 50%, stated on screen 04 as contract-locked
- Copy says "memecoin", never a specific ticker. Artwork may show real coins.
- Robinhood Chain memecoins only
