import type { Metadata, Viewport } from "next";
import { Geist, Poppins } from "next/font/google";
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

const TITLE = "$CB — Capybara Blyatovich";
const DESCRIPTION =
  "Lock memes. Borrow the meme. A lending protocol run by one tired capybara.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    type: "website",
    siteName: "$CB",
    locale: "en_US",
    url: SITE_URL,
    title: TITLE,
    description: DESCRIPTION,
    images: [
      {
        // Width and height are declared so the crawler can reserve the right
        // shape before the image arrives, which is what stops the card
        // collapsing to a small square in some clients.
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "Capybara Blyatovich in his 'cyka blyat' ushanka, beside the words: lock memes, borrow the meme.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    // Attributes the share card to the account, so a link posted by anyone
    // carries "@cykablyatvip" under it rather than a bare domain.
    site: "@cykablyatvip",
    creator: "@cykablyatvip",
    title: TITLE,
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
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
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
        {children}
      </body>
    </html>
  );
}
