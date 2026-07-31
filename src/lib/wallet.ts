"use client";

import { useCallback } from "react";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useAccount, useDisconnect, useSwitchChain, useWalletClient } from "wagmi";
import type { Address, WalletClient } from "viem";
import { robinhoodChain } from "./chain";

/**
 * The wallet, as the three facts the screen needs: is somebody connected, who,
 * and are they on the right chain.
 *
 * This used to be a hand-rolled EIP-1193 hook talking to `window.ethereum`. It is
 * now RainbowKit and wagmi underneath, and the shape it returns is deliberately
 * unchanged — `ProtocolSection` and `Positions` were written against this
 * interface and neither needed editing. A swap of connection library should not
 * reach the screens that only wanted to know whether they may sign.
 *
 * What the change buys is choice. wagmi's EIP-6963 discovery is on by default, so
 * every wallet extension the browser announces is offered rather than whichever
 * one happened to win the race for `window.ethereum` — which is the bug the old
 * hook could not fix: with two extensions installed it silently used one of them
 * and gave the visitor no say.
 *
 * Two behaviours from the old implementation are kept because wagmi provides
 * them rather than because they were rewritten: the account and chain are live
 * subscriptions, so switching account in the extension re-renders rather than
 * leaving somebody looking at another account's positions; and disconnect is
 * local, because EIP-1193 has no log-out and claiming otherwise is a lie the next
 * reload exposes.
 */

export type Wallet = {
  /** False only while wagmi is restoring a previous session, so the UI can avoid
      flashing "Connect" at somebody who is already connected. */
  ready: boolean;
  /**
   * Whether a wallet is available to connect.
   *
   * Always true now, and that is not a stub. RainbowKit owns this case: with no
   * extension installed its modal shows a "Get a wallet" flow, which is a better
   * answer than a disabled button reading "No wallet found". The field stays so
   * callers keep compiling and so the meaning — "is connecting worth offering" —
   * is still expressed somewhere.
   */
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

export function useWallet(): Wallet {
  const { address, chainId, status } = useAccount();
  const { openConnectModal, connectModalOpen } = useConnectModal();
  const { disconnect } = useDisconnect();
  const { switchChain, error: switchError } = useSwitchChain();
  const { data: walletClient } = useWalletClient();

  const connect = useCallback(() => openConnectModal?.(), [openConnectModal]);

  const switchNetwork = useCallback(
    () => switchChain({ chainId: robinhoodChain.id }),
    [switchChain]
  );

  return {
    // "reconnecting" is the one state that must not paint: it is wagmi reading a
    // stored connection back, and it resolves to connected often enough that
    // showing a Connect button first reads as having been logged out.
    ready: status !== "reconnecting",
    hasProvider: true,
    account: address,
    chainId,
    wrongNetwork: !!address && chainId !== undefined && chainId !== robinhoodChain.id,
    connecting: status === "connecting" || connectModalOpen,
    // 4001 and its wagmi equivalent are the visitor closing the prompt. That is
    // an answer, not a fault, and it does not get an error message.
    error:
      switchError && !/user rejected|denied/i.test(switchError.message)
        ? "Could not switch network."
        : undefined,
    connect,
    disconnect: () => disconnect(),
    switchNetwork,
    walletClient: walletClient as WalletClient | undefined,
  };
}
