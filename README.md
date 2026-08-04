# $CB — Capybara Blyatovich

A borrow screen, then eight screens of story. One tired capybara who runs a
lending desk: you lock memes with him, he lends you the meme, you pay him back
and he lets them out again.

Working notes for agents and anyone new to the repo are in `CLAUDE.md` —
including the checks that have caught real bugs here.

The eight story screens are a toy, deliberately — no figures, no risk copy, no
numbers to get wrong.

The first screen is not. It states the 80% limit, the 90% liquidation threshold
and that liquidation takes everything, because those are the terms and a page
that shows a borrow form without them is worse than one that shows nothing.

**It is wired to the contract and it can sign.** `LIVE` is `true` in
`ProtocolSection.tsx`, and the screen reads `CBLending` at
`0x369171De158fbf4eA80f9f608D5b406526E86963` on Robinhood Chain (4663) and opens,
repays, tops up and unwinds real positions through a connected wallet.
`/design/` is the handover note for it.

Its lent token answers `symbol()` with `CB` against a supply of 1,000,000,000, so
the `$CB` on the page and the token on the chain mean the same thing.
`Market.cbSymbol` in `src/lib/protocol.ts` still carries whatever the chain
reports, so the next disagreement is visible in code. Only the lending address is
written down by hand: `cb`, `weth` and `cbPool` in `src/lib/chain.ts` were read
back off that contract, which is the only way the manifest cannot drift from it.

**It is also brand new and not yet stocked.** `collateralTokens()` returns one
coin, CASHCAT; `availableCB()` is zero and no position has ever been opened. The
desk has nothing to lend until $CB is transferred to the contract, and every
other coin in the roster shows as "not listed yet" until an admin calls
`setCollateralConfig`. Neither is a change to this repo.

**The CB price read reverts today.** `twapWindow` is 3600s and the new CB/WETH
pool has an observation cardinality of 1, so there is no hour of history to
average and `quoteCBInWeth` — the read the page prices a loan with, and the same
one the contract uses to decide whether a borrow reverts — fails. Until an admin
calls `increaseObservationCardinalityNext` on the pool (or the window comes
down), the borrow screen cannot quote. The page deliberately does not fall back
to a price of its own: a second opinion the contract has not agreed to is how a
visitor gets quoted a loan the contract will reject.

## Running it

```bash
npm install
npm run dev
```

## How it deploys

Pushing to `main` builds a static export and publishes it to GitHub Pages.

**https://cykablyat.vip is served by Cloudflare Pages**, built from this repo.
The GitHub Pages workflow still runs and publishes to the project page path as a
fallback, but it no longer claims the domain — `DOMAIN` at the top of
`.github/workflows/deploy.yml` is empty, and whatever it holds is what GitHub
believes its custom domain to be. Set the repository variable `SITE_DOMAIN` to
hand the domain back to GitHub.

Whichever it resolves to, the build branches on it: with a domain it drops the
base path, uses absolute URLs and writes a `CNAME` into the artifact; without
one it sets a base path of `/sbfinal`. That branch is necessary rather than
tidy — a static export bakes every asset URL at build time, so it has to be told
which of the two it is being built for.

`CNAME` is written by the workflow, not committed. With Actions-based deployment
GitHub reads the custom domain out of the artifact, so a build that omits the
file silently unsets the domain.

## Security posture

No third-party scripts, no analytics, no cookies and nothing in storage. The
site talks to exactly one host that is not itself:
`https://rpc.mainnet.chain.robinhood.com`, named in `connect-src` in both
`src/app/layout.tsx` and `public/_headers`. Everything else external —
`x.com`, `t.me`, `app.cykablyat.vip`, the block explorer — is a plain link.

The page **does** now carry signing code, so the policy is doing real work
rather than describing a page that had nothing to protect:

- `connect-src` is `'self'` plus that one named origin. Never a wildcard, never
  a widened `default-src`. `npm run check:csp` asserts this in both copies and
  fails on drift — the meta tag and the header are written separately and the
  browser takes the intersection, so widening one alone breaks only production.
- `frame-ancestors 'none'` in `public/_headers` is the rule that stops a signing
  UI being framed. A `<meta>` CSP cannot carry it, which is why Cloudflare
  serves this site and GitHub Pages does not.
- Approvals are for the exact amount being spent, never unlimited.
- Every write is simulated against current state before it reaches the wallet,
  so the contract's own revert is shown as a sentence instead of being paid for.

`LIVE = false` in `ProtocolSection.tsx` is a real kill switch: it removes the
wallet, the confirm button and every claim that something can be sent, leaving
the read-only screen. It is not a label change — it used to be, and that was a
bug.

The real risk to a site like this is still not its code — it is the domain. Keep
registrar 2FA and the transfer lock on. Now it is also the admin key:
`DEFAULT_ADMIN_ROLE` on the proxy can replace the implementation with arbitrary
code, and therefore controls every token the contract holds.

## Cloudflare Pages — how it was set up

Done; recorded because the dashboard part is manual and would otherwise have to
be rediscovered.

Workers & Pages -> Create -> Pages -> Connect to Git -> `aibardefi/sbfinal`, then:

| Field | Value |
| --- | --- |
| Framework preset | Next.js (Static HTML Export) |
| Build command | `npm run build` |
| Build output directory | `out` |

`public/_headers` is then read at deploy time and becomes real response headers —
including `frame-ancestors`, which a `<meta>` CSP cannot carry and which is the
one that stops a signing UI being framed. GitHub Pages ignores the file.

Once Cloudflare serves the domain, stop this workflow claiming it: set the
repository variable `SITE_DOMAIN` to an empty value so GitHub Pages publishes at
the project page path instead, or disable the workflow.
