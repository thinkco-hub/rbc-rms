import { useEffect, useState } from "react";
import { api } from "../api/client";
import { recordAuditEvent } from "../utils/auditLog";
import { canAccessTab } from "../utils/permissions";
import type { Client, ClientFormData, ClientId, User } from "../types/domain";

interface BackendClient {
  id: number;
  name: string;
  contact: string;
  email: string;
  address: string;
  standing_order: string;
}

/** UI client ids keep the CL-001 display format; the number is the backend id. */
export const toClientId = (id: number): ClientId => `CL-${String(id).padStart(3, "0")}`;
export const backendClientId = (id: ClientId) => Number(id.replace(/^CL-/, ""));

const toClient = (client: BackendClient): Client => ({
  id: toClientId(client.id),
  name: client.name,
  contact: client.contact,
  email: client.email,
  address: client.address,
  standingOrder: client.standing_order,
});

interface UseClientsOptions {
  currentUser: User | null;
  /** Seeded clients; a test fixture replaces the server load. */
  clients?: Client[];
}

/**
 * Owns the clients feature, backed by /api/v1/orders/clients/. Which client is
 * on screen is the router's `/clients/:clientId` route, not state held here.
 */
export function useClients({ currentUser, clients: seededClients }: UseClientsOptions) {
  const [clients, setClients] = useState<Client[]>(seededClients ?? []);

  useEffect(() => {
    if (seededClients) return;
    let cancelled = false;
    api
      .get<BackendClient[]>("/api/v1/orders/clients/")
      .then((data) => {
        if (!cancelled) setClients(data.map(toClient));
      })
      .catch(() => {
        if (!cancelled) setClients([]);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const logClientEvent = (
    action: "client.created" | "client.updated",
    clientId: ClientId,
    details: string
  ) => {
    if (!currentUser) return;
    recordAuditEvent({
      userId: currentUser.id,
      userName: currentUser.name,
      userRole: currentUser.role,
      action,
      entityType: "Client",
      entityId: clientId,
      details,
    });
  };

  const addClient = async (data: ClientFormData) => {
    if (!currentUser || !canAccessTab(currentUser.role, "clients")) return;
    const created = await api.post<BackendClient>("/api/v1/orders/clients/", {
      name: data.name,
      contact: data.contact,
      email: data.email,
      address: data.address,
      standing_order: data.standingOrder,
    });
    const client = toClient(created);
    setClients((prev) => [...prev, client]);
    logClientEvent("client.created", client.id, `Added client ${client.id} (${data.name})`);
  };

  const updateClient = async (id: ClientId, data: Partial<ClientFormData>) => {
    const updated = await api.patch<BackendClient>(`/api/v1/orders/clients/${backendClientId(id)}/`, {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.contact !== undefined && { contact: data.contact }),
      ...(data.email !== undefined && { email: data.email }),
      ...(data.address !== undefined && { address: data.address }),
      ...(data.standingOrder !== undefined && { standing_order: data.standingOrder }),
    });
    const client = toClient(updated);
    setClients((prev) => prev.map((c) => (c.id === id ? client : c)));
    logClientEvent("client.updated", id, `Updated client ${id}`);
  };

  return { clients, addClient, updateClient };
}
