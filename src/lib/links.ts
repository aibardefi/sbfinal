/**
 * Where the outbound calls to action point.
 *
 * `BUY_URL` is shared rather than duplicated because two screens now carry a
 * Buy $CB button — the hero and the borrow app — and a token address that lands
 * in one and not the other is the failure mode worth engineering against. One
 * constant, one edit, both buttons.
 *
 * It is `"#"` until there is a pool. Every caller must catch that and say so
 * rather than let the browser jump to the top of the page; `HeroSection`'s
 * `handleCta` and `ProtocolSection`'s buy handler both do.
 *
 * When it is filled in, it wants the chain and the output token pinned — a bare
 * `https://app.uniswap.org/swap` opens a search box, and a search box is the
 * single most reliable way for someone to buy a counterfeit $CB.
 */
export const BUY_URL = "#";

/** The lending app, once there is one. Our own property, so: same tab. */
export const BORROW_URL = "https://app.cykablyat.vip";
