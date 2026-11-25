"use client";

import { useQuery } from "@tanstack/react-query";
import { getUser, userKeys } from "@/lib/api/users";

/**
 * `GET /admin/users/:id` (profile, edit drawer). Disabled when `id` is empty.
 * `includeDeleted` (the profile): a deleted account opens read-only instead of 404.
 */
export function useUser(id: string | null | undefined, opts: { includeDeleted?: boolean } = {}) {
  return useQuery({
    queryKey: [...userKeys.detail(id ?? ""), opts.includeDeleted ? "with-deleted" : "active"],
    queryFn: () => (opts.includeDeleted ? getUser(id!, { includeDeleted: true }) : getUser(id!)),
    enabled: !!id,
  });
}
