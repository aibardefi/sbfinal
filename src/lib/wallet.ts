"use client";

import { createContext, useContext } from "react";
import type { Address, WalletClient } from "viem";

/**
 * The wallet, as the three facts the screen needs: is somebody connected, who,
 * and are they on the right chain.
 *
 * The shape is deliberately unchanged from when this was a wagmi hook — screens
 * were written against it and none needed editing. What changed is where it comes
 * from. wagmi and RainbowKit are ~700 KB of JavaScript, and having them in the
 * first load is what made the page slow to wake up and left WalletConnect's
 * handshake fighting a blocked main thread on a phone. So the whole wallet
 * runtime is now a lazily-loaded chunk (`WalletRuntime`), it publishes this Wallet
 * into a context, and this file — which every screen imports — carries none of
 * that weight. `useWallet` just reads the context.
 *
 * Before the runtime has loaded, `Providers` supplies a stub whose `connect()`
 * pulls the runtime in on demand, so the Connect button works from the first
 * paint even though the code behind it arrives a moment later.
 */

export type Wallet = {
  /** False only while wagmi is restoring a previous session, so the UI can avoid
      flashing "Connect" at somebody who is already connected. */
  ready: boolean;
  /** Whether connecting is worth offering. Always true — RainbowKit owns the
      no-wallet case with its own "Get a wallet" flow. */
  hasProvider: boolean;
  account?: Address;
  chainId?: number;
  wrongNetwork: boolean;
  connecting: boolean;
  error?: string;
  connect: () => void;
  disconnect: () => void;
  switchNetwork: () => void;
  /** A signer bound to the connected account, or undefined when there is none. */
  walletClient?: WalletClient;
};

export const WalletContext = createContext<Wallet | null>(null);

export function useWallet(): Wallet {
  const wallet = useContext(WalletContext);
  if (!wallet)
    throw new Error("useWallet must be used within <Providers> (WalletContext).");
  return wallet;
}
