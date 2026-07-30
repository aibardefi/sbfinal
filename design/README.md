# The approved design, kept as source

This folder is **not published**. `public/` is what Cloudflare copies into the
export; this sits beside it in the repo and never reaches the site. That is
deliberate — see "Do not publish this" below.

It exists because the design that page 1 was built from lived only in a
throwaway sandbox directory, and the published preview
(`claude.ai/code/artifact/87aec8d8-…`) is a rendered page, not its source. Once
that sandbox was reclaimed there would have been no way back to the file every
colour and every string was taken from.

## What is here

| file | what it is |
| --- | --- |
| `borrow-screen.prototype.html` | The approved borrow screen. One self-contained file — open it in a browser, no build, no server. Every colour, string and layout decision on page 1 traces back to this. |
| `build-preview.py` | The script that joined the prototype to the eight story screens and produced the ten-screen preview artifact. It reads `out/index.html` from a completed `npm run build`, so it only runs after one. |

## What was taken from it, and what was not

Ported to the live page: the palette (`--ground: #efece5`, the cream the story
screens already sit on — the violet is the *card*, not the screen), the `$CB`
mark, the centred **Buy $CB** pill, `Lock memes. / Borrow $CB.` over
`0% interest · no fees`, Lock ↓ Borrow as two fields, the `0 / 80 limit /
90 liq` ruler scale, and the footer.

Still here and not built: the `25 / 50 / 75 / Max` chips, the USD sub-values
under each field, the Manage popup (Add / Withdraw / Borrow / Repay with
before→after deltas), the `Review → Sign → Done` step chrome, and the treasury
popup.

Two things in it are bugs and were deliberately **not** ported:

- `style.color = "var(--" + toneOf(l) + ")"` produces `var(--safe)`, which is
  not a declared property. The healthy state silently loses its colour.
- `problem()` returns `null` before the balance check when the user holds none
  of the token, so the primary button stays enabled over a transfer that would
  revert.

And one thing that reads as a bug but is the prototype's own choice: the
`Test panel` pinned to the bottom. Its comment says *"review scaffolding. Not
part of the design; it exists so every state can be reached without a wallet or
a chain."* It never shipped, and now that the contract is live those states are
real.

## Do not publish this

Three things in it are placeholders that are dangerous on a public page:

- `CONTRACT = "0x9a3f4c17e8b25d0a6f18c4e73b9d2054af6e11c8"` — invented, with a
  copy button beside it. The real one is `DEPLOYMENT.lending` in
  `src/lib/chain.ts`.
- `EXPLORER = "https://explorer.robinhood.example/tx/"` — `.example` is a
  reserved domain and does not resolve.
- `DEX = "https://app.uniswap.org/swap"` — no chain and no output token, so it
  opens a search box. On a memecoin site that is the most reliable way for
  someone to buy a counterfeit $CB. The live button uses `BUY_URL` in
  `src/lib/links.ts` instead, which is one constant shared with the hero.

Balances, prices and positions in it are invented too. That is fine in a design
file and is exactly why it stays out of `public/`.
