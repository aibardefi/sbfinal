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
 * A note on `handoff`. On a phone there is no extension and no relay here; the
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

export type ConnectorId = "metamask" | "phantom" | "rabby" | "trust" | "okx";

export type Connector = {
  id: ConnectorId;
  name: string;
  /** EIP-6963 identifier. The only trustworthy way to name a specific wallet. */
  rdns: string;
  installUrl: string;
  /**
   * Reopens this page inside the wallet's own browser, or `null` for a wallet
   * that cannot be reached that way.
   *
   * It performs the navigation rather than returning a URL string. Every wallet
   * that currently has one does the same single assignment, so that shape buys
   * nothing today — it is kept because the string form is what made OKX look
   * supportable when it is not, by forcing every wallet into the shape of the
   * easy ones. A wallet needing anything more than one assignment can have it
   * here instead of being bent to fit.
   *
   * Null is not an omission to be filled in later — it is the difference between
   * a wallet this site can reach on a phone and one it cannot. Two cannot, for
   * different reasons: Rabby's mobile app expects a scanned QR (WalletConnect,
   * which this site does not carry), and OKX has no universal link and a scheme
   * that errors when the app is absent. Both are hidden on phones rather than
   * offered as a button that opens an app store, an error, or nothing.
   */
  handoff: (() => void) | null;
  /** Where this wallet puts itself when it is not announcing over 6963. */
  legacy: () => Eip1193Provider | undefined;
};

/* --------------------------------------------------------------- the window */

type Flags = Record<string, unknown>;

type LegacyWindow = Window & {
  ethereum?: Eip1193Provider & Flags & { providers?: (Eip1193Provider & Flags)[] };
  phantom?: { ethereum?: Eip1193Provider & Flags };
  // Trust exposes itself either as the provider directly or wrapped, depending on
  // build, so both shapes are checked where it is read.
  trustwallet?: (Eip1193Provider & Flags) | { ethereum?: Eip1193Provider & Flags };
  okxwallet?: (Eip1193Provider & Flags) | { ethereum?: Eip1193Provider & Flags };
};

/** Accepts either `x` or `x.ethereum`, for wallets that have shipped both. */
function unwrap(value: unknown): (Eip1193Provider & Flags) | undefined {
  if (!value || typeof value !== "object") return undefined;
  const direct = value as Eip1193Provider & Flags;
  if (typeof direct.request === "function") return direct;
  const nested = (value as { ethereum?: Eip1193Provider & Flags }).ethereum;
  return nested && typeof nested.request === "function" ? nested : undefined;
}

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
    // A real https universal link, so no fallback is needed: with the app absent
    // it resolves to MetaMask's own web page rather than an error. Takes the
    // target with the scheme stripped — passing a full `https://…` gives a link
    // that opens the app but not the page.
    handoff: () => {
      const { host, pathname, search } = window.location;
      window.location.href = `https://metamask.app.link/dapp/${host}${pathname}${search}`;
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
    handoff: () => {
      const { href, origin } = window.location;
      window.location.href = `https://phantom.app/ul/browse/${encodeURIComponent(href)}?ref=${encodeURIComponent(origin)}`;
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
    handoff: null,
    legacy: () => pick((p) => p.isRabby === true),
  },

  trust: {
    id: "trust",
    name: "Trust Wallet",
    // Confirmed against Trust's own extension docs, which match on exactly this
    // string — unlike Rabby's above, this one is not a convention we assumed.
    rdns: "com.trustwallet.app",
    installUrl: "https://trustwallet.com/download",
    // Recovered from this repo's own history rather than invented: the deleted
    // `MobileWalletLinks.tsx` shipped this exact link, so it is a format that
    // demonstrably worked here. coin_id 60 is Ethereum in SLIP-44, which is what
    // selects the EVM side of a wallet that is not EVM-only.
    handoff: () => {
      window.location.href = `https://link.trustwallet.com/open_url?coin_id=60&url=${encodeURIComponent(window.location.href)}`;
    },
    // Trust is mobile-first, and the case that matters most is its own in-app
    // browser, where it takes the shared slot and sets `isTrust`. The named
    // namespace is preferred where the extension provides one.
    legacy: () =>
      unwrap(typeof window !== "undefined" ? (window as LegacyWindow).trustwallet : undefined) ??
      pick((p) => p.isTrust === true || p.isTrustWallet === true),
  },

  okx: {
    id: "okx",
    name: "OKX Wallet",
    // Conventional, and NOT confirmed — OKX's own docs pages are JS-rendered and
    // would not give it up from here. As with Rabby, `legacy` is what actually
    // carries detection: `window.okxwallet` is OKX's long-standing namespace and
    // cannot be another wallet, so a wrong string here costs only the
    // disambiguation between two extensions installed at once.
    rdns: "com.okex.wallet",
    installUrl: "https://www.okx.com/web3",
    /*
     * Null, after trying both ways of doing it. This is the record of why, so the
     * next person does not spend the same two rounds on it.
     *
     * **The https wrapper does not open the app.** `https://www.okx.com/download
     * ?deeplink=…` assumes OKX registered that path as an app-link. They have
     * not, so iOS treats it as an ordinary web page: it loaded okx.com and the
     * app never opened. Encoding a scheme into a query string cannot change what
     * the OS does with the outer URL.
     *
     * **The custom scheme errors for anyone without the app.**
     * `okx://wallet/dapp/url?dappUrl=…` opens OKX when it is installed, and when
     * it is not, Safari raises "cannot open the page because the address is
     * invalid" — immediately and modally, so a visibility-based fallback behind
     * it never gets to run. That dialog is worse than no row at all, and this row
     * would appear on phones precisely where the app CANNOT be detected, so the
     * visitor without it is the expected case rather than an edge one.
     *
     * Note the scheme is registered per-scheme at install time, not per-path — so
     * that error proves no `okx://` handler exists on the device, and says nothing
     * about whether the path was right. If OKX ever ships a real universal link,
     * this becomes one assignment like MetaMask's.
     */
    handoff: null,
    legacy: () =>
      unwrap(typeof window !== "undefined" ? (window as LegacyWindow).okxwallet : undefined) ??
      pick((p) => p.isOkxWallet === true || p.isOKExWallet === true),
  },
};

/** Display order in the panel. MetaMask first, as asked. */
export const CONNECTOR_ORDER: ConnectorId[] = ["metamask", "phantom", "rabby", "trust", "okx"];

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
