/**
 * Saved views for every DataList: `GET /admin/saved-views?resource=`, `POST`, `PATCH /:id`, `DELETE /:id`.
 */
import type { SavedView, SavedViewsSource } from "@/components/data-list/list-extras";
import { api, type DataResponse } from "./client";
import type { UserSummary } from "./settings";

export interface SavedViewDto {
  id: string;
  resource: string;
  name: string;
  query: Record<string, unknown>;
  isShared: boolean;
  owner: UserSummary;
  isOwner: boolean;
  createdAt: string;
  updatedAt: string;
}

export const savedViewKeys = {
  all: ["saved-views"] as const,
  resource: (resource: string) => [...savedViewKeys.all, resource] as const,
};

function toView(v: SavedViewDto): SavedView {
  const query: Record<string, string | string[]> = {};
  for (const [k, val] of Object.entries(v.query ?? {})) {
    if (Array.isArray(val)) query[k] = val.map(String);
    else if (val !== null && val !== undefined) query[k] = String(val);
  }
  return {
    id: v.id,
    name: v.name,
    query,
    isShared: v.isShared,
    isMine: v.isOwner,
    ownerName: v.owner?.fullName,
  };
}

export async function listSavedViews(resource: string): Promise<SavedView[]> {
  const res = await api.get<DataResponse<SavedViewDto[]>>("/admin/saved-views", { query: { resource } });
  return res.data.map(toView);
}

export function createSavedView(body: {
  resource: string;
  name: string;
  query: Record<string, unknown>;
  isShared: boolean;
}) {
  return api.post<DataResponse<SavedViewDto>>("/admin/saved-views", body);
}

export function updateSavedView(
  id: string,
  body: { name?: string; query?: Record<string, unknown>; isShared?: boolean },
) {
  return api.patch<DataResponse<SavedViewDto>>(`/admin/saved-views/${id}`, body);
}

export function deleteSavedView(id: string) {
  return api.delete<void>(`/admin/saved-views/${id}`);
}

/** DataList `savedViews` source bound to one list resource. */
export function savedViewsSource(resource: string): SavedViewsSource {
  return {
    queryKey: savedViewKeys.resource(resource),
    queryFn: () => listSavedViews(resource),
    onSave: (input) => createSavedView({ resource, ...input }),
    onDelete: (view) => deleteSavedView(view.id),
  };
}
