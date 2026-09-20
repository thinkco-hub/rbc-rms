import type { Client } from "../types/domain";

// Seed clients (FR-5.1) — extracted from App.jsx (§7 Phase 4)
export const initialClients: Client[] = [
  {
    id: "CL-001",
    name: "Cafe Luna",
    contact: "0917 123 4567",
    email: "orders@cafeluna.ph",
    address: "123 Session Rd, Baguio City",
    standingOrder: "20 Butter Croissants every Monday",
  },
  {
    id: "CL-002",
    name: "Central Cafe",
    contact: "0918 234 5678",
    email: "hello@centralcafe.ph",
    address: "45 Legarda Rd, Baguio City",
    standingOrder: "",
  },
  {
    id: "CL-003",
    name: "Daily Grind",
    contact: "0919 345 6789",
    email: "supply@dailygrind.ph",
    address: "8 Harrison Rd, Baguio City",
    standingOrder: "Weekly assorted pastry box, Fridays",
  },
];