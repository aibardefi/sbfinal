"use client";

import { useEffect, useState } from "react";
import s from "./MobileWalletLinks.module.css";

/**
 * The reliable phone path, for when WalletConnect will not.
 *
 * On a phone in Safari or Chrome, the RainbowKit modal's answer is WalletConnect:
 * tap a wallet, it dials the relay, generates a pairing URI and tries to deep-
 * link the app inside the tap. When the relay is slow or the URI is not ready in
 * the gesture window, the browser silently drops the app-open and the button
 * reads as dead — which is exactly what users hit.
 *
 * These are the wallets' OWN universal links, not a WalletConnect session. Each
 * one opens this page inside the wallet app's built-in browser, where an injected
 * provider exists and the ordinary Connect flow just works. No relay, no timing
 * window, no project id — a plain link that always opens.
 *
 * Renders only where it helps: a mobile user-agent with no injected provider yet.
 * On desktop, or once the page is already running inside a wallet browser
 * (`window.ethereum` present), it renders nothing.
 */

type Link = { name: string; href: string };

function walletLinks(): Link[] {
  const { href, host, pathname, search, origin } = window.location;
  // MetaMask wants host+path with no scheme; the others want the whole URL,
  // encoded, as a query parameter.
  const hostPath = `${host}${pathname}${search}`;
  const full = encodeURIComponent(href);
  return [
    { name: "MetaMask", href: `https://metamask.app.link/dapp/${hostPath}` },
    { name: "Trust", href: `https://link.trustwallet.com/open_url?coin_id=60&url=${full}` },
    { name: "Coinbase", href: `https://go.cb-w.com/dapp?cb_url=${full}` },
    {
      name: "Phantom",
      href: `https://phantom.app/ul/browse/${full}?ref=${encodeURIComponent(origin)}`,
    },
  ];
}

export function MobileWalletLinks() {
  const [links, setLinks] = useState<Link[] | null>(null);

  useEffect(() => {
    const ua = navigator.userAgent || "";
    const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
    // An injected provider means either a wallet's in-app browser or a mobile
    // extension — the normal Connect flow already reaches it, so these links
    // would only bounce the visitor out of the page and back.
    const hasInjected =
      typeof (window as unknown as { ethereum?: unknown }).ethereum !== "undefined";
    if (isMobile && !hasInjected) setLinks(walletLinks());
  }, []);

  if (!links) return null;

  return (
    <div className={s.wrap}>
      <p className={s.hint}>On a phone? Open this page in your wallet app:</p>
      <div className={s.row}>
        {links.map((w) => (
          <a key={w.name} className={s.link} href={w.href} rel="noopener noreferrer">
            {w.name}
          </a>
        ))}
      </div>
    </div>
  );
}
