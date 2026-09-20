import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Ban, Eye, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import type { ListResponse } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import { fetchMockUsers, type MockUser } from "@/mocks/users";
import { DateCell, UserCell } from "./cells";
import { DataList, type DataListProps } from "./data-list";

const baseProps: DataListProps<MockUser> = {
  resource: ["story-users"],
  queryFn: (p) => fetchMockUsers(p, { delay: 300 }),
  getRowId: (u) => u.id,
  columns: [
    { id: "name", header: "User", sortable: true, cell: (u) => <UserCell name={u.name} sub={u.sub} /> },
    { id: "role", header: "Role", cell: (u) => <StatusBadge domain="role" status={u.role} /> },
    { id: "status", header: "Status", cell: (u) => <StatusBadge domain="user" status={u.status} /> },
    { id: "wilaya", header: "Wilaya", cell: (u) => u.wilaya },
    {
      id: "joinedAt",
      header: "Joined",
      sortable: true,
      cell: (u) => <DateCell value={u.joinedAt} locale="en" />,
    },
  ],
  tabs: [
    { key: "all", label: "All", count: 72 },
    { key: "clients", label: "Clients" },
    { key: "providers", label: "Providers" },
  ],
  filters: [
    {
      key: "status",
      label: "Status",
      options: [
        { value: "active", label: "Active" },
        { value: "blocked", label: "Blocked" },
      ],
    },
    {
      key: "wilaya",
      label: "Wilaya",
      multiple: true,
      options: ["Alger", "Oran", "Blida"].map((w) => ({ value: w, label: w })),
    },
  ],
  sortOptions: [
    { value: "joinedAt:desc", label: "Newest" },
    { value: "name:asc", label: "Name" },
  ],
  defaultSort: "joinedAt:desc",
  searchPlaceholder: "Name, email, phone or user ID…",
  onMoreFilters: () => {},
  rowMenuHeader: (u) => ({ title: u.name, subtitle: u.sub }),
  rowMenu: () => [
    [{ icon: <Eye />, label: "Open profile" }],
    [
      { icon: <Ban />, label: "Block user", danger: true },
      { icon: <Trash2 />, label: "Delete user", danger: true },
    ],
  ],
  bulkActions: () => (
    <>
      <Button size="sm" variant="secondary" icon={<Ban />}>
        Block
      </Button>
      <Button size="sm" variant="secondary" icon={<Trash2 />}>
        Delete
      </Button>
    </>
  ),
};

const meta: Meta<typeof DataList<MockUser>> = {
  title: "Lists/DataList",
  component: DataList,
  args: baseProps,
  render: (args) => <DataList<MockUser> {...(args as DataListProps<MockUser>)} />,
};
export default meta;
type Story = StoryObj<typeof DataList<MockUser>>;

export const Default: Story = {};
export const RTL: Story = { globals: { locale: "ar" } };
export const Loading: Story = {
  args: { resource: ["story-loading"], queryFn: () => new Promise<ListResponse<MockUser>>(() => {}) },
};
export const Empty: Story = {
  args: {
    resource: ["story-empty"],
    queryFn: async () => ({ data: [], meta: { page: 1, limit: 10, total: 0, totalPages: 1 } }),
  },
};
export const ErrorState: Story = {
  args: {
    resource: ["story-error"],
    queryFn: async () => {
      throw new ApiError({
        status: 500,
        code: "INTERNAL_ERROR",
        message: "We couldn't load users.",
        requestId: "req_9f2a71c0",
      });
    },
  },
};
