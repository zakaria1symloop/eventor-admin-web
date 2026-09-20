import type { ListParams } from "@/components/data-list/use-list-state";
import type { ListResponse } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";

export interface MockUser {
  id: string;
  name: string;
  sub: string;
  role: "client" | "provider" | "admin";
  status: "active" | "blocked" | "unverified_phone";
  wilaya: string;
  joinedAt: string;
}

const seed: Omit<MockUser, "id">[] = [
  {
    name: "Amina Benali",
    sub: "amina.benali@email.com",
    role: "client",
    status: "active",
    wilaya: "Alger",
    joinedAt: "2026-01-12",
  },
  {
    name: "Karim Belkacem",
    sub: "Studio Lumière",
    role: "provider",
    status: "active",
    wilaya: "Alger",
    joinedAt: "2025-08-18",
  },
  {
    name: "Amine Cherif",
    sub: "Université d'Alger 1",
    role: "client",
    status: "active",
    wilaya: "Alger",
    joinedAt: "2026-03-09",
  },
  {
    name: "Farid Ouali",
    sub: "Salle Yasmine",
    role: "provider",
    status: "active",
    wilaya: "Alger",
    joinedAt: "2025-06-02",
  },
  {
    name: "Nadia Kaci",
    sub: "nadia.kaci@gmail.com",
    role: "client",
    status: "active",
    wilaya: "Oran",
    joinedAt: "2026-02-28",
  },
  {
    name: "Fatima Hadj",
    sub: "Fleurs de Yasmina",
    role: "provider",
    status: "active",
    wilaya: "Constantine",
    joinedAt: "2026-02-21",
  },
  {
    name: "Yacine Meddour",
    sub: "DJ Amine",
    role: "provider",
    status: "blocked",
    wilaya: "Blida",
    joinedAt: "2025-11-14",
  },
  {
    name: "Meriem Saidi",
    sub: "Club Robotique USTHB",
    role: "client",
    status: "active",
    wilaya: "Alger",
    joinedAt: "2025-10-05",
  },
  {
    name: "Lila Hamadi",
    sub: "lila.hamadi@outlook.com",
    role: "client",
    status: "unverified_phone",
    wilaya: "Sétif",
    joinedAt: "2026-03-12",
  },
  {
    name: "Sara Meziane",
    sub: "sara@eventor.dz",
    role: "admin",
    status: "active",
    wilaya: "Alger",
    joinedAt: "2025-07-01",
  },
];

const wilayas = ["Alger", "Oran", "Constantine", "Blida", "Sétif", "Tlemcen"];
const firstNames = [
  "Sofiane",
  "Yasmine",
  "Walid",
  "Lina",
  "Omar",
  "Rania",
  "Hichem",
  "Imane",
  "Samir",
  "Dounia",
];
const lastNames = ["Brahimi", "Khelil", "Saadi", "Mansouri", "Amrouche", "Belaid", "Toumi", "Zerrouki"];

export const mockUsers: MockUser[] = [
  ...seed,
  ...Array.from({ length: 62 }, (_, i) => {
    const name = `${firstNames[i % firstNames.length]} ${lastNames[(i * 3) % lastNames.length]}`;
    const role = i % 3 === 0 ? "provider" : "client";
    const day = String((i % 27) + 1).padStart(2, "0");
    const month = String((i % 12) + 1).padStart(2, "0");
    return {
      name,
      sub: `${name.toLowerCase().replace(" ", ".")}@email.com`,
      role,
      status: i % 11 === 0 ? "blocked" : "active",
      wilaya: wilayas[i % wilayas.length],
      joinedAt: `2025-${month}-${day}`,
    } satisfies Omit<MockUser, "id">;
  }),
].map((u, i) => ({ ...u, id: `usr_${String(i + 1).padStart(4, "0")}` }));

const blocked = new Set<string>();

export function blockMockUsers(ids: string[]) {
  ids.forEach((id) => blocked.add(id));
}

export function unblockMockUsers(ids: string[]) {
  ids.forEach((id) => blocked.delete(id));
}

/** Simulates GET /admin/users with the standard list contract. */
export async function fetchMockUsers(
  params: ListParams,
  { delay = 350 } = {},
): Promise<ListResponse<MockUser>> {
  if (delay) await new Promise((r) => setTimeout(r, delay));
  if (params.q === "error") {
    throw new ApiError({
      status: 500,
      code: "INTERNAL_ERROR",
      message: "Simulated server error",
      requestId: "req_demo01",
    });
  }
  let rows = mockUsers.map((u) => (blocked.has(u.id) ? { ...u, status: "blocked" as const } : u));

  if (params.tab === "clients") rows = rows.filter((u) => u.role === "client");
  if (params.tab === "providers") rows = rows.filter((u) => u.role === "provider");
  if (params.q) {
    const q = params.q.toLowerCase();
    rows = rows.filter((u) => `${u.name} ${u.sub} ${u.id}`.toLowerCase().includes(q));
  }
  for (const [key, value] of Object.entries(params.filters)) {
    const list = Array.isArray(value) ? value : [value];
    rows = rows.filter((u) => list.includes(String(u[key as keyof MockUser])));
  }

  const [field, dir] = (params.sort || "joinedAt:desc").split(":");
  const key = (field === "name" ? "name" : "joinedAt") as keyof MockUser;
  rows = [...rows].sort((a, b) => String(a[key]).localeCompare(String(b[key])) * (dir === "desc" ? -1 : 1));

  const total = rows.length;
  const start = (params.page - 1) * params.limit;
  return {
    data: rows.slice(start, start + params.limit),
    meta: {
      page: params.page,
      limit: params.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / params.limit)),
    },
  };
}
