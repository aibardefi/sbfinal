"use client";

import { useEffect, useState } from "react";
import s from "./MobileWalletLinks.module.css";

/**
 * The no-WalletConnect answer to "connect from a phone".
 *
 * The RainbowKit modal covers two of the three cases already: a desktop
 * extension, and a phone that is *already inside* a wallet's in-app browser
 * (both are an injected EIP-1193 provider). The third — a phone in Safari or
 * Chrome with the wallet only installed as an app — is the one that normally
 * needs WalletConnect, and WalletConnect needs a project id this site does not
 * carry.
 *
 * These are the wallets' OWN universal links, not a WalletConnect pairing. Each
 * one tells the wallet app to open this exact page inside its built-in browser,
 * where the injected provider then exists and the ordinary Connect flow works.
 * No relay, no project id, no third-party account — just a link.
 *
 * It renders only where it helps: a mobile user-agent with no injected provider
 * yet. On a desktop, or once the page is already running inside a wallet browser
 * (where `window.ethereum` is present), it renders nothing and stays out of the
 * way of the normal Connect button.
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
    const hasInjected = typeof (window as unknown as { ethereum?: unknown }).ethereum !== "undefined";
    if (isMobile && !hasInjected) setLinks(walletLinks());
  }, []);

  if (!links) return null;

  return (
    <div className={s.wrap}>
      <p className={s.hint}>On your phone? Open this page in your wallet app:</p>
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
