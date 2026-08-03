import { DEPLOYMENT } from "./chain";

/**
 * Where the outbound calls to action point.
 *
 * `BUY_URL` is shared rather than duplicated because two screens carry a Buy $CB
 * button — the hero and the borrow app — and a token address that lands in one
 * and not the other is the failure mode worth engineering against. One constant,
 * one edit, both buttons.
 *
 * **The output token is read from `DEPLOYMENT.cb`, not typed out here.** Both are
 * `0x7F31…73E3` today, and writing it twice is how they stop being. A redeploy
 * moves the contract, somebody updates `chain.ts`, and this link quietly goes on
 * selling the previous token — which on a memecoin site is indistinguishable from
 * a counterfeit, and worse for being on our own page. Derived, it cannot drift.
 *
 * The chain and the output token are both pinned for the same reason. A bare
 * `https://app.uniswap.org/swap` opens a token search box, and a search box is
 * the single most reliable way for somebody to buy the wrong $CB.
 */
export const BUY_URL = `https://app.uniswap.org/swap?chain=robinhood&inputCurrency=ETH&outputCurrency=${DEPLOYMENT.cb}`;

// There is no separate borrow app: the borrow screen is the first screen of
// this site. The hero's "Borrow $CB" scrolls to it rather than linking off to
// app.cykablyat.vip, which this project does not serve.

/**
 * Whether a link is a real destination or the `"#"` placeholder this file used
 * to hold.
 *
 * `BUY_URL` is live now, so nothing takes the false branch — it stays because
 * `"#"` is the site's convention for "not wired up yet" and the way back to it
 * should be one edit, not one edit plus remembering to restore two click
 * handlers. `HeroSection`'s `handleCta` and the borrow screen's buy button both
 * still catch it.
 */
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
