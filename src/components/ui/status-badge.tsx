"use client";

import { useTranslations } from "next-intl";
import { Pill, type Tone } from "./badge";

/**
 * One tone map per domain (dashboard-components §4). Labels come from
 * `status.<domain>.<status>` messages when present, otherwise a humanised key.
 */
export const statusTones = {
  user: { active: "green", blocked: "red", unverified_phone: "gray", deleted: "gray" },
  document: {
    pending: "amber",
    in_review: "amber",
    approved: "green",
    verified: "green",
    rejected: "red",
    not_required: "gray",
  },
  service: {
    published: "green",
    unavailable: "gray",
    waiting_approval: "amber",
    hidden: "red",
    removed: "red",
    draft: "gray",
    provider_blocked: "red",
  },
  pack: {
    published: "green",
    draft: "gray",
    unpublished: "gray",
    needs_attention: "red",
    provider_blocked: "red",
  },
  booking: { pending: "amber", accepted: "green", declined: "red", cancelled: "gray", completed: "blue" },
  request: {
    pending: "amber",
    in_progress: "blue",
    changes_requested: "amber",
    approved: "green",
    rejected: "red",
    completed: "blue",
    cancelled: "gray",
  },
  dispute: { open: "amber", in_review: "blue", resolved: "green", closed: "gray" },
  form: { draft: "gray", published: "green", closed: "red" },
  review: { published: "green", reported: "red", hidden: "gray", redacted: "amber" },
  report: { open: "red", resolved: "green", dismissed: "gray" },
  role: { client: "blue", provider: "brand", admin: "gray" },
  verification: {
    waiting: "amber",
    resubmitted: "brand",
    approved: "green",
    rejected: "red",
    incomplete: "gray",
  },
  auditLevel: { info: "blue", normal: "gray", sensitive: "red", security: "amber" },
  wilaya: { open: "green", closed: "gray" },
} as const satisfies Record<string, Record<string, Tone>>;

export type StatusDomain = keyof typeof statusTones;

function humanise(value: string) {
  const s = value.replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function StatusBadge({
  domain,
  status,
  label,
}: {
  domain: StatusDomain;
  status: string;
  label?: string;
}) {
  const t = useTranslations();
  const map = statusTones[domain] as Record<string, Tone>;
  const tone = map[status] ?? "gray";
  const key = `status.${domain}.${status}`;
  const text = label ?? (t.has(key) ? t(key) : humanise(status));
  return <Pill tone={tone}>{text}</Pill>;
}
