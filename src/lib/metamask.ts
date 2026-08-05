"use client";

/**
 * Finding MetaMask, on a desktop and on a phone, without a connector library.
 *
 * There are two entirely different problems behind one button.
 *
 * **On a desktop** MetaMask is an extension that injects an EIP-1193 provider.
 * The right way to find it is EIP-6963: the page fires `requestProvider`, every
 * installed wallet answers with `announceProvider` carrying an `rdns`, and we
 * take `io.metamask`. This matters because `window.ethereum` is a single slot
 * that several extensions fight over — with two wallets installed, the last one
 * to load wins, and a page that reads `window.ethereum.isMetaMask` connects to
 * whatever is standing there. `isMetaMask` is also set by wallets that are not
 * MetaMask, so it is a hint and not an answer. 6963 is the only way to say which
 * wallet you actually mean, which is why it is tried first and the legacy slot is
 * a fallback rather than the other way round.
 *
 * **On a phone** there is no extension. A normal mobile browser has no provider
 * at all, and the fix is not a relay — it is MetaMask's own universal link, which
 * reopens this page inside MetaMask's built-in browser. There a provider *is*
 * injected, on a fresh page load, and the desktop path above runs unchanged. No
 * WalletConnect, no QR, no pairing handshake to time out. This is the one part of
 * the removed deep-link screen worth keeping, and it is kept here rather than in
 * a component so that one button covers both surfaces.
 *
 * So `connect()` has three outcomes and the caller does not have to branch:
 * a provider is present and we prompt it; we are on a phone with none and we
 * hand off to the app; we are on a desktop with none and we send them to install.
 */

import type { Address } from "viem";

/** The slice of EIP-1193 this file needs. */
export type Eip1193Provider = {
  request: (args: { method: string; params?: unknown[] | object }) => Promise<unknown>;
  on?: (event: string, handler: (...args: never[]) => void) => void;
  removeListener?: (event: string, handler: (...args: never[]) => void) => void;
};

type ProviderDetail = {
  info: { uuid: string; name: string; icon: string; rdns: string };
  provider: Eip1193Provider;
};

export const METAMASK_RDNS = "io.metamask";

/* ----------------------------------------------------------- 6963 discovery */

/**
 * Announcements arrive asynchronously and only after we ask, so this is a tiny
 * store rather than a function that returns a provider. Discovery starts on first
 * subscribe and the request is re-fired then — wallets that loaded late answer it,
 * and ones that already answered simply answer again.
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
    // Keyed by rdns, not uuid: a wallet that announces twice is one wallet, and
    // uuid is regenerated per announcement.
    detailsByRdns.set(detail.info.rdns, detail);
    publish();
  });
  window.dispatchEvent(new Event("eip6963:requestProvider"));
}

export function subscribeToProviders(onChange: () => void) {
  beginDiscovery();
  listeners.add(onChange);
  // Ask again on each new subscriber. Cheap, and it covers an extension that
  // finished loading after our first request went out.
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("eip6963:requestProvider"));
  }
  return () => listeners.delete(onChange);
}

export const getProviderSnapshot = () => snapshot;
/** The server render has no wallets, and must not claim otherwise. */
export const getServerSnapshot = (): readonly ProviderDetail[] => [];

/* ------------------------------------------------------------ legacy lookup */

type LegacyWindow = Window & {
  ethereum?: Eip1193Provider & {
    isMetaMask?: boolean;
    isPhantom?: boolean;
    isCoinbaseWallet?: boolean;
    isBraveWallet?: boolean;
    providers?: (Eip1193Provider & Record<string, unknown>)[];
  };
};

/**
 * `window.ethereum`, for wallets predating 6963 — and, importantly, for
 * MetaMask's own in-app browser, which is where every phone connection actually
 * happens. Several wallets set `isMetaMask` to pass as it, so the ones that
 * identify themselves otherwise are excluded explicitly.
 */
function legacyMetaMask(): Eip1193Provider | undefined {
  if (typeof window === "undefined") return undefined;
  const eth = (window as LegacyWindow).ethereum;
  if (!eth) return undefined;
  const looksRight = (p: Record<string, unknown>) =>
    p.isMetaMask === true && !p.isPhantom && !p.isCoinbaseWallet && !p.isBraveWallet;
  // Some setups expose every injected wallet in an array on the same slot.
  if (Array.isArray(eth.providers)) {
    const found = eth.providers.find((p) => looksRight(p as Record<string, unknown>));
    if (found) return found;
  }
  return looksRight(eth as unknown as Record<string, unknown>) ? eth : undefined;
}

/** 6963 first, legacy slot second. Undefined means "not on this device". */
export function findMetaMask(): Eip1193Provider | undefined {
  return detailsByRdns.get(METAMASK_RDNS)?.provider ?? legacyMetaMask();
}

/* ------------------------------------------------------------------ surface */

export function isMobileBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || "");
}

/**
 * MetaMask's universal link. It takes the target with the scheme stripped —
 * `metamask.app.link/dapp/example.com/path` — and passing a full `https://…`
 * gives a link that opens the app but not the page.
 */
export function metamaskDeepLink(): string {
  const { host, pathname, search } = window.location;
  return `https://metamask.app.link/dapp/${host}${pathname}${search}`;
}

export const METAMASK_INSTALL_URL = "https://metamask.io/download/";

/** What the button should offer, given what is on this device. */
export type MetaMaskAction = "connect" | "openApp" | "install";

export function metamaskAction(present: boolean): MetaMaskAction {
  if (present) return "connect";
  return isMobileBrowser() ? "openApp" : "install";
}

/* ------------------------------------------------------------------ helpers */

export const asAddress = (value: unknown): Address | undefined =>
  typeof value === "string" && value.startsWith("0x") ? (value as Address) : undefined;

/** EIP-1193 rejections carry a numeric code; 4001 is the user saying no. */
export function isUserRejection(error: unknown): boolean {
  const code = (error as { code?: unknown })?.code;
  if (code === 4001 || code === "ACTION_REJECTED") return true;
  const message = (error as { message?: unknown })?.message;
  return typeof message === "string" && /user rejected|user denied|rejected the request/i.test(message);
}
