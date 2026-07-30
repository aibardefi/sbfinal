/**
 * The five memecoins this desk accepts, and the one it lends.
 *
 * Shape only — no prices, no balances, no addresses. Nothing on this screen
 * connects to anything yet (`LIVE` is false in ProtocolSection), so inventing
 * balances would be inventing facts on a live domain. What the list is for is
 * the collateral picker: a visitor can see what is accepted before there is
 * anything to accept it with.
 *
 * `sym` is what the contract's own `symbol()` would return. It is rendered as
 * text through JSX and never assembled into markup, which is the difference
 * between a token name and an injection.
 */
export type Token = {
  sym: string;
  name: string;
  /** Matches the coin roster on the story screens, so the same coin is the
      same colour on screen 01 and on this one. */
  bg: string;
  on: string;
};

export const COLLATERAL: Token[] = [
  { sym: "CASHCAT", name: "Cash Cat", bg: "#9a958c", on: "#12110c" },
  { sym: "CASHDOG", name: "Cash Dog", bg: "#7fb2e5", on: "#12110c" },
  { sym: "JOHN", name: "Little John", bg: "#1f6b46", on: "#f7edd9" },
  { sym: "TENDIES", name: "Tendies", bg: "#e8a92b", on: "#12110c" },
  { sym: "YOLO", name: "Yolo", bg: "#c4392b", on: "#f7edd9" },
  { sym: "ANSEM", name: "Ansem Cat", bg: "#9b7fe0", on: "#12110c" },
];

/** What you borrow. One token, always. */
export const BORROWED = "$CB";
