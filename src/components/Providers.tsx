"use client";

import { WalletContext, type Wallet } from "@/lib/wallet";

/**
 * Supplies the wallet context, which now holds one permanent answer: nobody is
 * connected, and nothing here can connect them.
 *
 * There used to be a lazily-loaded `WalletRuntime` behind this — wagmi,
 * RainbowKit, WalletConnect and a set of phone deep-links, ~700 KB of it. All of
 * that is gone. What is deliberately NOT gone is the context itself: every
 * screen reads the wallet through `useWallet`, and keeping the provider means
 * none of them had to be edited to remove a feature they only ever consumed.
 *
 * `DISCONNECTED` is a module constant rather than state because it can no longer
 * change. `ready: true` so no screen waits for a restore that will never happen;
 * `hasProvider: false` so the places that offer a Connect button hide it instead
 * of rendering one that does nothing.
 *
 * Reads are untouched by any of this. The borrow screen's figures come off chain
 * through `publicClient` in `chain.ts`, over our own RPC, and never needed a
 * wallet — which is why that screen still shows a real collateral roster, real
 * inventory and real prices with this in place.
 */
const DISCONNECTED: Wallet = {
  ready: true,
  hasProvider: false,
  wrongNetwork: false,
  connecting: false,
  connect: () => {},
  disconnect: () => {},
  switchNetwork: () => {},
};

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WalletContext.Provider value={DISCONNECTED}>{children}</WalletContext.Provider>
  );
}
