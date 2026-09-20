import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { fetchMockUsers, type MockUser } from "@/mocks/users";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { DataList } from "./data-list";
import { UserCell } from "./cells";
import {
  AdvancedFiltersDrawer,
  type AdvancedFilterField,
  type FilterValues,
} from "./advanced-filters-drawer";
import {
  ColumnsMenu,
  QuickFilterCards,
  SavedViewsMenu,
  SaveViewDialog,
  type QuickFilterItem,
  type SavedView,
} from "./list-extras";

const meta: Meta = { title: "Lists/Filters & views" };
export default meta;
type Story = StoryObj;

const advanced: AdvancedFilterField[] = [
  {
    key: "role",
    label: "Role",
    type: "multiselect",
    options: [
      { value: "client", label: "Client", hint: "10,906" },
      { value: "provider", label: "Provider", hint: "1,236" },
      { value: "admin", label: "Admin", hint: "318" },
    ],
  },
  {
    key: "status",
    label: "Account status",
    type: "multiselect",
    options: [
      { value: "active", label: "Active" },
      { value: "blocked", label: "Blocked" },
      { value: "unverified_phone", label: "Unverified phone" },
    ],
  },
  {
    key: "wilaya",
    label: "Wilaya",
    type: "multiselect",
    display: "dropdown",
    hint: "Matches where the account is based. Providers also match wilayas they cover.",
    options: ["Alger", "Oran", "Blida", "Tipaza", "Constantine", "Sétif"].map((w) => ({
      value: w,
      label: w,
    })),
  },
  {
    key: "rating",
    label: "Rating",
    type: "segmented",
    options: [
      { value: "3.5", label: "3.5+" },
      { value: "4", label: "4.0+" },
      { value: "4.5", label: "4.5+" },
    ],
  },
  { key: "joined", label: "Joined between", type: "daterange" },
  { key: "bookings", label: "Completed bookings", type: "range" },
  {
    key: "lastActive",
    label: "Last active",
    type: "select",
    options: [
      { value: "7d", label: "Last 7 days" },
      { value: "30d", label: "Last 30 days" },
    ],
  },
  { key: "reported", label: "Reports", type: "toggle", toggleLabel: "Has open reports" },
];

const quick: QuickFilterItem[] = [
  {
    key: "active",
    label: "Active accounts",
    value: "12,318",
    hint: "98.7% of all users",
    tone: "green",
    filter: { status: "active" },
  },
  {
    key: "new",
    label: "New this week",
    value: "128",
    hint: "+18% vs last week",
    tone: "blue",
    filter: { joined: "2026-09-09.." },
  },
  {
    key: "verify",
    label: "Awaiting verification",
    value: "14",
    hint: "Providers only",
    tone: "amber",
    filter: { role: ["provider"], status: "unverified_phone" },
  },
  {
    key: "blocked",
    label: "Blocked",
    value: "37",
    hint: "7 this month",
    tone: "red",
    filter: { status: "blocked" },
  },
];

let views: SavedView[] = [
  {
    id: "v1",
    name: "Providers in Alger",
    query: { role: ["provider"], wilaya: ["Alger"] },
    isShared: false,
    isMine: true,
  },
  {
    id: "v2",
    name: "Blocked this month",
    query: { status: ["blocked"] },
    isShared: true,
    isMine: false,
    ownerName: "Omar",
  },
];

function FullList() {
  return (
    <DataList<MockUser>
      resource={["story-users-adv"]}
      queryFn={(p) => fetchMockUsers(p, { delay: 300 })}
      columns={[
        {
          id: "name",
          header: "User",
          hideable: false,
          sortable: true,
          cell: (u) => <UserCell name={u.name} sub={u.sub} />,
        },
        { id: "role", header: "Role", cell: (u) => <StatusBadge domain="role" status={u.role} /> },
        { id: "status", header: "Status", cell: (u) => <StatusBadge domain="user" status={u.status} /> },
        { id: "wilaya", header: "Wilaya", cell: (u) => u.wilaya },
      ]}
      getRowId={(u) => u.id}
      quickFilters={quick}
      advancedFilters={advanced}
      savedViews={{
        queryKey: ["story-views"],
        queryFn: async () => views,
        onSave: async (input) => {
          views = [...views, { id: `v${views.length + 1}`, ...input, isMine: true }];
        },
        onDelete: async (v) => {
          views = views.filter((x) => x.id !== v.id);
        },
      }}
      columnsStorageKey="story-users"
      sortOptions={[
        { value: "", label: "Newest" },
        { value: "name:asc", label: "Name" },
      ]}
      itemLabel="users"
    />
  );
}

export const DataListWithEverything: Story = { render: () => <FullList /> };
export const DataListWithEverythingRTL: Story = { render: () => <FullList />, globals: { locale: "ar" } };

function DrawerDemo() {
  const [open, setOpen] = useState(true);
  const [values, setValues] = useState<FilterValues>({
    role: ["provider"],
    status: ["active"],
    wilaya: ["Alger"],
    rating: "4",
  });
  return (
    <>
      <Button onClick={() => setOpen(true)}>More filters</Button>
      <pre className="mt-3 text-12">{JSON.stringify(values)}</pre>
      <AdvancedFiltersDrawer
        open={open}
        onOpenChange={setOpen}
        fields={advanced}
        values={values}
        onApply={setValues}
        countFn={async (v) => 186 * (Object.keys(v).length || 1)}
        itemLabel="users"
        onSaveView={() => {}}
      />
    </>
  );
}
export const AdvancedFilters: Story = { render: () => <DrawerDemo /> };
export const AdvancedFiltersRTL: Story = { render: () => <DrawerDemo />, globals: { locale: "ar" } };

function Menus() {
  const [active, setActive] = useState<string>("active");
  const [hidden, setHidden] = useState<string[]>(["wilaya"]);
  const [saveOpen, setSaveOpen] = useState(false);
  return (
    <div className="flex flex-col gap-4">
      <QuickFilterCards items={quick} isActive={(i) => i.key === active} onSelect={(i) => setActive(i.key)} />
      <div className="flex gap-2">
        <SavedViewsMenu
          views={views}
          activeViewId="v1"
          onApply={() => {}}
          onSaveCurrent={() => setSaveOpen(true)}
        />
        <ColumnsMenu
          columns={[
            { id: "name", label: "User", hideable: false },
            { id: "role", label: "Role" },
            { id: "wilaya", label: "Wilaya" },
          ]}
          hidden={hidden}
          onChange={setHidden}
        />
      </div>
      <SaveViewDialog open={saveOpen} onOpenChange={setSaveOpen} onSave={async () => {}} />
    </div>
  );
}
export const QuickCardsViewsColumns: Story = { render: () => <Menus /> };
export const QuickCardsViewsColumnsRTL: Story = { render: () => <Menus />, globals: { locale: "ar" } };
