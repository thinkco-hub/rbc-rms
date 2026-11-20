import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { initialClients } from "../data/initialClients";
import { initialUsers } from "../data/initialUsers";
import { signInFake } from "../test/fake-api";
import { useClients } from "./useClients";
import type { ClientFormData, User } from "../types/domain";

const FORM: ClientFormData = {
  name: "Walk-in Guest",
  contact: "09171234567",
  email: "",
  address: "",
  standingOrder: "",
};

function userFor(email: string): User {
  const seeded = initialUsers.find((u) => u.email === email);
  if (!seeded) throw new Error(`No seeded user ${email}`);
  return seeded;
}

/** The count after one create attempt, read from the hook the shell mounts. */
async function afterAdd(currentUser: User | null): Promise<number> {
  if (currentUser) signInFake(currentUser.email);
  const view = renderHook(() => useClients({ currentUser, clients: initialClients }));
  await act(async () => {
    await view.result.current.addClient(FORM);
  });
  return view.result.current.clients.length;
}

describe("addClient capability check", () => {
  /**
   * The POS overlay is not the guard: a cashier-role caller that reaches the
   * mutation directly still cannot append to the client collection.
   */
  it("refuses a role with no Clients tab", async () => {
    expect(await afterAdd(userFor("cashier@rbc.test"))).toBe(initialClients.length);
    expect(await afterAdd(userFor("kitchen@rbc.test"))).toBe(initialClients.length);
  });

  it("refuses while nobody is signed in", async () => {
    expect(await afterAdd(null)).toBe(initialClients.length);
  });

  it("accepts a role that owns the Clients tab, with the id the server assigns", async () => {
    signInFake("sales@rbc.test");
    const view = renderHook(() =>
      useClients({ currentUser: userFor("sales@rbc.test"), clients: initialClients })
    );
    await act(async () => {
      await view.result.current.addClient(FORM);
    });
    expect(view.result.current.clients).toHaveLength(initialClients.length + 1);
    expect(view.result.current.clients[view.result.current.clients.length - 1]).toMatchObject({
      id: `CL-${String(initialClients.length + 1).padStart(3, "0")}`,
      name: "Walk-in Guest",
    });
  });
});
