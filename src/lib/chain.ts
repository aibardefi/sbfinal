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
  // Multicall3 at its canonical, deterministic address — the same one viem's own
  // chain registry records for Robinhood Chain, so it is genuinely deployed here.
  // Registering it is what lets `batch: { multicall: true }` on the client below
  // fold the borrow screen's ~three-dozen per-refresh reads into a couple of
  // eth_calls, which is the difference a visitor far from the one RPC endpoint
  // actually feels.
  contracts: {
    multicall3: { address: "0xca11bde05977b3631167028862be2a173976ca11" },
  },
});

/**
 * Deployment manifest for chain 4663.
 *
 * Only `lending` was given. Everything under it was read back off that contract
 * rather than carried over from the deployment before — `CB()`, `WETH()` and the
 * CB/WETH pool it prices against — because a manifest that disagrees with the
 * contract it points at is the one failure this file exists to prevent. `weth`
 * and `router` came back unchanged; `cb` and `cbPool` did not.
 *
 * Verified against the chain when it was wired in: MAX_LTV_BPS 8000,
 * LIQ_THRESHOLD_BPS 9000, not paused, twapWindow 3600s (the previous deployment
 * used 60), maxSlippageBps 200. `collateralTokens()` returns one token, CASHCAT,
 * enabled with a 1 CASHCAT minimum. The lent token answers `symbol()` with `CB`
 * and `name()` with "CB" — not "cyka blyat", which was the old one — against a
 * supply of exactly 1,000,000,000, the figure in CLAUDE.md's settled facts.
 *
 * Two things are true of it that the site cannot fix and must not paper over:
 * `availableCB()` is zero, so there is nothing to lend until $CB is transferred
 * in; and the new CB pool has an observation cardinality of 1, so a 3600s TWAP
 * has no history to read and `quoteCBInWeth` reverts. Both are admin actions on
 * the deployment (`increaseObservationCardinalityNext` on the pool), not changes
 * to this repo.
 *
 * `deployBlock` is deliberately absent rather than carried over. The manifest did
 * not supply one, and the old value belonged to the old contract — a stale block
 * number is worse than none, because the only thing that would read it is a log
 * replay for closed positions, which would silently start after the history it
 * was meant to find.
 */
export const DEPLOYMENT = {
  chainId: 4663,
  lending: "0x369171De158fbf4eA80f9f608D5b406526E86963" as Address,
  cb: "0xab46accEb52C3aBc3E891C17734CD0d09d9D38c9" as Address,
  weth: "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73" as Address,
  cbPool: "0x3Ad2640Aa2a81d82117c8142BA82d45FfE8308b3" as Address,
  router: "0xCaf681a66D020601342297493863E78C959E5cb2" as Address,
} as const;

/** Reference only. Never call this — see the note at the top of the file. */
export const IMPLEMENTATION = "0x914c1a842C7433Fe93083104C2D67fd05389dae4" as Address;

export const publicClient = createPublicClient({
  chain: robinhoodChain,
  transport: http(RPC_URL),
  // Every read on the borrow screen goes through this client, and there are many
  // in one tick — the whole collateral list, prices and configs. With multicall3
  // registered above, viem aggregates all the `readContract` calls fired in the
  // same tick into a single `eth_call`, so ~36 round-trips become ~3–4. This is
  // the standard way EVM apps read bulk state; nothing in `protocol.ts` changes.
  batch: { multicall: true },
});

export const txUrl = (hash: string) => `${EXPLORER_ORIGIN}/tx/${hash}`;
