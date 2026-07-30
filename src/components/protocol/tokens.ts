/**
 * Colours for the coins, and nothing else.
 *
 * This file used to be the list of accepted collateral. It is not any more: the
 * contract's `collateralTokens()` is the roster and `collateralConfigs()` says
 * what each one is allowed to do, so a coin listed but not deployed — which is
 * what the six hard-coded entries here were — is the page inventing a fact about
 * a live lending desk.
 *
 * What survives is the part the chain cannot answer. A token contract returns a
 * symbol and eighteen decimals; it does not return the colour it is drawn in on
 * screen 01. Keeping that mapping here is what makes the same coin the same
 * colour on the story screens and on the borrow form.
 *
 * Symbols are matched case-insensitively and anything unrecognised gets the
 * neutral pair, so a coin the admin whitelists tomorrow renders correctly
 * without a deploy of this site.
 */

export type CoinColour = { bg: string; on: string };

const INK = "#12110c";
const CREAM = "#f7edd9";

const PALETTE: Record<string, CoinColour> = {
  CASHCAT: { bg: "#9a958c", on: INK },
  CASHDOG: { bg: "#7fb2e5", on: INK },
  JOHN: { bg: "#1f6b46", on: CREAM },
  TENDIES: { bg: "#e8a92b", on: INK },
  YOLO: { bg: "#c4392b", on: CREAM },
  ANSEM: { bg: "#9b7fe0", on: INK },
};

/** Neutral, and deliberately not one of the six: an unknown coin should look
    unremarkable rather than borrow another coin's identity. */
const UNKNOWN: CoinColour = { bg: "#c9c3b6", on: INK };

export function coinColour(symbol: string): CoinColour {
  return PALETTE[symbol.toUpperCase()] ?? UNKNOWN;
}

/**
 * What you borrow, as the site says it.
 *
 * The token on this deployment answers `symbol()` with "WN". The site says $CB
 * throughout and that is the decision on file, so this string is the copy, not a
 * reading of the chain — `Market.cbSymbol` in `src/lib/protocol.ts` carries what
 * the contract actually reports.
 */
export const BORROWED = "$CB";
