"use client";

import { txUrl } from "@/lib/chain";
import type { TxState } from "@/lib/tx";
import s from "./TxStatus.module.css";

/**
 * Where a transaction has got to.
 *
 * `aria-live="polite"` because every state here arrives without the visitor
 * doing anything — a wallet confirms, a block lands — and a sighted user sees
 * the line change while a screen reader user would otherwise be told nothing at
 * all. Polite rather than assertive: it should not cut across whatever is being
 * read.
 *
 * The explorer link appears as soon as there is a hash and stays after a
 * failure. A reverted transaction is exactly when someone needs to go and look
 * at it, so removing the link on error would take the link away at the only
 * moment it matters.
 */
export function TxStatus({ state, onDismiss }: { state: TxState; onDismiss: () => void }) {
  if (state.phase === "idle") return null;

  const steps = state.total > 1 ? ` (${state.step} of ${state.total})` : "";

  return (
    <div className={s.wrap} data-phase={state.phase} aria-live="polite">
      <p className={s.line}>
        {state.phase === "signing" && (
          <>
            <span className={s.spin} aria-hidden="true" />
            {state.label}
            {steps} — confirm in your wallet.
          </>
        )}
        {state.phase === "pending" && (
          <>
            <span className={s.spin} aria-hidden="true" />
            {state.label}
            {steps} — waiting for the chain.
          </>
        )}
        {state.phase === "done" && <>Done.</>}
        {state.phase === "error" && <>{state.error}</>}
      </p>

      <span className={s.tail}>
        {state.hash ? (
          <a className={s.link} href={txUrl(state.hash)} target="_blank" rel="noreferrer noopener">
            View transaction
          </a>
        ) : null}
        {state.phase === "done" || state.phase === "error" ? (
          <button type="button" className={s.dismiss} onClick={onDismiss}>
            Dismiss
          </button>
        ) : null}
      </span>
    </div>
  );
}
