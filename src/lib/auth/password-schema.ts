import { z } from "zod";
import { isStrongPassword } from "@/lib/api/auth";

type T = (key: string) => string;

/** New password + confirm (≥ 10 chars, a letter and a digit — same rule as the API's PASSWORD_WEAK). */
export function newPasswordSchema(tv: T) {
  return z
    .object({
      password: z.string().min(1, tv("required")).refine(isStrongPassword, tv("passwordWeak")),
      confirm: z.string().min(1, tv("required")),
    })
    .refine((v) => v.password === v.confirm, { path: ["confirm"], message: tv("passwordMismatch") });
}
