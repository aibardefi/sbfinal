/**
 * The $CB token's public address — the one people buy and verify.
 *
 * This is the token the lending contract lends: `CB()` on `CBLending` returns
 * it, `symbol()` says `CB`, and its supply is exactly 1,000,000,000. It is still
 * written out here as a literal rather than imported from `DEPLOYMENT`, and that
 * is not duplication to be tidied away. `DEPLOYMENT.cb` follows whichever
 * lending contract the borrow screen is pointed at; if that address is repointed
 * again, an imported value would silently redirect "Buy $CB" at whatever token
 * the new deployment happens to lend. A buy link that moves on its own is how a
 * memecoin site sends its own visitors to a counterfeit. Two addresses that must
 * agree, kept apart so that disagreeing is visible, is the same arrangement as
 * `BORROWED` and `Market.cbSymbol`.
 *
 * Set to `null` to take every public reference to an address off the site at
 * once: `BUY_URL` goes back to `"#"` and the copy chip on the first screen
 * returns to "coming soon".
 */
export const TOKEN_ADDRESS: string | null = "0xab46accEb52C3aBc3E891C17734CD0d09d9D38c9";

/**
 * WETH on Robinhood Chain — the other side of the pair people buy through.
 *
 * The swap is pinned to CB/WETH because that is the only pool that exists:
 * `getPool(CB, WETH, fee)` on the factory answers with an address for the 1%
 * tier and `address(0)` for 0.01%, 0.05% and 0.3%. It is also the pool the
 * lending contract prices its own debt against
 * (`0x3Ad2640Aa2a81d82117c8142BA82d45FfE8308b3`), so what a visitor buys at and
 * what the borrow screen quotes are the same market rather than two that
 * usually agree.
 */
const WETH_ADDRESS = "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73";

/**
 * A swap on this chain, from WETH into one named token.
 *
 * Chain, input and output are all pinned rather than left to a search box —
 * typing a ticker into one is the single most reliable way to buy the wrong
 * coin, and on a chain of memecoins every ticker has a namesake.
 */
const swapUrl = (token: string) =>
  `https://app.uniswap.org/swap?chain=robinhood&inputCurrency=${WETH_ADDRESS}&outputCurrency=${token}`;

/**
 * Where "Buy $CB" points. Both screens that carry the button share it, so the
 * address can never land on one and not the other.
 *
 * While `TOKEN_ADDRESS` is null this is `"#"`, the site's convention for "not
 * wired up yet". `HeroSection`'s `handleCta` and the borrow screen's buy button
 * both catch `"#"` and say "soon" instead of opening a swap for nothing.
 */
export const BUY_URL = TOKEN_ADDRESS ? swapUrl(TOKEN_ADDRESS) : "#";

/**
 * Where "Buy" beside the collateral picker points.
 *
 * The address is not a constant here and must not become one: it is whichever
 * token `collateralTokens()` returned and the visitor then chose, so a coin the
 * admin whitelists tomorrow gets a working buy link without this file changing —
 * and a coin taken off the list takes its link with it. That is the same rule
 * the picker itself follows, and the reason there is no roster of addresses in
 * `protocol/tokens.ts` to drift out of date.
 *
 * WETH is the input for the same reason the CB link uses it: the lending
 * contract prices every collateral through `quoteCollateralInWeth`, so the pool
 * a visitor buys in is the pool the borrow screen quotes against, not a second
 * market that usually agrees.
 */
export const collateralBuyUrl = (token: string) => swapUrl(token);

// There is no separate borrow app: the borrow screen is the first screen of
// this site. The hero's "Borrow $CB" scrolls to it rather than linking off to
// app.cykablyat.vip, which this project does not serve.

/** Whether a link is a real destination or the `"#"` placeholder. */
export const isLive = (url: string) => url !== "#" && url.length > 0;

/**
 * Anchor attributes for a link that leaves the site.
 *
 * A new tab, because the borrow screen is a form somebody may be part-way
 * through and navigating away loses it. `noopener` because the opened page gets
 * a handle on `window.opener` without it, and `noreferrer` to match the
 * site-wide referrer policy in `layout.tsx` — Uniswap does not need to know which
 * of our screens sent the visitor.
 *
 * Returns nothing for a placeholder, so a `"#"` link stays in-tab and its click
 * handler can say "soon" instead of opening an empty window.
 */
export const externalLinkProps = (url: string) =>
  isLive(url) ? ({ target: "_blank", rel: "noreferrer noopener" } as const) : {};
