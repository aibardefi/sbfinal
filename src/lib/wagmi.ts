"use client";

import { connectorsForWallets } from "@rainbow-me/rainbowkit";
import {
  injectedWallet,
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
 * The smallest connector roster that still covers everyone, chosen for weight.
 *
 * `getDefaultConfig` and the six-wallet roster before it dragged in the Coinbase
 * and Rainbow SDKs and a per-wallet WalletConnect wrapper each — millions of
 * bytes of JavaScript the phone had to parse before the page could respond. Two
 * connectors replace all of it:
 *
 * - `injectedWallet` is the browser extension, and with wagmi's EIP-6963
 *   discovery on it lists every installed wallet the browser announces — MetaMask,
 *   Rabby, Phantom, Coinbase — by name, each connecting straight through the
 *   extension. This is the path that actually works on a desktop.
 * - `walletConnectWallet` is the QR on desktop and the deep-link on a phone, and
 *   its heavy relay core is code-split, so it costs nothing until someone taps it.
 *
 * That is the whole trade: no bundled wallet SDKs, a far lighter first load, and
 * the two connection methods that between them reach every wallet.
 */
const rainbowConnectors = connectorsForWallets(
  [
    {
      groupName: "Connect",
      wallets: [injectedWallet, walletConnectWallet],
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
