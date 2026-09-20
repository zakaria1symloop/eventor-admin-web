import { setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { UsersDemo } from "./users-demo";

/** /[locale]/_demo/data-list — exercises DataList + ConfirmDialog + Toast with mock data. */
export default async function DataListDemoPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <Suspense>
      <UsersDemo />
    </Suspense>
  );
}
