import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import type { FormSchema } from "@/lib/forms/schema";
import { FileTile } from "./file-viewer";
import { FormRenderer, type FormFiles } from "./form-renderer";

const meta: Meta = { title: "Domain/Disputes & forms" };
export default meta;
type Story = StoryObj;

const schema: FormSchema = {
  fields: [
    { key: "event", type: "section", label_en: "Your event", label_ar: "مناسبتك" },
    { key: "title", type: "short_text", label_en: "Event title", label_ar: "عنوان المناسبة", required: true },
    {
      key: "event_type",
      type: "dropdown",
      label_en: "Type of event",
      label_ar: "نوع المناسبة",
      required: true,
      options: [
        { value: "conference", label_en: "Conference", label_ar: "مؤتمر" },
        { value: "other", label_en: "Other", label_ar: "أخرى" },
      ],
    },
    {
      key: "other",
      type: "short_text",
      label_en: "Describe “Other”",
      label_ar: "صف «أخرى»",
      showIf: { field: "event_type", equals: "other" },
    },
    {
      key: "date",
      type: "date",
      label_en: "Event date",
      label_ar: "تاريخ المناسبة",
      required: true,
      validation: { minOffsetDays: 21 },
    },
    { key: "wilaya", type: "wilaya", label_en: "Wilaya", label_ar: "الولاية", required: true },
    {
      key: "attendees",
      type: "number",
      label_en: "Expected attendees",
      label_ar: "عدد الحضور المتوقع",
      validation: { min: 10 },
    },
    {
      key: "letter",
      type: "file",
      label_en: "Authorisation letter",
      label_ar: "رسالة التفويض",
      validation: { types: ["pdf"], maxSizeMb: 5 },
    },
    { key: "docs", type: "section", label_en: "Consent", label_ar: "الموافقة" },
    {
      key: "consent",
      type: "consent",
      label_en: "I agree to be contacted",
      label_ar: "أوافق على التواصل",
      required: true,
    },
  ],
};

function Renderer() {
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [files, setFiles] = useState<FormFiles>({});
  return (
    <Card className="max-w-[420px] px-4 py-5">
      <FormRenderer
        schema={schema}
        answers={answers}
        onAnswersChange={setAnswers}
        files={files}
        onFilesChange={(n) => setFiles((c) => (typeof n === "function" ? n(c) : n))}
        today="2026-09-16"
        highlight={["date"]}
      />
    </Card>
  );
}

export const WebFormRenderer: Story = { render: () => <Renderer /> };
export const WebFormRendererArabic: Story = { render: () => <Renderer />, globals: { locale: "ar" } };

export const EvidenceTiles: Story = {
  render: () => (
    <div className="grid max-w-[640px] grid-cols-3 gap-3">
      <FileTile
        file={{ name: "call_log.pdf", mimeType: "application/pdf", url: "#", meta: "Karima · 08 Mar" }}
        onOpen={() => {}}
      />
      <FileTile
        file={{ name: "hall_no_dj.jpg", mimeType: "image/jpeg", meta: "Karima · 08 Mar" }}
        onOpen={() => {}}
      />
      <FileTile file={{ name: "Chat #EVT-2027", meta: "auto-attached" }} />
    </div>
  ),
};
