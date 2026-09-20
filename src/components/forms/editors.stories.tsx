import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { BilingualFields, type BilingualFieldConfig } from "./bilingual-fields";
import { DiffList, FormFooter, LineItemsEditor, ReasonPicker, type LineItem } from "./editors";
import { PhotoUploader, type PhotoItem } from "./photo-uploader";

const meta: Meta = { title: "Forms/Editors" };
export default meta;
type Story = StoryObj;

const bilingual: BilingualFieldConfig[] = [
  { name: "title", label: "Title", maxLength: 120 },
  { name: "description", label: "Description", multiline: true },
];

function Bilingual() {
  const [values, setValues] = useState<Record<string, string>>({
    title_en: "Wedding photo & video coverage",
    description_en: "Full-day coverage from the bride's preparation to the last dance.",
    title_ar: "تغطية تصوير فوتوغرافي وفيديو للأعراس",
  });
  return (
    <Card className="max-w-[560px]">
      <CardBody>
        <BilingualFields
          fields={bilingual}
          values={values}
          onChange={(k, v) => setValues((s) => ({ ...s, [k]: v }))}
          errors={{ description_ar: "Required to publish" }}
        />
      </CardBody>
    </Card>
  );
}
export const BilingualFieldsStory: Story = { name: "BilingualFields", render: () => <Bilingual /> };
export const BilingualFieldsRTL: Story = { render: () => <Bilingual />, globals: { locale: "ar" } };

const tile = (color: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="${color}"/></svg>`)}`;

function Photos({ full }: { full?: boolean }) {
  const colors = ["#E4DCF3", "#F3E6D3", "#DCE7F3", "#EDE3DC", "#DDEBDF", "#F1DEDE", "#E4DCF3", "#F3E6D3"];
  const [items, setItems] = useState<PhotoItem[]>([
    ...colors.slice(0, full ? 8 : 5).map((c, i) => ({ id: `p${i}`, url: tile(c), status: "ready" as const })),
    ...(full
      ? []
      : [
          { id: "up", url: tile("#DCE7F3"), status: "uploading" as const, progress: 42 },
          { id: "proc", url: tile("#EDE3DC"), status: "processing" as const },
          { id: "fail", url: tile("#F1DEDE"), status: "failed" as const },
        ]),
  ]);
  return (
    <div className="max-w-[720px]">
      <PhotoUploader
        value={items}
        onChange={setItems}
        limit={full ? 8 : 12}
        upload={(file, onProgress) =>
          new Promise((resolve) => {
            let p = 0;
            const id = setInterval(() => {
              p += 25;
              onProgress(Math.min(p, 100));
              if (p >= 100) {
                clearInterval(id);
                resolve({ id: `srv-${file.name}`, url: URL.createObjectURL(file), processing: false });
              }
            }, 300);
          })
        }
      />
    </div>
  );
}
export const PhotoUploaderStory: Story = { name: "PhotoUploader", render: () => <Photos /> };
export const PhotoUploaderFull: Story = { render: () => <Photos full /> };
export const PhotoUploaderRTL: Story = { render: () => <Photos />, globals: { locale: "ar" } };

function Lines() {
  const [items, setItems] = useState<LineItem[]>([
    { id: "a", label: "Henna evening", amount: 12000 },
    { id: "b", label: "Printed album", amount: 18000 },
  ]);
  return (
    <div className="max-w-[560px]">
      <LineItemsEditor
        value={items}
        onChange={setItems}
        base={45000}
        feePercent={10}
        labelPlaceholder="Extra"
      />
    </div>
  );
}
export const LineItems: Story = { render: () => <Lines /> };
export const LineItemsRTL: Story = { render: () => <Lines />, globals: { locale: "ar" } };

function Reasons() {
  const [value, setValue] = useState({ reason: "", message: "" });
  const reasons = [
    {
      value: "blurry",
      label: "Photo is blurry",
      message: "The ID photo is blurry. Please upload a sharper photo.",
    },
    {
      value: "expired",
      label: "Document expired",
      message: "This document has expired. Please upload a valid one.",
    },
    {
      value: "mismatch",
      label: "Name doesn't match",
      message: "The name on the document doesn't match your account.",
    },
  ];
  return (
    <div className="grid max-w-[520px] gap-8">
      <ReasonPicker reasons={reasons} value={value} onChange={setValue} />
      <ReasonPicker reasons={reasons} value={value} onChange={setValue} variant="select" required />
    </div>
  );
}
export const ReasonPickerStory: Story = { name: "ReasonPicker", render: () => <Reasons /> };

function Footer() {
  const [dirty, setDirty] = useState(true);
  return (
    <Card className="max-w-[640px] overflow-hidden">
      <CardHeader title="Commission & pricing" />
      <CardBody>
        <label className="text-13">
          <input type="checkbox" checked={dirty} onChange={(e) => setDirty(e.target.checked)} /> dirty
        </label>
      </CardBody>
      <FormFooter
        isDirty={dirty}
        isValid
        onDiscard={() => setDirty(false)}
        note="Saved in the activity log"
      />
    </Card>
  );
}
export const FormFooterStory: Story = { name: "FormFooter", render: () => <Footer /> };
export const FormFooterRTL: Story = { render: () => <Footer />, globals: { locale: "ar" } };

const diffRows = [
  { label: "Commission", old: "8%", new: "10%" },
  { label: "Pack fee", old: "5%", new: "5%" },
  { label: "Reply deadline", old: "24 hours", new: "48 hours" },
  { label: "Support email", old: null, new: "support@eventor.dz" },
];
export const DiffListStory: Story = {
  name: "DiffList",
  render: () => <DiffList rows={diffRows} className="max-w-[560px] bg-surface" />,
};
export const DiffListRTL: Story = {
  render: () => <DiffList rows={diffRows} className="max-w-[560px] bg-surface" />,
  globals: { locale: "ar" },
};
