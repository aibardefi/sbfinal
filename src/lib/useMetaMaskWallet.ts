"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { createWalletClient, custom, numberToHex, type Address, type WalletClient } from "viem";
import { robinhoodChain } from "./chain";
import { RPC_URL } from "./rpc";
import {
  asAddress,
  findMetaMask,
  getProviderSnapshot,
  getServerSnapshot,
  isUserRejection,
  metamaskAction,
  metamaskDeepLink,
  METAMASK_INSTALL_URL,
  subscribeToProviders,
} from "./metamask";
import type { Wallet } from "./wallet";

/**
 * The wallet, rebuilt on viem alone.
 *
 * This is what wagmi was doing for us, minus the 700 KB: hold the account and
 * chain, keep them in step with the provider's events, hand out a viem
 * `WalletClient` for the write paths, and know how to add a chain the wallet has
 * never heard of.
 *
 * Three things here are the difference between working and nearly working.
 *
 * **The silent restore is `eth_accounts`, never `eth_requestAccounts`.** The
 * first reports who is already connected; the second *prompts*. Using the
 * prompting one to restore a session opens MetaMask in the visitor's face on
 * every page load. `ready` stays false until that silent check resolves, which is
 * what stops the header flashing "Connect" at somebody who is already connected.
 *
 * **Chain 4663 is not in any wallet's list.** `wallet_switchEthereumChain` fails
 * with 4902 for a chain the wallet does not know, so the switch falls through to
 * `wallet_addEthereumChain` and then retries. Without that, "Switch to Robinhood
 * Chain" is a button that always errors — for every visitor, since nobody has
 * this chain preinstalled.
 *
 * **Rejections are not errors.** Closing MetaMask is a decision, not a failure,
 * so 4001 clears the pending state and says nothing. Surfacing "Error: user
 * rejected" is how a UI tells somebody off for changing their mind.
 */
export function useMetaMaskWallet(): Wallet {
  // Re-render when a wallet announces itself, so a button that was "Install"
  // becomes "Connect" the moment the extension finishes loading.
  useSyncExternalStore(subscribeToProviders, getProviderSnapshot, getServerSnapshot);

  const [account, setAccount] = useState<Address | undefined>();
  const [chainId, setChainId] = useState<number | undefined>();
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [restored, setRestored] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);

  /* The provider itself, read during render. Its identity is stable — a wallet
     re-announcing sends the same object — so it can be a dependency directly, and
     the store keeps it current without a ref written during render, which React
     forbids. */
  const provider = findMetaMask();
  const present = provider !== undefined;

  /* Derived, not stored. `ready` means "we are done finding out", and with no
     wallet on the device there is nothing to find out — so it is true at once.
     Computing it avoids setting state synchronously in the effect below, which
     costs a second render pass on the most common path of all: no extension. */
  const ready = !present || restored;

  /* ------------------------------------------------ restore, then stay in step */

  useEffect(() => {
    let cancelled = false;
    const p = findMetaMask();
    // Nothing to restore, and nothing to listen to. If a wallet appears later
    // this effect reruns, because `present` will have changed.
    if (!p) return;

    (async () => {
      try {
        const [accounts, hexChain] = await Promise.all([
          p.request({ method: "eth_accounts" }),
          p.request({ method: "eth_chainId" }),
        ]);
        if (cancelled) return;
        setAccount(asAddress((accounts as unknown[])?.[0]));
        setChainId(typeof hexChain === "string" ? Number.parseInt(hexChain, 16) : undefined);
      } catch {
        // A provider that will not answer a read is one we cannot use; leaving
        // the fields empty is the honest result.
      } finally {
        if (!cancelled) setRestored(true);
      }
    })();

    const onAccounts = (...args: never[]) => {
      const next = asAddress((args[0] as unknown[])?.[0]);
      setAccount(next);
      // MetaMask reports a disconnect as an empty accounts array, not an event.
      if (!next) setError(undefined);
    };
    const onChain = (...args: never[]) => {
      const hex = args[0] as unknown;
      setChainId(typeof hex === "string" ? Number.parseInt(hex, 16) : undefined);
    };

    p.on?.("accountsChanged", onAccounts);
    p.on?.("chainChanged", onChain);
    return () => {
      cancelled = true;
      p.removeListener?.("accountsChanged", onAccounts);
      p.removeListener?.("chainChanged", onChain);
    };
  }, [present]);

  /* ---------------------------------------------------------------- actions */

  const connectMetaMask = useCallback(async () => {
    const p = findMetaMask();

    // No provider here: hand off rather than fail. On a phone that means opening
    // this same page inside MetaMask's browser, where a provider exists.
    if (!p) {
      const action = metamaskAction(false);
      window.location.href =
        action === "openApp" ? metamaskDeepLink() : METAMASK_INSTALL_URL;
      return;
    }

    setConnecting(true);
    setError(undefined);
    try {
      const accounts = await p.request({ method: "eth_requestAccounts" });
      const next = asAddress((accounts as unknown[])?.[0]);
      setAccount(next);
      const hexChain = await p.request({ method: "eth_chainId" });
      setChainId(typeof hexChain === "string" ? Number.parseInt(hexChain, 16) : undefined);
      if (next) setPanelOpen(false);
    } catch (e) {
      if (!isUserRejection(e)) setError("Could not connect to MetaMask.");
    } finally {
      setConnecting(false);
    }
  }, []);

  const switchNetwork = useCallback(async () => {
    const p = findMetaMask();
    if (!p) return;
    const hexId = numberToHex(robinhoodChain.id);
    setError(undefined);
    try {
      await p.request({ method: "wallet_switchEthereumChain", params: [{ chainId: hexId }] });
    } catch (e) {
      const code = (e as { code?: number }).code;
      // 4902 is "unrecognized chain". Nobody has 4663 already, so this is the
      // normal path rather than the exception.
      const unknownChain =
        code === 4902 || /unrecognized|not been added|add.*chain/i.test(String((e as Error)?.message));
      if (!unknownChain) {
        if (!isUserRejection(e)) setError("Could not switch network.");
        return;
      }
      try {
        await p.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: hexId,
              chainName: robinhoodChain.name,
              nativeCurrency: robinhoodChain.nativeCurrency,
              rpcUrls: [RPC_URL],
              blockExplorerUrls: [robinhoodChain.blockExplorers.default.url],
            },
          ],
        });
      } catch (addError) {
        if (!isUserRejection(addError)) setError("Could not add Robinhood Chain.");
      }
    }
  }, []);

  /**
   * There is no way to make a wallet forget us — permission lives in the
   * extension. So this drops the session on our side and says as much in the UI
   * copy; `wallet_revokePermissions` is attempted first because MetaMask does
   * support it, and a wallet that honours it gives a true disconnect.
   */
  const disconnect = useCallback(() => {
    const p = findMetaMask();
    setAccount(undefined);
    setError(undefined);
    void p
      ?.request({ method: "wallet_revokePermissions", params: [{ eth_accounts: {} }] })
      .catch(() => {});
  }, []);

  /* ----------------------------------------------------------- viem client */

  /* Rebuilt only when the provider or the account actually changes. A wallet
     re-announcing itself hands back the same provider object, so this does not
     churn — which matters, because a new signer handed to `tx.ts` mid-transaction
     is a signature request against a client nobody is awaiting. */
  const walletClient = useMemo<WalletClient | undefined>(() => {
    if (!provider || !account) return undefined;
    return createWalletClient({ account, chain: robinhoodChain, transport: custom(provider) });
  }, [provider, account]);

  return useMemo<Wallet>(
    () => ({
      ready,
      hasProvider: true,
      account,
      chainId,
      wrongNetwork: !!account && chainId !== undefined && chainId !== robinhoodChain.id,
      connecting,
      error,
      connect: () => setPanelOpen(true),
      disconnect,
      switchNetwork: () => void switchNetwork(),
      walletClient,
      panelOpen,
      closeConnect: () => setPanelOpen(false),
      connectMetaMask: () => void connectMetaMask(),
      metamaskPresent: present,
    }),
    [
      ready,
      account,
      chainId,
      connecting,
      error,
      disconnect,
      switchNetwork,
      walletClient,
      panelOpen,
      connectMetaMask,
      present,
    ]
  );
}
