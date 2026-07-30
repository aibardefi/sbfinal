/**
 * Where the page is allowed to talk, as one value.
 *
 * This module exists so that the client and the Content-Security-Policy cannot
 * disagree. `layout.tsx` builds its `connect-src` from `RPC_ORIGIN`, and
 * `chain.ts` dials `RPC_URL` — change the endpoint here and both move together.
 * Held apart from `chain.ts` on purpose: `layout.tsx` is a server component and
 * has no business importing viem to learn one hostname.
 *
 * `public/_headers` carries the same origin and is the one copy a build cannot
 * derive, because Cloudflare reads that file as plain text. It is checked by
 * `npm run check:csp` — see scripts/check-csp.mjs, which exists precisely
 * because these two drifting apart fails silently: the meta policy allows the
 * call, the header blocks it, and only the deployed site is broken.
 */

/** Origin only — no path. This is the form a CSP directive takes. */
export const RPC_ORIGIN = "https://rpc.mainnet.chain.robinhood.com";

/** The endpoint itself. Robinhood Chain mainnet serves JSON-RPC at the root. */
export const RPC_URL = `${RPC_ORIGIN}/`;

/** Block explorer, used for "view transaction" links. */
export const EXPLORER_ORIGIN = "https://robinhoodchain.blockscout.com";
