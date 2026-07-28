/**
 * The people on the other end of a loan.
 *
 * Anatomy matters here — the first pass read as bears. A capybara has a blocky,
 * almost rectangular head rather than a round one, small ears set low and wide
 * instead of high on top, eyes pushed up near the brow, and a very broad blunt
 * muzzle taking up the bottom half of the face. Those four things are the whole
 * difference.
 *
 * Deliberately not the mascot: different fur tones, no ushanka, and each wears
 * a costume, so they read as a crowd of other people rather than as him
 * repeated three times.
 */
const INK = "#12110c";

type Capy = { name: string; fur: string; muzzle: string; costume: React.ReactNode };

const CAPYS: Capy[] = [
  {
    name: "Degen",
    fur: "#b07a4a",
    muzzle: "#8f5f37",
    costume: (
      <>
        <rect x="20" y="36" width="60" height="14" rx="5" fill={INK} />
        <rect x="24" y="39" width="21" height="8" rx="3" fill="#3ad0f0" />
        <rect x="55" y="39" width="21" height="8" rx="3" fill="#3ad0f0" />
        <path
          d="M34 84 q16 10 32 0"
          stroke="var(--au)"
          strokeWidth="5"
          fill="none"
          strokeLinecap="round"
        />
        <circle cx="50" cy="91" r="5.5" fill="var(--au)" stroke={INK} strokeWidth="3" />
      </>
    ),
  },
  {
    name: "Crown",
    fur: "#a9754a",
    muzzle: "#8a5c36",
    costume: (
      <path
        d="M28 14 L28 -8 L40 3 L50 -12 L60 3 L72 -8 L72 14 Z"
        fill="var(--au)"
        stroke={INK}
        strokeWidth="4"
        strokeLinejoin="round"
      />
    ),
  },
  {
    name: "Cap",
    fur: "#8f6039",
    muzzle: "#744c2b",
    costume: (
      <>
        <path
          d="M17 30 q0 -26 33 -26 q33 0 33 26 z"
          fill="var(--cb)"
          stroke={INK}
          strokeWidth="4"
          strokeLinejoin="round"
        />
        <path
          d="M17 30 q-12 2 -14 8 q22 3 36 -4 z"
          fill="var(--cb-deep)"
          stroke={INK}
          strokeWidth="4"
          strokeLinejoin="round"
        />
      </>
    ),
  },
];

export function Capybara({ i, className = "" }: { i: number; className?: string }) {
  const { fur, muzzle, costume } = CAPYS[i % CAPYS.length];
  return (
    <svg
      className={className}
      viewBox="-8 -18 116 116"
      role="img"
      aria-label="A capybara borrower"
    >
      <g stroke={INK} strokeWidth="5" strokeLinejoin="round">
        {/* Ears sit low and to the sides, mostly behind the head. */}
        <ellipse cx="17" cy="34" rx="9" ry="8" fill={fur} />
        <ellipse cx="83" cy="34" rx="9" ry="8" fill={fur} />
        {/* The head is a block, not a ball: flat top, square-ish jaw. */}
        <path
          d="M14 40 q0 -18 36 -18 q36 0 36 18 v22 q0 22 -36 22 q-36 0 -36 -22 z"
          fill={fur}
        />
        {/* Broad blunt muzzle across the whole lower face. */}
        <path
          d="M22 66 q0 -9 28 -9 q28 0 28 9 v6 q0 14 -28 14 q-28 0 -28 -14 z"
          fill={muzzle}
        />
      </g>
      <g fill={INK}>
        <ellipse cx="50" cy="64" rx="10" ry="6" />
        <circle cx="32" cy="44" r="4.5" />
        <circle cx="68" cy="44" r="4.5" />
      </g>
      <path
        d="M43 78 q7 5 14 0"
        stroke={INK}
        strokeWidth="3.5"
        fill="none"
        strokeLinecap="round"
      />
      {costume}
    </svg>
  );
}

export const CAPY_COUNT = CAPYS.length;
