"use client";

import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { http } from "viem";
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
 * RainbowKit's `getDefaultConfig` — the same batteries-included setup Aave,
 * Uniswap and the rest run on, chosen deliberately over a hand-built roster.
 *
 * The hand-built roster was the bug. Listing `metaMaskWallet` by name gave a
 * tile that always went through WalletConnect — so on a desktop with the
 * MetaMask extension installed, clicking "MetaMask" opened a QR for the phone
 * instead of the extension, and the connection never happened. `getDefaultConfig`
 * does the standard thing instead: it surfaces every wallet the browser actually
 * announces (EIP-6963) as an "Installed" option that connects through the
 * extension directly, and keeps WalletConnect as the QR / mobile path for
 * everything else. That is why it "just works" where it is used.
 *
 * The old comment warned that RainbowKit's wallet barrel drags in
 * `@coinbase/wallet-sdk` and its uninstalled `@x402/*` packages and breaks the
 * build. It does not: `getDefaultConfig` builds and runs cleanly here.
 *
 * Reads still go over our own RPC. The heavy batching lives on the standalone
 * `publicClient` in `chain.ts` (multicall3), which is what every on-screen figure
 * is read through; this config's transport is only for wagmi's own calls.
 */
export const wagmiConfig = getDefaultConfig({
  appName: "$CB — Capybara CykaBlyat",
  projectId: WALLETCONNECT_PROJECT_ID,
  chains: [robinhoodChain],
  transports: { [robinhoodChain.id]: http(RPC_URL) },
  // A static export prerenders this at build time, where there is no window to
  // read a stored connection from.
  ssr: true,
});
