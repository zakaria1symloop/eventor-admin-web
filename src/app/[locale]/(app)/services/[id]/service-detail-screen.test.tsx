import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import type { ServiceDetail } from "@/lib/api/services";
import { ServiceDetailScreen } from "./service-detail-screen";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));
vi.mock("./availability-calendar", () => ({ AvailabilityCalendar: () => null }));
vi.mock("../../reviews/reviews-card", () => ({ ReviewsCard: () => null }));

const provider = {
  id: "p1",
  fullName: "Karim Haddad",
  businessName: "Traiteur El Djazair",
  status: "active" as const,
  verificationStatus: "verified" as const,
};

/** A service an admin (Omar Belaid) hid: the provider must not read as the one who hid it. */
const hiddenService = {
  id: "s1-0000-0000",
  titleEn: "Wedding buffet",
  titleAr: "بوفيه الأعراس",
  coverUrl: null,
  category: { id: "c1", nameEn: "Catering", nameAr: "تموين" },
  provider,
  basePrice: "50000.00",
  priceType: "fixed",
  rating: 0,
  ratingCount: 0,
  bookingsCount: 0,
  status: "hidden",
  isFeatured: false,
  visibleInApp: false,
  wilayas: [],
  createdAt: "2026-11-01T10:00:00.000Z",
  updatedAt: "2026-11-20T10:00:00.000Z",
  descriptionEn: "",
  descriptionAr: "",
  cancellationPolicyEn: null,
  cancellationPolicyAr: null,
  facts: [],
  onePerDay: false,
  maxEventsPerDay: null,
  maxGuests: null,
  allowSimultaneous: false,
  concurrentClients: 1,
  availableFrom: null,
  availableUntil: null,
  hours: [],
  featuredPosition: null,
  favouritesCount: 0,
  extras: [],
  photos: [],
  wilayaDetails: [],
  hidden: {
    reason: "policy_violation",
    message: null,
    allowResubmit: true,
    hiddenBy: { id: "a1", fullName: "Omar Belaid" },
    hiddenAt: "2026-11-20T10:00:00.000Z",
  },
  visibilityReasons: ["not_published"],
  publishMissing: [],
  stats: {
    bookings: { pending: 0, accepted: 0, declined: 0, cancelled: 0, completed: 0, total: 0 },
    revenue: "0.00",
    ratingBreakdown: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    favourites: 0,
    packsCount: 0,
    packs: [],
  },
  providerCard: {
    ...provider,
    avatarUrl: null,
    phone: null,
    email: "traiteur@example.test",
    rating: 0,
    ratingCount: 0,
    acceptingBookings: true,
    servicesCount: 1,
    packsCount: 0,
    bookingsCount: 0,
    completedBookingsCount: 0,
  },
} as unknown as ServiceDetail;

vi.mock("@/lib/api/services", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/services")>()),
  getService: () => Promise.resolve(hiddenService),
}));

describe("M-21 service hidden by an admin: the header names the right actor", () => {
  it("EN: the provider is introduced as “Offered by”, the admin is named in the banner", async () => {
    renderWithProviders(<ServiceDetailScreen id="s1-0000-0000" />);
    const providerLink = (await screen.findAllByRole("link", { name: /Traiteur El Djazair/ }))[0];
    expect(providerLink.parentElement).toHaveTextContent(/^Offered by Karim Haddad · Traiteur El Djazair$/);
    expect(screen.getByText(/Hidden by an admin/)).toBeInTheDocument();
    expect(screen.getByText(/by Omar Belaid on/)).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(/Hidden\s*by\s*(Karim Haddad|Traiteur El Djazair)/);
  });

  it("AR: the same, in Arabic", async () => {
    renderWithProviders(<ServiceDetailScreen id="s1-0000-0000" />, { locale: "ar" });
    const providerLink = (await screen.findAllByRole("link", { name: /Traiteur El Djazair/ }))[0];
    expect(providerLink.parentElement).toHaveTextContent(/^مقدَّمة من Karim Haddad · Traiteur El Djazair$/);
    expect(screen.getByText(/أخفاها مشرف/)).toBeInTheDocument();
    expect(screen.getByText(/بواسطة Omar Belaid/)).toBeInTheDocument();
  });
});
