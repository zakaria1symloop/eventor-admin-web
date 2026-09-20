"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Ban, Eye, Trash2, UserPlus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { z } from "zod";
import { DataList, type DataColumn, type FilterConfig } from "@/components/data-list";
import { DateCell, UserCell } from "@/components/data-list/cells";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { FormDrawer } from "@/components/feedback/form-dialog";
import { toast } from "@/components/feedback/toast";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { Checkbox } from "@/components/forms/fields";
import { ApiError } from "@/lib/api/errors";
import { blockMockUsers, fetchMockUsers, unblockMockUsers, type MockUser } from "@/mocks/users";

const resource = ["demo-users"] as const;

const addUserSchema = z.object({
  name: z.string().min(2, "Enter a name"),
  email: z.email("Enter a valid email"),
  role: z.enum(["client", "provider"]),
});

export function UsersDemo() {
  const t = useTranslations();
  const locale = useLocale();
  const queryClient = useQueryClient();
  const [blockTarget, setBlockTarget] = useState<MockUser[] | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MockUser[] | null>(null);
  const [simulateError, setSimulateError] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  const columns = useMemo<DataColumn<MockUser>[]>(
    () => [
      {
        id: "name",
        header: t("demo.columns.user"),
        sortable: true,
        cell: (u) => <UserCell name={u.name} sub={u.sub} />,
      },
      {
        id: "role",
        header: t("demo.columns.role"),
        cell: (u) => <StatusBadge domain="role" status={u.role} />,
      },
      {
        id: "status",
        header: t("demo.columns.status"),
        cell: (u) => <StatusBadge domain="user" status={u.status} />,
      },
      {
        id: "wilaya",
        header: t("demo.columns.wilaya"),
        cell: (u) => <span className="text-ink-2">{u.wilaya}</span>,
      },
      {
        id: "joinedAt",
        header: t("demo.columns.joined"),
        sortable: true,
        cell: (u) => <DateCell value={u.joinedAt} locale={locale} />,
      },
    ],
    [t, locale],
  );

  const filters = useMemo<FilterConfig[]>(
    () => [
      {
        key: "status",
        label: t("demo.filters.status"),
        options: [
          { value: "active", label: t("status.user.active") },
          { value: "blocked", label: t("status.user.blocked") },
          { value: "unverified_phone", label: t("status.user.unverified_phone") },
        ],
      },
      {
        key: "wilaya",
        label: t("demo.filters.wilaya"),
        multiple: true,
        options: ["Alger", "Oran", "Constantine", "Blida", "Sétif", "Tlemcen"].map((w) => ({
          value: w,
          label: w,
        })),
      },
    ],
    [t],
  );

  async function confirmBlock(users: MockUser[]) {
    await new Promise((r) => setTimeout(r, 700));
    if (simulateError) {
      throw new ApiError({
        status: 409,
        code: "USER_HAS_OPEN_DISPUTE",
        message: "This user has an open dispute.",
        requestId: "req_9f2a71c0",
      });
    }
    const ids = users.map((u) => u.id);
    blockMockUsers(ids);
    await queryClient.invalidateQueries({ queryKey: resource });
    toast.success(
      users.length === 1
        ? t("demo.blocked", { name: users[0].name })
        : t("demo.bulkBlocked", { count: users.length }),
      {
        action: {
          label: t("common.undo"),
          onClick: () => {
            unblockMockUsers(ids);
            void queryClient.invalidateQueries({ queryKey: resource });
          },
        },
      },
    );
  }

  const blockName = blockTarget?.length === 1 ? blockTarget[0].name : String(blockTarget?.length ?? "");

  return (
    <>
      <PageHeader
        breadcrumb={[{ label: t("breadcrumb.manage") }, { label: t("pages.demo.title") }]}
        title={t("pages.demo.title")}
        subtitle={t("pages.demo.subtitle")}
        actions={
          <>
            <Checkbox
              label={t("demo.simulateError")}
              checked={simulateError}
              onCheckedChange={setSimulateError}
            />
            <Button icon={<UserPlus />} onClick={() => setAddOpen(true)}>
              {t("pages.users.title")}
            </Button>
          </>
        }
      />

      <DataList<MockUser>
        resource={resource}
        queryFn={(params) => fetchMockUsers(params)}
        columns={columns}
        getRowId={(u) => u.id}
        tabs={[
          { key: "all", label: t("demo.tabs.all") },
          { key: "clients", label: t("demo.tabs.clients") },
          { key: "providers", label: t("demo.tabs.providers") },
        ]}
        defaultTab="all"
        filters={filters}
        sortOptions={[
          { value: "joinedAt:desc", label: t("demo.sort.newest") },
          { value: "joinedAt:asc", label: t("demo.sort.oldest") },
          { value: "name:asc", label: t("demo.sort.name") },
        ]}
        defaultSort="joinedAt:desc"
        searchPlaceholder={t("demo.searchPlaceholder")}
        rowMenuHeader={(u) => ({ title: u.name, subtitle: u.sub })}
        rowMenu={(u) => [
          [{ icon: <Eye />, label: t("demo.openProfile"), onSelect: () => toast.info(u.name) }],
          [
            {
              icon: <Ban />,
              label: t("demo.block"),
              danger: true,
              disabled: u.status === "blocked",
              onSelect: () => setBlockTarget([u]),
            },
            { icon: <Trash2 />, label: t("demo.delete"), danger: true, onSelect: () => setDeleteTarget([u]) },
          ],
        ]}
        bulkActions={(selected) => (
          <>
            <Button size="sm" variant="secondary" icon={<Ban />} onClick={() => setBlockTarget(selected)}>
              {t("demo.block")}
            </Button>
            <Button size="sm" variant="secondary" icon={<Trash2 />} onClick={() => setDeleteTarget(selected)}>
              {t("demo.delete")}
            </Button>
          </>
        )}
      />

      <ConfirmDialog
        open={blockTarget !== null}
        onOpenChange={(o) => !o && setBlockTarget(null)}
        tone="danger"
        icon={<Ban />}
        title={t("demo.blockTitle", { name: blockName })}
        description={t("demo.blockDescription")}
        impact={[t("demo.blockImpact1"), t("demo.blockImpact2"), t("demo.blockImpact3")]}
        reasonField={{
          required: true,
          options: [
            { value: "no_shows", label: t("demo.reasons.noShows") },
            { value: "fraud", label: t("demo.reasons.fraud") },
            { value: "abuse", label: t("demo.reasons.abuse") },
          ],
        }}
        messageField={{}}
        footerNote={t("common.savedInActivityLog")}
        confirmLabel={t("demo.blockConfirm")}
        onConfirm={() => confirmBlock(blockTarget ?? [])}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        tone="danger"
        icon={<Trash2 />}
        title={t("demo.deleteTitle", { count: deleteTarget?.length ?? 0 })}
        description={t("demo.deleteDescription")}
        typeToConfirm={deleteTarget?.length === 1 ? deleteTarget[0].name : "DELETE"}
        confirmLabel={t("demo.delete")}
        onConfirm={async () => {
          await new Promise((r) => setTimeout(r, 500));
          toast.success(t("demo.deleteTitle", { count: deleteTarget?.length ?? 0 }));
        }}
      />

      <FormDrawer
        open={addOpen}
        onOpenChange={setAddOpen}
        title={t("pages.users.title")}
        schema={addUserSchema}
        defaultValues={{ name: "", email: "", role: "client" }}
        fields={[
          { name: "name", label: t("demo.columns.user"), type: "text", required: true },
          { name: "email", label: t("login.email"), type: "email", required: true },
          {
            name: "role",
            label: t("demo.columns.role"),
            type: "select",
            options: [
              { value: "client", label: t("status.role.client") },
              { value: "provider", label: t("status.role.provider") },
            ],
          },
        ]}
        onSubmit={async (values) => {
          await new Promise((r) => setTimeout(r, 400));
          if (values.email.endsWith("@taken.dz")) {
            throw new ApiError({
              status: 409,
              code: "VALIDATION_FAILED",
              message: "Validation failed",
              details: [{ field: "email", code: "EMAIL_TAKEN", message: "This email is already used." }],
            });
          }
          toast.success(values.name);
        }}
      />
    </>
  );
}
