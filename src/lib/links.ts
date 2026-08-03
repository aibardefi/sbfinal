/**
 * The final $CB token's public address — the one people buy and verify.
 *
 * `null` until the token is created. It is deliberately NOT `DEPLOYMENT.cb`:
 * that value wires the borrow screen to the contract it reads and signs
 * against, and the token that ships to the public is a separate, not-yet-minted
 * thing. Selling or displaying an interim address on a memecoin site is
 * indistinguishable from pointing buyers at a counterfeit, so nothing on the
 * site shows or links to an address until this holds the real one.
 *
 * Fill this in ONE place on launch: `BUY_URL` starts working and the copy chip
 * on the first screen goes from "Coming soon" to the live, copyable address.
 */
export const TOKEN_ADDRESS: string | null = null;

/**
 * Where "Buy $CB" points. Both screens that carry the button share it, so the
 * address can never land on one and not the other.
 *
 * While `TOKEN_ADDRESS` is null this is `"#"` — the site's convention for "not
 * wired up yet". `HeroSection`'s `handleCta` and the borrow screen's buy button
 * both catch `"#"` and say "soon" instead of opening a swap for the wrong token.
 * The chain and output token are pinned rather than left to a search box, which
 * is the single most reliable way for somebody to buy the wrong $CB.
 */
export const BUY_URL = TOKEN_ADDRESS
  ? `https://app.uniswap.org/swap?chain=robinhood&inputCurrency=ETH&outputCurrency=${TOKEN_ADDRESS}`
  : "#";

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
