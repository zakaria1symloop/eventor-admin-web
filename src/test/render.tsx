import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, type RenderOptions } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { withNuqsTestingAdapter, type OnUrlUpdateFunction } from "nuqs/adapters/testing";
import type { ReactElement, ReactNode } from "react";
import en from "../../messages/en.json";
import ar from "../../messages/ar.json";

export function renderWithProviders(
  ui: ReactElement,
  {
    locale = "en",
    searchParams = "",
    onUrlUpdate,
    ...options
  }: { locale?: "en" | "ar"; searchParams?: string; onUrlUpdate?: OnUrlUpdateFunction } & RenderOptions = {},
) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const Nuqs = withNuqsTestingAdapter({ searchParams, onUrlUpdate, hasMemory: true });
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <NextIntlClientProvider locale={locale} messages={locale === "ar" ? ar : en} timeZone="Africa/Algiers">
        <QueryClientProvider client={queryClient}>
          <Nuqs>{children}</Nuqs>
        </QueryClientProvider>
      </NextIntlClientProvider>
    );
  }
  return { queryClient, ...render(ui, { wrapper: Wrapper, ...options }) };
}
