import type { ReactNode } from "react";

/**
 * The Robinhood Chain memecoins, as named by the client.
 *
 * Drawn flat with fat outlines to sit in the same world as the mascot. The
 * rendered 3D coin art elsewhere in the repo is a different style and reads as
 * a second website when placed next to him.
 *
 * Six distinct hues, none of them near the $CB lime — a coin that reads as
 * $CB defeats the whole lock-one-borrow-the-other point of the first two
 * screens. Eyes and details are punched out in the coin's own background
 * colour rather than drawn, so each glyph stays a single flat shape.
 */
export type Coin = {
  ticker: string;
  bg: string;
  glyphOn: string;
  glyph: ReactNode;
};

/**
 * The roster's colours, addressable by name.
 *
 * These six are the only decorative colours on the site. Anything that needs to
 * be tinted — a mood button, a story card — takes one of these rather than
 * inventing a hue, which is how the palette went from thirty-five values to
 * this plus eight roles. They are not in globals.css on purpose: they belong to
 * the tokens, not to the page, and a coin leaving the roster should take its
 * colour with it.
 */
export const COIN_COLOR = {
  cashcat: "#b9b3a6",
  cashdog: "#7fb3dd",
  littlejohn: "#2f6f4f",
  tendies: "#e0a33c",
  yolo: "#c4392b",
  ansemcat: "#8b6fd4",
} as const;

export const COINS: Coin[] = [
  {
    // Cash + cat, so the money has to be on the face. Dollar-sign eyes are the
    // oldest cartoon shorthand there is and survive being shrunk to a 36px
    // button better than a banknote or a money bag would.
    ticker: "CASHCAT",
    bg: COIN_COLOR.cashcat,
    glyphOn: "#12110c",
    glyph: (
      <>
        <path d="M24 38 L17 11 L41 26 Z" />
        <path d="M76 38 L83 11 L59 26 Z" />
        <ellipse cx="50" cy="58" rx="33" ry="29" />
        <text
          x="37"
          y="63"
          fontSize="24"
          fontWeight="900"
          textAnchor="middle"
          fill="#b9b3a6"
        >
          $
        </text>
        <text
          x="63"
          y="63"
          fontSize="24"
          fontWeight="900"
          textAnchor="middle"
          fill="#b9b3a6"
        >
          $
        </text>
        <path
          d="M43 74 q7 6 14 0"
          stroke="#b9b3a6"
          strokeWidth="4"
          fill="none"
          strokeLinecap="round"
        />
      </>
    ),
  },
  {
    // Same money eyes as the cat — they are a pair, and the ears are what tell
    // them apart: his hang, hers point.
    ticker: "CASH DOG",
    bg: COIN_COLOR.cashdog,
    glyphOn: "#12110c",
    glyph: (
      <>
        <path d="M22 30 q-16 10 -12 38 q3 16 17 8 z" />
        <path d="M78 30 q16 10 12 38 q-3 16 -17 8 z" />
        <ellipse cx="50" cy="54" rx="30" ry="27" />
        <text
          x="38"
          y="58"
          fontSize="22"
          fontWeight="900"
          textAnchor="middle"
          fill="#7fb3dd"
        >
          $
        </text>
        <text
          x="62"
          y="58"
          fontSize="22"
          fontWeight="900"
          textAnchor="middle"
          fill="#7fb3dd"
        >
          $
        </text>
        <ellipse cx="50" cy="70" rx="13" ry="9" fill="#7fb3dd" />
        <ellipse cx="50" cy="66" rx="5" ry="3.5" />
      </>
    ),
  },
  {
    // The Robinhood feather, not a hooded figure. A whole character collapses
    // into a smudge at this size, and the feather is the mark everyone already
    // reads as Robinhood — which is the joke, since this is its chain.
    ticker: "LITTLE JOHN",
    bg: COIN_COLOR.littlejohn,
    glyphOn: "#f7edd9",
    glyph: (
      <>
        {/* Vane, then a quill that runs past the bottom of it. Both details are
            what separate a feather from a leaf: veins angle down from a leaf's
            midrib and the stem meets the blade, where a feather's barbs sweep
            up toward the tip and the shaft continues below the vane. The first
            pass had it the leaf way round and read as one. */}
        <path d="M50 6 q25 25 23 47 q-2 19 -23 27 q-21 -8 -23 -27 q-2 -22 23 -47 z" />
        <path
          d="M50 92 V14"
          stroke="#2f6f4f"
          strokeWidth="5"
          strokeLinecap="round"
        />
        <g stroke="#2f6f4f" strokeWidth="4" strokeLinecap="round">
          <path d="M50 42 L33 32" />
          <path d="M50 42 L67 32" />
          <path d="M50 58 L30 48" />
          <path d="M50 58 L70 48" />
          <path d="M50 73 L34 64" />
          <path d="M50 73 L66 64" />
        </g>
      </>
    ),
  },
  {
    // Three actual tenders in a row. The single lumpy shape it used to be read
    // as a chocolate-chip cookie — the count is what makes it chicken.
    ticker: "TENDIES",
    bg: COIN_COLOR.tendies,
    glyphOn: "#12110c",
    glyph: (
      <>
        <g>
          <rect
            x="12"
            y="30"
            width="22"
            height="46"
            rx="11"
            transform="rotate(-13 23 53)"
          />
          <rect x="39" y="22" width="22" height="56" rx="11" />
          <rect
            x="66"
            y="30"
            width="22"
            height="46"
            rx="11"
            transform="rotate(13 77 53)"
          />
        </g>
        <g fill="#e0a33c">
          <circle cx="22" cy="44" r="3" />
          <circle cx="26" cy="60" r="2.6" />
          <circle cx="46" cy="38" r="3" />
          <circle cx="53" cy="55" r="2.6" />
          <circle cx="47" cy="68" r="2.4" />
          <circle cx="78" cy="44" r="3" />
          <circle cx="74" cy="60" r="2.6" />
        </g>
      </>
    ),
  },
  {
    // A rocket that reads as a rocket. The old one had a 44-unit nose cone on a
    // straight-sided body with no flame, which at button size was the letter A.
    ticker: "YOLO",
    bg: COIN_COLOR.yolo,
    glyphOn: "#f7edd9",
    glyph: (
      <>
        <path d="M50 6 q17 17 17 38 v20 h-34 v-20 q0 -21 17 -38 z" />
        <path d="M33 46 l-15 24 l15 -5 z" />
        <path d="M67 46 l15 24 l-15 -5 z" />
        <circle cx="50" cy="34" r="8" fill="#c4392b" />
        <path d="M38 66 h24 l-12 26 z" />
        <path d="M46 66 h8 l-4 14 z" fill="#c4392b" />
      </>
    ),
  },
  {
    // The shades are the whole point — without them this is CASHCAT again.
    ticker: "ANSEMCAT",
    bg: COIN_COLOR.ansemcat,
    glyphOn: "#12110c",
    glyph: (
      <>
        <path d="M22 36 L15 10 L40 25 Z" />
        <path d="M78 36 L85 10 L60 25 Z" />
        <ellipse cx="50" cy="58" rx="32" ry="28" />
        <rect x="20" y="47" width="60" height="15" rx="6" fill="#f7edd9" />
        <path
          d="M50 47 v15"
          stroke="#8b6fd4"
          strokeWidth="5"
          strokeLinecap="round"
        />
        <path
          d="M43 74 q7 6 14 0"
          stroke="#8b6fd4"
          strokeWidth="4"
          fill="none"
          strokeLinecap="round"
        />
      </>
    ),
  },
];

export function CoinGlyph({ coin }: { coin: Coin }) {
  return (
    <svg viewBox="0 0 100 100" fill={coin.glyphOn} aria-hidden="true">
      {coin.glyph}
    </svg>
  );
}
