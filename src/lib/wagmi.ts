"use client";

import { connectorsForWallets } from "@rainbow-me/rainbowkit";
import {
  injectedWallet,
  metaMaskWallet,
  phantomWallet,
  trustWallet,
  uniswapWallet,
  walletConnectWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { createConfig, http } from "wagmi";
import { robinhoodChain } from "./chain";
import { RPC_URL } from "./rpc";

/**
 * The WalletConnect project id — a free, PUBLIC key from cloud.reown.com, shipped
 * to every browser, not a secret. Env wins when the deploy sets it.
 */
const WALLETCONNECT_PROJECT_ID =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ??
  "f6857532efcddfe6a529b65c08ef68b8";

/**
 * The wallets shown by name, plus the two catch-alls.
 *
 * These are listed explicitly so the first screen of the modal shows the wallets
 * people actually have — MetaMask, Phantom, Trust, Uniswap — instead of a generic
 * set. On a desktop each connects through its installed extension; on a phone each
 * deep-links into its app over WalletConnect. `walletConnectWallet` is the QR /
 * "all wallets" catch-all, and `injectedWallet` covers any other extension the
 * browser announces.
 *
 * The whole stack this builds is loaded lazily by `WalletRuntime`, so naming a
 * few wallets here does not cost the first paint.
 */
const rainbowConnectors = connectorsForWallets(
  [
    {
      groupName: "Popular",
      wallets: [
        metaMaskWallet,
        phantomWallet,
        trustWallet,
        uniswapWallet,
        walletConnectWallet,
        injectedWallet,
      ],
    },
  ],
  {
    appName: "$CB — Capybara CykaBlyat",
    projectId: WALLETCONNECT_PROJECT_ID,
  }
);

export const wagmiConfig = createConfig({
  chains: [robinhoodChain],
  connectors: rainbowConnectors,
  // Reads still go over our own RPC; the multicall batching lives on the
  // standalone publicClient in chain.ts, which every on-screen figure is read
  // through. This transport is only for wagmi's own calls.
  transports: { [robinhoodChain.id]: http(RPC_URL) },
  // A static export prerenders this at build time, where there is no window to
  // read a stored connection from.
  ssr: true,
});
