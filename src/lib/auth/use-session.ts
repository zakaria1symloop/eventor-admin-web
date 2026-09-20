"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@/i18n/navigation";
import { authKeys, getMe, logout, type AdminMe } from "@/lib/api/auth";
import { tokenStore } from "@/lib/api/token";

/** Current admin (GET /admin/me). Enabled once an access token exists. */
export function useSession({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery<AdminMe>({
    queryKey: authKeys.me(),
    queryFn: getMe,
    enabled: enabled && tokenStore.get() !== null,
    staleTime: 5 * 60_000,
  });
}

/** Sign out: POST /admin/auth/logout, drop the token and cached data, go to login. */
export function useSignOut() {
  const queryClient = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationFn: logout,
    onSettled: () => {
      tokenStore.clear();
      queryClient.clear();
      router.replace("/login");
    },
  });
}
