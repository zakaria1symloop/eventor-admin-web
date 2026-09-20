import { redirect } from "@/i18n/navigation";

/** `/reviews/:id` (links from the API: activity, notifications, reports) opens REV-02 over the list. */
export default async function Page({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  redirect({ href: `/reviews?review=${encodeURIComponent(id)}`, locale });
}
