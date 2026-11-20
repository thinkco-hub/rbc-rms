import { describe, expect, it } from "vitest";
import { useRef, useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useDrawerA11y } from "./useDrawerA11y";

/** The shape both shells give the hook: a trigger outside, a drawer with a Close button. */
function Harness({ drawerLayout = true }: { drawerLayout?: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const drawerA11y = useDrawerA11y({
    containerRef: drawerRef,
    triggerRef,
    closeRef,
    isOpen,
    isDrawerLayout: drawerLayout,
    onClose: () => setIsOpen(false),
  });

  return (
    <>
      <button ref={triggerRef} onClick={() => setIsOpen(true)}>
        Open navigation
      </button>
      <div ref={drawerRef} {...drawerA11y}>
        <button ref={closeRef} onClick={() => setIsOpen(false)}>
          Close navigation
        </button>
        <a href="/orders">Orders</a>
        <button
          aria-expanded={isExpanded}
          aria-controls="submenu"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          Toggle inventory submenu
        </button>
        <div id="submenu" hidden={!isExpanded}>
          <a href="/inventory/reconciliation">Reconciliation</a>
        </div>
        <a href="/logout">Log Out</a>
      </div>
      <main>
        <button>Page action</button>
      </main>
    </>
  );
}

async function openDrawer() {
  const user = userEvent.setup();
  render(<Harness />);
  await user.click(screen.getByRole("button", { name: "Open navigation" }));
  return { user, drawer: screen.getByRole("dialog", { name: "Navigation" }) };
}

describe("useDrawerA11y", () => {
  it("takes a closed drawer out of the tab order and the accessibility tree", () => {
    render(<Harness />);
    const panel = document.querySelector('[role="complementary"]');
    if (!(panel instanceof HTMLElement)) throw new Error("No drawer");

    expect(panel).toHaveAttribute("inert");
    expect(panel).toHaveAttribute("aria-hidden", "true");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByRole("link", { name: "Orders" })).toBeNull();
    expect(screen.getByRole("button", { name: "Page action" })).toBeInTheDocument();
  });

  it("opens as a named modal dialog with focus on Close", async () => {
    const { drawer } = await openDrawer();
    expect(drawer).toHaveAttribute("aria-modal", "true");
    expect(drawer).not.toHaveAttribute("inert");
    expect(drawer).not.toHaveAttribute("aria-hidden");
    expect(screen.getByRole("button", { name: "Close navigation" })).toHaveFocus();
  });

  it("closes on Escape from anywhere inside and returns focus to the trigger", async () => {
    const { drawer } = await openDrawer();
    screen.getByRole("link", { name: "Orders" }).focus();
    fireEvent.keyDown(drawer, { key: "Escape" });

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("button", { name: "Open navigation" })).toHaveFocus();
  });

  it("returns focus to the trigger when the Close button dismisses it", async () => {
    const { user } = await openDrawer();
    await user.click(screen.getByRole("button", { name: "Close navigation" }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("button", { name: "Open navigation" })).toHaveFocus();
  });

  it("keeps Tab and Shift+Tab inside the open drawer", async () => {
    const { drawer } = await openDrawer();
    const first = screen.getByRole("button", { name: "Close navigation" });
    const last = screen.getByRole("link", { name: "Log Out" });

    last.focus();
    fireEvent.keyDown(drawer, { key: "Tab" });
    expect(first).toHaveFocus();

    first.focus();
    fireEvent.keyDown(drawer, { key: "Tab", shiftKey: true });
    expect(last).toHaveFocus();
  });

  it("does not stop on a collapsed submenu's links", async () => {
    const { user } = await openDrawer();
    const toggle = screen.getByRole("button", { name: "Toggle inventory submenu" });
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    toggle.focus();
    await user.tab();
    expect(screen.getByRole("link", { name: "Log Out" })).toHaveFocus();
  });

  it("leaves the pinned rail alone even while the drawer flag is set", async () => {
    const user = userEvent.setup();
    render(<Harness drawerLayout={false} />);
    await user.click(screen.getByRole("button", { name: "Open navigation" }));

    const rail = document.querySelector('[role="complementary"]');
    if (!(rail instanceof HTMLElement)) throw new Error("No rail");
    expect(rail).not.toHaveAttribute("inert");
    expect(rail).not.toHaveAttribute("aria-hidden");
    expect(screen.getByRole("complementary")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close navigation" })).not.toHaveFocus();
  });
});