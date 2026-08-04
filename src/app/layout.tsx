import type { Metadata, Viewport } from "next";
import { Geist, Poppins } from "next/font/google";
import { RPC_ORIGIN } from "@/lib/rpc";
import { Providers } from "@/components/Providers";
import "./globals.css";

const sb = Geist({
  variable: "--font-sb",
  subsets: ["latin"],
});

/**
 * The borrow screen's face, and only that screen's.
 *
 * Through `next/font/google` rather than a data: URI or a CDN link, because the
 * CSP here is `font-src 'self'` with no `data:` — Next downloads the files at
 * build time and serves them from this origin, which is the only arrangement
 * that policy allows. A CDN link fails silently and falls back to Arial.
 *
 * Four weights, no italics: 400 for prose, 600 for figures, 700 for labels,
 * 800 for the headline.
 */
const app = Poppins({
  variable: "--font-app",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
  display: "swap",
});

/**
 * Where this copy of the site lives, absolutely.
 *
 * A crawler resolves og:image against nothing — it needs a full URL, so a
 * relative "/og.png" silently produces a link with no preview at all. Reading
 * from the environment means the same source yields the right absolute URL
 * whether the site is serving from its project-page path or from its own
 * domain, and the fallback is the real address so a plain `npm run build`
 * still emits something valid.
 */
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  "https://cykablyat.vip";

// The browser-tab title, and the only place the name lives now. It is
// deliberately just "$CB": a link preview draws its bold line from og:title,
// falling back to this <title>, so keeping the full "Capybara CykaBlyat" here
// would put that bold line back on the card the moment a scraper ignored the
// empty og:title. The card art already says everything the title used to.
const TITLE = "$CB";
const DESCRIPTION =
  "Lock Memes. Borrow the CB, buy more memes or do whatever - a lending protocol run on Robinhood.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    type: "website",
    // No `siteName`. Next forces og:title to fall back to the "$CB" <title>
    // (an empty og:title is dropped, not emitted), so a site_name of "$CB" on
    // top of that title-"$CB" is the very double line this change removes. One
    // "$CB" above the art is enough; the art carries the rest.
    locale: "en_US",
    url: SITE_URL,
    description: DESCRIPTION,
    images: [
      {
        // Width and height are declared so the crawler can reserve the right
        // shape before the image arrives, which is what stops the card
        // collapsing to a small square in some clients.
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "Capybara CykaBlyat in his 'cyka blyat' ushanka, beside the words: $CB, lock memes, borrow the meme.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    // Attributes the share card to the account, so a link posted by anyone
    // carries "@cykablyatvip" under it rather than a bare domain.
    site: "@cykablyatvip",
    creator: "@cykablyatvip",
    description: DESCRIPTION,
    images: ["/og.png"],
  },
};

/**
 * What this page is allowed to load, and from where.
 *
 * The site already talks to nobody — no fetch, no analytics, no third-party
 * script — so this policy is not fixing a hole. It is what keeps that true: if
 * anything ever manages to inject a script tag pointing off-site, the browser
 * refuses to run it. That matters more here than on an ordinary page, because
 * the thing people impersonate about a memecoin site is exactly a script that
 * asks for a wallet.
 *
 * 'unsafe-inline' is unavoidable in both directions: Next emits an inline
 * bootstrap script to hydrate, and the artwork sets inline style attributes on
 * hundreds of SVG nodes. Everything else is locked to same-origin.
 *
 * frame-ancestors is deliberately absent — browsers ignore it in a meta tag, so
 * claiming it here would be theatre. It has to be a real response header, which
 * is the one thing GitHub Pages cannot send; put it in front (Cloudflare) if
 * clickjacking protection is wanted.
 */
// WalletConnect reaches a spread of its OWN subdomains to complete a
// connection, and the set differs by device: the relay websocket, the wallet
// registry, the config and analytics APIs, the Verify attestation host, and — on
// a phone — secure-mobile.walletconnect.org. Naming them one by one is how this
// broke: a strict list that missed the mobile host left "tap MetaMask" doing
// nothing, because the pairing could not finish. So connect-src trusts
// WalletConnect's and WalletConnect's web3modal registrable domains by wildcard,
// the way production dapps do. This is scoped to their domains only — not a
// blanket `*`, which check:csp still refuses.
const WALLETCONNECT_CONNECT_SRC =
  "wss://*.walletconnect.org wss://*.walletconnect.com " +
  "https://*.walletconnect.org https://*.walletconnect.com https://*.web3modal.org";

// WalletConnect's Verify API runs in a hidden iframe (verify.walletconnect.org,
// which itself frames secure.walletconnect.org) to attest the dapp's origin
// during pairing. With only `default-src 'self'` that iframe is blocked, and on
// mobile that alone is enough to leave the tap dead. Same scoped wildcard.
const WALLETCONNECT_FRAME_SRC =
  "https://*.walletconnect.org https://*.walletconnect.com";

const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  // WalletConnect's wallet picker (Reown AppKit) styles itself with Inter loaded
  // from Google Fonts, so its stylesheet host is named here and its font files in
  // font-src. Without them the picker renders as blank grey tiles.
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  // The wallet logos in that picker come from api.web3modal.org (and the
  // walletconnect image hosts); the rest of the page's images are still 'self'
  // and data:. Blank tiles that do not respond to a tap are these being blocked.
  "img-src 'self' data: https://*.walletconnect.com https://*.web3modal.org https://imagedelivery.net",
  "font-src 'self' https://fonts.gstatic.com",
  // The borrow screen reads the lending contract over JSON-RPC, so this is no
  // longer 'self' alone. It is named origins, never a wildcard and never a
  // widened default-src, which would look like a one-word change and remove the
  // protection entirely.
  //
  // An injected wallet needs nothing here — its signing traffic is the
  // extension's, not the page's. WalletConnect is the exception: pairing runs
  // over its relay websocket, so the relay and the wallet-registry origins are
  // named. They are only dialled once a WalletConnect session opens; an injected
  // connection never touches them.
  `connect-src 'self' ${RPC_ORIGIN} ${WALLETCONNECT_CONNECT_SRC}`,
  // Only WalletConnect's Verify iframe is allowed to frame; nothing else, and no
  // wildcard. Without this the default-src 'self' below would block it.
  `frame-src 'self' ${WALLETCONNECT_FRAME_SRC}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join("; ");

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Fill the whole screen and expose safe-area insets so fixed chrome can
  // clear the notch / Dynamic Island on modern phones.
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${sb.variable} ${app.variable}`}>
      <head>
        <meta httpEquiv="Content-Security-Policy" content={CSP} />
        {/* No referrer leaves this site: the outbound links go to X and
            Telegram, and neither needs to know which page sent the visitor. */}
        <meta name="referrer" content="no-referrer" />
      </head>
      {/* Ground and colour come from globals.css, which owns the shared
          palette; the old Tailwind colour classes no longer resolve. */}
      <body>
        {/* wagmi + RainbowKit, around everything rather than around the borrow
            screen: the connection lives in context and the wallet dialog portals
            to the body, so a provider nested inside one of nine scroll-snap
            sections would put that dialog inside a snap target. */}
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
