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
import { safe } from "wagmi/connectors";
import { robinhoodChain } from "./chain";
import { RPC_URL } from "./rpc";

/**
 * The WalletConnect project id — a free, PUBLIC key from cloud.reown.com. It is
 * shipped to every browser in the client bundle, so committing it is fine; it is
 * not a secret. The deploy may override it with
 * NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID; otherwise the literal below is used.
 *
 * This is what turns the named mobile wallets on. MetaMask, Trust and Phantom
 * reach a phone through the WalletConnect relay, so an empty id would leave those
 * tiles present but unable to pair. With a real id they scan a QR from a desktop
 * or deep-link straight into the app on a phone, and the session stays in this
 * tab.
 */
const WALLETCONNECT_PROJECT_ID =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ??
  "f6857532efcddfe6a529b65c08ef68b8";

/**
 * RainbowKit's connector roster, built its own way.
 *
 * **Why `connectorsForWallets` and not a hand-built `connectors` array.**
 * RainbowKit's modal only renders wallets it was handed through this function.
 * A bare wagmi connector dropped into `createConfig` initialises but gets no
 * tile, so the "Connect" dialog comes up empty. The options have to come from
 * `@rainbow-me/rainbowkit/wallets` for RainbowKit to know how to present them.
 *
 * **The barrel scare is narrower than it looks.** The whole module does reach
 * `@coinbase/wallet-sdk` and its uninstalled `@x402/*` payment packages — but
 * only through `coinbaseWallet`. Named-importing the entries below tree-shakes
 * `coinbaseWallet` out and the build resolves cleanly. We simply never name it.
 *
 * The roster:
 * - `metaMaskWallet`, `trustWallet`, `phantomWallet`, `uniswapWallet` — the
 *   popular wallets by name, each with a phone path over WalletConnect (QR +
 *   deep-link).
 * - `walletConnectWallet` — the catch-all for every other WalletConnect wallet
 *   that is not listed by name.
 * - `injectedWallet` — the browser-extension option; with wagmi's EIP-6963
 *   discovery still on, every extension the browser announces is also offered.
 *
 * The relay these need is why `connect-src` in both copies of the CSP
 * (`src/app/layout.tsx`, `public/_headers`, held together by `npm run
 * check:csp`) names the WalletConnect origins.
 */
const rainbowConnectors = connectorsForWallets(
  [
    {
      groupName: "Popular",
      wallets: [
        metaMaskWallet,
        walletConnectWallet,
        trustWallet,
        phantomWallet,
        uniswapWallet,
      ],
    },
    { groupName: "Other", wallets: [injectedWallet] },
  ],
  {
    appName: "$CB — Capybara Blyatovich",
    projectId: WALLETCONNECT_PROJECT_ID,
  }
);

/**
 * `safe()` is added outside RainbowKit's list on purpose. A Safe app runs in an
 * iframe and auto-connects; it never needs a tile a human clicks, so it does not
 * belong among the wallets and RainbowKit does not have to render it. Inert
 * outside a Safe.
 */
export const wagmiConfig = createConfig({
  chains: [robinhoodChain],
  connectors: [...rainbowConnectors, safe()],
  /**
   * Reads go over our own RPC rather than the wallet's: the same transport
   * `publicClient` uses in `chain.ts`, so the collateral list, the inventory and
   * the prices render for a visitor with no wallet at all — and still render
   * correctly underneath the "switch network" prompt when a connected wallet is
   * pointed somewhere else.
   */
  transports: { [robinhoodChain.id]: http(RPC_URL) },
  // A static export prerenders this at build time, where there is no window to
  // read a stored connection from.
  ssr: true,
});
