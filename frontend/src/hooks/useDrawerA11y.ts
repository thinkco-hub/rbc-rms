import { useEffect, useRef } from "react";
import type { KeyboardEvent, RefObject } from "react";

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export interface DrawerA11yOptions {
  /** The off-canvas panel. A `<div>`: ARIA-in-HTML does not allow dialog on aside. */
  containerRef: RefObject<HTMLDivElement>;
  /** The hamburger that opened it; focus returns here when it closes. */
  triggerRef: RefObject<HTMLElement>;
  /** The drawer's own Close button, focused on open. */
  closeRef: RefObject<HTMLElement>;
  isOpen: boolean;
  /** False on the pinned desktop rail, which is part of the page, not an overlay. */
  isDrawerLayout: boolean;
  onClose: () => void;
}

/**
 * The drawer half of the shell's accessibility: a closed drawer is off-screen,
 * so it must also be out of the tab order and the accessibility tree, and an
 * open one is a modal dialog that owns focus until it is dismissed.
 */
export function useDrawerA11y({
  containerRef,
  triggerRef,
  closeRef,
  isOpen,
  isDrawerLayout,
  onClose,
}: DrawerA11yOptions) {
  const wasOpen = useRef(false);

  useEffect(() => {
    const drawer = containerRef.current;
    if (!drawer) return;
    // The attribute, not the IDL property: React 18 does not type the prop and
    // jsdom does not reflect it, so this is the form both shells can assert on.
    if (isDrawerLayout && !isOpen) drawer.setAttribute("inert", "");
    else drawer.removeAttribute("inert");

    if (!isDrawerLayout) {
      wasOpen.current = false;
      return;
    }
    if (isOpen) {
      closeRef.current?.focus();
    } else if (wasOpen.current) {
      const trigger = triggerRef.current;
      if (trigger && document.contains(trigger)) trigger.focus();
    }
    wasOpen.current = isOpen;
  }, [isOpen, isDrawerLayout, containerRef, triggerRef, closeRef]);

  const open = isDrawerLayout && isOpen;

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") {
      onClose();
      return;
    }
    if (event.key !== "Tab") return;
    const drawer = containerRef.current;
    if (!drawer) return;
    // A collapsed submenu stays in the document for aria-controls, but its links
    // are not stops; jsdom has no layout, so visibility comes from the DOM.
    const stops = Array.from(drawer.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      (el) => !el.closest("[hidden]") && getComputedStyle(el).visibility !== "hidden"
    );
    if (stops.length === 0) return;
    const first = stops[0];
    const last = stops[stops.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return {
    // The panel is a div, so the landmark it replaces has to be named explicitly.
    role: open ? ("dialog" as const) : ("complementary" as const),
    "aria-modal": open ? true : undefined,
    "aria-label": open ? "Navigation" : undefined,
    "aria-hidden": isDrawerLayout && !isOpen ? true : undefined,
    onKeyDown: isDrawerLayout ? handleKeyDown : undefined,
  };
}