"use client";

import { connectorsForWallets } from "@rainbow-me/rainbowkit";
import { injectedWallet, walletConnectWallet } from "@rainbow-me/rainbowkit/wallets";
import { createConfig, http } from "wagmi";
import { safe } from "wagmi/connectors";
import { robinhoodChain } from "./chain";
import { RPC_URL } from "./rpc";

/**
 * The WalletConnect project id — a free, PUBLIC key from cloud.reown.com. It is
 * shipped to every browser in the client bundle, so committing it is fine; it is
 * not a secret. The deploy can set `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`, or the
 * literal fallback below can hold it. Fill in ONE and phone wallets light up on
 * the next build.
 *
 * While it is empty, `walletConnectWallet` is left out of the roster — it needs
 * a project id — so the modal behaves exactly as it did before: injected wallets
 * only, no QR.
 */
const WALLETCONNECT_PROJECT_ID =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "";

/**
 * RainbowKit's connector roster, built its own way.
 *
 * **Why `connectorsForWallets` and not a hand-built `connectors` array.**
 * RainbowKit's modal only renders wallets it was handed through this function
 * (or `getDefaultConfig`). A bare wagmi `walletConnect()` connector dropped into
 * `createConfig` does initialise — but RainbowKit draws no tile for it, so the
 * "Connect" dialog comes up empty and there is no way to reach the QR. The
 * WalletConnect and injected options have to come from
 * `@rainbow-me/rainbowkit/wallets` for RainbowKit to know how to present them.
 *
 * **The barrel scare is narrower than it looks.** The whole module does reach
 * `@coinbase/wallet-sdk` and its uninstalled `@x402/*` payment packages — but
 * only through `coinbaseWallet`. Named-importing `injectedWallet` and
 * `walletConnectWallet` alone tree-shakes `coinbaseWallet` out, and the build
 * resolves cleanly. We simply never name the Coinbase entry.
 *
 * `injectedWallet` is the browser-extension option and, with wagmi's EIP-6963
 * discovery still on by default, every extension the browser announces —
 * MetaMask, Rabby, Coinbase, Brave, Phantom, Zerion — is offered by name too.
 * `walletConnectWallet` is what adds QR and phone wallets: any wallet on any
 * device, scanning from a desktop or deep-linking into a wallet app on a phone.
 * RainbowKit draws its QR inside its own themed modal.
 *
 * The relay this needs is why `connect-src` in both copies of the CSP
 * (`src/app/layout.tsx`, `public/_headers`, held together by `npm run
 * check:csp`) names the WalletConnect origins.
 */
const wallets = [injectedWallet, ...(WALLETCONNECT_PROJECT_ID ? [walletConnectWallet] : [])];

const rainbowConnectors = connectorsForWallets(
  [{ groupName: "Wallets", wallets }],
  {
    appName: "$CB — Capybara Blyatovich",
    // connectorsForWallets requires a string; the value is only ever read by
    // walletConnectWallet, which is absent while the id is empty.
    projectId: WALLETCONNECT_PROJECT_ID || "unset",
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
