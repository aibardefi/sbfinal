/**
 * The coin roster: the order they are listed in, the names they are called, and
 * the colours they are drawn in.
 *
 * This is the approved design's list and its sequence. None of it is derivable
 * from a chain — a token contract returns a symbol and eighteen decimals, not
 * the position it holds in a picker or the colour it wears on screen 01 — so it
 * lives here and the contract is not asked for it.
 *
 * What the contract *does* own is which of these can actually be borrowed
 * against. `collateralTokens()` is the authority on that, and it is the reason
 * this file no longer carries addresses: a coin on this list that the contract
 * has never been configured for has no address to lend against, and offering it
 * as a choice buys the visitor a revert. `InvalidPool()` — the contract's
 * "I have never heard of this token" — is what that looks like from the app.
 *
 * So the roster is the running order, and the chain decides which rows in it are
 * live. A coin the admin whitelists tomorrow lights up without a deploy of this
 * site; a coin whitelisted that is not on this list is appended at the end with
 * its own on-chain name and a neutral colour.
 */

export type CoinMeta = {
  /** The ticker as the design writes it. This is what the picker shows. */
  sym: string;
  /** The name as the design writes it, which is not always `name()` on chain. */
  name: string;
  /**
   * Other symbols the same coin answers to on chain.
   *
   * Deployed tokens do not always agree with the design about their own ticker.
   * `LITTLEJOHN` is this coin on Robinhood Chain; the design has always called
   * it JOHN. Without the alias the roster would show JOHN as "not listed yet"
   * and then append the real token underneath as a seventh, unstyled row — one
   * coin, listed twice, neither of them right.
   *
   * Matching is case-insensitive, which separately covers `CashDog` answering
   * where the roster says CASHDOG.
   */
  aliases?: string[];
  bg: string;
  on: string;
};

const INK = "#12110c";
const CREAM = "#f7edd9";

/** Order matters. This is the sequence the picker lists them in. */
export const ROSTER: CoinMeta[] = [
  { sym: "CASHCAT", name: "Cash Cat", bg: "#9a958c", on: INK },
  { sym: "CASHDOG", name: "Cash Dog", bg: "#7fb2e5", on: INK },
  /* Listed as LITTLEJOHN, which is also what the token answers. JOHN is kept as
     an alias because that is what the earlier design called it, so an older
     reference to the coin still resolves to this row rather than falling off the
     roster and appending itself as an extra. */
  { sym: "LITTLEJOHN", name: "Little John", aliases: ["JOHN"], bg: "#1f6b46", on: CREAM },
  { sym: "TENDIES", name: "Tendies", bg: "#e8a92b", on: INK },
  { sym: "YOLO", name: "Yolo", bg: "#c4392b", on: CREAM },
  { sym: "ANSEM", name: "Ansem Cat", bg: "#9b7fe0", on: INK },
];

/** Neutral, and deliberately not one of the six: a coin the contract lists but
    the design has never seen should look unremarkable rather than borrow
    another coin's identity. */
const UNKNOWN = { bg: "#c9c3b6", on: INK };

const bySymbol = new Map<string, CoinMeta>(
  ROSTER.flatMap((c) => [c.sym, ...(c.aliases ?? [])].map((key) => [key.toUpperCase(), c] as const))
);

export const rosterEntry = (symbol: string) => bySymbol.get(symbol.toUpperCase());

export function coinColour(symbol: string) {
  const entry = rosterEntry(symbol);
  return entry ? { bg: entry.bg, on: entry.on } : UNKNOWN;
}

/**
 * Where a symbol sits in the running order.
 *
 * Anything off the roster sorts after everything on it, rather than at the
 * front — a newly whitelisted coin should not silently displace CASHCAT from
 * the top of a list somebody signed off on.
 */
export const rosterIndex = (symbol: string) => {
  const entry = rosterEntry(symbol);
  const i = entry ? ROSTER.indexOf(entry) : -1;
  return i === -1 ? Number.MAX_SAFE_INTEGER : i;
};

/**
 * What you borrow, as the site says it.
 *
 * Still the copy rather than a reading of the chain, even now that the two
 * agree: the token on this deployment answers `symbol()` with `CB`, where the
 * one before it said `WN`. `Market.cbSymbol` in `src/lib/protocol.ts` carries
 * what the contract actually reports, so a future redeploy that disagrees is
 * visible in the code instead of only in a wallet.
 */
export const BORROWED = "$CB";
