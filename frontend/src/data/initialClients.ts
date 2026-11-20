import type { Client } from "../types/domain";

// Seed clients (FR-5.1) — extracted from App.jsx (§7 Phase 4)
export const initialClients: Client[] = [
  {
    id: "CL-001",
    name: "Cafe Luna",
    contact: "09171234567",
    email: "orders@cafeluna.ph",
    address: "123 Session Rd, Baguio City",
    standingOrder: "20 Butter Croissants every Monday",
  },
  {
    id: "CL-002",
    name: "Central Cafe",
    contact: "09182345678",
    email: "hello@centralcafe.ph",
    address: "45 Legarda Rd, Baguio City",
    standingOrder: "",
  },
  {
    id: "CL-003",
    name: "Daily Grind",
    contact: "09193456789",
    email: "supply@dailygrind.ph",
    address: "8 Harrison Rd, Baguio City",
    standingOrder: "Weekly assorted pastry box, Fridays",
  },
];