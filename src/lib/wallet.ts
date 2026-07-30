"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { createWalletClient, custom, type Address, type WalletClient } from "viem";
import { robinhoodChain } from "./chain";

/**
 * The injected wallet, as the three facts the screen needs: is there one, who
 * is signed in, and are they on the right chain.
 *
 * Deliberately no connector library. The write surface here is one approve and
 * one contract call at a time, and every wallet worth supporting on this chain
 * injects an EIP-1193 provider — a connector stack would be more code than the
 * thing it connects to.
 *
 * Three behaviours are not optional and are easy to leave out:
 *
 * **The silent check on mount uses `eth_accounts`, never `eth_requestAccounts`.**
 * The latter opens the wallet's approval popup. Calling it on page load means
 * every visitor who has ever connected gets a modal thrown at them by a
 * marketing page, which is the behaviour that teaches people to click through
 * wallet prompts without reading.
 *
 * **`accountsChanged` and `chainChanged` are subscribed for the life of the
 * page.** A visitor who switches account in MetaMask and is still shown the old
 * account's positions is being shown someone else's money.
 *
 * **Disconnect is local only.** EIP-1193 has no "log out" — the page can forget
 * the account, but the wallet still considers the site permitted. Saying
 * "disconnected" while the wallet disagrees is a lie the next page load exposes,
 * so nothing is persisted and a reload re-detects.
 */

type Eip1193Provider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: (...args: never[]) => void) => void;
  removeListener?: (event: string, handler: (...args: never[]) => void) => void;
};

declare global {
  interface Window {
    ethereum?: Eip1193Provider;
  }
}

const getProvider = () => (typeof window === "undefined" ? undefined : window.ethereum);

/** 4663 as the hex string `wallet_switchEthereumChain` expects. */
const CHAIN_ID_HEX = `0x${robinhoodChain.id.toString(16)}`;

export type Wallet = {
  /** Undefined until the mount check has run, so the UI can avoid flashing
      "install a wallet" at someone who has one. */
  ready: boolean;
  hasProvider: boolean;
  account?: Address;
  chainId?: number;
  wrongNetwork: boolean;
  connecting: boolean;
  error?: string;
  connect: () => Promise<void>;
  disconnect: () => void;
  switchNetwork: () => Promise<void>;
  /** A signer bound to the connected account, or undefined when there is none. */
  walletClient?: WalletClient;
};

/**
 * Whether this browser has a wallet at all.
 *
 * `useSyncExternalStore` rather than state written from an effect: the answer is
 * a fact about the environment, not something this component owns, and reading
 * it this way gives the server render a defined answer (`false`) instead of a
 * hydration mismatch. The subscribe function does nothing because extensions
 * inject before first paint and do not come and go while the page is open.
 */
const subscribeNothing = () => () => {};
const providerNow = () => !!getProvider();
const providerOnServer = () => false;

export function useWallet(): Wallet {
  const hasProvider = useSyncExternalStore(subscribeNothing, providerNow, providerOnServer);
  const [probed, setProbed] = useState(false);
  const [account, setAccount] = useState<Address>();
  const [chainId, setChainId] = useState<number>();
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string>();

  /* Nothing to probe without a provider, so that case is ready immediately —
     derived rather than assigned, which keeps the effect below free of any
     synchronous state write. */
  const ready = !hasProvider || probed;

  useEffect(() => {
    const provider = getProvider();
    if (!provider) return;

    let live = true;

    const readChain = async () => {
      const id = (await provider.request({ method: "eth_chainId" })) as string;
      if (live) setChainId(Number.parseInt(id, 16));
    };

    // Silent: reports an account only if this site is already permitted.
    const readAccounts = async () => {
      const accounts = (await provider.request({ method: "eth_accounts" })) as Address[];
      if (live) setAccount(accounts[0]);
    };

    Promise.all([readChain(), readAccounts()])
      .catch(() => {})
      .finally(() => live && setProbed(true));

    const onAccounts = (...args: never[]) => {
      const accounts = args[0] as unknown as Address[];
      setAccount(accounts?.[0]);
    };
    const onChain = (...args: never[]) => {
      setChainId(Number.parseInt(args[0] as unknown as string, 16));
    };

    provider.on?.("accountsChanged", onAccounts);
    provider.on?.("chainChanged", onChain);
    return () => {
      live = false;
      provider.removeListener?.("accountsChanged", onAccounts);
      provider.removeListener?.("chainChanged", onChain);
    };
  }, []);

  const connect = useCallback(async () => {
    const provider = getProvider();
    if (!provider) return;
    setConnecting(true);
    setError(undefined);
    try {
      const accounts = (await provider.request({ method: "eth_requestAccounts" })) as Address[];
      setAccount(accounts[0]);
      const id = (await provider.request({ method: "eth_chainId" })) as string;
      setChainId(Number.parseInt(id, 16));
    } catch (e) {
      // 4001 is the user closing the prompt. That is an answer, not a fault, and
      // it does not get an error message.
      const code = (e as { code?: number }).code;
      if (code !== 4001) setError("Could not connect to the wallet.");
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setAccount(undefined);
    setError(undefined);
  }, []);

  const switchNetwork = useCallback(async () => {
    const provider = getProvider();
    if (!provider) return;
    setError(undefined);
    try {
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: CHAIN_ID_HEX }],
      });
    } catch (e) {
      // 4902: the wallet has never heard of this chain. Offer to add it, which
      // is the only way a visitor gets onto Robinhood Chain from a fresh wallet.
      if ((e as { code?: number }).code === 4902) {
        try {
          await provider.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: CHAIN_ID_HEX,
                chainName: robinhoodChain.name,
                nativeCurrency: robinhoodChain.nativeCurrency,
                rpcUrls: [...robinhoodChain.rpcUrls.default.http],
                blockExplorerUrls: [robinhoodChain.blockExplorers.default.url],
              },
            ],
          });
          return;
        } catch {
          setError("Could not add Robinhood Chain to the wallet.");
          return;
        }
      }
      if ((e as { code?: number }).code !== 4001) setError("Could not switch network.");
    }
  }, []);

  const provider = getProvider();
  const walletClient =
    provider && account
      ? createWalletClient({ account, chain: robinhoodChain, transport: custom(provider) })
      : undefined;

  return {
    ready,
    hasProvider,
    account,
    chainId,
    wrongNetwork: !!account && chainId !== undefined && chainId !== robinhoodChain.id,
    connecting,
    error,
    connect,
    disconnect,
    switchNetwork,
    walletClient,
  };
}
