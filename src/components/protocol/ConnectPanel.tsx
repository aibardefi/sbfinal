"use client";

import { isMobileBrowser, METAMASK_INSTALL_URL } from "@/lib/metamask";
import { useWallet } from "@/lib/wallet";
import { Modal } from "./Modal";
import s from "./ConnectPanel.module.css";

/**
 * The connect panel: one row per wallet, MetaMask first.
 *
 * **One panel on both surfaces, deliberately.** What this replaced had a modal on
 * desktop and a separate row of deep-link buttons on a phone, and that split is
 * how the two drifted — the phone path was rewritten five times while the desktop
 * one sat still, and a fix to either was not a fix to the other. There is no
 * user-agent branch here. `Modal` already sizes itself for both.
 *
 * The surface difference is in which rows exist, and it is not symmetric:
 *
 * **A desktop only lists wallets it actually has.** With no extension installed
 * there is nothing for the row to connect to, and a button whose whole job is to
 * navigate away to a download page is a dead control wearing a wallet's name —
 * it looks identical to the working one until it is pressed. So the row is hidden
 * and the install link moves out of the list, where it reads as what it is.
 *
 * **A phone always lists it.** There is never an injected provider in Safari or
 * Chrome on a phone, so hiding on "not detected" would hide it from every phone
 * visitor. There the row is the handoff: it opens this page inside MetaMask's own
 * browser, where a provider exists and connecting works. Detection cannot tell
 * those two cases apart, which is why the surface is asked about directly.
 *
 * The fox is inline SVG. `img-src` is `'self' data:` and there is no CDN in the
 * policy, so a remote logo would be blocked — and the whole reason the CSP is
 * that tight again is that the wallet stack which needed it widened is gone.
 * Adding a second wallet here should not reopen that.
 */
export function ConnectPanel({
  open,
  onClose,
  theme,
}: {
  open: boolean;
  onClose: () => void;
  /** Carried through to `Modal`, which portals to `<body>` where the screen's
      `--p1-*` tokens are not declared. Without it the panel has no background. */
  theme: "light" | "dark";
}) {
  const wallet = useWallet();

  /* Read at render, not at module load: this only ever runs in the browser,
     because `Modal` returns null until `open`, and `open` is set by a click. */
  const mobile = isMobileBrowser();
  const showMetaMask = wallet.metamaskPresent || mobile;

  return (
    <Modal open={open} onClose={onClose} theme={theme} title="Connect a wallet">
      {showMetaMask ? (
        <ul className={s.list}>
          <li>
            <button
              type="button"
              className={s.wallet}
              onClick={wallet.connectMetaMask}
              disabled={wallet.connecting}
            >
              <span className={s.icon} aria-hidden="true">
                <FoxMark />
              </span>
              <span className={s.text}>
                <span className={s.name}>MetaMask</span>
                <span className={s.sub}>
                  {wallet.connecting
                    ? "Check MetaMask…"
                    : wallet.metamaskPresent
                      ? "Browser extension"
                      : "Open in the MetaMask app"}
                </span>
              </span>
              {wallet.connecting ? <span className={s.spinner} aria-hidden="true" /> : null}
            </button>
          </li>
        </ul>
      ) : (
        /* Desktop, nothing installed. The list is genuinely empty, so it says so
           rather than showing a row that cannot connect. */
        <div className={s.empty}>
          <div className={s.mark} aria-hidden="true">
            <FoxMark />
          </div>
          <p className={s.lead}>No wallet detected</p>
          <p className={s.note}>
            This browser has no wallet extension installed. MetaMask is the one supported here —{" "}
            <a className={s.link} href={METAMASK_INSTALL_URL} target="_blank" rel="noreferrer noopener">
              install it
            </a>{" "}
            and reload this page.
          </p>
        </div>
      )}

      {wallet.error ? <p className={s.error}>{wallet.error}</p> : null}

      {showMetaMask ? (
        <p className={s.note}>
          {mobile && !wallet.metamaskPresent
            ? "MetaMask opens this page inside its own browser to finish connecting."
            : "More wallets are coming."}
        </p>
      ) : null}
    </Modal>
  );
}

/** A flat, two-tone fox. Recognisable at 26px, which is all it has to be. */
function FoxMark() {
  return (
    <svg viewBox="0 0 32 30" role="img">
      <path d="M29.6 1 18.3 9.3l2.1-4.9z" fill="#e2761b" />
      <path d="M2.4 1l11.2 8.4-2-5z" fill="#e4761b" />
      <path d="M25.5 21.4l-3 4.6 6.4 1.8 1.9-6.3zM1.2 21.5l1.8 6.3 6.4-1.8-3-4.6z" fill="#e4761b" />
      <path d="M9 13.2l-1.8 2.8 6.4.3-.2-6.9zM23 13.2l-4.5-3.9-.1 7 6.3-.3zM9.4 26l3.8-1.9-3.3-2.6zM18.8 24.1l3.8 1.9-.5-4.5z" fill="#e4761b" />
      <path d="M22.6 26l-3.8-1.9.3 2.5v1.1zM9.4 26l3.5 1.7v-1.1l.3-2.5z" fill="#d7c1b3" />
      <path d="M13 20.3l-3.2-.9 2.3-1zM19 20.3l.9-1.9 2.3 1z" fill="#233447" />
      <path d="M9.4 26l.6-4.6-3.6.1zM22 21.4l.6 4.6 3-4.5zM24.8 16l-6.3.3.6 3.9.9-1.9 2.3 1zM9.8 19.4l2.3-1 .9 1.9.6-3.9-6.4-.3z" fill="#cd6116" />
      <path d="M7.2 16l2.7 5.2-.1-2.6zM22.2 18.6l-.1 2.6 2.7-5.2zM13.6 16.3l-.6 3.9.8 4 .2-5.3zM18.5 16.3l-.4 2.6.1 5.3.8-4z" fill="#e4751f" />
      <path d="M19.1 20.2l-.8 4 .5.4 3.3-2.6.1-2.6zM9.8 19.4l.1 2.6 3.3 2.6.5-.4-.8-4z" fill="#f6851b" />
      <path d="M19.2 27.7v-1.1l-.3-.3h-5.7l-.3.3v1.1L9.4 26l1.2 1 2.5 1.7h5.8l2.5-1.7 1.2-1z" fill="#c0ad9e" />
      <path d="M18.8 24.1l-.5-.4h-4.6l-.5.4-.3 2.5.3-.3h5.7l.3.3z" fill="#161616" />
      <path d="M30.1 9.9L31 5.3 29.6 1l-10.8 8 4.2 3.5 5.9 1.7 1.3-1.5-.6-.4 1-.9-.7-.6 1-.7zM1 5.3l1 4.6-.6.5.9.7-.7.6.9.9-.6.4 1.3 1.5 5.9-1.7 4.2-3.5L2.4 1z" fill="#763d16" />
      <path d="M28.9 14.2L23 12.5l1.8 2.7-2.7 5.2 3.5-.1h5.2zM9 12.5l-5.9 1.7-1.9 6.1h5.2l3.5.1-2.7-5.2zM18.5 16.3l.4-6.5 1.7-4.5h-7.4l1.7 4.5.4 6.5.1 2.1v5.2h4.6v-5.2z" fill="#f6851b" />
    </svg>
  );
}
