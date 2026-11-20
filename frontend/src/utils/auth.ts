/** Hashes a password with SHA-256 via the browser's Web Crypto API. */
export async function hashPassword(password: string): Promise<string> {
  const bytes = new TextEncoder().encode(password);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function verifyPassword(
  password: string,
  passwordHash: string
): Promise<boolean> {
  return (await hashPassword(password)) === passwordHash;
}
