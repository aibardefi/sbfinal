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
| Wallets | `src/lib/connectors.ts` is the registry — add one there, not in the panel |
| Wallet session | `src/lib/useWalletConnection.ts` → `Providers` → `useWallet()` context |
| Connect panel | `src/components/protocol/ConnectPanel.tsx`; icons are inline SVG |
| Thresholds | `src/lib/health.ts` — 80 / 90, and every mark is computed from them |
| Handover | `public/design/` — what page 1 is pointed at and what not to change |
| Device audit | `npm run audit` — 39 viewports x 9 screens; see "Checks" below |
| CSP check | `npm run check:csp` — the meta and header policies must agree |
| Preview build | `npm run preview` — builds, serves `out/` on :6677 with `_headers` |

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

**`next dev` is not this site, and a bug found there may not exist.** Buttons on
the borrow screen were dead on an iPhone and nowhere else. Nothing in the CSS or
markup explained it — no overlay, no `pointer-events`, no stuck `inert`, no
global touch handler. The tell was that `<a href>` links still worked while every
`onClick` did not, which is hydration failing rather than a layout fault. It was
dev-only: the meta CSP has no `'unsafe-eval'` and React's development build
requires `eval`, and dev over a LAN IP is not a secure context so
`navigator.clipboard` is undefined too — which is why the copy button failed on
the phone and worked on a desktop, where `localhost` *is* a secure context.
`npm run preview` serves the real `out/` with the real headers; test there before
believing any of it.

**The production bundle can carry syntax the phone cannot parse.** With no
`browserslist`, `next build` emitted a class static block into Next's own runtime
chunk — Safari only supports those from 16.4, and below that it is a *parse*
error, so the chunk dies and nothing hydrates. There is now a `browserslist` in
`package.json`; if it goes, this comes back silently on old iOS only.

**The lockfile must be written by the npm Cloudflare uses.** A deploy died on
`npm ci` with packages "missing from lock file". Cause: npm 11 locally, npm 10.9.2
on Pages, and they record optional and transitive deps differently. `npm install`
did not fix it — `npx npm@10.9.2 install` did. Verify with `npx npm@10.9.2 ci`,
which is the exact command that failed.

**A wallet's mobile link comes from a source you can check, or it is `null`.**
The handoffs that work were recovered from this repo's own git history (Trust,
Phantom, Coinbase) or are the documented standard form (MetaMask). Every one
reconstructed from search or convention failed on a real phone — OKX twice, the
second time landing the visitor on "Safari cannot open the page because the
address is invalid". Note an unhandled custom scheme errors *immediately and
modally*, so a timed fallback behind it never runs; and iOS registers a scheme
per-app at install time, so that error proves no app handles it and says nothing
about whether your path was right. Rabby, OKX, Uniswap and Rainbow are therefore
desktop-only, and WalletConnect is how a phone reaches them.

**Read the library before widening the CSP for it.** The WalletConnect picker
listed every wallet by name with no logo. The obvious guess — a missing image
host — was wrong. AppKit *fetches* image bytes through `connect-src` and renders
`URL.createObjectURL(blob)`, so `img-src` sees a `blob:` URL and never the host.
Forty seconds in `ApiController.js` beat any amount of guessing at hostnames.

**WalletConnect: chain 4663 goes in `optionalChains`, never `chains`.** A chain
in the required set is a condition of the session, and no wallet ships Robinhood
Chain — so every wallet refuses to pair, silently, and the picker's tiles do
nothing when tapped. That is the likeliest reading of why WalletConnect was torn
out of this repo over five commits before. The library is also loaded on demand,
not at startup: ~400 KB behind a click is the difference from the stack that made
the page slow to wake.

**Page 1 can spend money now.** The borrow screen signs real transactions
against `CBLending` on chain 4663. Two rules follow. Anything that changes an
amount is arithmetic on `bigint` — a `uint256` through a double silently loses
its low digits, which is why `exactAmount` exists beside `formatAmount` and why
"Max" uses the former. And every write simulates first, so the contract's own
revert reaches the visitor as a sentence instead of a paid-for failure; do not
replace that with a client-side guess at the limit.

**Live and usable are different claims.** Read at block 28579361: `paused` false,
MAX_LTV 8000, LIQ 9000, one collateral token, and `availableCB` about 500,000,000
CB — funded, where it used to be zero. But `quoteCBInWeth` still reverts
`0x533e5228`: the CB/WETH pool's observation cardinality is 1, so no TWAP window
can be satisfied. Prices are unavailable and every borrow fails at simulation
until an admin runs `increaseObservationCardinalityNext` on that pool. `LIVE` is
true; that is not a claim the product works.

## Facts that are settled

- 1,000,000,000 $CB · fair launch · no presale · no team allocation
- Treasury holds 50%, stated on screen 04 as contract-locked
- Copy says "memecoin", never a specific ticker. Artwork may show real coins.
- Robinhood Chain memecoins only
