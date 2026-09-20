/**
 * STA-05 exports. `POST /admin/exports { resource, filters, columns, format }` → `{ id, status, fileUrl? }`;
 * poll `GET /admin/exports/:id` until done / failed. 5,000+ rows are queued and emailed.
 */
import { api, type DataResponse } from "./client";

export type ExportFormat = "csv" | "xlsx";
export type ExportStatus = "queued" | "running" | "done" | "failed";

export interface ExportJob {
  id: string;
  resource: string;
  format: ExportFormat;
  status: ExportStatus;
  filters: Record<string, unknown>;
  columns: string[];
  rowCount: number | null;
  fileUrl: string | null;
  emailedAt: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateExportBody {
  resource: string;
  filters: Record<string, unknown>;
  columns?: string[];
  format: ExportFormat;
}

export async function createExport(body: CreateExportBody): Promise<ExportJob> {
  return (await api.post<DataResponse<ExportJob>>("/admin/exports", body)).data;
}

export async function getExport(id: string): Promise<ExportJob> {
  return (await api.get<DataResponse<ExportJob>>(`/admin/exports/${id}`)).data;
}
