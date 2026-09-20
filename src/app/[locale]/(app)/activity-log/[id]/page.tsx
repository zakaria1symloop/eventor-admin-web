import { redirect } from "@/i18n/navigation";

/** `/activity-log/:id` (overview `logHref`) opens LOG-02 over the list. */
export default async function Page({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  redirect({ href: `/activity-log?entry=${encodeURIComponent(id)}`, locale });
}
