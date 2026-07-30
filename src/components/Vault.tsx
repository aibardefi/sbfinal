import type { ReactNode } from "react";

/**
 * The safe, as a standalone drawing.
 *
 * Same object as the one built into the machine on the borrow screen — glass
 * carcass, brass hardware, four throw bolts down the hinge side — but lifted
 * out so the two screens that need a safe on its own can share one. Drawing it
 * twice is how the two would drift apart.
 *
 * `inside` renders behind the door, between the cavity and the glass, so
 * whatever is put in there genuinely reads as being *in* the safe rather than
 * painted on the front.
 */
export function Vault({
  inside,
  alt,
  className = "",
}: {
  inside?: ReactNode;
  alt: string;
  className?: string;
}) {
  return (
    <svg className={className} viewBox="40 58 440 406" role="img" aria-label={alt}>
      <g
        stroke="var(--ink)"
        strokeWidth="7"
        strokeLinejoin="round"
        strokeLinecap="round"
      >
        <rect
          x="50"
          y="70"
          width="420"
          height="356"
          rx="22"
          fill="var(--glass)"
          fillOpacity="0.07"
        />
        {/* One hard raking highlight. A flat tint alone reads as frosted
            plastic; what says "glass" is a specular streak and a bright edge. */}
        <path
          d="M50 400 L222 70 L288 70 L116 426 L50 426 Z"
          fill="#ffffff"
          fillOpacity="0.5"
          stroke="none"
        />
        <rect
          x="50"
          y="70"
          width="420"
          height="356"
          rx="22"
          fill="none"
          stroke="var(--glass-lit)"
          strokeOpacity="0.75"
          strokeWidth="4"
        />

        {/* The cavity behind the door — without it the carcass is one flat wash
            and reads as a solid slab rather than a box you can see into. */}
        <rect
          x="88"
          y="108"
          width="344"
          height="280"
          rx="14"
          fill="var(--glass-deep)"
          fillOpacity="0.07"
        />
        <rect
          x="88"
          y="108"
          width="344"
          height="280"
          rx="14"
          fill="none"
          stroke="var(--glass-lit)"
          strokeOpacity="0.5"
          strokeWidth="3"
        />

        {/* stroke:none on the wrapper. Everything above is drawn by a group
            carrying a 7px ink stroke, and anything dropped in here inherits it
            — which put a fat black outline on the "20%" and turned the gold
            coins into dark blobs. Contents that want an outline set their own. */}
        <g stroke="none">{inside}</g>

        {/* The door goes over the contents, so they sit behind glass. */}
        <rect
          x="88"
          y="108"
          width="344"
          height="280"
          rx="14"
          fill="var(--glass)"
          fillOpacity="0.16"
        />
        <path
          d="M110 372 L196 122 L232 122 L146 372 Z"
          fill="#ffffff"
          fillOpacity="0.4"
          stroke="none"
        />

        {/* Four throw bolts on the latch side, three barrel hinges opposite. */}
        <g fill="var(--gold)" strokeWidth="5">
          <rect x="72" y="150" width="30" height="18" rx="6" />
          <rect x="72" y="208" width="30" height="18" rx="6" />
          <rect x="72" y="266" width="30" height="18" rx="6" />
          <rect x="72" y="324" width="30" height="18" rx="6" />
          <rect x="422" y="132" width="22" height="34" rx="9" />
          <rect x="422" y="231" width="22" height="34" rx="9" />
          <rect x="422" y="330" width="22" height="34" rx="9" />
        </g>

        <rect x="90" y="426" width="72" height="26" rx="10" fill="var(--ink)" />
        <rect x="358" y="426" width="72" height="26" rx="10" fill="var(--ink)" />
      </g>

      {/* The handle, solid brass over glass — that contrast is what makes this
          a safe and not a display case. There was a combination dial above it
          too; it said the same thing twice, so the spoked wheel does the job
          alone and the door is quieter for it. Centred on the door now that it
          is the only piece of hardware on the face. */}
      <g stroke="var(--ink)" strokeWidth="5">
        <circle cx="362" cy="248" r="30" fill="none" />
        <path
          d="M362 248 V218 M362 248 L388 263 M362 248 L336 263"
          stroke="var(--gold)"
          strokeWidth="10"
          strokeLinecap="round"
        />
        <circle cx="362" cy="248" r="11" fill="var(--gold)" />
      </g>
    </svg>
  );
}

/**
 * A $CB coin.
 *
 * This is the same coin the machine pays out on screen 02, and it has to be —
 * the treasury screen answers where that gold came from, so a different-looking
 * disc reads as a different token. The payout builds its coins with
 * `setAttribute` at a fixed r=17, so those numbers are the master and every
 * measurement here is that drawing scaled: a 5-wide ink rim, `$CB` set at 12
 * with the baseline 4.5 below centre and -0.4 of tracking.
 */
const REF_R = 17;

export function CbCoin({
  r = 26,
  cx = 0,
  cy = 0,
  label = "$CB",
}: {
  r?: number;
  cx?: number;
  cy?: number;
  label?: string;
}) {
  const k = r / REF_R;
  return (
    <g transform={`translate(${cx} ${cy})`}>
      {/* The stroke is stated rather than inherited. `Vault` wraps `inside` in a
          `<g stroke="none">` precisely so its contents cannot pick up the 7px ink
          stroke the carcass is drawn with, which means a coin dropped in there
          gets no rim at all unless it asks for one. */}
      <circle
        r={r}
        fill="var(--gold)"
        stroke="var(--ink)"
        strokeWidth={(5 * k).toFixed(2)}
      />
      {/* The mark is a label on the coin, not the coin itself — filling the disc
          with the glyph made the whole thing read as a dark blob. */}
      <text
        y={(4.5 * k).toFixed(2)}
        fontSize={(12 * k).toFixed(2)}
        fontWeight="900"
        textAnchor="middle"
        letterSpacing={(-0.4 * k).toFixed(2)}
        fill="var(--ink)"
      >
        {label}
      </text>
    </g>
  );
}
