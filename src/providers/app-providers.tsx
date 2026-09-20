"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { useState, type ReactNode } from "react";
import { Toaster } from "@/components/feedback/toast";
import { setApiLocale } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import { getDirection } from "@/i18n/routing";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
          // Don't retry client errors (4xx); retry network/5xx once.
          if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
          return failureCount < 1;
        },
      },
    },
  });
}

export function AppProviders({ locale, children }: { locale: string; children: ReactNode }) {
  const [queryClient] = useState(makeQueryClient);
  setApiLocale(locale);

  return (
    <NuqsAdapter>
      <QueryClientProvider client={queryClient}>
        {children}
        <Toaster dir={getDirection(locale)} />
      </QueryClientProvider>
    </NuqsAdapter>
  );
}
