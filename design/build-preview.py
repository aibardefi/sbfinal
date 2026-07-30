"""
Build the ten-screen preview: page 1 (the protocol) followed by the nine story
screens, as one self-contained file.

The nine are React + CSS Modules, so they are lifted from the static export
rather than re-implemented. The ~700KB of React chunks are deliberately left
out; the only thing they did that matters visually is add `.entGo` on scroll,
which is 15 lines of vanilla JS against the same `data-ent` attributes.
"""
import json, re, base64, pathlib

SB = pathlib.Path("/workspace/sbfinal")
OUT = SB / "out"
SCRATCH = pathlib.Path(".")

F = json.load(open("fonts.json"))

# ---------------------------------------------------------------- the story
site = (OUT / "index.html").read_text()

# The nine sections live inside <main>. Everything else in the body is Next's
# bootstrap, which we do not want.
m = re.search(r"<main[^>]*>(.*)</main>", site, re.S)
assert m, "could not find <main> in the static export"
story = m.group(1)

# Any <script>/<template> Next left inside goes.
story = re.sub(r"<script\b.*?</script>", "", story, flags=re.S)
story = re.sub(r"<template\b.*?</template>", "", story, flags=re.S)

# The mascot is the one raster asset the story uses. A single file has no
# /assets to serve it from, so it rides along as a data URI.
# The mascot appears four times, as SVG <image href="..."> (SVG uses href, not
# src). Inlining the data URI four times cost ~350KB of duplicate base64, so it
# is declared once as a <symbol> and referenced with <use>. Sizing is preserved
# exactly: width/height/preserveAspectRatio on a <use> apply to the symbol's
# viewport, and every call site already uses "xMidYMax meet".
MASCOT_W, MASCOT_H = 795, 1008
mascot = base64.b64encode((OUT / "assets/kapibara.webp").read_bytes()).decode()

story = re.sub(r"<link\b[^>]*kapibara[^>]*>", "", story)


def image_to_use(m):
    tag = m.group(0)
    tag = re.sub(r'href="[^"]*kapibara[^"]*"', 'href="#cap"', tag)
    return "<use" + tag[len("<image"):]


story = re.sub(r"<image\b[^>]*kapibara[^>]*>", image_to_use, story)
story = story.replace("</image>", "</use>")


def img_to_svg(m):
    """next/image emits three <img> tags for the same mascot. They cannot use a
    <symbol>, so each becomes an inline <svg> pointing at the one definition —
    keeping its class (the breathing animation) and its alt text as a label."""
    tag = m.group(0)
    cls = re.search(r'class="([^"]*)"', tag)
    alt = re.search(r'alt="([^"]*)"', tag)
    return (
        f'<svg class="{cls.group(1) if cls else ""}" '
        f'viewBox="0 0 {MASCOT_W} {MASCOT_H}" role="img" '
        f'aria-label="{alt.group(1) if alt else "Capybara Blyatovich"}" '
        'style="width:100%;height:auto;display:block">'
        '<use href="#cap"/></svg>'
    )


story = re.sub(r"<img\b[^>]*kapibara[^>]*?/?>", img_to_svg, story)

# app.cykablyat.vip is gone — the protocol is screen 1 of this page now, so
# every "Borrow $CB" points back up to it instead of off-site. The Join
# screen's "Launch app" button is dropped: it duplicated that same jump.
# The Launch app anchor wraps an inline <svg>, so match the whole element by
# its content rather than expecting the label to sit directly inside the tag.
# "Launch app" pointed at a host that no longer exists. It is replaced in place
# by the two links the screen actually wants — Borrow (up to screen 1) and Buy
# (out to Uniswap) — reusing the anchor's own classes so they look native.
def _join_ctas(m):
    tag = m.group(0)
    cls = re.search(r'class="([^"]*)"', tag)
    cls = cls.group(1) if cls else ""
    base = " ".join(c for c in cls.split() if not c.endswith("__primary"))
    arrow = ('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" '
             'stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" '
             'aria-hidden="true"><path d="M5 12h13M12 5l7 7-7 7"></path></svg>')
    return (
        f'<a class="{cls}" href="#p1" data-toapp="1">{arrow}Borrow $CB</a>'
        f'<a class="{base}" href="https://app.uniswap.org/swap" target="_blank" '
        f'rel="noreferrer noopener">Buy $CB</a>'
    )


story = re.sub(r'<a\b(?:(?!</a>).)*?Launch app</a>', _join_ctas, story, flags=re.S)
story = story.replace('href="https://app.cykablyat.vip"', 'href="#p1" data-toapp="1"')

# ---------------------------------------------------------------------------
# Treasury's $CB coins, matched to the ones that come out of the machine.
#
# The two were drawn differently: CbCoin is --au (#ffc61f) with no perimeter and
# a bare "$", while the coins the chute pays out on screen 02 are --gold
# (#d9a020) with a 5px ink stroke and "$CB" on the face. Same currency, two
# looks. These take the payout coin's treatment, scaled off each coin's own
# radius from its r=17 original, so a big coin and a small one stay the same
# drawing rather than the same absolute stroke.
#
# Only the coins are touched. Three other things in this section are also --au —
# a crown and a borrower's smile — and the pattern is specific enough to leave
# them alone.
_COIN = re.compile(
    r'<g transform="translate\(([\d.\- ]+)\)"><circle r="([\d.]+)" fill="var\(--au\)"'
    r' stroke="none"></circle><text y="[\d.]+" font-size="[\d.]+" font-weight="900"'
    r' text-anchor="middle" letter-spacing="[^"]*" fill="var\(--ink\)">\$</text></g>'
)


def _cb_coin(m):
    pos, r = m.group(1), float(m.group(2))
    k = r / 17.0  # the payout coin's radius
    return (
        f'<g transform="translate({pos})">'
        f'<circle r="{r:g}" fill="var(--gold)" stroke="var(--ink)"'
        f' stroke-width="{5 * k:.2f}"></circle>'
        f'<text y="{4.5 * k:.2f}" font-size="{12 * k:.2f}" font-weight="900"'
        f' text-anchor="middle" letter-spacing="{-0.4 * k:.2f}"'
        f' fill="var(--ink)">$CB</text></g>'
    )


story, _n = _COIN.subn(_cb_coin, story)
assert _n == 6, f"expected 6 $CB coins in Treasury, rewrote {_n}"

# Two words in the Wake payoff. Only that line changes — the domain stays
# cykablyat.vip, and the hat is artwork rather than text.
story = story.replace("Cykablyat enough, I need", "Cyka blyat enough, I&nbsp;need")

# Both socials moved to the cykablyatvip handle. Rewritten here rather than left
# to the source, so the artifact matches the live accounts before the port lands.
story = story.replace('https://t.me/sbmemetoken', 'https://t.me/cykablyatvip')
story = story.replace('https://x.com/sbmemecoin', 'https://x.com/cykablyatvip')


# ---------------------------------------------------------------- restructure
# Screen 02 (Borrow) is dropped and its explanation moves onto the vault screen,
# set to the left of the machine. Sections are flat siblings inside <main>, so
# they can be sliced apart on their opening tags.
_starts = [m.start() for m in re.finditer(r"<section\b", story)]
_chunks = [story[a:(_starts[i + 1] if i + 1 < len(_starts) else len(story))]
           for i, a in enumerate(_starts)]
assert len(_chunks) == 9, f"expected 9 sections, found {len(_chunks)}"

_kept = [c for c in _chunks if "BorrowSection-module__" not in c]
assert len(_kept) == 8, "BorrowSection was not removed"

# The words that used to be screen 02, now a left-hand column on the vault.
VAULT_WORDS = (
    '<div class="vaultWords">'
    '<dl class="vwSteps">'
    '<div><dt>Lock</dt><dd>$1,000 of a memecoin</dd></div>'
    '<div><dt>Borrow</dt><dd>Up to $800 in $CB</dd></div>'
    '<div><dt>Spend</dt><dd>Use the $CB however you want</dd></div>'
    '<div><dt>Repay</dt><dd>Return the $CB to unlock your memecoin</dd></div>'
    "</dl>"
    "</div>"
)

for i, c in enumerate(_kept):
    if "VaultSection-module__" in c:
        # Injected as the last child of `.middle`, which globals.css already makes
        # `position: relative`. Inside `.wrap` — the machine's own box — was
        # tidier to position against, but it made the column a descendant of the
        # artwork rather than its sibling, so on a short phone it could only ever
        # be placed *over* the row and it printed across the $CB readout. As a
        # sibling it can drop into the flow above the machine instead.
        b = c.index('<div class="bottom"')
        cut = c.rindex("</div>", 0, b)  # the tag that closes .middle
        _kept[i] = c[:cut] + VAULT_WORDS + c[cut:]
        break
else:
    raise AssertionError("VaultSection not found")

# Counters are literal text per section, so removing one leaves 01,03,04… of 09.
_total = len(_kept)
for i, c in enumerate(_kept):
    _kept[i] = re.sub(r'(<div class="count">)\s*\d+\s*/\s*\d+',
                      lambda m, n=i + 1: f"{m.group(1)}{n:02d} / {_total:02d}", c, count=1)

story = "".join(_kept)


MASCOT_DEFS = (
    '<svg width="0" height="0" aria-hidden="true" focusable="false" '
    'style="position:absolute;width:0;height:0;overflow:hidden">'
    f'<symbol id="cap" viewBox="0 0 {MASCOT_W} {MASCOT_H}" '
    'preserveAspectRatio="xMidYMax meet">'
    f'<image href="data:image/webp;base64,{mascot}" '
    f'width="{MASCOT_W}" height="{MASCOT_H}"/></symbol></svg>'
)

# Site CSS: globals first, then the modules.
css_globals = (OUT / "_next/static/chunks/3dd5j5iulf8xr.css").read_text()
css_modules = (OUT / "_next/static/chunks/2bs1pbms1_8gc.css").read_text()

# next/font emits @font-face rules pointing at ../media/*.woff2 — those files
# will not exist here, so the rules are dropped and Geist is declared once
# from the inlined latin subset instead.
site_css = css_globals + "\n" + css_modules
site_css = re.sub(r"@font-face\{[^}]*\}", "", site_css)

# `html{scroll-snap-type:y mandatory}` is what makes the screens snap. It stays,
# but the export also sets a background on <body> that would fight page 1's own
# ground, so page 1 paints its own.

# ---------------------------------------------------------------- page 1
app = open("app.template.html").read()
p1_css = app[app.index("<style>") + 7 : app.index("</style>")]

# The template still carries __POP400__ style placeholders; the shared `fonts`
# block below declares Poppins properly, so page 1's own @font-face rules are
# dropped rather than shipped with unsubstituted placeholders in them.
p1_css = re.sub(r"@font-face\s*\{[^}]*\}", "", p1_css)

# Comments must go before scoping. The scoper reads whatever precedes a `{` as
# a selector, so a comment sitting above a rule gets "#p1 " spliced into its
# prose and — worse — swallows the selector slot, leaving the next rule
# unscoped. That is how :root escaped and nearly repainted all nine screens.
p1_css = re.sub(r"/\*.*?\*/", "", p1_css, flags=re.S)
p1_body = app[app.index("</style>") + 8 : app.index("<script>")]
p1_js = app[app.index("<script>") + 8 : app.rindex("</script>")]

# ---- scope page 1's CSS under #p1 -----------------------------------------
# .middle .hot .top .head .stage all exist in BOTH stylesheets. Without this
# the two silently corrupt each other — the story's .middle would centre page
# 1's panels, and page 1's .top would restyle nine section headers.
TOKEN_HOSTS = ("#p1", "#modal-root", ".preview", ".show-preview")


def scope(css: str, sel: str = "#p1") -> str:
    out, i = [], 0
    while i < len(css):
        # copy @font-face / @keyframes / :root blocks through untouched
        at = re.match(r"\s*@(font-face|keyframes|media|supports)\b", css[i:])
        if at:
            kind = at.group(1)
            start = i
            if kind in ("media", "supports"):
                # rewrite the inner block, keep the wrapper
                brace = css.index("{", i)
                depth, j = 1, brace + 1
                while depth:
                    if css[j] == "{": depth += 1
                    elif css[j] == "}": depth -= 1
                    j += 1
                out.append(css[start:brace + 1])
                out.append(scope(css[brace + 1 : j - 1], sel))
                out.append("}")
                i = j
                continue
            brace = css.index("{", i)
            depth, j = 1, brace + 1
            while depth:
                if css[j] == "{": depth += 1
                elif css[j] == "}": depth -= 1
                j += 1
            out.append(css[start:j])
            i = j
            continue

        brace = css.find("{", i)
        if brace == -1:
            out.append(css[i:])
            break
        selector = css[i:brace]
        depth, j = 1, brace + 1
        while depth and j < len(css):
            if css[j] == "{": depth += 1
            elif css[j] == "}": depth -= 1
            j += 1
        body = css[brace:j]

        parts = []
        for s in selector.split(","):
            s = s.strip()
            if not s:
                continue
            if s in ("*", "body", "html"):
                # `* { box-sizing }` etc. must not escape into the story
                parts.append(f"{sel} {s}" if s == "*" else sel)
            elif s.startswith(":root"):
                # Token declarations. These must reach the modals and the test
                # panel too — both sit outside #p1 in the DOM, and without this
                # `color: var(--paper)` resolves to nothing there and the text
                # disappears. They cannot go on :root itself: the story defines
                # its own --ink for every outline in the artwork, and page 1's
                # --ink would repaint all nine screens.
                # The host is appended after the whole :root compound, not
                # spliced in after the word — ":root:not([data-theme=light])"
                # must become ":root:not(…) #p1", never ":root #p1:not(…)",
                # which would test the attribute on the wrong element and kill
                # dark mode.
                for host in TOKEN_HOSTS:
                    parts.append(host if s == ":root" else f"{s} {host}")
            else:
                parts.append(f"{sel} {s}")
        out.append(", ".join(parts) + body)
        i = j
    return "".join(out)

p1_scoped = scope(p1_css)

# The modal root and the test panel are position:fixed and live outside #p1,
# so their rules need the same treatment applied at the document level.
p1_scoped = p1_scoped.replace("#p1 .veil", ".veil") \
                     .replace("#p1 .modal", ".modal") \
                     .replace("#p1 .mhead", ".mhead") \
                     .replace("#p1 .mbody", ".mbody") \
                     .replace("#p1 .mfoot", ".mfoot") \
                     .replace("#p1 .preview", ".preview") \
                     .replace("#p1 .show-preview", ".show-preview")

# ---------------------------------------------------------------- assemble
fonts = f"""
@font-face {{ font-family:"Poppins"; font-weight:400; font-display:block;
  src:url(data:font/woff2;base64,{F['pop400']}) format("woff2"); }}
@font-face {{ font-family:"Poppins"; font-weight:600; font-display:block;
  src:url(data:font/woff2;base64,{F['pop600']}) format("woff2"); }}
@font-face {{ font-family:"Poppins"; font-weight:700; font-display:block;
  src:url(data:font/woff2;base64,{F['pop700']}) format("woff2"); }}
@font-face {{ font-family:"Poppins"; font-weight:800; font-display:block;
  src:url(data:font/woff2;base64,{F['pop800']}) format("woff2"); }}
@font-face {{ font-family:"Geist"; font-weight:100 900; font-display:block;
  src:url(data:font/woff2;base64,{F['geist']}) format("woff2"); }}
"""

glue = """
/* ---------------------------------------------------------------------------
   The join. Page 1 is the first snap panel; the nine story screens follow.
   --------------------------------------------------------------------------- */
html { scroll-snap-type: y mandatory; scroll-behavior: smooth; overflow-x: hidden; }
body { margin: 0; overflow-x: hidden; }

/* next/font is not here, so the variable the story's CSS reads is set by hand. */
:root { --font-sb: "Geist"; }

#p1 {
  scroll-snap-align: start;
  scroll-snap-stop: always;
  background: var(--ground);
  position: relative;
}

/* A quiet cue that there are nine more screens under the app. */
#p1 .more {
  position: absolute; left: 50%; bottom: 3.4rem; transform: translateX(-50%);
  display: grid; justify-items: center; gap: 0.2rem;
  font-size: 0.7rem; font-weight: 600; letter-spacing: 0.16em;
  text-transform: uppercase; color: var(--head-dim);
  background: none; border: 0; cursor: pointer; padding: 0.4rem 0.6rem;
}
#p1 .more span { display: block; animation: p1nudge 1.9s ease-in-out infinite; }
/* On a phone there is no room between the footer and the bottom of the screen
   for it, and it landed on top of the contract address. Swiping down is not a
   thing a phone needs told anyway. */
@media (max-width: 560px) { #p1 .more { display: none; } }
@keyframes p1nudge { 0%,100% { transform: translateY(0) } 50% { transform: translateY(4px) } }

/* The words lifted off the removed screen 02, sitting to the left of the vault
   and centred between top and bottom. Absolutely positioned so it does not
   disturb the section's existing four-row grid.

   Typography follows the screen's own readout: a small uppercase tracked
   label in --text-dim over a heavy line in --ink. No borders, no counters —
   the vault screen has neither.

   Placed off the same expression that sizes the machine, so the column tracks it
   at every viewport instead of drifting out to the window frame. The 0.38 rather
   than 0.5 is the machine's own empty margin: its viewBox is 660 wide and the
   lever, the leftmost thing drawn, starts near x=95, so measuring to the box edge
   would have left a gap of nothing. */
.vaultWords {
  /* Derived from the machine's own budget, not from a copy of the expression it
     used to be sized by — the two had drifted apart once `--art` took over, and
     the column was being placed for a 573px machine beside a 509px one. */
  --vwMachine: min(100%, calc(var(--art) * 660 / 560));
  position: absolute;
  right: calc(50% + var(--vwMachine) * 0.40);
  top: 50%;
  transform: translateY(-50%);
  width: min(17rem, calc(50% - var(--vwMachine) * 0.40 - 1.5rem));
  display: grid;
  gap: 1.05rem;
  text-align: left;
  z-index: 3;
}
.vwSteps { margin: 0; padding: 0; display: grid; gap: 0.85rem; }
/* The bubble's voice on this same screen — uppercase in --ink, no tracking, the
   same clamp and the same 1.05 leading — but not all at 900. Everything heavy is
   everything shouted, and a block where nothing is emphasised reads as slowly as
   one where everything is.

   Two weights only, so the eye has somewhere to land: the four verbs carry the
   accent and nothing else does — no bolded figures competing with them. Geist is
   embedded as a variable face (100-900), so 600 is a real weight here, not a
   synthesised one. */
.vwSteps dt,
.vwSteps dd {
  margin: 0;
  font-weight: 600;
  text-transform: uppercase;
  font-size: clamp(0.72rem, 2.2vw, 0.95rem);
  line-height: 1.05;
  letter-spacing: 0;
  color: var(--ink);
}
.vwSteps dt { font-weight: 900; }
.vwSteps dd { margin-top: 0.2rem; font-variant-numeric: tabular-nums; }

/* Narrow screens have no room beside the machine, so the column rejoins the flow
   above it — a sibling row inside `.middle`, packed to the bottom so it sits
   against the machine rather than floating halfway up the screen. */
@media (max-width: 980px) {
  /* Both of these bottom-align their artwork, which is right on a laptop where
     the artwork is height-bound. On a tall phone it is width-bound instead — the
     safe is 412px wide and 345 tall in a 600px row — so all the slack pooled in
     one lump under the corner readout. Centred, the same slack reads as margin. */
  [class*="VaultSection-module__"][class*="__middle"],
  [class*="RepaySection-module__"][class*="__middle"] {
    align-content: center;
    row-gap: clamp(0.3rem, 1.2vh, 0.9rem);
  }
  .vaultWords {
    position: static;
    transform: none;
    width: min(30rem, 94vw);
    margin: 0 auto;
    justify-items: center; text-align: center;
    gap: 0.5rem;
  }
  /* Under the machine, not above it. Above, the leftover height in the row all
     collected between the readout and the words and read as a hole; below, that
     slack ends up behind the readout where it is meant to be. */
  /* Four across is 85px a column at 390px. Two by two instead, each pair wide
     enough for its line to stay on one or two lines. */
  .vwSteps {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.6rem 1.1rem;
    justify-content: center;
  }
}

/* Short and narrow: the words, the readout and the machine are all competing for
   the same 330px. The machine takes a height cap so the other two fit above it. */
@media (max-width: 560px) and (max-height: 700px) {
  .vaultWords { gap: 0.3rem; }
  .vwSteps { gap: 0.45rem 0.9rem; }
  .vwSteps dt, .vwSteps dd { font-size: 0.72rem; }
}
@media (max-width: 560px) and (max-height: 620px) {
  /* 0.66rem is 10.6px — still legible, and it takes the longest step from three
     wrapped lines to two, which is what buys the machine its height back. */
  .vwSteps { gap: 0.35rem 0.8rem; }
  .vwSteps dt, .vwSteps dd { font-size: 0.66rem; }
}

/* Nothing you tap, pull or drag should highlight. The site's CSS has no
   user-select rule at all, so hitting the clock or dragging the repay handle
   left a blue selection over the artwork. Text you might actually want to
   copy — the contract address — is deliberately excluded. */
main .stage,
#p1 .app {
  -webkit-user-select: none;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
}
main .stage [class*="__ca"],
main .stage [class*="__addr"],
#p1 .addr,
#p1 input {
  -webkit-user-select: text;
  user-select: text;
}
/* Dragging an SVG or an image otherwise starts a native drag. */
main .stage svg,
main .stage image,
main .stage use { -webkit-user-drag: none; }

@media (prefers-reduced-motion: reduce) {
  html { scroll-snap-type: none; scroll-behavior: auto; }
  #p1 .more span { animation: none; }
}
"""

# ---------------------------------------------------------------------------
# Phones. Emitted after the site's own stylesheets so equal-specificity rules
# win on source order.
#
# `.stage` is `min-height: 100dvh` with rows `auto auto 1fr auto`, so anything
# in the fixed rows that will not shrink pushes the panel past the viewport —
# and under `scroll-snap-type: y mandatory` with `scroll-snap-stop: always` the
# overflow is close to unreachable. Three screens did it:
#
#   Hero    705px on a 568px screen — a 52dvh mascot over a 159px coin rail
#   Join    790px — four pill links stacked one per row, 218px of them
#   Play    593px — the same 159px control row under a 50dvh yard
#
# The artwork is already dvh-capped; the control rows were not. `.disc` is the
# part they share, so making it height-aware fixes Hero and Playground at once.
# Every rule is width-qualified so laptops keep the full-size design.
# ---------------------------------------------------------------------------
phones = """
/* ================= one rhythm across screens 01–08 ==========================
   Each section sized its own artwork independently, so the eight of them ranged
   from 19% of the screen to 59% and the sparse ones read as half-empty:

                        desktop        phone
     Hero    41dvh cap    58%           52%
     Vault   54dvh        65%           59%
     Repay   56dvh        68%           54%
     Treasury  no cap     40%           27%      <- width-only, never grew
     Wake    52dvh        50%           19%      <- 2.4:1 scene, width-bound
     Story   no cap       65%           37%      <- three 3:4 cards, width-bound
     Play    50dvh/420px  47%           39%
     Join    content      64%           46%

   Everything now derives from one budget, `--art`, so the artwork lands on the
   same height on every screen and the knob is in a single place. Each screen
   converts it through its own aspect ratio, which is why the multipliers differ.

   Two cannot reach the budget by growing tall, and are widened instead: Wake is
   a 2.4:1 room, so at any honest width its height is a fraction of its span, and
   Story is three 3:4 cards in a row, which is 0.44 of the deck's width. Cropping
   either to force the height would cut the alarm clock and the cards in half. */
main .stage { --art: min(54dvh, 500px); }

[class*="HeroSection-module__"][class*="__mascot"] {
  width: min(100%, calc(var(--art) * 795 / 1008));
}
[class*="VaultSection-module__"][class*="__wrap"] {
  width: min(100%, calc(var(--art) * 660 / 560));
}
[class*="RepaySection-module__"][class*="__wrap"] {
  width: min(100%, calc(var(--art) * 620 / 520));
}
[class*="PlaygroundSection-module__"][class*="__yard"] {
  width: min(100%, calc(var(--art) * 380 / 360));
}
/* Wake's verdict is absolutely positioned directly above the room
   (`bottom: calc(100% + 0.6rem)`), so it rides upward with the room as the
   viewport gets shorter — and its size is driven by width (4vw) while the space
   it has is driven by height. On a landscape iPad, where the browser's toolbar
   takes a slice of the height, the two met and the line crossed into the
   headline. Two fixes, both needed:

     the line is capped by height as well as width, so a wide short viewport
     no longer asks for a 38px line it has no room for;

     the row reserves the space the line needs above the room, rather than
     relying on there happening to be some.

   Both read from one custom property so they cannot drift apart. */
[class*="WakeSection-module__"][class*="__mid"] {
  --verdict: clamp(1.1rem, min(4vw, 5.2vh), 2.4rem);
  padding-top: calc(var(--verdict) * 1.4 + 0.7rem);
}
/* Narrow enough that the line takes two rows. */
@media (max-width: 700px) {
  [class*="WakeSection-module__"][class*="__mid"] {
    padding-top: calc(var(--verdict) * 2.5 + 0.7rem);
  }
}
/* Wide and short — a small landscape window — is where the room is sized by
   height rather than by width, so it is the one case where reserving the space
   costs the room its fit. It gives that back. Portrait phones are untouched:
   their room is width-bound and this cap never binds. */
@media (max-height: 660px) {
  [class*="WakeSection-module__"][class*="__mid"] { --art: min(40dvh, 430px); }
}
[class*="WakeSection-module__"][class*="__verdict"] { font-size: var(--verdict); }

[class*="WakeSection-module__"][class*="__room"] {
  width: min(100%, calc(var(--art) * 700 / 292));
}
/* Treasury's safe was clamp(120px, 26vw, 250px) — pure width, which is why this
   screen never filled at any height. The borrowers scale with it so the crowd
   keeps its proportion to the vault they are borrowing from. */
/* Capped on both axes. `.tflow` is a flex row with no width of its own, so a
   height-derived safe drove the row to 770px inside a 390px phone — Treasury's
   stage is the one with `overflow: hidden`, so it silently cut the crowd off
   rather than scrolling. The vw halves keep the safe and the borrowers inside the
   row's share of the screen; the dvh halves are what make it fill on a laptop. */
/* The safe is drawn edge to edge in its box, where every other screen's artwork
   has slack inside its viewBox — the machine on 02 fills 295px of a 509px box.
   So at a matching box size this one read a size larger than everything else.
   340px puts the drawing itself just under the glass safe on 03, which is the
   nearest thing to it on the site. */
[class*="TreasurySection-module__"][class*="__safewrap"] {
  width: clamp(120px, min(calc(var(--art) * 0.78), 40vw), 289px);
}
[class*="TreasurySection-module__"][class*="__capy"] {
  width: clamp(46px, min(calc(var(--art) * 0.26), 16vw), 118px);
}
[class*="TreasurySection-module__"][class*="__crowd"] > [class*="__capy"]:nth-child(2) {
  width: clamp(54px, min(calc(var(--art) * 0.3), 18vw), 136px);
}
/* On a phone the safe and the crowd side by side can only ever be as tall as half
   the screen is wide, which is what kept this the emptiest screen of the eight at
   any budget. Stacked, the safe gets the full width and the flow reads top-down
   instead of left-right — the orbit follows, because it is measured from the real
   boxes rather than tuned. */
@media (max-width: 640px) {
  [class*="TreasurySection-module__"][class*="__tflow"] {
    flex-direction: column;
    align-items: center;
    gap: clamp(0.6rem, 2.4vh, 1.4rem);
  }
  [class*="TreasurySection-module__"][class*="__safewrap"] {
    width: min(calc(var(--art) * 0.81), 53vw);
  }
  [class*="TreasurySection-module__"][class*="__capy"] { width: clamp(46px, 19vw, 118px); }
  [class*="TreasurySection-module__"][class*="__crowd"] > [class*="__capy"]:nth-child(2) {
    width: clamp(54px, 22vw, 136px);
  }
}

/* Stacked, this screen's height is set by the safe's width, so on the shortest
   phones the width cap is the only thing that can give — the budget is not what
   binds here. At 62vw it ran 33px past a 320x568 and put the scroll cue below the
   bottom edge. */
@media (max-width: 560px) and (max-height: 660px) {
  [class*="TreasurySection-module__"][class*="__safewrap"] {
    width: min(calc(var(--art) * 0.81), 41vw);
  }
  [class*="TreasurySection-module__"][class*="__tflow"] { gap: 0.4rem; }
  [class*="TreasurySection-module__"][class*="__middle"] { gap: 0.4rem; }
}
/* A card is a third of the deck and 3:4, so deck height is deck width x 4/9 —
   the deck has to be about 2.1x the height wanted, once its label is allowed for. */
[class*="StorySection-module__"][class*="__deck"] {
  width: min(100%, calc(var(--art) * 2.05));
}
[class*="JoinSection-module__"][class*="__hero"] {
  width: clamp(96px, calc(var(--art) * 0.34), 170px);
}

/* Screens whose artwork carries extra furniture above or beside it — a coin arc,
   a readout, a speech bubble, a caption — reach the same overall block with a
   slightly smaller budget than the ones that are just the artwork. */
[class*="VaultSection-module__"][class*="__middle"]  { --art: min(48dvh, 450px); }
/* The vault also carries the four-step explanation lifted off the removed screen
   02, so its machine runs a size smaller on a phone than it would alone — and
   smaller again on the shortest screens, where the steps take two rows instead of
   one. These have to sit here rather than with the other phone rules: `glue` is
   emitted before this block, so a budget written there loses to the 980px rule
   below it and never applies. */
@media (max-width: 980px) {
  [class*="VaultSection-module__"][class*="__middle"] { --art: min(43dvh, 450px); }
}
@media (max-width: 560px) and (max-height: 700px) {
  [class*="VaultSection-module__"][class*="__middle"] { --art: min(40dvh, 450px); }
}
@media (max-width: 560px) and (max-height: 620px) {
  [class*="VaultSection-module__"][class*="__middle"] { --art: min(36dvh, 450px); }
}
[class*="RepaySection-module__"][class*="__middle"]  { --art: min(49dvh, 455px); }
[class*="JoinSection-module__"][class*="__middle"]   { --art: min(50dvh, 465px); }

/* Nothing should be stuck against one edge of its row with the leftover pooled at
   the other. Centred, every screen carries the same margin above and below its
   block — which is most of what reads as "balanced" from one screen to the next.
   The artwork keeps its own ground inside the SVG, so nothing starts floating. */
main .stage > .middle,
main .stage > [class*="__mid"] { align-content: center; }
[class*="HeroSection-module__"][class*="__middle"],
[class*="VaultSection-module__"][class*="__middle"],
[class*="RepaySection-module__"][class*="__middle"],
[class*="PlaygroundSection-module__"][class*="__middle"],
[class*="WakeSection-module__"][class*="__mid"] { place-items: center; }

/* Readouts and in-artwork labels: Hero's number was a size larger than the two
   screens that repeat it, and Story's instruction a size larger than the label
   doing the same job on Vault and Wake. */
[class*="HeroSection-module__"][class*="__value"],
[class*="VaultSection-module__"][class*="__value"],
[class*="RepaySection-module__"][class*="__value"] {
  font-size: clamp(1.5rem, 5vw, 2.8rem);
}
[class*="StorySection-module__"][class*="__deckLabel"] {
  font-size: clamp(0.72rem, 1.7vw, 0.8rem);
}

/* The orbiting coins were 22-34px wide, which is not enough for "$CB" to read as
   anything. Bigger, now that they carry a legend rather than a single glyph. */
[class*="TreasurySection-module__"][class*="__gc"] {
  width: clamp(30px, 4.6vw, 46px);
}

/* The scroll cue sat 14-21px off the bottom edge on every screen and every
   device — `.stage` reserves `max(1.1rem, env(safe-area-inset-bottom))`, and on a
   phone with no home indicator that inset is 0, so 17.6px was the whole margin.
   The type needs room to sit above the edge rather than against it. Stated as a
   longhand so it beats the shorthand in the section's own stylesheet. */
main .stage {
  padding-bottom: max(2.4rem, calc(env(safe-area-inset-bottom) + 1.4rem));
}
/* Treasury's lowest line is two lines of copy on a phone, and with a smaller safe
   there is height going spare — so this screen reserves more than the rest and its
   whole block sits higher. */
[class*="TreasurySection-module__"][class*="__stage"] {
  padding-bottom: max(4rem, calc(env(safe-area-inset-bottom) + 3rem));
}
/* Short screens cannot spare the full amount; they still get half again on what
   they had. */
@media (max-width: 560px) and (max-height: 700px) {
  main .stage {
    padding-bottom: max(1.8rem, calc(env(safe-area-inset-bottom) + 1.1rem));
  }
  [class*="TreasurySection-module__"][class*="__stage"] {
    padding-bottom: max(2.8rem, calc(env(safe-area-inset-bottom) + 2rem));
  }
}

/* Short viewports at any width — a tablet on its side, a small laptop window, a
   phone in landscape. Everything in here is height-driven; the width tier below
   handles what is genuinely about narrowness. Without this the fixed rows never
   gave way, and Hero, Treasury, Playground and Join all ran past the bottom of a
   1024x600 or a landscape iPad. */
@media (max-height: 870px) {
  [class*="HeroSection-module__"][class*="__middle"]       { --art: min(40dvh, 460px); }
  [class*="PlaygroundSection-module__"][class*="__middle"] { --art: min(46dvh, 500px); }
  [class*="TreasurySection-module__"][class*="__middle"]   { --art: min(46dvh, 500px); }
  .head { padding-top: clamp(0.25rem, 1.2vh, 1rem); }
  .hint { min-height: 1em; }
}
@media (max-height: 700px) {
  [class*="HeroSection-module__"][class*="__middle"] { --art: min(34dvh, 460px); }
  [class*="HeroSection-module__"][class*="__reset"] { font-size: 0.68rem; padding: 0.3rem 0.7rem; }
  /* Join is content, not artwork, so it gives from its spacing. */
  [class*="JoinSection-module__"][class*="__final"] { gap: clamp(0.3rem, 1.1vh, 0.9rem); }
  [class*="JoinSection-module__"][class*="__spec"] { gap: 0.15rem; margin-top: 0.15rem; }
  [class*="JoinSection-module__"][class*="__specRow"] { font-size: 0.8rem; }
  a[class*="JoinSection-module__"][class*="__link"] { padding: 0.45rem 0.8rem; border-width: 3px; }
  div[class*="JoinSection-module__"][class*="__hero"] { width: clamp(74px, 12vh, 130px); }
}

/* ===================== phones: fit one screen, thumb-sized ==================== */

/* Tier one — every phone. A 54px disc floor on a 568px screen is six discs of
   pure height. Height-aware now, with a 40px floor so it never drops below a
   comfortable tap. 0.66rem is 10.6px: the smallest a phone renders cleanly. */
/* Six of these in a row is the tallest fixed thing on two screens, and at desktop
   widths it was 70px regardless of how little height there was — 194px of a 600px
   window, on its own. Height-aware at every width now; on a normal desktop
   min(12.5vw, 8.6dvh) still resolves above the 70px cap, so nothing changes there. */
.disc {
  width: clamp(40px, min(12.5vw, 8.6dvh), 70px);
  height: clamp(40px, min(12.5vw, 8.6dvh), 70px);
}

@media (max-width: 560px) {
  .slabel { font-size: 0.66rem; }
  .head { padding-top: clamp(0.25rem, 1.2vh, 1rem); }
  main h1.sticker { font-size: clamp(1.3rem, 4.2vw, 2.4rem); }
  .hint { font-size: 0.8rem; min-height: 1em; }
  .cue { font-size: 0.66rem; }

  /* Per-screen budget, set on each section's own middle row. The bottom rows are
     not the same height — Hero carries a six-coin rail, Playground a six-button
     pad, Treasury only a line of text — so the artwork budget has to differ by
     exactly that much for the screens to come out the same overall. */
  [class*="HeroSection-module__"][class*="__middle"] { --art: min(44dvh, 460px); }
  [class*="HeroSection-module__"][class*="__reset"] {
    font-size: 0.68rem; padding: 0.3rem 0.7rem;
  }

  /* Join: the pills are 169px wide, so two never fit side by side and all four
     stacked. Two equal columns fit at 320px. */
  [class*="JoinSection-module__"][class*="__links"] {
    display: grid; grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.4rem; width: 100%;
  }
  a[class*="JoinSection-module__"][class*="__link"] {
    padding: 0.45rem 0.5rem; font-size: 0.76rem;
    border-width: 3px; justify-content: center;
  }
  div[class*="JoinSection-module__"][class*="__hero"] { width: clamp(74px, 15vw, 120px); }
  [class*="JoinSection-module__"][class*="__final"] { gap: clamp(0.35rem, 1.2vh, 0.9rem); }
  [class*="JoinSection-module__"][class*="__spec"] { gap: 0.2rem; margin-top: 0.2rem; }
  [class*="JoinSection-module__"][class*="__specRow"] { font-size: 0.74rem; }
  [class*="JoinSection-module__"][class*="__caLabel"] { font-size: 0.68rem; }
}

/* Tier two — the short ones: iPhone SE/8 and the 640-tall Androids. Hero and
   Join are still a little over at 568, and both give from the artwork and the
   gaps rather than from any control. */
@media (max-width: 560px) and (max-height: 700px) {
  /* Hero, Vault and Repay all pin a readout to a corner of the middle row, which
     works while there is space around the artwork. On a short screen the row is
     only as tall as the artwork, so "$CB BORROWED" printed across his hat and
     "LEFT TO REPAY" across the safe. All three join the flow as one line instead,
     and the artwork gives up the height they need. */
  [class*="HeroSection-module__"][class*="__readout"],
  [class*="VaultSection-module__"][class*="__readout"],
  [class*="RepaySection-module__"][class*="__readout"] {
    position: static; display: flex; align-items: baseline; gap: 0.5rem;
  }
  [class*="HeroSection-module__"][class*="__readout"] { justify-self: end; }
  [class*="VaultSection-module__"][class*="__readout"],
  [class*="RepaySection-module__"][class*="__readout"] { justify-self: start; }
  [class*="HeroSection-module__"][class*="__value"],
  [class*="VaultSection-module__"][class*="__value"],
  [class*="RepaySection-module__"][class*="__value"] { font-size: 1.3rem; }

  /* Repay's safe now shares the row with its readout. */
  [class*="RepaySection-module__"][class*="__middle"] {
    --art: min(46dvh, 480px); row-gap: 0.4rem;
  }
  [class*="HeroSection-module__"][class*="__middle"] { --art: min(31dvh, 460px); }
  div[class*="JoinSection-module__"][class*="__hero"] { width: clamp(64px, 15vw, 120px); }
  [class*="JoinSection-module__"][class*="__final"] { gap: clamp(0.28rem, 1vh, 0.9rem); }
  [class*="JoinSection-module__"][class*="__links"] { gap: 0.3rem; }
  [class*="JoinSection-module__"][class*="__spec"] { gap: 0.12rem; margin-top: 0.1rem; }
  [class*="JoinSection-module__"][class*="__specRow"] { font-size: 0.7rem; }
}

/* Story's deck is three cards across, so on a phone its width is fixed by the
   screen and 3:4 cards come out 118x158 — the sparsest block of the eight. The
   cards go taller rather than the deck going wider, which is the only axis left. */
@media (max-width: 640px) {
  /* The card is the only button in the deck — an unanchored __card also matches
     cardFace, cardBack and cardArt, and setting a ratio on those shrank the art
     inside instead of making the card taller. */
  button[class*="StorySection-module__"][class*="__card"] { aspect-ratio: 3 / 5; }
  [class*="StorySection-module__"][class*="__deck"] {
    gap: clamp(0.4rem, 1.8vw, 1rem);
    /* repeat(3, 1fr) is minmax(auto, 1fr), so each card's min-content — the
       longest word on its face — could push the column past a third of the deck
       and the third card off the right edge. */
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

/* Tap targets. The SVG controls — the lever, the clock, the yard — carry their
   own hit areas in the artwork; the plain buttons were laid out for a mouse. */
@media (pointer: coarse) {
  main .sbtn { min-height: 44px; }
  a[class*="JoinSection-module__"][class*="__link"] { min-height: 44px; }
  /* The Buy / Borrow pair in Hero's top bar. */
  a[class*="HeroSection-module__"][class*="__cta"] {
    min-height: 44px; padding-block: 0.5rem;
  }
  /* Join's "Back to top" — the last thing on the site, and 29px tall. */
  [class*="JoinSection-module__"][class*="__toTop"] {
    min-height: 34px; padding: 0.35rem 0.7rem;
    display: inline-flex; align-items: center;
  }
}
"""

html = f"""<title>$CB — cykablyat.vip</title>

<style>
{fonts}
{glue}
/* ===================== page 1: the protocol (scoped to #p1) ===================== */
{p1_scoped}
/* ===================== screens 2–10: the story (from the Next build) ============ */
{site_css}
{phones}
</style>

<div id="p1">
{p1_body}
<button class="more" type="button" data-more>the story <span>&#8595;</span></button>
</div>

{MASCOT_DEFS}

<main>{story}</main>

<div id="modal-root"></div>
<div class="preview" id="preview"></div>
<button class="show-preview" id="show-preview" type="button">Test panel</button>

<script>
{p1_js}
</script>

<script>
/* ---------------------------------------------------------------------------
   useEntrance, reimplemented. globals.css ships `.ent{{opacity:0}}` and React
   adds `.entGo` once a section scrolls into view — without it all nine screens
   render invisible. The exported markup already carries data-ent and
   data-ent-delay on 41 elements, so this reads exactly what the hook read.
   --------------------------------------------------------------------------- */
(function () {{
  "use strict";
  var stages = document.querySelectorAll("main .stage, main section");
  if (!stages.length) return;

  /* data-ent is only half the reveal. Each section also hides its own content
     at rest and un-hides it through one parent state class that React toggles:
     BorrowSection.module.css has `.bag,.safewrap,.arrow,.flyer{{opacity:0}}`
     plus `.play .bag{{…}}`, driven by useState. Six of the nine call that class
     `play`; Treasury needs `crowd` as well. Without it, screens 02 and 05 were
     a headline on an empty page.

     Resolved from the section's own hashed prefix so we use its mechanism
     rather than force-setting opacity — which would also expose transient bits
     like the "copied" toast. */
  /* Section-level state classes only, verified against each component's own
     <section className={...}>:
        Borrow/Treasury  play
        Story            allDone
        Wake             s4  (its steps are s0..s4 on the section)
     "crowd" and "flipped" were mistakes caught in review — they are child
     classes (the capybara container, and a per-card flip). Putting "crowd" on
     the section restyled Treasury as a flex crowd and collapsed the whole
     screen to blank. Vault ("pulled") and Playground ("busy") are left alone:
     their hidden elements are interaction artefacts and both already read as
     complete. */
  /* Each with the delay React itself would have applied. Adding a state class
     the instant a screen scrolls in jumps it to its last frame and the
     animation never plays — that is what broke Wake and Story after the first
     fix. The delay lets each section's own CSS keyframes run, then the
     late-stage content appears. */
  /* Only Treasury reveals on a timer with nothing to click. Wake ("s4") and
     Story ("allDone") were here too, which was wrong: both are driven by
     hitting the clock and flipping the cards, so forcing their last frame on a
     delay skipped the whole interaction. They are wired as clicks below. */
  var STATES = [{{ name: "play", after: 900 }}];

  function modulePrefix(stage) {{
    var el = stage.querySelector('[class*="-module__"]');
    while (el) {{
      var hit = /([A-Za-z]+-module__[A-Za-z0-9_-]+?__)/.exec(el.className);
      if (hit) return hit[1];
      el = el.querySelector('[class*="-module__"]');
    }}
    return null;
  }}

  function reveal(stage) {{
    var pre = modulePrefix(stage);
    if (!pre) return;
    STATES.forEach(function (st) {{
      /* Only add a class the section actually defines. */
      if (!styleHas(pre + st.name)) return;
      setTimeout(function () {{
        /* Wake's steps are mutually exclusive; the export ships s0, so drop
           any earlier step before moving to the last one. */
        if (st.name === "s4") {{
          for (var k = 0; k < 4; k++) stage.classList.remove(pre + "s" + k);
        }}
        stage.classList.add(pre + st.name);
      }}, st.after);
    }});
  }}

  var SHEET_TEXT = null;
  function styleHas(cls) {{
    if (SHEET_TEXT === null) {{
      SHEET_TEXT = "";
      var tags = document.querySelectorAll("style");
      for (var i = 0; i < tags.length; i++) SHEET_TEXT += tags[i].textContent;
    }}
    return SHEET_TEXT.indexOf("." + cls) !== -1;
  }}

  function play(stage) {{
    reveal(stage);
    stage.querySelectorAll("[data-ent]").forEach(function (el) {{
      var delay = parseInt(el.getAttribute("data-ent-delay") || "0", 10);
      setTimeout(function () {{
        el.classList.add(el.getAttribute("data-ent") === "fade" ? "entGoFade" : "entGo");
      }}, delay);
    }});
  }}

  if (!("IntersectionObserver" in window)) {{
    stages.forEach(play);
    return;
  }}
  var io = new IntersectionObserver(function (entries) {{
    entries.forEach(function (e) {{
      /* Once only. Replaying on every pass turns choreography into a twitch —
         the same call the original hook made. */
      if (e.isIntersecting) {{ play(e.target); io.unobserve(e.target); }}
    }});
  }}, {{ threshold: 0.25 }});
  stages.forEach(function (s) {{ io.observe(s); }});

  /* ------------------------------------------------------------------
     Click-driven animations. Both of these are section-level class
     toggles in the original, so they can be reproduced exactly:
       Vault      .pulled   on the section, from clicking the lever
       Playground .mJump/.mSpin/… + .busy, from the mood buttons
     Durations are the components' own (MOODS in PlaygroundSection).
     Hero's coin feed is deliberately not here — it measures rects and
     mounts a React root to draw the flying coin, so it is not a class
     toggle and cannot be faked honestly.
     ------------------------------------------------------------------ */
  (function wireClicks() {{
    function prefixOf(el) {{
      var hit = /([A-Za-z]+-module__[A-Za-z0-9_-]+?__)/.exec(el.getAttribute("class") || "");
      return hit ? hit[1] : null;
    }}

    /* ---- replay: nothing is allowed to stay spent --------------------
       The site's own two-part contract, reproduced for all eight screens:

         useReplay     rewinds a screen once it has scrolled away, so you
                       always come back to a fresh one and the reset is
                       never seen happening.
         useAutoRearm  rewinds it in place 5200ms after it settles, so a
                       screen you finished while still looking at it offers
                       itself again instead of sitting used up.

       Every toy here was one-shot without this: the clock stayed hit, the
       cards stayed face up, he stayed fat. */
    var REPLAY = [];
    function replayable(st, reset, isBusy) {{
      if (st && reset) REPLAY.push({{ st: st, reset: reset, busy: isBusy }});
    }}
    /* A CSS animation that fires on mount can only be replayed by restarting
       it — React does this by remounting the subtree on a changed key. */
    function restartCss(root) {{
      if (!root) return;
      root.querySelectorAll("*").forEach(function (e) {{
        if (getComputedStyle(e).animationName === "none") return;
        var keep = e.style.animation;
        e.style.animation = "none";
        void e.offsetWidth;
        e.style.animation = keep;
      }});
    }}

    /* --- Hero: feed him a coin ---------------------------------------
       Reproduced from HeroSection.tsx rather than approximated: same
       MAX/PER, same LINES, same shape() curve, same three animations with
       their own easings and the 620ms duration, same 720ms squash on
       impact, same 5200ms auto-rearm. The one substitution is the flying
       coin's glyph — the original mounts a React root to draw it, so here
       the clicked coin's own SVG is cloned instead. */
    (function hero() {{
      var stage = document.querySelector("main .stage");
      if (!stage) return;
      var pre = prefixOf(stage.querySelector('[class*="HeroSection-module__"]') || stage);
      if (!pre) return;

      var mascot = stage.querySelector('[class*="__mascot"]');
      var value = stage.querySelector('[class*="__value"]');
      var bubble = stage.querySelector(".bubble");
      var coins = stage.querySelectorAll(".sbtn");
      if (!mascot || !coins.length) return;

      var MAX = 10, PER = 4200;
      var LINES = {{ 1: "fine.", 3: "that's it?", 5: "more.", 7: "i am rich now", 10: "full. stop." }};
      var fed = 0, inFlight = 0, bubbleTimer, rearm;
      var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

      function shape(n) {{ var sy = 1 + n * 0.032; return {{ sx: sy * (1 + n * 0.038), sy: sy }}; }}

      function say(t) {{
        if (!bubble) return;
        bubble.textContent = t;
        bubble.classList.add("show");
        clearTimeout(bubbleTimer);
        bubbleTimer = setTimeout(function () {{ bubble.classList.remove("show"); }}, 2200);
      }}

      function paint(n) {{
        var k = shape(n);
        mascot.style.transform = "scale(" + k.sx.toFixed(3) + "," + k.sy.toFixed(3) + ")";
        if (value) value.textContent = (n * PER).toLocaleString("en-US");
      }}

      function gulp(n) {{
        if (reduce) return;
        var g = shape(n);
        var k = function (x, y) {{ return "scale(" + g.sx * x + "," + g.sy * y + ")"; }};
        mascot.animate([
          {{ transform: k(1, 1), offset: 0 }},
          {{ transform: k(1.09, 0.88), offset: 0.16 }},
          {{ transform: k(0.95, 1.07), offset: 0.42 }},
          {{ transform: k(1.03, 0.975), offset: 0.66 }},
          {{ transform: k(0.99, 1.012), offset: 0.85 }},
          {{ transform: k(1, 1), offset: 1 }}
        ], {{ duration: 720, easing: "cubic-bezier(.25,.7,.35,1)" }});
      }}

      /* "Give the bags back" — it is in the markup with a .show class the
         component toggles on fed > 0, and it was never wired here, so once he
         had eaten there was no way back to his own shape short of reloading.
         That is the one thing this screen has to be able to undo. */
      var resetBtn = stage.querySelector('[class*="__reset"]');
      var idle;

      function deflate(quiet) {{
        clearTimeout(rearm); clearTimeout(idle);
        inFlight = 0; fed = 0;
        paint(0);
        if (resetBtn) resetBtn.classList.remove(pre + "show");
        if (quiet) {{ if (bubble) bubble.classList.remove("show"); }}
        else say("no.");
      }}

      if (resetBtn) {{
        resetBtn.addEventListener("click", function () {{ deflate(false); }});
      }}

      function land(n) {{
        fed = n;
        paint(n);
        gulp(n);
        if (LINES[n]) say(LINES[n]);
        if (resetBtn && n > 0) resetBtn.classList.add(pre + "show");
        /* The component only hands the bags back once he is completely full, and
           with ten to give and six coins to give them with, most people stop
           short and leave him stuck fat. The timer runs off the last coin
           instead, so he always returns to his own shape — reaching MAX still
           lands "full. stop." the moment the tenth arrives. */
        clearTimeout(rearm); clearTimeout(idle);
        idle = setTimeout(function () {{ deflate(true); }}, 5200);
      }}

      replayable(stage, function () {{ deflate(true); }}, function () {{ return inFlight > fed; }});

      function fly(disc, done) {{
        if (reduce) {{ done(); return; }}
        var from = disc.getBoundingClientRect();
        var box = mascot.getBoundingClientRect();
        var tx = box.left + box.width / 2;
        var ty = box.top + box.height * 0.52;          /* his mouth */
        var dx = tx - (from.left + from.width / 2);
        var dy = ty - (from.top + from.height / 2);

        var outer = document.createElement("div");
        outer.className = pre + "flyer";
        outer.style.left = from.left + "px";
        outer.style.top = from.top + "px";
        outer.style.width = from.width + "px";
        outer.style.height = from.height + "px";
        outer.style.background = getComputedStyle(disc).backgroundColor;

        var inner = document.createElement("div");
        inner.style.width = "100%";
        inner.style.height = "100%";
        inner.style.display = "grid";
        inner.style.placeItems = "center";
        var glyph = disc.querySelector("svg");
        if (glyph) inner.appendChild(glyph.cloneNode(true));
        outer.appendChild(inner);
        document.body.appendChild(outer);

        var DUR = 620;
        var rise = Math.max(70, Math.abs(dy) * 0.42);

        /* Axes split on purpose: one shared curve on both is what makes an
           arc read as a tween instead of a throw. */
        outer.animate(
          [{{ transform: "translateX(0)" }}, {{ transform: "translateX(" + dx + "px)" }}],
          {{ duration: DUR, easing: "cubic-bezier(.36,.15,.62,.9)", fill: "forwards" }}
        );
        inner.animate([
          {{ transform: "translateY(0) rotate(0deg) scale(1)", offset: 0 }},
          {{ transform: "translateY(" + (dy - rise) + "px) rotate(210deg) scale(1.12)", offset: 0.42 }},
          {{ transform: "translateY(" + dy + "px) rotate(400deg) scale(0.14)", offset: 1 }}
        ], {{ duration: DUR, easing: "cubic-bezier(.3,.7,.5,1)", fill: "forwards" }});

        var fade = outer.animate([{{ opacity: 1 }}, {{ opacity: 0 }}], {{ duration: DUR }});
        fade.onfinish = function () {{ outer.remove(); done(); }};
      }}

      coins.forEach(function (btn) {{
        btn.addEventListener("click", function () {{
          if (inFlight >= MAX) return;
          var disc = btn.querySelector(".disc");
          if (!disc) return;
          inFlight += 1;
          var n = Math.min(MAX, inFlight);
          fly(disc, function () {{ land(n); }});
        }});
      }});
    }})();

    /* --- Wake: hit the alarm clock ------------------------------------
       hit() in WakeSection.tsx: stage 0..4, a 260ms squash on the clock, a
       160ms steps(2,end) shake on the room, and a line per stage. */
    (function wake() {{
      var hitArea = document.querySelector('main [class*="__clockHit"]');
      if (!hitArea) return;
      var st = hitArea.closest(".stage");
      var pre = prefixOf(hitArea);
      if (!st || !pre) return;

      /* STAGES in WakeSection: a line for him and a line for the status row at
         each of the five steps. Only his was being ported, so the row under the
         room read "still asleep" the whole way through — including once he was
         sitting up wide awake. */
      var SAY = ["five more minutes.", "no. go away.", "what time is it.",
                 "i have no money.", ""];
      var LINE = ["still asleep", "stirring", "one eye open",
                  "sitting up", "awake. dangerous."];
      var MAXW = 4, stage = 0, wt;
      var clock = st.querySelector('[class*="__clockBody"]');
      var room = st.querySelector('[class*="__roomSvg"]');
      var bub = st.querySelector('.bubble, [class*="__bub"]');
      var bubT;
      var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

      /* `ringing` (stage < MAX) and `dead` (stage >= MAX) are on the section
         alongside s0..s4, and neither was being managed — so the alarm went on
         ringing after he was up and the verdict never switched over. */
      var hitline = st.querySelector('[class*="__hitline"]');
      var hint = st.querySelector(".hint");

      function setStage(n) {{
        for (var i = 0; i <= MAXW; i++) st.classList.remove(pre + "s" + i);
        st.classList.add(pre + "s" + n);
        st.classList.toggle(pre + "ringing", n < MAXW);
        st.classList.toggle(pre + "dead", n >= MAXW);
        if (hitline) hitline.textContent = LINE[n];
        if (hint) hint.textContent = n >= MAXW ? "That is the whole reason." : " ";
        stage = n;
      }}

      /* Back to fast asleep with the alarm going, so the room is worth walking
         into a second time. */
      function rearmWake() {{
        clearTimeout(wt); clearTimeout(bubT);
        setStage(0);
        if (bub) bub.classList.remove("show");
      }}
      replayable(st, rearmWake);

      hitArea.style.cursor = "pointer";
      hitArea.addEventListener("click", function () {{
        if (stage >= MAXW) return;
        setStage(stage + 1);
        if (stage >= MAXW) {{
          clearTimeout(wt);
          wt = setTimeout(rearmWake, 5200);
        }}

        if (!reduce) {{
          if (clock) clock.animate([
            {{ transform: "translateY(0) scale(1)" }},
            {{ transform: "translateY(9px) scaleY(0.86) scaleX(1.1)" }},
            {{ transform: "translateY(0) scale(1)" }}
          ], {{ duration: 260, easing: "ease-out" }});
          if (room) room.animate([
            {{ transform: "translate(0,0)" }},
            {{ transform: "translate(-3px,2px)" }},
            {{ transform: "translate(3px,-1px)" }},
            {{ transform: "translate(0,0)" }}
          ], {{ duration: 160, easing: "steps(2, end)" }});
        }}

        /* An empty line is an instruction to shut the bubble, not to leave the
           last one up — at the final stage he has nothing left to say. */
        if (bub) {{
          if (!SAY[stage]) {{
            bub.classList.remove("show");
          }} else {{
            bub.textContent = SAY[stage];
            bub.classList.add("show");
            clearTimeout(bubT);
            bubT = setTimeout(function () {{ bub.classList.remove("show"); }}, 1900);
          }}
        }}
      }});
    }})();

    /* --- Story: flip the cards ----------------------------------------
       flipCard(): idle -> lifting (300ms) -> flipped; once all three are
       flipped, showPayoff after 700ms puts allDone on the section. */
    (function story() {{
      /* [class*="__card"] also caught cardFace/cardBack — nine elements
         instead of three. Match the token exactly. */
      var cards = [].filter.call(
        document.querySelectorAll('main [class*="StorySection-module__"]'),
        function (el) {{
          return [].some.call(el.classList, function (c) {{ return /__card$/.test(c); }});
        }}
      );
      if (!cards.length) return;
      var st = cards[0].closest(".stage");
      var pre = prefixOf(cards[0]);
      if (!st || !pre) return;
      var flipped = 0, sTimers = [];

      /* The deck turns itself face down again once the payoff has been read, so
         the three cards are not a one-shot. */
      function rearmStory() {{
        sTimers.forEach(clearTimeout); sTimers = [];
        st.classList.remove(pre + "allDone");
        cards.forEach(function (c) {{
          c.classList.remove(pre + "lift");
          c.classList.remove(pre + "flipped");
          delete c.dataset.done;
        }});
        flipped = 0;
      }}
      replayable(st, rearmStory, function () {{ return flipped > 0 && flipped < cards.length; }});

      cards.forEach(function (card) {{
        card.style.cursor = "pointer";
        card.addEventListener("click", function () {{
          if (card.dataset.done) return;
          card.dataset.done = "1";
          card.classList.add(pre + "lift");
          sTimers.push(setTimeout(function () {{
            card.classList.remove(pre + "lift");
            card.classList.add(pre + "flipped");
            flipped += 1;
            if (flipped === cards.length) {{
              sTimers.push(setTimeout(function () {{
                st.classList.add(pre + "allDone");
                sTimers.push(setTimeout(rearmStory, 5200));
              }}, 700));
            }}
          }}, 300));
        }});
      }});
    }})();

    /* --- Repay: drag the handle ---------------------------------------
       Ported from RepaySection.tsx rather than approximated. Everything the
       drag drives there is driven here: the four throw bolts pulling back a
       quarter each, the brass wheel turning two full revolutions off your
       thumb, the amount owed, the running hint, and — once you reach the far
       end — the door swinging away and the five memes climbing out on the
       component's own 820 + i*150 stagger.

       The earlier version only moved the fill and added `freed`. Since React
       writes the door's `scaleX(1)` and the wheel's angle as *inline*
       transforms, leaving them alone meant the safe stayed shut with the memes
       sealed behind it, which is what "does not work" looked like. */
    (function repay() {{
      var slider = document.querySelector('main [class*="__slider"]');
      if (!slider) return;
      var st = slider.closest(".stage");
      var pre = prefixOf(slider);
      if (!st || !pre) return;

      var fill = st.querySelector('[class*="__fill"]');
      var knob = st.querySelector('[class*="__knob"]');
      var svg = st.querySelector('[class*="__svg"]');
      var door = st.querySelector('[class*="__safeDoor"]');
      var wheel = st.querySelector('[class*="__rhandle"]');
      var owed = st.querySelector('[class*="__value"]');
      var hint = st.querySelector(".hint");
      var bubble = st.querySelector(".bubble");
      /* The bolts carry no class of their own — they are the four rects the
         component draws at x=72 and positions inline. */
      var bolts = svg ? svg.querySelectorAll('rect[x="72"]') : [];
      var memes = svg ? svg.querySelectorAll('[class*="__memeOut"]') : [];

      var TOTAL = 42000;
      var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
      var p = 0, dragging = false, done = false, stuck = false;
      var bubbleTimer, nopeTimer, rearmTimer, outTimers = [];

      function say(t) {{
        if (!bubble) return;
        bubble.textContent = t;
        bubble.classList.add("show");
        clearTimeout(bubbleTimer);
        bubbleTimer = setTimeout(function () {{ bubble.classList.remove("show"); }}, 2000);
      }}

      function travel() {{
        return Math.max(1, slider.clientWidth - (knob ? knob.offsetWidth : 0));
      }}

      function tell() {{
        if (!hint || stuck) return;
        var pct = Math.round(p * 100);
        hint.textContent =
          p === 0 ? "Drag the handle right to repay"
          : p < 0.35 ? pct + "% repaid — the lock is lifting"
          : p < 0.8 ? pct + "% repaid — keep going"
          : p < 1 ? pct + "% — almost off"
          : "Paid in full.";
      }}

      function paint() {{
        if (fill) fill.style.width = (p * 100).toFixed(2) + "%";
        /* Offset in px against the track's usable travel — a percentage would
           walk the 62px knob clean off the right-hand end. */
        if (knob) knob.style.left = (p * travel()).toFixed(1) + "px";
        if (owed) owed.textContent =
          Math.round(TOTAL * (1 - p)).toLocaleString("en-US");
        for (var i = 0; i < bolts.length; i++) {{
          var local = Math.max(0, Math.min(1, (p - i * 0.25) / 0.25));
          bolts[i].style.transform = "translateX(" + (local * 28).toFixed(1) + "px)";
        }}
        if (wheel) {{
          wheel.style.transform =
            "rotate(" + (-p * 720 + (done ? -120 : 0)).toFixed(1) + "deg)";
        }}
        tell();
      }}

      function free() {{
        done = true;
        st.classList.add(pre + "freed");
        if (wheel) wheel.classList.add(pre + "rhandleFreed");
        if (door) door.style.transform = "scaleX(0)";
        stuck = false;
        /* Repainted now that `done` is set, so the wheel takes its last 120°
           in the same frame the spring transition is added to it. */
        paint();
        if (hint) hint.textContent = "Unlocked. They are yours again.";
        say("we are square.");

        memes.forEach(function (m, i) {{
          if (reduce) {{ m.style.opacity = "0"; return; }}
          outTimers.push(setTimeout(function () {{
            m.animate([
              {{ transform: "translate(0,0) scale(1)", opacity: 1 }},
              {{ transform: "translate(70px,-30px) scale(1.1)", opacity: 1, offset: 0.4 }},
              {{ transform: "translate(150px,-210px) scale(0.55)", opacity: 0 }}
            ], {{ duration: 1200, easing: "cubic-bezier(.4,0,.6,1)", fill: "forwards" }});
          }}, 820 + i * 150));
        }});

        clearTimeout(rearmTimer);
        rearmTimer = setTimeout(rearm, 5200);
      }}

      /* The safe re-locks itself so the handle is back at zero for another go.
         Cancelling the meme animations is what actually rebuilds it — dropping
         the class alone would leave it standing open and empty. */
      function rearm() {{
        outTimers.forEach(clearTimeout);
        outTimers = [];
        clearTimeout(bubbleTimer);
        memes.forEach(function (m) {{
          m.getAnimations().forEach(function (a) {{ a.cancel(); }});
          m.style.opacity = "";
        }});
        if (bubble) bubble.classList.remove("show");
        st.classList.remove(pre + "freed");
        if (wheel) wheel.classList.remove(pre + "rhandleFreed");
        if (door) door.style.transform = "scaleX(1)";
        if (knob) knob.classList.remove(pre + "snap");
        done = false; stuck = false; p = 0;
        paint();
      }}

      function commit(v) {{
        p = Math.max(0, Math.min(1, v));
        paint();
        if (p >= 1 && !done) free();
      }}

      function at(clientX) {{
        var r = slider.getBoundingClientRect();
        var k = knob ? knob.offsetWidth : 0;
        return (clientX - r.left - k / 2) / travel();
      }}

      function release() {{
        if (!dragging) return;
        dragging = false;
        if (done) return;
        /* Short of the end: springs back, and he tells you so. */
        if (knob) knob.classList.add(pre + "snap");
        if (p > 0.06) {{
          say(p > 0.75 ? "so close." : "not enough.");
          if (svg) {{
            svg.classList.add(pre + "nope");
            clearTimeout(nopeTimer);
            nopeTimer = setTimeout(function () {{
              svg.classList.remove(pre + "nope");
            }}, 300);
          }}
          if (hint) hint.textContent = "All of it, or nothing comes out.";
          stuck = true;
        }}
        p = 0;
        paint();
      }}

      slider.style.cursor = "ew-resize";
      slider.style.touchAction = "none";
      slider.addEventListener("pointerdown", function (e) {{
        if (done) return;
        if (knob) knob.classList.remove(pre + "snap");
        dragging = true; stuck = false;
        slider.setPointerCapture(e.pointerId);
        commit(at(e.clientX));
      }});
      slider.addEventListener("pointermove", function (e) {{
        if (!dragging || done) return;
        commit(at(e.clientX));
      }});
      slider.addEventListener("pointerup", release);
      slider.addEventListener("pointercancel", release);
      addEventListener("resize", function () {{ if (!done) paint(); }});
      replayable(st, rearm, function () {{ return dragging; }});
      paint();
    }})();

    /* --- Treasury: measure the orbit ----------------------------------
       The three $CB coins run between the safe and the borrowers on a path
       expressed in `--ox` / `--oy`, and TreasurySection sets those from the
       real gap because it differs enormously between phone and desktop. With
       nobody measuring, the custom properties were absent, every translate()
       in @keyframes cbloop resolved to nothing, and the coins sat piled in the
       corner of the flow instead of circulating. */
    (function treasury() {{
      var flow = document.querySelector('main [class*="__tflow"]');
      if (!flow) return;
      var st = flow.closest(".stage");
      if (!st) return;
      var vault = flow.querySelector('[class*="__vault"]');
      var crowd = flow.querySelector('[class*="__crowd"]');
      var gcs = flow.querySelectorAll('[class*="__gc"]');
      if (!vault || !crowd || !gcs.length) return;

      function measure() {{
        var f = flow.getBoundingClientRect();
        var v = vault.getBoundingClientRect();
        var c = crowd.getBoundingClientRect();
        if (!f.width || !v.width) return;
        var vx = v.left - f.left + v.width * 0.5;
        var vy = v.top - f.top + v.height * 0.55;
        var cx = c.left - f.left + c.width * 0.5;
        var cy = c.top - f.top + c.height * 0.45;
        gcs.forEach(function (g) {{
          g.style.left = vx + "px";
          g.style.top = vy + "px";
        }});
        st.style.setProperty("--ox", (cx - vx) + "px");
        st.style.setProperty("--oy", (cy - vy) + "px");
      }}

      measure();
      var t;
      addEventListener("resize", function () {{
        clearTimeout(t);
        t = setTimeout(measure, 150);
      }});
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
      /* Re-measured on arrival too: the section is off-screen at load, and a
         scroll-snap panel's box is only final once it has been laid out. The
         orbit is also dropped on the way out and restarted on the way back in —
         the component does exactly this, so the coins are always partway round
         when you arrive rather than frozen where you left them. */
      var pre = prefixOf(st.querySelector('[class*="TreasurySection-module__"]') || st);
      if ("IntersectionObserver" in window) {{
        new IntersectionObserver(function (es) {{
          es.forEach(function (e) {{
            if (e.isIntersecting) {{ measure(); if (pre) st.classList.add(pre + "play"); }}
            else if (pre) st.classList.remove(pre + "play");
          }});
        }}, {{ threshold: 0.4 }}).observe(st);
      }}
    }})();

    /* --- Join: copy the address --------------------------------------- */
    (function join() {{
      var btn = document.querySelector('main [class*="JoinSection-module__"][class*="__copy"]');
      if (!btn) return;
      var st = btn.closest(".stage");
      var pre = prefixOf(btn);
      if (!st || !pre) return;
      var t;
      btn.addEventListener("click", function () {{
        st.classList.add(pre + "showCopied");
        clearTimeout(t);
        t = setTimeout(function () {{ st.classList.remove(pre + "showCopied"); }}, 1600);
      }});

      /* The hat tip, the sparks and the three buttons are CSS animations that
         fire on mount, so on every return he was frozen mid-welcome. The
         component replays them by remounting on a key; restarting the
         animations is the same thing without throwing the markup away. */
      var final = st.querySelector('[class*="__final"]');
      replayable(st, function () {{
        clearTimeout(t);
        st.classList.remove(pre + "showCopied");
        restartCss(final);
      }});
    }})();

    /* --- Vault: pull the lever ----------------------------------------
       A port of VaultSection.tsx's startSequence(), not a class toggle. The
       toggle version added `.pulled` and took it away 5.2s later, which ran
       the lever, the door and the padlock — but every part of the screen that
       React drives imperatively stayed put: the six memes never travelled
       down the funnel, so `insideIn` was never set and the chamber stayed
       empty, the chute never paid out, the counter never rolled and the three
       spend buttons never appeared. Same geometry constants, same timings,
       same keyframes as the component. */
    (function vault() {{
      var lever = document.querySelector('main [class*="__lever"]');
      if (!lever) return;
      var st = lever.closest(".stage");
      var pre = prefixOf(lever);
      if (!st || !pre) return;
      var svg = st.querySelector('[class*="__svg"]') || st.querySelector("svg");
      if (!svg) return;

      var SVGNS = "http://www.w3.org/2000/svg";
      var TOTAL = 42000;
      var FUNNEL_NECK_X = 330, FEED_COIN_R = 19;
      var FEED_AT = [
        {{ x: 171, y: 30 }}, {{ x: 213, y: 16 }}, {{ x: 255, y: 6 }},
        {{ x: 367, y: 6 }}, {{ x: 409, y: 16 }}, {{ x: 451, y: 30 }}
      ];
      var INSIDE_AT = [
        {{ x: 216, y: 234 }}, {{ x: 268, y: 224 }}, {{ x: 320, y: 234 }},
        {{ x: 216, y: 302 }}, {{ x: 268, y: 310 }}, {{ x: 320, y: 302 }}
      ];
      var SPEND_LINE = ["gone.", "worth it.", "again? fine."];

      var drops = svg.querySelectorAll('[class*="__drop"]');
      /* The .inside coins and the payout host are the two things the component
         reaches for by ref. `insideIn` shares the `inside` stem, so the resting
         coins are matched on the exact class token. */
      var insides = [].filter.call(svg.querySelectorAll('[class*="__inside"]'),
        function (e) {{
          return (e.getAttribute("class") || "").split(/\\s+/).some(function (c) {{
            return /__inside$/.test(c);
          }});
        }});
      /* payoutRef renders as a bare <g/> — the only empty, class-less group on
         the screen. */
      var host = [].filter.call(svg.querySelectorAll("g"), function (g) {{
        return !g.childNodes.length && !g.getAttribute("class");
      }})[0];
      var value = st.querySelector('[class*="__value"]');
      var hint = st.querySelector(".hint");
      var bubble = st.querySelector(".bubble");
      var spendWrap = st.querySelector('[class*="__spend"]');
      var spendBtns = st.querySelectorAll('[class*="__spendBtn"]');

      var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
      var timers = [], raf = null, busy = false, spent = false, landed = 0;

      function after(ms, fn) {{ timers.push(setTimeout(fn, reduce ? 0 : ms)); }}
      function clearTimers() {{
        timers.forEach(clearTimeout); timers = [];
        /* The counter runs on rAF, so clearing timeouts alone would let it
           drive a freshly-zeroed readout straight back up. */
        if (raf !== null) {{ cancelAnimationFrame(raf); raf = null; }}
      }}
      function say(t) {{
        if (!bubble) return;
        bubble.textContent = t;
        bubble.classList.add("show");
      }}
      function setValue(n) {{
        if (value) value.textContent = n.toLocaleString("en-US");
      }}
      function land(n) {{
        landed = Math.max(landed, n);
        for (var i = 0; i < insides.length; i++) {{
          insides[i].classList.toggle(pre + "insideIn", i < landed);
        }}
      }}

      function dropCoins() {{
        drops.forEach(function (el, i) {{
          after(195 + i * 100, function () {{
            if (reduce) {{ el.style.opacity = "0"; land(i + 1); return; }}
            /* The funnel mouth spans 212..448 but its neck is only 288..372,
               so a coin falling straight down passes through the sloped wall.
               Each slides along the wall to the neck, then on to the exact
               spot it will sit inside the safe. Offsets are relative, which
               works only because the parent group holds the position. */
            var sx = FEED_AT[i].x + FEED_COIN_R;
            var sy = FEED_AT[i].y + FEED_COIN_R;
            var nDx = FUNNEL_NECK_X - sx, nDy = 172 - sy;
            var rDx = INSIDE_AT[i].x - sx, rDy = INSIDE_AT[i].y - sy;
            var f = function (n) {{ return n.toFixed(1); }};
            var fall = el.animate([
              {{ transform: "translate(0,0) scale(1)" }},
              {{ transform: "translate(" + f(nDx * 0.55) + "px," + f(nDy * 0.42) + "px)", offset: 0.28 }},
              {{ transform: "translate(" + f(nDx) + "px," + f(nDy) + "px) scale(0.84)", offset: 0.5 }},
              {{ transform: "translate(" + f(rDx) + "px," + f(rDy - 30) + "px) scale(0.95)", offset: 0.8 }},
              {{ transform: "translate(" + f(rDx) + "px," + f(rDy) + "px) scaleY(0.8) scaleX(1.14)", offset: 0.9 }},
              {{ transform: "translate(" + f(rDx) + "px," + f(rDy) + "px) scale(1)" }}
            ], {{ duration: 700, easing: "cubic-bezier(.4,0,.55,1)", fill: "forwards" }});
            /* Hands off to the resting copy at the same coordinates, so the
               swap is invisible and the coin simply stays where it landed. */
            fall.onfinish = function () {{ el.style.opacity = "0"; land(i + 1); }};
          }});
        }});
      }}

      /* Gold spraying out of the chute and piling in two tiers on the floor. */
      function payOut() {{
        if (!host) return;
        for (var i = 0; i < 12; i++) {{
          (function (i) {{
            after(2800 + i * 72, function () {{
              var g = document.createElementNS(SVGNS, "g");
              var c = document.createElementNS(SVGNS, "circle");
              c.setAttribute("r", "17");
              /* Literal, not var(--gold): an attribute cannot resolve a custom
                 property. */
              c.setAttribute("fill", "#d9a020");
              c.setAttribute("stroke", "#12110c");
              c.setAttribute("stroke-width", "5");
              var t = document.createElementNS(SVGNS, "text");
              t.setAttribute("text-anchor", "middle");
              t.setAttribute("y", "4.5");
              t.setAttribute("font-size", "12");
              t.setAttribute("font-weight", "900");
              t.setAttribute("letter-spacing", "-0.4");
              t.setAttribute("fill", "#12110c");
              t.textContent = "$CB";
              g.appendChild(c); g.appendChild(t);

              var tier = i % 2, lane = Math.floor(i / 2) - 2.5;
              var lx = 330 + lane * 38 + tier * 19, ly = 528 - tier * 24;
              g.setAttribute("transform", "translate(330 400)");
              /* The payout animation is fill:forwards, so the attribute still
                 reads the chute position — spending needs the real resting
                 place to lift from. */
              g.dataset.lx = String(lx);
              g.dataset.ly = String(ly);
              host.appendChild(g);
              if (reduce) {{ g.setAttribute("transform", "translate(" + lx + " " + ly + ")"); return; }}
              g.animate([
                {{ transform: "translate(330px,400px) rotate(0deg)" }},
                {{ transform: "translate(" + (330 + lane * 14) + "px," + (ly - 90) + "px) rotate(" + lane * 60 + "deg)", offset: 0.45 }},
                {{ transform: "translate(" + lx + "px," + ly + "px) rotate(" + lane * 5 + "deg)" }}
              ], {{ duration: 910, easing: "cubic-bezier(.3,.7,.4,1)", fill: "forwards" }});
            }});
          }})(i);
        }}
      }}

      function rollCounter() {{
        if (reduce) {{ setValue(TOTAL); return; }}
        var start = performance.now();
        var step = function (now) {{
          var p = Math.min(1, (now - start) / 1430);
          setValue(Math.round(TOTAL * (1 - Math.pow(1 - p, 3))));
          raf = p < 1 ? requestAnimationFrame(step) : null;
        }};
        raf = requestAnimationFrame(step);
      }}

      function reset(silent) {{
        clearTimers();
        st.classList.remove(pre + "pulled", pre + "jolt", pre + "settled");
        if (spendWrap) spendWrap.classList.remove(pre + "spendShow");
        setValue(0);
        spent = false; landed = 0;
        insides.forEach(function (e) {{ e.classList.remove(pre + "insideIn"); }});
        if (host) host.innerHTML = "";
        if (bubble) bubble.classList.remove("show");
        /* Only the fall. getAnimations() also hands back the CSS bob, and
           cancelling a CSSAnimation through the API detaches it permanently. */
        drops.forEach(function (el) {{
          el.getAnimations().forEach(function (a) {{ a.cancel(); }});
          el.style.opacity = "";
        }});
        if (!silent) {{
          if (hint) hint.textContent = "";
          busy = false;
        }}
      }}

      function startSequence() {{
        dropCoins();
        /* The jolt lands with the padlock, not the door — that's the heavy beat. */
        after(2360, function () {{
          if (reduce) return;
          st.classList.add(pre + "jolt");
          after(416, function () {{ st.classList.remove(pre + "jolt"); }});
        }});
        payOut();
        after(2800, rollCounter);
        after(3600, function () {{ say("buy whatever you want."); }});
        after(4250, function () {{
          st.classList.add(pre + "settled");
          if (spendWrap) spendWrap.classList.add(pre + "spendShow");
          if (hint) hint.textContent = "Now go spend it.";
          busy = false;
        }});
      }}

      function pull() {{
        if (busy) return;
        busy = true;
        reset(true);
        if (hint) hint.textContent = "";
        /* Across two frames, not one: letting `.pulled` genuinely go off and
           back on is what restarts the door, the padlock and the chute. */
        requestAnimationFrame(function () {{
          st.classList.add(pre + "pulled");
          startSequence();
        }});
      }}

      function spendOn(i) {{
        if (!st.classList.contains(pre + "settled") || spent) return;
        var coins = host ? host.querySelectorAll("g") : [];
        if (!coins.length) return;
        spent = true;
        coins.forEach(function (g, k) {{
          after(k * 35, function () {{
            if (reduce) {{ g.remove(); return; }}
            /* Absolute viewBox coordinates: a relative rise converged every
               coin on the top-left corner. */
            var cx = Number(g.dataset.lx || 330), cy = Number(g.dataset.ly || 400);
            g.animate([
              {{ transform: "translate(" + cx + "px," + cy + "px)", opacity: 1 }},
              {{ transform: "translate(" + cx + "px," + (cy - 260) + "px) scale(0.2)", opacity: 0 }}
            ], {{ duration: 520, easing: "cubic-bezier(.5,0,.9,.4)", fill: "forwards" }})
              .onfinish = function () {{ g.remove(); }};
          }});
        }});
        after(600, function () {{
          say(SPEND_LINE[i]);
          if (hint) hint.textContent = i === 2 ? "And now you owe him." : "That was fast.";
          /* MORE MEMES is the joke and the hand-off into the next screen. */
          if (i === 2) after(1400, function () {{ reset(false); }});
          /* Once the gold is spent the screen has nothing left to offer, so it
             rebuilds itself — this is what covers LAMBO and PIZZA. */
          else after(4600, function () {{ reset(false); }});
        }});
      }}

      lever.style.cursor = "pointer";
      lever.addEventListener("click", pull);
      spendBtns.forEach(function (b, i) {{
        b.addEventListener("click", function () {{ spendOn(i); }});
      }});
      /* Rearm when the section scrolls away, so coming back gives a fresh
         machine. */
      if ("IntersectionObserver" in window) {{
        new IntersectionObserver(function (es) {{
          es.forEach(function (e) {{ if (!e.isIntersecting && !busy) reset(false); }});
        }}, {{ threshold: 0.35 }}).observe(st);
      }}
    }})();

    /* --- the playground moods --- */
    var MOODS = {{
      JUMP: {{ cls: "mJump", ms: 950 }},
      SPIN: {{ cls: "mSpin", ms: 1150 }},
      RAGE: {{ cls: "mRage", ms: 3040 }},
      INFLATE: {{ cls: "mFat", ms: 1600 }},
      SHY: {{ cls: "mShy", ms: 1900 }},
      NAP: {{ cls: "mSleep", ms: 3000 }}
    }};
    var pStage = null, pPre = null;
    var moodEls = document.querySelectorAll('main [class*="PlaygroundSection-module__"]');
    for (var i = 0; i < moodEls.length; i++) {{
      var pf = prefixOf(moodEls[i]);
      if (pf) {{ pPre = pf; pStage = moodEls[i].closest(".stage"); break; }}
    }}
    if (pStage && pPre) {{
      var busy = pPre + "busy";
      var all = Object.keys(MOODS).map(function (k) {{ return pPre + MOODS[k].cls; }});
      /* Moods clear themselves on a timer, so all leaving the screen has to do
         is cut a mood short rather than let it finish off-screen. */
      replayable(pStage, function () {{
        all.forEach(function (c) {{ pStage.classList.remove(c); }});
        pStage.classList.remove(busy);
      }});
      pStage.querySelectorAll("button").forEach(function (btn) {{
        var label = (btn.textContent || "").trim().toUpperCase();
        var mood = MOODS[label];
        if (!mood) return;
        btn.addEventListener("click", function () {{
          all.forEach(function (c) {{ pStage.classList.remove(c); }});
          /* Forced reflow, so clicking the same mood twice restarts the
             animation instead of doing nothing — the same reason the original
             has a comment about mJump straight back to mJump. */
          void pStage.offsetWidth;
          pStage.classList.add(pPre + mood.cls, busy);
          setTimeout(function () {{
            pStage.classList.remove(pPre + mood.cls, busy);
          }}, mood.ms);
        }});
      }});
    }}
    if ("IntersectionObserver" in window) {{
      REPLAY.forEach(function (r) {{
        new IntersectionObserver(function (es) {{
          es.forEach(function (e) {{
            if (!e.isIntersecting && !(r.busy && r.busy())) r.reset();
          }});
        }}, {{ threshold: 0.05 }}).observe(r.st);
      }});
    }}
  }})();

  /* Borrow $CB now scrolls to the protocol screen rather than leaving. */
  document.querySelectorAll("[data-toapp]").forEach(function (a) {{
    a.addEventListener("click", function (e) {{
      e.preventDefault();
      var p1 = document.getElementById("p1");
      if (p1) p1.scrollIntoView({{ behavior: "smooth" }});
    }});
  }});

  var more = document.querySelector("[data-more]");
  if (more) more.addEventListener("click", function () {{
    var first = document.querySelector("main .stage, main section");
    if (first) first.scrollIntoView({{ behavior: "smooth" }});
  }});

  /* The test panel belongs to page 1. Left visible it sits on top of all nine
     story screens, which is both ugly and misleading. */
  var p1 = document.getElementById("p1");
  var panel = document.getElementById("preview");
  var opener = document.getElementById("show-preview");
  if (p1 && panel && "IntersectionObserver" in window) {{
    new IntersectionObserver(function (e) {{
      var on = e[0].isIntersecting;
      panel.style.visibility = on ? "" : "hidden";
      if (opener) opener.style.visibility = on ? "" : "hidden";
    }}, {{ threshold: 0.4 }}).observe(p1);
  }}
}})();
</script>
"""

open("full.html", "w").write(html)
print("full.html", len(html) // 1024, "KB")
print("story markup", len(story) // 1024, "KB; site css", len(site_css) // 1024, "KB")
