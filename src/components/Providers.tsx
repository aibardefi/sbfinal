"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { WalletContext, type Wallet } from "@/lib/wallet";

/**
 * Loads the wallet runtime lazily, and gives the whole page a working wallet
 * context in the meantime.
 *
 * The old Providers imported wagmi, RainbowKit and TanStack Query at the top, so
 * ~700 KB of wallet code sat in the first load and had to parse before anything
 * responded — the site's "slow to wake, wallet won't connect on a phone" was
 * mostly this. Now the heavy part is `WalletRuntime`, pulled in with `dynamic(…,
 * { ssr: false })` so it is a separate chunk. It is fetched during the browser's
 * first idle moment (proactively, so it is ready before anyone reaches the
 * Connect button), not on the critical path.
 *
 * Until it arrives, `WalletContext` holds a stub: not connected, and a
 * `connect()` that pulls the runtime in and asks it to open the modal as soon as
 * it can. So the Connect button works from first paint even though its code lands
 * a moment later.
 */
const WalletRuntime = dynamic(
  () => import("./WalletRuntime").then((m) => m.WalletRuntime),
  { ssr: false }
);

export function Providers({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const [live, setLive] = useState<Wallet | null>(null);
  const requestOpen = useRef(false);

  // Pull the wallet chunk in as soon as the browser is idle after first paint —
  // early enough to be ready when needed, late enough not to block the paint.
  //
  // Except on a phone with no wallet extension: there the connect UI is the
  // deep-link buttons, which are plain links and need none of wagmi/RainbowKit.
  // Loading ~700 KB of it there only janks the scroll for no benefit — the actual
  // connection happens later, inside the wallet app's own browser, on a fresh
  // page load where the injected provider is present and this does run. So that
  // one case never mounts the runtime at all.
  useEffect(() => {
    const ua = navigator.userAgent || "";
    const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
    const hasInjected =
      typeof (window as unknown as { ethereum?: unknown }).ethereum !== "undefined";
    if (isMobile && !hasInjected) return;

    const w = window as Window &
      typeof globalThis & {
        requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
        cancelIdleCallback?: (id: number) => void;
      };
    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(() => setMounted(true), { timeout: 2500 });
      return () => w.cancelIdleCallback?.(id);
    }
    const id = window.setTimeout(() => setMounted(true), 200);
    return () => window.clearTimeout(id);
  }, []);

  const stub = useMemo<Wallet>(
    () => ({
      // ready:true so the Connect button paints immediately for the common case
      // (a first-time visitor). A returning visitor with a stored session sees
      // Connect for the moment before the runtime reconnects — the small price
      // for not shipping the wallet stack on the critical path.
      ready: true,
      hasProvider: true,
      wrongNetwork: false,
      connecting: false,
      connect: () => {
        requestOpen.current = true;
        setMounted(true);
      },
      disconnect: () => {},
      switchNetwork: () => {},
    }),
    []
  );

  return (
    <WalletContext.Provider value={live ?? stub}>
      {mounted ? (
        <WalletRuntime onWallet={setLive} requestOpen={requestOpen} />
      ) : null}
      {children}
    </WalletContext.Provider>
  );
}
