import { useState } from "react";
import { initialClients } from "../data/initialClients";
import type { Client, ClientFormData, ClientId } from "../types/domain";

/**
 * Owns the clients feature: the client list and the client detail panel
 * (viewingClient).
 */
export function useClients() {
  const [clients, setClients] = useState<Client[]>(initialClients);
  const [viewingClient, setViewingClient] = useState<Client | null>(null);

  const addClient = (data: ClientFormData) => {
    setClients((prev) => [
      ...prev,
      { id: `CL-${String(prev.length + 1).padStart(3, "0")}`, ...data },
    ]);
  };

  const updateClient = (id: ClientId, data: Partial<ClientFormData>) => {
    setClients((prev) => prev.map((c) => (c.id === id ? { ...c, ...data } : c)));
    setViewingClient((prev) => (prev && prev.id === id ? { ...prev, ...data } : prev));
  };

  const clearViewingClient = () => setViewingClient(null);

  return {
    clients,
    viewingClient,
    setViewingClient,
    addClient,
    updateClient,
    clearViewingClient,
  };
}