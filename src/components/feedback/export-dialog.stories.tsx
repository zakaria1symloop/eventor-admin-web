import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ExportDialog } from "./export-dialog";

const meta: Meta = { title: "Feedback/ExportDialog (STA-05)" };
export default meta;
type Story = StoryObj;

function Demo() {
  const [open, setOpen] = useState(true);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Export</Button>
      <ExportDialog
        open={open}
        onOpenChange={setOpen}
        resource="categories"
        title="Export categories"
        filters={{ tab: "hidden" }}
        summary="9 categories · Tab Hidden"
        summaryHint="Current tab, search and filters"
        columns={[
          { key: "slug", label: "Slug" },
          { key: "nameEn", label: "Name (EN)" },
          { key: "nameAr", label: "Name (AR)" },
          { key: "descriptionEn", label: "Description (EN)", defaultChecked: false },
          { key: "servicesCount", label: "Services" },
          { key: "providersCount", label: "Providers" },
        ]}
      />
    </>
  );
}

export const Default: Story = { render: () => <Demo /> };
export const RTL: Story = { render: () => <Demo />, globals: { locale: "ar" } };
