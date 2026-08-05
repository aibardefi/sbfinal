"use client";

import { CONNECTORS, isMobileBrowser, type ConnectorId } from "@/lib/connectors";
import { useWallet, type ConnectorView } from "@/lib/wallet";
import { Modal } from "./Modal";
import s from "./ConnectPanel.module.css";

/**
 * The connect panel: one row per wallet the visitor can actually use.
 *
 * **One panel on both surfaces, deliberately.** What this replaced had a modal on
 * desktop and a separate row of deep-link buttons on a phone, and that split is
 * how the two drifted — the phone path was rewritten five times while the desktop
 * one sat still, and a fix to either was not a fix to the other. There is no
 * user-agent branch around the layout. `Modal` already sizes itself for both.
 *
 * What the surface *does* decide is which rows exist, and it is not symmetric:
 *
 * **A desktop only lists wallets it actually has.** With the extension missing
 * there is nothing for the row to connect to, and a button whose whole job is to
 * navigate to a download page is a dead control wearing a wallet's name — it
 * looks identical to the working one until it is pressed.
 *
 * **A phone lists everything.** There is never an injected provider in Safari or
 * Chrome on a phone, so hiding on "not detected" would hide every wallet from
 * every phone visitor, including people who have the app installed. There a row
 * is a handoff: it reopens this page inside that wallet's own browser, where a
 * provider exists. Detection cannot tell "not installed" from "installed but not
 * hosting this page", which is why the surface is asked about directly.
 *
 * The panel knows no wallet by name — it renders `wallet.connectors`. Adding a
 * third means adding it to `CONNECTORS` and drawing a mark below; nothing here
 * changes. Marks are inline SVG because `img-src` is `'self' data:` with no CDN,
 * and the reason that policy is tight again is that the stack which needed it
 * widened is gone. A second wallet should not reopen it.
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

  /* Read at render, not at module load: this only runs in the browser, because
     `Modal` returns null until `open`, and `open` is set by a click. */
  const mobile = isMobileBrowser();

  /* A wallet is listed if it is actually here, or — on a phone only — if it can
     be handed off to. Both halves are load-bearing:

     `c.present` first and unconditionally, because inside a wallet's own in-app
     browser its provider IS injected, phone or not. Filtering that case on the
     deep link would hide a wallet sitting right there waiting to be used.

     The second half is why a phone shows wallets it cannot detect: there is never
     an injected provider in Safari or Chrome, so `present` is false for everyone
     and the list would be empty. A wallet with no universal link — Rabby, whose
     mobile app expects a scanned QR rather than hosting the page — has nothing a
     row could do there, so it stays hidden instead of opening an app and
     stranding the visitor in it. */
  const shown = wallet.connectors.filter(
    (c) => c.present || (mobile && CONNECTORS[c.id].deepLink !== null)
  );

  return (
    <Modal open={open} onClose={onClose} theme={theme} title="Connect a wallet">
      {shown.length > 0 ? (
        <ul className={s.list}>
          {shown.map((c) => (
            <li key={c.id}>
              <WalletRow connector={c} onSelect={() => wallet.connectWith(c.id)} busy={wallet.connecting} />
            </li>
          ))}
        </ul>
      ) : (
        /* Desktop with nothing installed. The list is genuinely empty, so it says
           so rather than showing rows that cannot connect. */
        <div className={s.empty}>
          <div className={s.mark} aria-hidden="true">
            <Fox />
          </div>
          <p className={s.lead}>No wallet detected</p>
          <p className={s.note}>
            This browser has no wallet extension installed. Install{" "}
            {wallet.connectors.map((c, i) => (
              <span key={c.id}>
                {i > 0 ? " or " : ""}
                <a
                  className={s.link}
                  href={CONNECTORS[c.id].installUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  {c.name}
                </a>
              </span>
            ))}
            , then reload this page.
          </p>
        </div>
      )}

      {wallet.error ? <p className={s.error}>{wallet.error}</p> : null}

      {shown.length > 0 ? (
        <p className={s.note}>
          {mobile
            ? "Your wallet opens this page inside its own browser to finish connecting."
            : "More wallets are coming."}
        </p>
      ) : null}
    </Modal>
  );
}

function WalletRow({
  connector,
  onSelect,
  busy,
}: {
  connector: ConnectorView;
  onSelect: () => void;
  /** True while ANY row is connecting, so a second wallet cannot be started on
      top of a prompt the visitor has not answered yet. */
  busy: boolean;
}) {
  return (
    <button type="button" className={s.wallet} onClick={onSelect} disabled={busy}>
      <span className={s.icon} aria-hidden="true">
        <Mark id={connector.id} />
      </span>
      <span className={s.text}>
        <span className={s.name}>{connector.name}</span>
        <span className={s.sub}>
          {connector.connecting
            ? `Check ${connector.name}…`
            : connector.present
              ? "Browser extension"
              : `Open in the ${connector.name} app`}
        </span>
      </span>
      {connector.connecting ? <span className={s.spinner} aria-hidden="true" /> : null}
    </button>
  );
}

/**
 * The one place that maps a connector to a drawing. Exhaustive over `ConnectorId`,
 * so adding a wallet to `CONNECTORS` without a mark here is a type error rather
 * than a blank square nobody notices until it ships.
 */
function Mark({ id }: { id: ConnectorId }) {
  const marks: Record<ConnectorId, () => React.ReactElement> = {
    metamask: Fox,
    phantom: Ghost,
    rabby: Rabbit,
  };
  const Glyph = marks[id];
  return <Glyph />;
}

/** MetaMask. A flat, two-tone fox — recognisable at 26px, which is all it needs. */
function Fox() {
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

/** Phantom. The ghost, in its own violet. */
function Ghost() {
  return (
    <svg viewBox="0 0 32 32" role="img">
      <rect width="32" height="32" rx="8" fill="#ab9ff2" />
      <path
        d="M24.6 15.6c0-4.8-3.9-8.2-8.6-8.2-4.6 0-8.5 3.3-8.6 8-.1 3.9 2.4 7.2 2.4 7.2.3.4.9.4 1.2 0l1.2-1.6c.3-.3.7-.3 1 0l1.2 1.6c.3.4.9.4 1.2 0l1.2-1.6c.3-.3.7-.3 1 0l1.2 1.6c.3.4.9.4 1.2 0 0 0 1.4-1.8 2-4.1h1.4c.6 0 1-.5 1-1.1z"
        fill="#fff"
      />
      <ellipse cx="13.3" cy="14.4" rx="1.5" ry="2.3" fill="#ab9ff2" />
      <ellipse cx="18.6" cy="14.4" rx="1.5" ry="2.3" fill="#ab9ff2" />
    </svg>
  );
}

/** Rabby. The rabbit, in its blue. */
function Rabbit() {
  return (
    <svg viewBox="0 0 32 32" role="img">
      <rect width="32" height="32" rx="8" fill="#7084ff" />
      <path
        d="M11.4 9.6c-.7-2.1-1.7-3.3-2.5-3.1-.9.2-1.1 1.8-.6 3.9.3 1.3.8 2.5 1.4 3.4a7 7 0 0 0-1.1 3.7c0 3.9 3.6 6.9 8.1 6.9 1.6 0 3.1-.4 4.3-1.1l2.6 1.4c.5.3 1.1-.2.9-.8l-.9-2.5c.8-1 1.3-2.2 1.3-3.6 0-.6-.1-1.2-.3-1.8l1.6-.5c.6-.2.6-1 0-1.2l-4.2-1.6a9.6 9.6 0 0 0-4.6-1.1c-1.6 0-3.1.4-4.4 1a12 12 0 0 1-1.6-2.9z"
        fill="#fff"
      />
      <circle cx="19.6" cy="17.7" r="1.15" fill="#7084ff" />
    </svg>
  );
}
