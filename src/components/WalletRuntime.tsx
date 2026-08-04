"use client";

import { useCallback, useEffect, useState, type MutableRefObject } from "react";
import {
  RainbowKitProvider,
  darkTheme,
  lightTheme,
  useConnectModal,
} from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, useAccount, useDisconnect, useSwitchChain, useWalletClient } from "wagmi";
import type { WalletClient } from "viem";
import { wagmiConfig } from "@/lib/wagmi";
import { robinhoodChain } from "@/lib/chain";
import type { Wallet } from "@/lib/wallet";
import "@rainbow-me/rainbowkit/styles.css";

/**
 * Everything heavy about the wallet, isolated in one place so it can be a
 * `next/dynamic` chunk that loads after the page is interactive instead of
 * blocking first paint. It mounts the three providers, then a `Bridge` that
 * turns the wagmi/RainbowKit hooks into the plain `Wallet` object the rest of
 * the site reads through context.
 *
 * `onWallet` hands that object up to `Providers`. `requestOpen` is the ref
 * `Providers`' stub sets when someone hit Connect before this chunk had loaded —
 * the bridge honours it the moment the modal is available, so an early click is
 * not lost.
 */
export function WalletRuntime({
  onWallet,
  requestOpen,
}: {
  onWallet: (wallet: Wallet) => void;
  requestOpen: MutableRefObject<boolean>;
}) {
  // In state, not module scope: a client shared across prerenders is wrong, and
  // this file is only ever evaluated in the browser (ssr: false), but the habit
  // is cheap and correct.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { refetchOnWindowFocus: false, retry: 1 },
        },
      })
  );

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          appInfo={{ appName: "$CB — Capybara CykaBlyat" }}
          modalSize="compact"
          theme={{
            lightMode: lightTheme({
              accentColor: "#4dffbc",
              accentColorForeground: "#052b1f",
              borderRadius: "medium",
              fontStack: "system",
            }),
            darkMode: darkTheme({
              accentColor: "#42eaff",
              accentColorForeground: "#07222b",
              borderRadius: "medium",
              fontStack: "system",
            }),
          }}
        >
          <Bridge onWallet={onWallet} requestOpen={requestOpen} />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

function Bridge({
  onWallet,
  requestOpen,
}: {
  onWallet: (wallet: Wallet) => void;
  requestOpen: MutableRefObject<boolean>;
}) {
  const { address, chainId, status } = useAccount();
  const { openConnectModal, connectModalOpen } = useConnectModal();
  const { disconnect } = useDisconnect();
  const { switchChain, error: switchError } = useSwitchChain();
  const { data: walletClient } = useWalletClient();

  const connect = useCallback(() => openConnectModal?.(), [openConnectModal]);
  const disconnectFn = useCallback(() => disconnect(), [disconnect]);
  const switchNetwork = useCallback(
    () => switchChain({ chainId: robinhoodChain.id }),
    [switchChain]
  );

  // A Connect pressed before this chunk finished loading set the flag; open the
  // modal as soon as it can be opened, then clear it.
  useEffect(() => {
    if (requestOpen.current && openConnectModal) {
      requestOpen.current = false;
      openConnectModal();
    }
  }, [openConnectModal, requestOpen]);

  // Publish the live wallet up to Providers whenever any input changes.
  useEffect(() => {
    onWallet({
      ready: status !== "reconnecting",
      hasProvider: true,
      account: address,
      chainId,
      wrongNetwork:
        !!address && chainId !== undefined && chainId !== robinhoodChain.id,
      connecting: status === "connecting" || connectModalOpen,
      error:
        switchError && !/user rejected|denied/i.test(switchError.message)
          ? "Could not switch network."
          : undefined,
      connect,
      disconnect: disconnectFn,
      switchNetwork,
      walletClient: walletClient as WalletClient | undefined,
    });
  }, [
    address,
    chainId,
    status,
    connectModalOpen,
    switchError,
    walletClient,
    connect,
    disconnectFn,
    switchNetwork,
    onWallet,
  ]);

  return null;
}
