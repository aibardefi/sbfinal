# $SB — Capybara Blyatovich

Seven screens. One tired capybara who runs a lending desk: you lock memes with
him, he lends you the meme, you pay him back and he lets them out again.

A toy, deliberately. There is no LTV, no interest rate and no risk copy anywhere
on it, because there is no protocol behind it to describe yet.

## Running it

```bash
npm install
npm run dev
```

## How it deploys

Pushing to `main` builds a static export and publishes it to GitHub Pages.

The site lives at **https://cykablyat.vip**, set in one place: `DOMAIN` at the
top of `.github/workflows/deploy.yml`. The repository variable `SITE_DOMAIN`
overrides it (Settings → Secrets and variables → Actions → Variables), so moving
to another address is a settings change rather than a commit; setting it empty
publishes at the project page path instead.

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
anywhere in the built bundle are `x.com` and `t.me`, both plain links. A
Content-Security-Policy in `src/app/layout.tsx` keeps it that way.

The real risk to a site like this is not its code — it is the domain. Keep
registrar 2FA and the transfer lock on.

## Moving to Cloudflare Pages

The repo is ready for it; the dashboard part is manual.

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
