import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import type { ReactNode } from "react";
import CrashFallback from "./components/common/CrashFallback";
import { router } from "./router";

/**
 * A throw is only worth testing through the mechanism that catches it, so this
 * builds a data router and throws from its element — the same shape
 * src/router.tsx hands RouterProvider, with a broken `App`.
 */
function Boom(): ReactNode {
  throw new Error("threw while rendering");
}

function renderCrash() {
  return render(
    <RouterProvider
      router={createMemoryRouter(
        [{ path: "/*", element: <Boom />, errorElement: <CrashFallback /> }],
        { initialEntries: ["/pos"] }
      )}
    />
  );
}

// React Router logs a boundary's catch to console.error. The throw belongs to
// these tests, and jsdom still prints its own copy of the stack.
beforeEach(() => vi.spyOn(console, "error").mockImplementation(() => {}));
afterEach(() => vi.restoreAllMocks());

describe("crash boundary", () => {
  it("lands an uncaught render throw on the crash screen instead of a blank page", async () => {
    renderCrash();

    expect(
      await screen.findByRole("heading", { name: "Something went wrong" })
    ).toBeInTheDocument();
    // The message the router handed the boundary, printed small and on purpose:
    // a store reporting a crash needs something to read out.
    expect(screen.getByText("threw while rendering")).toBeInTheDocument();
  });

  /**
   * The copy is the feature here: nothing can be recovered, so it must not read
   * as though the entry survived. The exit has to work with no shell under it,
   * and after `App` unmounted there is no session to return to — `/` is the
   * sign-in screen.
   */
  it("says nothing was kept and exits to the sign-in screen", async () => {
    renderCrash();

    await screen.findByRole("heading", { name: "Something went wrong" });
    expect(screen.getByText(/nothing from\s+this session is kept/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to sign in" })).toHaveAttribute(
      "href",
      "/"
    );
  });

  /**
   * The fallback only stands between a throw and a blank page if the real router
   * mounts it. This is the one assertion that fails when the seam is removed.
   */
  it("hangs the fallback on the app's own catch-all route", () => {
    const [root] = router.routes;
    expect(root.path).toBe("/*");
    expect(root.errorElement).toBeDefined();
  });
});
