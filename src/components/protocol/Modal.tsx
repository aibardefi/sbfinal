"use client";

import { useCallback, useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import s from "./Modal.module.css";
import t from "./theme.module.css";

/**
 * The shell every popup on the borrow screen uses.
 *
 * Three things here are not decoration:
 *
 * **It portals to `<body>`.** `<html>` carries `scroll-snap-type: y mandatory`
 * and every section is a snap target, so a modal rendered inside one is a child
 * of a snap container — scroll it and the page snaps out from under the overlay.
 * At body level it is outside that entirely.
 *
 * **The background is inert while it is open.** Without it, Tab walks straight
 * out of the dialog and into the page behind, which on this site means the
 * visitor is tabbing through a capybara they cannot see. `inert` also hides the
 * background from screen readers, which `aria-modal` alone does not do reliably.
 *
 * **Focus is restored after the caller has re-rendered, not before.** Returning
 * focus synchronously on close lands it on an element the parent is about to
 * replace, and it ends up on `<body>` — so the keyboard user is dumped at the
 * top of the document. One frame's delay is the whole fix.
 */
export function Modal({
  open,
  onClose,
  title,
  theme,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Carried in because this renders at `<body>`, where the screen's tokens are
      not declared. Without it the panel has no background and the page behind
      shows straight through it. */
  theme: "light" | "dark";
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);
  const titleId = useId();

  const close = useCallback(() => {
    const back = returnTo.current;
    onClose();
    // After the caller's re-render, not during it.
    requestAnimationFrame(() => back?.focus?.());
  }, [onClose]);

  useEffect(() => {
    if (!open) return;

    returnTo.current = document.activeElement as HTMLElement | null;

    const main = document.querySelector("main");
    main?.setAttribute("inert", "");
    // The page behind must not scroll while a dialog is over it. Held on <html>
    // because that is where the snap container lives.
    const root = document.documentElement;
    const prevOverflow = root.style.overflow;
    root.style.overflow = "hidden";

    // Focus the panel itself rather than its first control: a dialog that opens
    // with a destructive-looking button already focused invites a stray Enter.
    requestAnimationFrame(() => panel.current?.focus());

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }
      if (e.key !== "Tab") return;
      // Keep Tab inside the panel. `inert` already blocks the page behind, but
      // the browser would still cycle to the address bar and back.
      const focusable = panel.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not(:disabled), input:not(:disabled), [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      main?.removeAttribute("inert");
      root.style.overflow = prevOverflow;
    };
  }, [open, close]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className={`${t.tokens} ${s.scrim}`}
      data-p1-theme={theme}
      onMouseDown={(e) => e.target === e.currentTarget && close()}
    >
      <div
        className={s.panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        ref={panel}
      >
        <div className={s.head}>
          <h2 id={titleId} className={s.title}>
            {title}
          </h2>
          <button type="button" className={s.x} onClick={close} aria-label="Close">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M6 6l12 12M18 6L6 18"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                fill="none"
              />
            </svg>
          </button>
        </div>
        <div className={s.body}>{children}</div>
        {footer ? <div className={s.foot}>{footer}</div> : null}
      </div>
    </div>,
    document.body
  );
}
