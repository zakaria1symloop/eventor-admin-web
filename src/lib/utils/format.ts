/** Formatting helpers shared by cells and forms. Arabic keeps western digits (nu-latn). */

export function intlLocale(locale: string) {
  return locale === "ar" ? "ar-DZ-u-nu-latn" : "en-GB";
}

/** "45000.00" → "45 000 DA" / "45 000 دج". Decimals are dropped when zero. */
export function formatMoney(value: string | number | null | undefined, locale: string): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return String(value);
  const hasCents = Math.round(n * 100) % 100 !== 0;
  const body = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: 2,
  })
    .format(n)
    .replace(/,/g, " ");
  return locale === "ar" ? `${body} دج` : `${body} DA`;
}

/** Compact money for KPI tiles: 1920000 → "1.92M DA". */
export function formatCompactMoney(value: string | number, locale: string): string {
  const n = typeof value === "number" ? value : Number(value);
  const body = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 }).format(n);
  return locale === "ar" ? `${body} دج` : `${body} DA`;
}

export function formatNumber(value: number, locale: string): string {
  return new Intl.NumberFormat(intlLocale(locale)).format(value);
}

export function formatDate(value: string | Date, locale: string): string {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export function formatDateTime(value: string | Date, locale: string): string {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

/** "2 days ago" / "in 3 hours" / "now". */
export function formatRelative(value: string | Date, locale: string, now: Date = new Date()): string {
  const diff = (new Date(value).getTime() - now.getTime()) / 1000;
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat(intlLocale(locale), { numeric: "auto" });
  if (abs < 45) return rtf.format(0, "second");
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["minute", 60],
    ["hour", 3600],
    ["day", 86400],
    ["week", 604800],
    ["month", 2592000],
    ["year", 31536000],
  ];
  let chosen: [Intl.RelativeTimeFormatUnit, number] = units[0];
  for (const u of units) if (abs >= u[1]) chosen = u;
  return rtf.format(Math.round(diff / chosen[1]), chosen[0]);
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

/** Countdown text for lockouts: 905 → "15:05". */
export function formatCountdown(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * Algerian phone → E.164 (+213XXXXXXXXX).
 * Accepts "0550 12 34 56", "550123456", "213550123456", "+213 550 12 34 56", "00213…".
 * Returns null when it can't be normalised.
 */
export function normalizeDzPhone(raw: string): string | null {
  let d = raw.replace(/[^\d+]/g, "");
  if (d.startsWith("+")) d = d.slice(1);
  else if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("213")) d = d.slice(3);
  if (d.startsWith("0")) d = d.slice(1);
  if (!/^\d{8,9}$/.test(d)) return null;
  return `+213${d}`;
}

/** "+213555123456" → "+213 555 12 34 56" (other values unchanged). */
export function formatDzPhone(phone: string): string {
  const m = /^\+213(\d{3})(\d{2})(\d{2})(\d{2})$/.exec(phone);
  return m ? `+213 ${m[1]} ${m[2]} ${m[3]} ${m[4]}` : phone;
}
