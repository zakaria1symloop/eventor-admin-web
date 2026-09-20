import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Ban, CircleCheck, Trash2 } from "lucide-react";
import { useState, type ComponentProps } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { RadioCards } from "@/components/forms/fields";
import { ApiError } from "@/lib/api/errors";
import { Banner } from "./banner";
import { ConfirmDialog } from "./confirm-dialog";
import { FormDialog, FormDrawer } from "./form-dialog";
import { EmptyState, ErrorState, TableSkeleton, CardSkeleton } from "./states";
import { toast } from "./toast";

const meta: Meta = { title: "Feedback" };
export default meta;
type Story = StoryObj;

function ConfirmDemo({
  noBookings,
  ...props
}: Partial<ComponentProps<typeof ConfirmDialog>> & { fail?: boolean; noBookings?: boolean }) {
  const [open, setOpen] = useState(true);
  const [bookings, setBookings] = useState("cancel");
  return (
    <>
      <Button onClick={() => setOpen(true)}>Open dialog</Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        tone="danger"
        icon={<Ban />}
        title="Block Karim Belkacem?"
        description="He can't sign in, his services disappear from the app and clients can't book him."
        impact={[
          "5 services hidden from search and his profile",
          "1 Ready Pack (Fiançailles) marked “Provider blocked”",
          "17 conversations become read-only",
        ]}
        reasonField={{
          required: true,
          options: [
            { value: "no_shows", label: "Repeated no-shows" },
            { value: "fraud", label: "Fraud" },
          ],
        }}
        messageField={{
          label: "Message to the user",
          defaultValue: "Your account is blocked after 3 client complaints. Contact support@eventor.dz.",
        }}
        footerNote="Saved in the activity log"
        confirmLabel="Block account"
        onConfirm={async () => {
          await new Promise((r) => setTimeout(r, 900));
          if (props.fail)
            throw new ApiError({
              status: 409,
              code: "USER_HAS_OPEN_DISPUTE",
              message: "This user has an open dispute.",
              requestId: "req_9f2a71c0",
            });
          toast.success("Karim Belkacem blocked", { action: { label: "Undo", onClick: () => {} } });
        }}
        {...props}
      >
        {!noBookings && (
          <div>
            <div className="mb-2 text-13 font-medium text-ink">3 pending and 2 upcoming bookings</div>
            <RadioCards
              value={bookings}
              onValueChange={setBookings}
              options={[
                {
                  value: "cancel",
                  label: "Cancel them and notify the clients",
                  description: "Clients are told the provider is unavailable and can book someone else.",
                },
                {
                  value: "keep",
                  label: "Keep them",
                  description: "Bookings stay; only new bookings are blocked.",
                },
              ]}
            />
          </div>
        )}
      </ConfirmDialog>
    </>
  );
}

export const ConfirmDanger: Story = { render: () => <ConfirmDemo /> };
export const ConfirmDangerRTL: Story = { render: () => <ConfirmDemo />, globals: { locale: "ar" } };
export const ConfirmAsyncError: Story = { render: () => <ConfirmDemo fail /> };
export const ConfirmTypeToConfirm: Story = {
  render: () => (
    <ConfirmDemo
      icon={<Trash2 />}
      title="Delete Karim Belkacem?"
      description="The account is anonymised. This can't be undone."
      reasonField={undefined}
      messageField={undefined}
      noBookings
      typeToConfirm="Karim Belkacem"
      checkboxes={[{ name: "notify", label: "Email the user", defaultChecked: true }]}
      confirmLabel="Delete user"
    />
  ),
};
export const ConfirmSuccessTone: Story = {
  render: () => (
    <ConfirmDemo
      tone="success"
      icon={<CircleCheck />}
      title="Approve all documents?"
      impact={["Provider marked verified", "4 services published"]}
      reasonField={undefined}
      messageField={undefined}
      noBookings
      secondaryAction={{ label: "Review first", onClick: () => {} }}
      confirmLabel="Approve all"
    />
  ),
};

const schema = z.object({
  name: z.string().min(2, "Enter a name"),
  email: z.email("Enter a valid email"),
  role: z.enum(["client", "provider"]),
  skip: z.boolean(),
});
const fields = [
  { name: "name" as const, label: "Full name", type: "text" as const, required: true },
  {
    name: "email" as const,
    label: "Email",
    type: "email" as const,
    required: true,
    hint: "Try x@taken.dz for an API field error",
  },
  {
    name: "role" as const,
    label: "Role",
    type: "select" as const,
    options: [
      { value: "client", label: "Client" },
      { value: "provider", label: "Provider" },
    ],
  },
  { name: "skip" as const, label: "Skip verification", type: "toggle" as const },
];
async function submit(values: z.output<typeof schema>) {
  await new Promise((r) => setTimeout(r, 600));
  if (values.email.endsWith("@taken.dz")) {
    throw new ApiError({
      status: 400,
      code: "VALIDATION_FAILED",
      message: "Validation failed",
      details: [{ field: "email", code: "EMAIL_TAKEN", message: "This email is already used." }],
    });
  }
  toast.success("User created");
}

function FormDialogDemo({ drawer }: { drawer?: boolean }) {
  const [open, setOpen] = useState(true);
  const Comp = drawer ? FormDrawer : FormDialog;
  return (
    <>
      <Button onClick={() => setOpen(true)}>Open</Button>
      <Comp
        open={open}
        onOpenChange={setOpen}
        title={drawer ? "Edit details" : "Add user"}
        schema={schema}
        defaultValues={{ name: "", email: "", role: "client", skip: false }}
        fields={fields}
        onSubmit={submit}
      />
    </>
  );
}
export const FormDialogStory: Story = { name: "FormDialog", render: () => <FormDialogDemo /> };
export const FormDrawerStory: Story = {
  name: "FormDrawer (unsaved changes guard)",
  render: () => <FormDialogDemo drawer />,
};
export const FormDrawerRTL: Story = { render: () => <FormDialogDemo drawer />, globals: { locale: "ar" } };

export const Toasts: Story = {
  render: () => (
    <div className="flex gap-2">
      <Button
        onClick={() => toast.success("2 users blocked", { action: { label: "Undo", onClick: () => {} } })}
      >
        Success + Undo
      </Button>
      <Button
        variant="danger"
        onClick={() =>
          toast.apiError(
            new ApiError({
              status: 500,
              code: "INTERNAL_ERROR",
              message: "Couldn't block the user",
              requestId: "req_1",
            }),
          )
        }
      >
        API error
      </Button>
    </div>
  ),
};

export const States: Story = {
  render: () => (
    <div className="grid gap-4">
      <Card>
        <EmptyState title="All caught up" description="No providers are waiting for verification." />
      </Card>
      <Card>
        <EmptyState
          title="No services match these filters"
          description="Category: Photography · Wilaya: Tamanrasset"
          actions={[
            <Button key="c">Clear all filters</Button>,
            <Button key="r" variant="secondary">
              Remove wilaya
            </Button>,
          ]}
        />
      </Card>
      <Card>
        <ErrorState
          error={
            new ApiError({
              status: 500,
              code: "INTERNAL_ERROR",
              message: "We couldn't load users.",
              requestId: "req_9f2a71c0",
            })
          }
          onRetry={() => {}}
        />
      </Card>
      <Card>
        <TableSkeleton rows={4} />
      </Card>
      <div className="grid grid-cols-4 gap-4">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    </div>
  ),
};
export const StatesRTL: Story = { ...States, globals: { locale: "ar" } };

export const Banners: Story = {
  render: () => (
    <div className="grid max-w-2xl gap-3">
      <Banner
        tone="red"
        title="Blocked by Sara Meziane · Repeated no-shows"
        description="5 services hidden · 3 bookings cancelled"
        action={
          <Button size="sm" variant="secondary">
            Unblock
          </Button>
        }
      />
      <Banner tone="amber" title="Requester has no account yet" />
      <Banner tone="blue" title="New date waiting for confirmation" />
      <Banner tone="green" title="Provider verified" />
    </div>
  ),
};
