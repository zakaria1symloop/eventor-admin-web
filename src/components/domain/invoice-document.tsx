"use client";

import { useLocale, useTranslations } from "next-intl";
import type { Invoice } from "@/lib/api/bookings";
import { formatDate, formatDzPhone, formatMoney } from "@/lib/utils/format";

/** Invoice issued by Eventor (BKG-07): issuer, billed to, provider, lines, total, fee. */
export function InvoiceDocument({ invoice: inv }: { invoice: Invoice }) {
  const t = useTranslations("domain.invoice");
  const locale = useLocale();
  const money = (v: string) => formatMoney(v, locale).replace(/^-/, "− ");
  const title = locale === "ar" ? inv.titleAr || inv.titleEn : inv.titleEn;
  const filled = (v: string | null | undefined) => (v ?? "").trim();
  const issuerLines = [
    // the brand line already says "Eventor"
    filled(inv.issuer.name).toLowerCase() === "eventor" ? "" : filled(inv.issuer.name),
    filled(inv.issuer.address),
    [
      filled(inv.issuer.nif) && `NIF ${filled(inv.issuer.nif)}`,
      filled(inv.issuer.rc) && `RC ${filled(inv.issuer.rc)}`,
    ]
      .filter(Boolean)
      .join(" · "),
  ].filter(Boolean);
  const party = (p: Invoice["client"]) =>
    [p.businessName ? p.name : null, p.phone ? formatDzPhone(p.phone) : null, p.email]
      .filter(Boolean)
      .join(" · ");
  return (
    <article aria-label={t("label", { number: inv.number })} className="flex flex-col gap-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-22 font-semibold text-brand">Eventor</div>
          {/* L-27: only the issuer fields that are filled — no bare "NIF · RC" labels or separators. */}
          {issuerLines.map((line) => (
            <div key={line} className="text-12 text-muted">
              {line}
            </div>
          ))}
        </div>
        <div className="text-end">
          <div className="text-15 font-semibold text-ink">
            {t("title")} {inv.number}
            {inv.version > 1 && <span className="ms-1 text-12 text-muted">v{inv.version}</span>}
          </div>
          <div className="text-12 text-muted">
            {t("issued", { date: formatDate(inv.issuedAt, locale), reference: inv.bookingReference })}
          </div>
        </div>
      </header>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <div className="text-11 font-medium tracking-wide text-muted uppercase">{t("billedTo")}</div>
          <div className="text-14 font-semibold text-ink">{inv.client.name}</div>
          <div className="text-12 text-muted">{party(inv.client)}</div>
        </div>
        <div>
          <div className="text-11 font-medium tracking-wide text-muted uppercase">{t("provider")}</div>
          <div className="text-14 font-semibold text-ink">
            {inv.provider.businessName ?? inv.provider.name}
          </div>
          <div className="text-12 text-muted">{party(inv.provider)}</div>
        </div>
      </div>
      <table className="w-full overflow-hidden rounded-lg border border-border text-13">
        <caption className="sr-only">{title}</caption>
        <tbody className="divide-y divide-border">
          {inv.lines.map((l, i) => (
            <tr key={i}>
              <td className="px-4 py-2.5 text-ink-2">
                {l.label}
                {i === 0 ? ` · ${formatDate(inv.eventDate, locale)}` : ""}
                {l.quantity > 1 ? ` × ${l.quantity}` : ""}
              </td>
              <td className="px-4 py-2.5 text-end font-medium text-ink tabular-nums" dir="ltr">
                {money(l.amount)}
              </td>
            </tr>
          ))}
          <tr className="bg-canvas">
            <th scope="row" className="px-4 py-2.5 text-start font-semibold text-ink">
              {t("total")}
            </th>
            <td className="px-4 py-2.5 text-end font-semibold text-ink tabular-nums" dir="ltr">
              {money(inv.total)}
            </td>
          </tr>
          <tr>
            <td className="px-4 py-2.5 text-ink-2">{t("fee", { percent: Number(inv.feePercent) })}</td>
            <td className="px-4 py-2.5 text-end font-medium text-ink tabular-nums" dir="ltr">
              {money(inv.feeAmount)}
            </td>
          </tr>
        </tbody>
      </table>
      <p className="text-12 text-muted">{t("cashNote")}</p>
    </article>
  );
}
