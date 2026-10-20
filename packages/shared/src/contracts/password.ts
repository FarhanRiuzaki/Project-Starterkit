import { z } from "zod";

// Own module so users.ts can take it without importing auth.ts, which imports users.ts (AuthContextDto).
// auth.ts re-exports it; the schema is emitted from there.
export const Password = z.string().min(12).max(128);
