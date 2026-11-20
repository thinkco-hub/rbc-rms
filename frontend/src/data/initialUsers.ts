import type { User } from "../types/domain";

// passwordHash values are SHA-256 of the demo passwords — see src/utils/auth.ts hashPassword().
// Demo credentials (prototype only):
//   rbc.admin@gmail.com     / admin123    (Super Admin / Owner)
//   admin@rbc.test          / admin123    (Admin)
//   rd@rbc.test             / rnd123      (Research and Development)
//   sales@rbc.test          / sales123    (Sales and Marketing)
//   kitchen@rbc.test        / kitchen123  (Kitchen)
//   cashier@rbc.test        / cashier123  (Cashier)
export const initialUsers: User[] = [
  {
    id: "user-1",
    name: "Owner",
    email: "rbc.admin@gmail.com",
    passwordHash:
      "240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9",
    role: "super_admin",
    active: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: "user-2",
    name: "Admin",
    email: "admin@rbc.test",
    passwordHash:
      "240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9",
    role: "admin",
    active: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: "user-3",
    name: "R&D Lead",
    email: "rd@rbc.test",
    passwordHash:
      "f1f55a0a37dbe36a09786d53047810155f8948150a406809d61040c77a6fe0e5",
    role: "research_development",
    active: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: "user-4",
    name: "Sales & Marketing",
    email: "sales@rbc.test",
    passwordHash:
      "6bc0a63cb29c92306020c0a6bbc358cc4628db277dc06e253535e126517ad637",
    role: "sales_marketing",
    active: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: "user-5",
    name: "Kitchen Staff",
    email: "kitchen@rbc.test",
    passwordHash:
      "e5cf9d8e3884bb2a899372b9fcb87af6fcd9b3aad2ff07e2c076b4a71ffad67c",
    role: "kitchen",
    active: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: "user-6",
    name: "Cashier",
    email: "cashier@rbc.test",
    passwordHash:
      "b4c94003c562bb0d89535eca77f07284fe560fd48a7cc1ed99f0a56263d616ba",
    role: "cashier",
    active: true,
    createdAt: new Date().toISOString(),
  },
];
