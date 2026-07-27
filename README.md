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

The address lives in exactly one place: the repository variable **`SITE_DOMAIN`**
(Settings → Secrets and variables → Actions → Variables).

- **Unset** — the site publishes to `https://aibardefi.github.io/sbfinal`, and
  the build sets a base path to match.
- **Set to `sbmeme.xyz`** — the build drops the base path, writes a `CNAME` into
  the artifact and the site serves from the domain root.

That switch is the whole domain cutover. Nothing else changes, because a static
export bakes every asset URL at build time and so has to be told which of the two
it is being built for.

## Security posture

No network calls, no third-party scripts, no analytics, no cookies or storage,
and no wallet or signing code of any kind. The only external hosts referenced
anywhere in the built bundle are `x.com` and `t.me`, both plain links. A
Content-Security-Policy in `src/app/layout.tsx` keeps it that way.

The real risk to a site like this is not its code — it is the domain. Keep
registrar 2FA and the transfer lock on.
