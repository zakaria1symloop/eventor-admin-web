import { z } from "zod";
import { isStrongPassword } from "@/lib/api/auth";

type T = (key: string, values?: Record<string, string | number>) => string;

/**
 * New password + confirm (≥ 10 chars, a letter and a digit — same rule as the API's PASSWORD_WEAK).
 * `max`: an upper length limit (the app accounts' 128), off by default.
 */
export function newPasswordSchema(tv: T, opts: { max?: number } = {}) {
  const required = z.string().min(1, tv("required"));
  const bounded = opts.max ? required.max(opts.max, tv("passwordTooLong", { max: opts.max })) : required;
  return z
    .object({
      password: bounded.refine(isStrongPassword, tv("passwordWeak")),
      confirm: z.string().min(1, tv("required")),
    })
    .refine((v) => v.password === v.confirm, { path: ["confirm"], message: tv("passwordMismatch") });
}
