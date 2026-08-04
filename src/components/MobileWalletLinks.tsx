"use client";

import { useEffect, useState } from "react";
import s from "./MobileWalletLinks.module.css";

/**
 * The phone path that does not depend on WalletConnect.
 *
 * On a phone with no extension the in-modal wallets all route through
 * WalletConnect, and when its relay handshake will not complete the tiles do not
 * respond. These are the wallets' OWN universal links instead: each opens this
 * page inside that wallet's built-in browser, where the injected provider exists
 * and the ordinary Connect flow just works — no relay, no QR, no timing window.
 *
 * Shown only on a mobile user-agent with no injected provider (a normal mobile
 * browser, not already inside a wallet app), and hidden once connected.
 */

type Link = { name: string; href: string };

function walletLinks(): Link[] {
  const { href, host, pathname, search, origin } = window.location;
  const hostPath = `${host}${pathname}${search}`;
  const full = encodeURIComponent(href);
  return [
    {
      name: "Phantom",
      href: `https://phantom.app/ul/browse/${full}?ref=${encodeURIComponent(origin)}`,
    },
    { name: "MetaMask", href: `https://metamask.app.link/dapp/${hostPath}` },
    { name: "Trust", href: `https://link.trustwallet.com/open_url?coin_id=60&url=${full}` },
    { name: "Coinbase", href: `https://go.cb-w.com/dapp?cb_url=${full}` },
  ];
}

export function MobileWalletLinks() {
  const [links, setLinks] = useState<Link[] | null>(null);

  useEffect(() => {
    const ua = navigator.userAgent || "";
    const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
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
