import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

/** A confirm can open over a detail card; the inner dialog must not clear the outer lock. */
let openDialogs = 0;

function lockBackground() {
  openDialogs += 1;
  if (openDialogs === 1) document.getElementById("root")?.setAttribute("inert", "");
}

function unlockBackground() {
  openDialogs = Math.max(0, openDialogs - 1);
  if (openDialogs === 0) document.getElementById("root")?.removeAttribute("inert");
}

export interface ModalProps {
  role?: "dialog" | "alertdialog";
  /** id of the heading that names the dialog */
  labelledBy: string;
  onClose: () => void;
  /** Defaults to the dialog container, so the title is announced before the first Tab. */
  initialFocusRef?: React.RefObject<HTMLElement>;
  /** The card, or the full-screen sheet. Receives the dialog role, focus and outline reset. */
  className?: string;
  /** z-index, backdrop and padding; the fixed inset-0 base is always applied. */
  overlayClassName?: string;
  dismissOnBackdrop?: boolean;
  children: React.ReactNode;
}

export default function Modal({
  role = "dialog",
  labelledBy,
  onClose,
  initialFocusRef,
  className = "",
  overlayClassName = "z-[100] bg-black/50 backdrop-blur-sm p-4",
  dismissOnBackdrop = true,
  children,
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  // Captured during render, before autoFocus focuses a control inside the dialog.
  const restoreRef = useRef<HTMLElement | null>(
    typeof document !== "undefined" && document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
  );

  useEffect(() => {
    const restore = restoreRef.current;
    lockBackground();
    const dialog = dialogRef.current;
    // An input's autoFocus has already landed inside the dialog; do not pull focus back out.
    if (dialog && !dialog.contains(document.activeElement)) {
      (initialFocusRef?.current ?? dialog).focus();
    }
    return () => {
      unlockBackground();
      if (restore && document.contains(restore)) restore.focus();
    };
    // Mount/unmount only: a re-render must not re-run focus or the background lock.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== "Tab") return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (focusable.length === 0) {
      event.preventDefault();
      dialog.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;
    if (active === dialog || !dialog.contains(active)) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
      return;
    }
    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return createPortal(
    <div
      className={`fixed inset-0 flex items-center justify-center ${overlayClassName}`}
      onClick={(event) => {
        if (dismissOnBackdrop && event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role={role}
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className={`outline-none ${className}`}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}
