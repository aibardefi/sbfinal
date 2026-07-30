/**
 * The chain, the deployment, and the read-only client.
 *
 * Reads go over `RPC_URL` rather than through the visitor's wallet, so the
 * borrow screen shows the real collateral list, the real inventory and real
 * prices to someone who has not connected anything — and so a wallet that is
 * pointed at the wrong network still renders a correct page underneath the
 * "switch network" prompt. Writes are the only thing that need a wallet.
 *
 * Addresses are the deployed proxy, not the implementation. `IMPLEMENTATION` is
 * recorded for reference only and must never be called: this contract is UUPS,
 * its state lives in the proxy, and calling the implementation directly reads
 * zeroes.
 */

import { createPublicClient, defineChain, http, type Address } from "viem";
import { EXPLORER_ORIGIN, RPC_URL } from "./rpc";

export const robinhoodChain = defineChain({
  id: 4663,
  name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
  blockExplorers: { default: { name: "Blockscout", url: EXPLORER_ORIGIN } },
});

/** Deployment manifest for chain 4663, mirrored from `sb/ui/deployments/4663.json`. */
export const DEPLOYMENT = {
  chainId: 4663,
  lending: "0x13BCbCb4F2F42951A5BBcb481B0496554eEC9774" as Address,
  cb: "0x35C84a03960C5684Eb803264eA7dE6f0a159cdFc" as Address,
  weth: "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73" as Address,
  cbPool: "0x41B275eeda2Dd4AeB12722511017Fb4637edF136" as Address,
  router: "0xCaf681a66D020601342297493863E78C959E5cb2" as Address,
  deployBlock: 94945449,
  /** True on this deployment: the collateral and the lent token are mocks. */
  mocks: true,
} as const;

/** Reference only. Never call this — see the note at the top of the file. */
export const IMPLEMENTATION = "0xbB7C6799774A89DAa3B5D451aCE022c018a11D7D" as Address;

export const publicClient = createPublicClient({
  chain: robinhoodChain,
  transport: http(RPC_URL),
});

export const txUrl = (hash: string) => `${EXPLORER_ORIGIN}/tx/${hash}`;
