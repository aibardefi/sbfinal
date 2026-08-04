"use client";

import { useEffect, useState } from "react";
import s from "./MobileWalletLinks.module.css";

/**
 * True on a normal mobile browser with no injected wallet — the case where
 * RainbowKit's only option is WalletConnect, whose tiles do not respond when the
 * relay handshake will not complete. There, the deep-link buttons below replace
 * the Connect button entirely.
 */
export function useMobileNoInjected(): boolean {
  const [value, setValue] = useState(false);
  useEffect(() => {
    const ua = navigator.userAgent || "";
    const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
    const hasInjected =
      typeof (window as unknown as { ethereum?: unknown }).ethereum !== "undefined";
    setValue(isMobile && !hasInjected);
  }, []);
  return value;
}

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
    // Uniswap Wallet has no "open this URL in my browser" universal link the way
    // the others do, so this opens the app itself; from there the user reaches
    // the site through its in-app browser.
    { name: "Uniswap", href: "https://uniswap.org/app" },
  ];
}

/**
 * The phone connect UI. Each button is the wallet's OWN universal link, which
 * opens this page inside that wallet's built-in browser where the injected
 * provider exists and Connect just works — no WalletConnect relay, no QR, no
 * timing window. Rendered in place of the Connect button on a mobile browser.
 */
export function MobileWalletLinks() {
  const show = useMobileNoInjected();
  const [links, setLinks] = useState<Link[] | null>(null);

  useEffect(() => {
    if (show) setLinks(walletLinks());
  }, [show]);

  if (!show || !links) return null;

  return (
    <div className={s.wrap}>
      <p className={s.hint}>Tap your wallet — it opens the app to connect</p>
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
