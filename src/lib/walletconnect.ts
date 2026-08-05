"use client";

import { robinhoodChain } from "./chain";
import { RPC_URL } from "./rpc";
import type { Eip1193Provider } from "./connectors";

/**
 * WalletConnect: the one connector that is not an extension.
 *
 * The other eight are injected providers — code already running in the page,
 * found synchronously. This is a relay protocol. It has to be fetched,
 * initialised over the network, and it draws its own wallet picker. That makes it
 * different in three ways that the registry has to respect, and every one of them
 * is a lesson this repo already paid for.
 *
 * **It is loaded on demand, never at startup.** The wallet stack that used to
 * live here was ~700 KB in the first load, and CLAUDE.md records what that cost:
 * a page slow to wake, with WalletConnect's own handshake then fighting a blocked
 * main thread on a phone. The import below runs when somebody picks this row and
 * not before, so the eight injected wallets — and the whole rest of the site —
 * carry none of its weight.
 *
 * **Chain 4663 goes in `optionalChains`, never `chains`.** A chain in the
 * required set is a condition of the session: a wallet that has never heard of
 * Robinhood Chain — which is every wallet, nobody ships it — refuses to pair at
 * all, and refuses silently. The symptom is a wallet picker whose tiles do
 * nothing when tapped, which is exactly what this repo's history describes before
 * WalletConnect was torn out over five commits. Optional means "connect first,
 * ask about the chain after", and the chain is then added through the same
 * `wallet_addEthereumChain` path the injected wallets use.
 *
 * **The session survives, so a second visit usually skips the QR.** `init()`
 * restores any stored session, and `enable()` on a live session returns the
 * accounts without drawing anything. That is also why there is no attempt to
 * restore this on page load: doing so would pull the whole library into every
 * visit to save one click on the visit where it matters.
 */

/**
 * A free, PUBLIC key from cloud.reown.com, shipped to every browser — not a
 * secret. Carried over from the previous integration so an existing project keeps
 * its allowlisted origins. Env wins when the deploy sets one.
 */
const PROJECT_ID =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "f6857532efcddfe6a529b65c08ef68b8";

/** What this connector needs beyond plain EIP-1193. */
export type WalletConnectProvider = Eip1193Provider & {
  /** Opens the picker (or reuses a stored session) and resolves with accounts. */
  enable: () => Promise<string[]>;
  disconnect: () => Promise<void>;
  session?: unknown;
};

let instance: WalletConnectProvider | undefined;
let pending: Promise<WalletConnectProvider> | undefined;

/** The live provider, or undefined before anyone has picked this row. */
export const getWalletConnect = () => instance;

/**
 * Fetch and initialise the provider, once. Concurrent callers share the same
 * promise rather than racing two relay connections into existence.
 */
export function initWalletConnect(): Promise<WalletConnectProvider> {
  if (instance) return Promise.resolve(instance);
  if (pending) return pending;

  pending = (async () => {
    const { EthereumProvider } = await import("@walletconnect/ethereum-provider");
    const provider = await EthereumProvider.init({
      projectId: PROJECT_ID,
      // See the note above. This is the single most important line in the file.
      optionalChains: [robinhoodChain.id],
      // Reown's picker. It is what makes this "any wallet" rather than "a QR
      // code": on a phone it deep-links into whichever wallet was chosen, which
      // is the part the hand-written links cannot do for wallets like Rabby.
      showQrModal: true,
      rpcMap: { [robinhoodChain.id]: RPC_URL },
      metadata: {
        name: "$CB — Capybara CykaBlyat",
        description: "Borrow against your memecoins on Robinhood Chain.",
        // Must be this origin: the Verify API attests the dapp against it, and a
        // mismatch is what puts a "cannot verify this site" warning in the wallet.
        url: window.location.origin,
        icons: [`${window.location.origin}/og.png`],
      },
    });
    instance = provider as unknown as WalletConnectProvider;
    return instance;
  })();

  // A failed init must not poison every later attempt with a rejected promise.
  pending.catch(() => {
    pending = undefined;
  });

  return pending;
}

/** Drop the session and the cached instance, so the next connect starts clean. */
export async function resetWalletConnect() {
  const live = instance;
  instance = undefined;
  pending = undefined;
  try {
    await live?.disconnect();
  } catch {
    // Already gone, or the relay is unreachable. Either way our side is clear.
  }
}
