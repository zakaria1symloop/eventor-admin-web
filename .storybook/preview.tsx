import type { Preview } from "@storybook/nextjs-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { useEffect, useState } from "react";
import en from "../messages/en.json";
import ar from "../messages/ar.json";
import { Toaster } from "../src/components/feedback/toast";
import "../src/app/globals.css";

const preview: Preview = {
  parameters: {
    nextjs: { appDirectory: true, navigation: { pathname: "/users" } },
    layout: "padded",
    backgrounds: { disable: true },
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
    a11y: { test: "todo" },
  },
  globalTypes: {
    locale: {
      description: "Locale / direction",
      toolbar: {
        title: "Locale",
        icon: "globe",
        items: [
          { value: "en", title: "English (LTR)" },
          { value: "ar", title: "العربية (RTL)" },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { locale: "en" },
  decorators: [
    (Story, context) => {
      const locale = (context.globals.locale as "en" | "ar") ?? "en";
      const dir = locale === "ar" ? "rtl" : "ltr";
      const [queryClient] = useState(
        () => new QueryClient({ defaultOptions: { queries: { retry: false } } }),
      );
      useEffect(() => {
        document.documentElement.lang = locale;
        document.documentElement.dir = dir;
        document.body.style.background = "var(--canvas)";
      }, [locale, dir]);
      return (
        <NextIntlClientProvider
          key={locale}
          locale={locale}
          messages={locale === "ar" ? ar : en}
          timeZone="Africa/Algiers"
        >
          <QueryClientProvider client={queryClient}>
            <NuqsTestingAdapter hasMemory>
              <div dir={dir} lang={locale}>
                <Story />
              </div>
              <Toaster dir={dir} />
            </NuqsTestingAdapter>
          </QueryClientProvider>
        </NextIntlClientProvider>
      );
    },
  ],
};

export default preview;
