# $CB — Capybara Blyatovich

A borrow screen, then eight screens of story. One tired capybara who runs a
lending desk: you lock memes with him, he lends you the meme, you pay him back
and he lets them out again.

Working notes for agents and anyone new to the repo are in `CLAUDE.md` —
including the checks that have caught real bugs here.

The eight story screens are a toy, deliberately — no figures, no risk copy, no
numbers to get wrong.

The first screen is not. It states the 80% limit, the 90% liquidation threshold
and that liquidation takes everything, because those are the terms and a page
that shows a borrow form without them is worse than one that shows nothing. It
carries no wallet code at all: `LIVE` is `false` in `ProtocolSection.tsx` and the
CSP's `connect-src 'self'` means nothing on the page can reach a chain even if it
tried. `/design/` explains what arming it would take.

## Running it

```bash
npm install
npm run dev
```

## How it deploys

Pushing to `main` builds a static export and publishes it to GitHub Pages.

**https://cykablyat.vip is served by Cloudflare Pages**, built from this repo.
The GitHub Pages workflow still runs and publishes to the project page path as a
fallback, but it no longer claims the domain — `DOMAIN` at the top of
`.github/workflows/deploy.yml` is empty, and whatever it holds is what GitHub
believes its custom domain to be. Set the repository variable `SITE_DOMAIN` to
hand the domain back to GitHub.

Whichever it resolves to, the build branches on it: with a domain it drops the
base path, uses absolute URLs and writes a `CNAME` into the artifact; without
one it sets a base path of `/sbfinal`. That branch is necessary rather than
tidy — a static export bakes every asset URL at build time, so it has to be told
which of the two it is being built for.

`CNAME` is written by the workflow, not committed. With Actions-based deployment
GitHub reads the custom domain out of the artifact, so a build that omits the
file silently unsets the domain.

## Security posture

No network calls, no third-party scripts, no analytics, no cookies or storage,
and no wallet or signing code of any kind. The only external hosts referenced
anywhere in the built bundle are `x.com`, `t.me` and `app.cykablyat.vip`, all
plain links. A Content-Security-Policy in `src/app/layout.tsx` keeps it that way.

The real risk to a site like this is not its code — it is the domain. Keep
registrar 2FA and the transfer lock on.

## Cloudflare Pages — how it was set up

Done; recorded because the dashboard part is manual and would otherwise have to
be rediscovered.

Workers & Pages -> Create -> Pages -> Connect to Git -> `aibardefi/sbfinal`, then:

| Field | Value |
| --- | --- |
| Framework preset | Next.js (Static HTML Export) |
| Build command | `npm run build` |
| Build output directory | `out` |

`public/_headers` is then read at deploy time and becomes real response headers —
including `frame-ancestors`, which a `<meta>` CSP cannot carry and which is the
one that stops a signing UI being framed. GitHub Pages ignores the file.

Once Cloudflare serves the domain, stop this workflow claiming it: set the
repository variable `SITE_DOMAIN` to an empty value so GitHub Pages publishes at
the project page path instead, or disable the workflow.
