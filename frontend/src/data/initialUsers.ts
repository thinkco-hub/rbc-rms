import type { User } from "../types/domain";

// passwordHash is SHA-256("admin123") — see src/utils/auth.ts hashPassword()
export const initialUsers: User[] = [
  {
    id: "user-1",
    name: "Admin",
    email: "rbc.admin@gmail.com",
    passwordHash:
      "240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9",
    role: "admin",
    active: true,
    createdAt: new Date().toISOString(),
  },
];
