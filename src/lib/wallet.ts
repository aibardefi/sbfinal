"use client";

import { createContext, useContext } from "react";
import type { Address, WalletClient } from "viem";

/**
 * The wallet, as the three facts the screen needs: is somebody connected, who,
 * and are they on the right chain.
 *
 * The first seven fields are unchanged from when this was a wagmi hook and from
 * when there was no wallet at all — screens were written against them and have
 * never needed editing. What changes is what fills them. Today that is
 * `useMetaMaskWallet`, built on viem and EIP-1193 directly; wagmi, RainbowKit and
 * the WalletConnect relay are gone from the bundle.
 *
 * The last block is new, and exists because the connect panel is now a real
 * thing that opens rather than a modal a library owned. Opening it and connecting
 * are two separate actions on purpose: every Connect button on the site calls
 * `connect()`, which only opens the panel, and only the panel itself calls
 * `connectMetaMask()`. That is what lets a second wallet be added later by adding
 * one row to the panel, without hunting down every button that used to mean
 * "connect the one wallet we support".
 */

export type Wallet = {
  /** False only while a previous session is being restored, so the UI can avoid
      flashing "Connect" at somebody who is already connected. */
  ready: boolean;
  /** Whether connecting is worth offering at all. */
  hasProvider: boolean;
  account?: Address;
  chainId?: number;
  wrongNetwork: boolean;
  connecting: boolean;
  error?: string;
  /** Opens the connect panel. Does NOT connect — see the note above. */
  connect: () => void;
  disconnect: () => void;
  switchNetwork: () => void;
  /** A signer bound to the connected account, or undefined when there is none. */
  walletClient?: WalletClient;

  /** Whether the connect panel is showing. Held here rather than in the screen so
      any Connect button anywhere opens the same one. */
  panelOpen: boolean;
  closeConnect: () => void;
  /** Prompts MetaMask. With no MetaMask on the device this hands off instead:
      the app's universal link on a phone, the download page on a desktop. */
  connectMetaMask: () => void;
  /** Whether a MetaMask provider was found, so the panel can say "Connect"
      rather than "Install" without repeating the detection. */
  metamaskPresent: boolean;
};

export const WalletContext = createContext<Wallet | null>(null);

export function useWallet(): Wallet {
  const wallet = useContext(WalletContext);
  if (!wallet)
    throw new Error("useWallet must be used within <Providers> (WalletContext).");
  return wallet;
}
