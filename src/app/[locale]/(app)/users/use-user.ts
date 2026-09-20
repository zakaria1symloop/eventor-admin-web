"use client";

import { useQuery } from "@tanstack/react-query";
import { getUser, userKeys } from "@/lib/api/users";

/** `GET /admin/users/:id` (profile, edit drawer). Disabled when `id` is empty. */
export function useUser(id: string | null | undefined) {
  return useQuery({
    queryKey: userKeys.detail(id ?? ""),
    queryFn: () => getUser(id!),
    enabled: !!id,
  });
}
