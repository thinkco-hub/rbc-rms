import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { Client, ClientFormData, ClientId } from "../types/domain";

interface BackendClient {
  id: number;
  name: string;
  contact: string;
  email: string;
  address: string;
  standing_order: string;
}

const toClient = (client: BackendClient): Client => ({
  id: `CL-${String(client.id).padStart(3, "0")}`,
  name: client.name,
  contact: client.contact,
  email: client.email,
  address: client.address,
  standingOrder: client.standing_order,
});

const backendId = (id: ClientId) => Number(id.replace(/^CL-/, ""));

export function useClients() {
  const [clients, setClients] = useState<Client[]>([]);
  const [viewingClient, setViewingClient] = useState<Client | null>(null);

  useEffect(() => {
    api.get<BackendClient[]>("/api/v1/orders/clients/")
      .then((data) => setClients(data.map(toClient)))
      .catch(() => setClients([]));
  }, []);

  const addClient = async (data: ClientFormData) => {
    const created = await api.post<BackendClient>("/api/v1/orders/clients/", {
      name: data.name,
      contact: data.contact,
      email: data.email,
      address: data.address,
      standing_order: data.standingOrder,
    });
    setClients((prev) => [...prev, toClient(created)]);
  };

  const updateClient = async (id: ClientId, data: Partial<ClientFormData>) => {
    const updated = await api.patch<BackendClient>(`/api/v1/orders/clients/${backendId(id)}/`, {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.contact !== undefined && { contact: data.contact }),
      ...(data.email !== undefined && { email: data.email }),
      ...(data.address !== undefined && { address: data.address }),
      ...(data.standingOrder !== undefined && { standing_order: data.standingOrder }),
    });
    const client = toClient(updated);
    setClients((prev) => prev.map((item) => (item.id === id ? client : item)));
    setViewingClient((prev) => (prev?.id === id ? client : prev));
  };

  return {
    clients,
    viewingClient,
    setViewingClient,
    addClient,
    updateClient,
    clearViewingClient: () => setViewingClient(null),
  };
}
