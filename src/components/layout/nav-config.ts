import {
  Check,
  Briefcase,
  CalendarDays,
  FileText,
  LayoutGrid,
  GraduationCap,
  House,
  Layers,
  MapPin,
  MessageCircle,
  Settings,
  Star,
  TriangleAlert,
  User,
  type LucideIcon,
} from "lucide-react";

export type NavKey =
  | "overview"
  | "users"
  | "verifications"
  | "services"
  | "packs"
  | "bookings"
  | "disputes"
  | "academicRequests"
  | "reviews"
  | "messages"
  | "categories"
  | "locations"
  | "settings"
  | "activityLog";

export interface NavItem {
  key: NavKey;
  href: string;
  icon: LucideIcon;
  /** build-plan module that ships this screen */
  module: number;
}

export interface NavGroup {
  key: "overview" | "manage" | "setup";
  items: NavItem[];
}

export const navGroups: NavGroup[] = [
  { key: "overview", items: [{ key: "overview", href: "/", icon: House, module: 13 }] },
  {
    key: "manage",
    items: [
      { key: "users", href: "/users", icon: User, module: 4 },
      { key: "verifications", href: "/verifications", icon: Check, module: 5 },
      { key: "services", href: "/services", icon: Briefcase, module: 6 },
      { key: "packs", href: "/packs", icon: Layers, module: 7 },
      { key: "bookings", href: "/bookings", icon: CalendarDays, module: 8 },
      { key: "disputes", href: "/disputes", icon: TriangleAlert, module: 9 },
      { key: "academicRequests", href: "/academic-requests", icon: GraduationCap, module: 10 },
      { key: "reviews", href: "/reviews", icon: Star, module: 12 },
      { key: "messages", href: "/messages", icon: MessageCircle, module: 11 },
    ],
  },
  {
    key: "setup",
    items: [
      { key: "categories", href: "/categories", icon: LayoutGrid, module: 3 },
      { key: "locations", href: "/locations", icon: MapPin, module: 3 },
      { key: "settings", href: "/settings", icon: Settings, module: 2 },
      { key: "activityLog", href: "/activity-log", icon: FileText, module: 2 },
    ],
  },
];

export const allNavItems = navGroups.flatMap((g) => g.items);

export function findActiveNav(pathname: string): NavKey | undefined {
  if (pathname === "/" || pathname === "") return "overview";
  const match = allNavItems
    .filter((i) => i.href !== "/")
    .find((i) => pathname === i.href || pathname.startsWith(`${i.href}/`));
  return match?.key;
}
