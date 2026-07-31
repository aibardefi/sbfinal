"use client";

import { createConfig, http } from "wagmi";
import { injected, safe } from "wagmi/connectors";
import { robinhoodChain } from "./chain";
import { RPC_URL } from "./rpc";

/**
 * RainbowKit, wired to browser wallets only.
 *
 * **No WalletConnect, deliberately.** It is what would add QR and mobile wallets,
 * and it costs two things this site has decided against. It needs a `projectId`
 * from a third-party account, and it needs `connect-src` widened to the
 * WalletConnect relay and `img-src` to their logo CDN — the same policy line the
 * README calls the thing that keeps "a script on this page cannot ask for your
 * wallet" a fact rather than a hope. On a memecoin site that is not a trade worth
 * making by default.
 *
 * **Connectors come from wagmi, not from `@rainbow-me/rainbowkit/wallets`.** That
 * module is a barrel: importing one wallet from it pulls the whole roster, and
 * the roster reaches `@coinbase/wallet-sdk` and then `@coinbase/cdp-sdk`, whose
 * optional `@x402/*` payment packages are not installed. The build fails on five
 * unresolved modules belonging to a wallet this config never lists. Installing
 * them to satisfy an import we do not want would put a payments SDK in a static
 * marketing site.
 *
 * Nothing is lost by dropping it. `multiInjectedProviderDiscovery` is wagmi's
 * EIP-6963 support and is on by default, so every extension the browser
 * announces — MetaMask, Rabby, Coinbase, Brave, Phantom, Zerion — is discovered
 * at runtime and offered by name, and RainbowKit renders whatever the config
 * holds. That discovery is also the real upgrade here: the hand-rolled hook this
 * replaces read `window.ethereum`, so with two extensions installed it silently
 * used whichever won the race and gave the visitor no say.
 *
 * `safe` is named because a Safe app runs in an iframe and cannot announce
 * itself. It is inert outside one.
 *
 * Turning WalletConnect on later means the `walletConnect` connector, a real
 * projectId, and both copies of the CSP — `src/app/layout.tsx` and
 * `public/_headers`, which `npm run check:csp` holds together.
 */

export const wagmiConfig = createConfig({
  chains: [robinhoodChain],
  connectors: [injected(), safe()],
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
