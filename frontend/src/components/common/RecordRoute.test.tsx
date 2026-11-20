import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RecordRoute from "./RecordRoute";

interface Widget {
  id: string;
  name: string;
}

const widgets: Widget[] = [
  { id: "W-1", name: "Mixer" },
  { id: "W-2", name: "Oven" },
];

function renderWidget(id: string, onBack: () => void = () => {}) {
  return render(
    <RecordRoute items={widgets} id={id} kind="Widget" onBack={onBack}>
      {(widget) => <h1>{widget.name}</h1>}
    </RecordRoute>
  );
}

describe("RecordRoute", () => {
  it("renders the view for the item the id names", () => {
    renderWidget("W-2");

    expect(screen.getByRole("heading", { name: "Oven" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Back to list" })).toBeNull();
  });

  it("names an id the collection does not have", () => {
    renderWidget("W-404");

    expect(
      screen.getByRole("heading", { name: "Widget W-404 not found" })
    ).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Oven" })).toBeNull();
  });

  it("sends the not-found back link through the one callback", async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    renderWidget("W-404", onBack);

    await user.click(screen.getByRole("button", { name: "Back to list" }));

    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
