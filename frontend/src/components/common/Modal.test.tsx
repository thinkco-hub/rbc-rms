import { describe, expect, it } from "vitest";
import { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Modal from "./Modal";

function Harness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Open dialog</button>
      {open && (
        <Modal labelledBy="modal-title" onClose={() => setOpen(false)}>
          <h2 id="modal-title">Test dialog</h2>
          <button>First action</button>
          <button>Last action</button>
        </Modal>
      )}
    </>
  );
}

async function openDialog() {
  const user = userEvent.setup();
  render(<Harness />);
  await user.click(screen.getByRole("button", { name: "Open dialog" }));
  return screen.getByRole("dialog", { name: "Test dialog" });
}

describe("Modal", () => {
  it("exposes a named modal dialog and moves focus into it", async () => {
    const dialog = await openDialog();
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-labelledby", "modal-title");
    expect(dialog).toHaveFocus();
  });

  it("closes on Escape and returns focus to the trigger", async () => {
    const dialog = await openDialog();
    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Open dialog" })).toHaveFocus();
  });

  it("keeps Tab and Shift+Tab inside the dialog", async () => {
    const dialog = await openDialog();
    const first = screen.getByRole("button", { name: "First action" });
    const last = screen.getByRole("button", { name: "Last action" });

    dialog.focus();
    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(first).toHaveFocus();

    last.focus();
    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(first).toHaveFocus();

    first.focus();
    fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
    expect(last).toHaveFocus();
  });
});
