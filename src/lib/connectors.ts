"use client";

/**
 * The wallets this site can talk to, and how to find each one.
 *
 * This replaces a MetaMask-shaped `metamask.ts`. A second wallet added by copying
 * the first is exactly how the old desktop modal and phone deep-links drifted
 * apart — a fix to one was not a fix to the other — so the differences between
 * wallets are data in `CONNECTORS` and the logic around them is written once.
 *
 * Finding a wallet is two mechanisms, because there are two situations:
 *
 * **EIP-6963**, on a desktop. The page fires `requestProvider`, every installed
 * wallet answers with an `rdns`, and we match the one we mean. This is the only
 * way to say *which* wallet: `window.ethereum` is a single slot that several
 * extensions overwrite, so with two installed the last to load wins — and both
 * MetaMask and Phantom set `isMetaMask`-style flags that the other may also set.
 * rdns is the only identifier that is actually the wallet's own.
 *
 * **The legacy window slot**, second — and it is not a legacy path at all on a
 * phone. Inside a wallet's own in-app browser the provider is injected the old
 * way, and that is where every mobile connection happens. Phantom also exposes
 * itself at `window.phantom.ethereum`, which is unambiguous in a way that the
 * shared slot is not, so it is preferred where it exists.
 *
 * A note on `deepLink`. On a phone there is no extension and no relay here; the
 * button opens this same page inside the wallet's own browser, where a provider
 * exists on a fresh load and the desktop path runs unchanged.
 */

import type { Address } from "viem";

/** The slice of EIP-1193 this file needs. */
export type Eip1193Provider = {
  request: (args: { method: string; params?: unknown[] | object }) => Promise<unknown>;
  on?: (event: string, handler: (...args: never[]) => void) => void;
  removeListener?: (event: string, handler: (...args: never[]) => void) => void;
};

export type ConnectorId = "metamask" | "phantom" | "rabby";

export type Connector = {
  id: ConnectorId;
  name: string;
  /** EIP-6963 identifier. The only trustworthy way to name a specific wallet. */
  rdns: string;
  installUrl: string;
  /**
   * Reopens this page inside the wallet's own browser, or `null` for a wallet
   * that has no such link.
   *
   * Null is not an omission to be filled in later — it is the difference between
   * a wallet this site can reach on a phone and one it cannot. The handoff works
   * because the wallet hosts the page and injects a provider. A wallet whose
   * mobile app connects by scanning a QR code instead is asking for
   * WalletConnect, which this site does not carry, so there is nothing for a
   * phone row to do and the panel hides it rather than offering a button that
   * opens an app and abandons you there.
   */
  deepLink: (() => string) | null;
  /** Where this wallet puts itself when it is not announcing over 6963. */
  legacy: () => Eip1193Provider | undefined;
};

/* --------------------------------------------------------------- the window */

type Flags = Record<string, unknown>;

type LegacyWindow = Window & {
  ethereum?: Eip1193Provider & Flags & { providers?: (Eip1193Provider & Flags)[] };
  phantom?: { ethereum?: Eip1193Provider & Flags };
};

/** Every provider sitting on `window.ethereum`, whether one or a list. */
function injectedCandidates(): (Eip1193Provider & Flags)[] {
  if (typeof window === "undefined") return [];
  const eth = (window as LegacyWindow).ethereum;
  if (!eth) return [];
  return Array.isArray(eth.providers) ? eth.providers : [eth];
}

const pick = (match: (p: Flags) => boolean) =>
  injectedCandidates().find((p) => match(p as Flags));

/* ------------------------------------------------------------- the registry */

export const CONNECTORS: Record<ConnectorId, Connector> = {
  metamask: {
    id: "metamask",
    name: "MetaMask",
    rdns: "io.metamask",
    installUrl: "https://metamask.io/download/",
    // Takes the target with the scheme stripped. Passing a full `https://…`
    // gives a link that opens the app but not the page.
    deepLink: () => {
      const { host, pathname, search } = window.location;
      return `https://metamask.app.link/dapp/${host}${pathname}${search}`;
    },
    // Phantom and Coinbase both set `isMetaMask` in some builds to pass as it,
    // so they are excluded rather than trusted.
    legacy: () =>
      pick((p) => p.isMetaMask === true && !p.isPhantom && !p.isCoinbaseWallet && !p.isBraveWallet),
  },

  phantom: {
    id: "phantom",
    name: "Phantom",
    rdns: "app.phantom",
    installUrl: "https://phantom.app/download",
    deepLink: () => {
      const { href, origin } = window.location;
      return `https://phantom.app/ul/browse/${encodeURIComponent(href)}?ref=${encodeURIComponent(origin)}`;
    },
    // `window.phantom.ethereum` is Phantom's own namespace and cannot be another
    // wallet; the shared slot is only consulted if that is absent.
    legacy: () =>
      (typeof window !== "undefined"
        ? (window as LegacyWindow).phantom?.ethereum
        : undefined) ?? pick((p) => p.isPhantom === true),
  },

  rabby: {
    id: "rabby",
    name: "Rabby",
    // NOT confirmed against Rabby's source — it could not be verified from here,
    // and the value below is the conventional one. That is why `legacy` also
    // matches the `isRabby` flag, which is long-established and reliable: if this
    // string is wrong, detection still works, and only the disambiguation between
    // two simultaneously-installed extensions would fall back to the flag.
    rdns: "io.rabby",
    installUrl: "https://rabby.io/",
    // Rabby's mobile app connects by scanning a QR code — WalletConnect — rather
    // than by hosting the page in its own browser. There is no universal link to
    // hand off to, so on a phone this wallet is not offered at all. Inventing one
    // would open the app store and lose the visitor.
    deepLink: null,
    legacy: () => pick((p) => p.isRabby === true),
  },
};

/** Display order in the panel. MetaMask first, as asked. */
export const CONNECTOR_ORDER: ConnectorId[] = ["metamask", "phantom", "rabby"];

/* ----------------------------------------------------------- 6963 discovery */

type ProviderDetail = {
  info: { uuid: string; name: string; icon: string; rdns: string };
  provider: Eip1193Provider;
};

/**
 * Announcements arrive asynchronously and only after we ask, so this is a store
 * rather than a function returning a provider. Discovery starts on first
 * subscribe, which happens when `Providers` mounts — long before anyone can open
 * the panel, so by then the answers have landed.
 */
const detailsByRdns = new Map<string, ProviderDetail>();
const listeners = new Set<() => void>();
let discovering = false;

/** A stable snapshot identity, so `useSyncExternalStore` does not loop. */
let snapshot: readonly ProviderDetail[] = [];

function publish() {
  snapshot = Array.from(detailsByRdns.values());
  for (const l of listeners) l();
}

function beginDiscovery() {
  if (discovering || typeof window === "undefined") return;
  discovering = true;
  window.addEventListener("eip6963:announceProvider", (event: Event) => {
    const detail = (event as CustomEvent<ProviderDetail>).detail;
    if (!detail?.info?.rdns) return;
    // Keyed by rdns, not uuid: a wallet announcing twice is one wallet, and uuid
    // is regenerated per announcement.
    detailsByRdns.set(detail.info.rdns, detail);
    publish();
  });
  window.dispatchEvent(new Event("eip6963:requestProvider"));
}

export function subscribeToProviders(onChange: () => void) {
  beginDiscovery();
  listeners.add(onChange);
  // Ask again per subscriber. Cheap, and it covers an extension that finished
  // loading after the first request went out.
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("eip6963:requestProvider"));
  }
  return () => listeners.delete(onChange);
}

export const getProviderSnapshot = () => snapshot;
/** The server render has no wallets, and must not claim otherwise. */
export const getServerSnapshot = (): readonly ProviderDetail[] => [];

/** 6963 first, the wallet's own window slot second. */
export function findProvider(connector: Connector): Eip1193Provider | undefined {
  return detailsByRdns.get(connector.rdns)?.provider ?? connector.legacy();
}

/* ------------------------------------------------------------------ helpers */

export function isMobileBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || "");
}

export const asAddress = (value: unknown): Address | undefined =>
  typeof value === "string" && value.startsWith("0x") ? (value as Address) : undefined;

/** EIP-1193 rejections carry a numeric code; 4001 is the user saying no. */
export function isUserRejection(error: unknown): boolean {
  const code = (error as { code?: unknown })?.code;
  if (code === 4001 || code === "ACTION_REJECTED") return true;
  const message = (error as { message?: unknown })?.message;
  return typeof message === "string" && /user rejected|user denied|rejected the request/i.test(message);
}
