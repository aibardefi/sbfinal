"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { createWalletClient, custom, numberToHex, type Address, type WalletClient } from "viem";
import { robinhoodChain } from "./chain";
import { RPC_URL } from "./rpc";
import {
  asAddress,
  CONNECTORS,
  CONNECTOR_ORDER,
  findProvider,
  getProviderSnapshot,
  getServerSnapshot,
  isMobileBrowser,
  isUserRejection,
  subscribeToProviders,
  type ConnectorId,
} from "./connectors";
import type { Wallet } from "./wallet";

/** Which wallet was last connected, so a reload restores the same one. */
const STORAGE_KEY = "cb:wallet";

const readStored = (): ConnectorId | undefined => {
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    // Checked against the registry rather than a hand-written union, so adding a
    // wallet cannot leave a stored session for it silently unrestorable.
    return v && v in CONNECTORS ? (v as ConnectorId) : undefined;
  } catch {
    // Safari in private mode throws on localStorage. A session that cannot be
    // remembered is not a session that should crash the page.
    return undefined;
  }
};

const writeStored = (id: ConnectorId | undefined) => {
  try {
    if (id) window.localStorage.setItem(STORAGE_KEY, id);
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* see above */
  }
};

/**
 * The wallet, on viem and EIP-1193 alone — what wagmi was doing, minus the 700 KB.
 *
 * Now multi-wallet, which changes one thing structurally: there is an *active*
 * connector, and every operation after connecting has to go to that one. Reading
 * "whichever wallet we can find" for a chain switch is how a visitor connected
 * with Phantom gets a MetaMask popup.
 *
 * Four things here are the difference between working and nearly working.
 *
 * **The silent restore is `eth_accounts`, never `eth_requestAccounts`.** The
 * first reports who is already connected; the second *prompts*. Restoring with
 * the prompting one opens a wallet in the visitor's face on every page load.
 * `ready` stays false until that check resolves, which stops the header flashing
 * "Connect" at somebody already connected.
 *
 * **Which wallet to restore is remembered, not guessed.** With two extensions
 * installed, both may answer `eth_accounts` — picking the first would silently
 * switch somebody's wallet on reload.
 *
 * **Chain 4663 is in nobody's list.** `wallet_switchEthereumChain` fails with
 * 4902 for an unknown chain, so the switch falls through to
 * `wallet_addEthereumChain` and retries. That is the normal path here, not the
 * exception — no wallet ships with Robinhood Chain.
 *
 * **Rejections are not errors.** Closing the wallet is a decision, so 4001
 * clears the pending state and says nothing.
 */
export function useWalletConnection(): Wallet {
  // Re-render when a wallet announces itself, so a row that was absent appears
  // the moment the extension finishes loading.
  useSyncExternalStore(subscribeToProviders, getProviderSnapshot, getServerSnapshot);

  const [activeId, setActiveId] = useState<ConnectorId | undefined>();
  const [account, setAccount] = useState<Address | undefined>();
  const [chainId, setChainId] = useState<number | undefined>();
  const [pending, setPending] = useState<ConnectorId | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [restored, setRestored] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);

  /* Which wallets are on this device, as a string like "10" — one character per
     connector, in `CONNECTOR_ORDER`. A string rather than an object because it is
     a dependency below, and a fresh object every render would rebuild the whole
     `Wallet` every render and re-render every consumer of the context.
     `useSyncExternalStore` above is what re-runs this when discovery publishes. */
  const presence = CONNECTOR_ORDER.map((id) => (findProvider(CONNECTORS[id]) ? "1" : "0")).join("");

  const activeProvider = activeId ? findProvider(CONNECTORS[activeId]) : undefined;

  /* Derived, not stored. `ready` means "we are done finding out"; with nothing to
     restore there is nothing to find out, so it is true at once. Computing it
     avoids a synchronous setState in the effect below. */
  const ready = restored;

  /* ------------------------------------------------ restore, then stay in step */

  /* Runs once. Every path through it settles `restored`, and every one does so
     from inside the async body rather than the effect body — `localStorage` is
     not readable during render (there is no window in the static prerender, and
     a lazy initialiser would disagree with it at hydration), so the read has to
     happen here, and setting state synchronously beside it would cost a second
     render pass on the most common path of all: nobody has connected before. */
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const settle = () => {
        if (!cancelled) setRestored(true);
      };
      const stored = readStored();
      // Remembered nothing, or remembered a wallet that is not here — an
      // extension removed, or a phone browser that is not that wallet's.
      const p = stored ? findProvider(CONNECTORS[stored]) : undefined;
      if (!stored || !p) return settle();

      try {
        const [accounts, hexChain] = await Promise.all([
          p.request({ method: "eth_accounts" }),
          p.request({ method: "eth_chainId" }),
        ]);
        if (cancelled) return;
        const found = asAddress((accounts as unknown[])?.[0]);
        if (found) {
          setAccount(found);
          setActiveId(stored);
          setChainId(typeof hexChain === "string" ? Number.parseInt(hexChain, 16) : undefined);
        } else {
          // Permission was revoked in the wallet since the last visit.
          writeStored(undefined);
        }
      } catch {
        // A provider that will not answer a read is one we cannot use; leaving
        // the fields empty is the honest result.
      } finally {
        settle();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /* Events come from the ACTIVE wallet only. Binding to every detected provider
     would let a wallet nobody connected with change the account on screen. */
  useEffect(() => {
    if (!activeProvider) return;

    const onAccounts = (...args: never[]) => {
      const next = asAddress((args[0] as unknown[])?.[0]);
      setAccount(next);
      if (!next) {
        // A wallet reports being disconnected as an empty accounts array.
        setActiveId(undefined);
        setError(undefined);
        writeStored(undefined);
      }
    };
    const onChain = (...args: never[]) => {
      const hex = args[0] as unknown;
      setChainId(typeof hex === "string" ? Number.parseInt(hex, 16) : undefined);
    };

    activeProvider.on?.("accountsChanged", onAccounts);
    activeProvider.on?.("chainChanged", onChain);
    return () => {
      activeProvider.removeListener?.("accountsChanged", onAccounts);
      activeProvider.removeListener?.("chainChanged", onChain);
    };
  }, [activeProvider]);

  /* ---------------------------------------------------------------- actions */

  const connectWith = useCallback(async (id: ConnectorId) => {
    const connector = CONNECTORS[id];
    const p = findProvider(connector);

    // Not here: hand off rather than fail. On a phone that means reopening this
    // page inside the wallet's browser, where a provider exists — for the wallets
    // that have such a link. One without falls back to its install page, though
    // the panel does not show those rows on a phone in the first place.
    if (!p) {
      const link = isMobileBrowser() && connector.deepLink ? connector.deepLink() : connector.installUrl;
      window.location.href = link;
      return;
    }

    setPending(id);
    setError(undefined);
    try {
      const accounts = await p.request({ method: "eth_requestAccounts" });
      const next = asAddress((accounts as unknown[])?.[0]);
      if (!next) return;
      const hexChain = await p.request({ method: "eth_chainId" });
      setAccount(next);
      setActiveId(id);
      setChainId(typeof hexChain === "string" ? Number.parseInt(hexChain, 16) : undefined);
      writeStored(id);
      setPanelOpen(false);
    } catch (e) {
      if (!isUserRejection(e)) setError(`Could not connect to ${connector.name}.`);
    } finally {
      setPending(undefined);
    }
  }, []);

  const switchNetwork = useCallback(async () => {
    if (!activeId) return;
    const connector = CONNECTORS[activeId];
    const p = findProvider(connector);
    if (!p) return;
    const hexId = numberToHex(robinhoodChain.id);
    setError(undefined);
    try {
      await p.request({ method: "wallet_switchEthereumChain", params: [{ chainId: hexId }] });
    } catch (e) {
      const code = (e as { code?: number }).code;
      // 4902 is "unrecognized chain", which is the normal case here.
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
        if (!isUserRejection(addError)) {
          // Some wallets only support a fixed set of chains and will refuse any
          // custom one outright. That is the wallet's limit, not a failure here,
          // and naming it is the difference between a usable message and "error".
          setError(`${connector.name} would not add Robinhood Chain.`);
        }
      }
    }
  }, [activeId]);

  /**
   * There is no way to make a wallet forget us — permission lives in the
   * extension — so this drops the session on our side and the UI copy says as
   * much. `wallet_revokePermissions` is attempted because wallets that honour it
   * give a true disconnect.
   */
  const disconnect = useCallback(() => {
    const p = activeId ? findProvider(CONNECTORS[activeId]) : undefined;
    setAccount(undefined);
    setActiveId(undefined);
    setError(undefined);
    writeStored(undefined);
    void p
      ?.request({ method: "wallet_revokePermissions", params: [{ eth_accounts: {} }] })
      .catch(() => {});
  }, [activeId]);

  /* ----------------------------------------------------------- viem client */

  const walletClient = useMemo<WalletClient | undefined>(() => {
    if (!activeProvider || !account) return undefined;
    return createWalletClient({ account, chain: robinhoodChain, transport: custom(activeProvider) });
  }, [activeProvider, account]);

  const connectors = useMemo(
    () =>
      CONNECTOR_ORDER.map((id, i) => ({
        id,
        name: CONNECTORS[id].name,
        present: presence[i] === "1",
        connecting: pending === id,
      })),
    [presence, pending]
  );

  return useMemo<Wallet>(
    () => ({
      ready,
      hasProvider: true,
      account,
      chainId,
      wrongNetwork: !!account && chainId !== undefined && chainId !== robinhoodChain.id,
      connecting: pending !== undefined,
      error,
      connect: () => setPanelOpen(true),
      disconnect,
      switchNetwork: () => void switchNetwork(),
      walletClient,
      panelOpen,
      closeConnect: () => setPanelOpen(false),
      connectors,
      connectWith: (id) => void connectWith(id),
      activeId,
    }),
    [
      ready,
      account,
      chainId,
      pending,
      error,
      disconnect,
      switchNetwork,
      walletClient,
      panelOpen,
      connectors,
      connectWith,
      activeId,
    ]
  );
}
