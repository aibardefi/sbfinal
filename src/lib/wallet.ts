"use client";

import { createContext, useContext } from "react";
import type { Address, WalletClient } from "viem";
import type { ConnectorId } from "./connectors";

/**
 * The wallet, as the three facts the screen needs: is somebody connected, who,
 * and are they on the right chain.
 *
 * The first seven fields are unchanged from when this was a wagmi hook and from
 * when there was no wallet at all — screens were written against them and have
 * never needed editing. What changes is what fills them. Today that is
 * `useWalletConnection`, built on viem and EIP-1193 directly; wagmi, RainbowKit
 * and the WalletConnect relay are gone from the bundle.
 *
 * The last block exists because the connect panel is a real thing that opens
 * rather than a modal a library owned. Opening it and connecting are two separate
 * actions on purpose: every Connect button on the site calls `connect()`, which
 * only opens the panel, and only the panel calls `connectWith(id)`. That is what
 * let a second wallet be added by adding a row to `CONNECTORS`, without hunting
 * down every button that used to mean "connect the one wallet we support".
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
  /** Every wallet the site supports, in display order, each with whether it was
      actually found on this device. The panel renders this list rather than
      knowing any wallet by name — adding a third means adding it to
      `CONNECTORS`, not editing the panel. */
  connectors: ConnectorView[];
  /** Prompts that wallet. If it is not on the device this hands off instead: the
      wallet's universal link on a phone, its download page on a desktop. */
  connectWith: (id: ConnectorId) => void;
  /** Which wallet the current session belongs to. Everything after connecting —
      the chain switch, the signer, the disconnect — must go to this one, or a
      visitor connected with Phantom gets a MetaMask popup. */
  activeId?: ConnectorId;
};

export type ConnectorView = {
  id: ConnectorId;
  name: string;
  /** Found on this device: an extension that announced itself, or the injected
      provider inside that wallet's own in-app browser. */
  present: boolean;
  connecting: boolean;
};

export const WalletContext = createContext<Wallet | null>(null);

export function useWallet(): Wallet {
  const wallet = useContext(WalletContext);
  if (!wallet)
    throw new Error("useWallet must be used within <Providers> (WalletContext).");
  return wallet;
}
