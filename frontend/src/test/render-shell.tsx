import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import type { UserEvent } from "@testing-library/user-event";
import App from "../App";

/**
 * The app shell exactly as src/router.tsx mounts it, on a memory history so a
 * test can start on any route. Tests still move between screens by clicking the
 * sidebar, so they read the same whichever of them owns navigation.
 */
export function renderShell(initialPath = "/") {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <App />
    </MemoryRouter>
  );
}

/** Signs in as any seeded user, by email and demo password. */
export async function signIn(user: UserEvent, email: string, password: string) {
  // The form appears once the app's session check (GET /accounts/me/) settles.
  await screen.findByRole("button", { name: "Log In" });
  // The login form's labels are not associated with its fields, so the email
  // input is the only role query available; the password field is picked by type.
  const passwordField = document.querySelector('input[type="password"]');
  if (!(passwordField instanceof HTMLInputElement)) throw new Error("No password field");

  // The form reopens pre-filled with the last email, so a second sign-in in one
  // test would otherwise append to it.
  const emailField = screen.getByRole("textbox");
  await user.clear(emailField);
  await user.type(emailField, email);
  await user.type(passwordField, password);
  await user.click(screen.getByRole("button", { name: "Log In" }));
}

/** Signs in as the cashier: the most restricted role that still has a POS and Orders. */
export async function signInAsCashier(user: UserEvent) {
  await signIn(user, "cashier@rbc.test", "cashier123");
}
