"use client";

import { useShortAddress } from "@/lib/protocol";
import type { Wallet } from "@/lib/wallet";
import s from "./WalletChip.module.css";

/**
 * The wallet, in the top bar, in as few words as it can be said.
 *
 * Nothing renders until `ready`: the mount check is a round trip to the
 * extension, and showing "Connect" for a beat to somebody who is already
 * connected reads as having been logged out.
 *
 * When there is no wallet at all this stays empty. The card's primary button is
 * where that gets explained, because a visitor who has never held a token needs
 * the sentence next to the thing they were trying to do, not a disabled chip in
 * a corner they were not looking at.
 */
export function WalletChip({ wallet }: { wallet: Wallet }) {
  const short = useShortAddress(wallet.account);

  if (!wallet.ready || !wallet.hasProvider) return null;

  if (!wallet.account) {
    return (
      <button type="button" className={s.connect} onClick={wallet.connect} disabled={wallet.connecting}>
        {wallet.connecting ? "Connecting…" : "Connect"}
      </button>
    );
  }

  if (wallet.wrongNetwork) {
    return (
      <button type="button" className={s.wrong} onClick={wallet.switchNetwork}>
        Wrong network
      </button>
    );
  }

  return (
    <button
      type="button"
      className={s.chip}
      onClick={wallet.disconnect}
      title="Forget this account on this page. The wallet keeps its own permission."
    >
      <span className={s.live} aria-hidden="true" />
      {short}
    </button>
  );
}
