"use client";

import { createContext, useContext } from "react";
import type { Address, WalletClient } from "viem";

/**
 * The wallet, as the three facts the screen needs: is somebody connected, who,
 * and are they on the right chain.
 *
 * The shape is deliberately unchanged from when this was a wagmi hook, and again
 * from when there was a wallet at all — screens were written against it and none
 * needed editing either time. What changed is what fills it. There is no longer
 * any connector behind this: `Providers` supplies one frozen, disconnected
 * `Wallet` and that is the only value this context ever holds. wagmi, RainbowKit
 * and the WalletConnect relay are gone from the bundle entirely.
 *
 * The type keeps its full shape rather than being cut down to the two fields
 * still read. Everything that signs — `tx.ts`, the borrow and repay handlers —
 * is dormant behind `LIVE` in `ProtocolSection.tsx`, not deleted, and it is
 * typed against this. Narrowing the type would be the one edit that makes
 * turning the product back on a rewrite instead of a flag.
 */

export type Wallet = {
  /** False only while a previous session is being restored, so the UI can avoid
      flashing "Connect" at somebody who is already connected. Now always true:
      there is no session to restore. */
  ready: boolean;
  /** Whether connecting is worth offering. Now always false — there is no
      connector, so the two Connect buttons hide rather than render dead. */
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
