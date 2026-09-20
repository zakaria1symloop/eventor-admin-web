import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import type { FormSchema } from "@/lib/forms/schema";
import { renderWithProviders } from "@/test/render";
import { FormRenderer, type FormFiles } from "./form-renderer";

const schema: FormSchema = {
  fields: [
    { key: "s1", type: "section", label_en: "Your event", label_ar: "مناسبتك" },
    { key: "title", type: "short_text", label_en: "Event title", label_ar: "عنوان المناسبة", required: true },
    {
      key: "venue",
      type: "dropdown",
      label_en: "Venue booked?",
      label_ar: "هل القاعة محجوزة؟",
      options: [
        { value: "yes", label_en: "Yes", label_ar: "نعم" },
        { value: "no", label_en: "No", label_ar: "لا" },
      ],
    },
    {
      key: "venue_name",
      type: "short_text",
      label_en: "Venue name",
      label_ar: "اسم القاعة",
      required: true,
      showIf: { field: "venue", equals: "yes" },
    },
    { key: "s2", type: "section", label_en: "Documents", label_ar: "الوثائق" },
    {
      key: "letter",
      type: "file",
      label_en: "Letter",
      label_ar: "رسالة",
      validation: { maxFiles: 1, types: ["pdf"], maxSizeMb: 1 },
    },
  ],
};

function Harness({ onComplete, locale }: { onComplete: () => void; locale?: string }) {
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [files, setFiles] = useState<FormFiles>({});
  return (
    <FormRenderer
      schema={schema}
      answers={answers}
      onAnswersChange={setAnswers}
      files={files}
      onFilesChange={(n) => setFiles((c) => (typeof n === "function" ? n(c) : n))}
      today="2026-09-16"
      onComplete={onComplete}
      key={locale}
    />
  );
}

describe("FormRenderer", () => {
  it("blocks the step until required and showIf fields are valid", async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    renderWithProviders(<Harness onComplete={onComplete} />);
    expect(screen.getByRole("heading", { name: "Your event" })).toBeInTheDocument();
    expect(screen.queryByLabelText(/Venue name/)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("This question is required.")).toBeInTheDocument();

    await user.type(screen.getByLabelText(/Event title/), "Science Day");
    await user.selectOptions(screen.getByLabelText(/Venue booked/), "yes");
    expect(screen.getByLabelText(/Venue name/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("This question is required.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Your event" })).toBeInTheDocument();

    await user.type(screen.getByLabelText(/Venue name/), "Amphi A");
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("heading", { name: "Documents" })).toBeInTheDocument();
  });

  it("refuses files over the type and size limits", async () => {
    const user = userEvent.setup({ applyAccept: false });
    const onComplete = vi.fn();
    renderWithProviders(<Harness onComplete={onComplete} />);
    await user.type(screen.getByLabelText(/Event title/), "Science Day");
    await user.click(screen.getByRole("button", { name: "Next" }));
    const input = screen.getByTestId("file-letter");
    await user.upload(input, new File(["x"], "photo.png", { type: "image/png" }));
    expect(screen.getByText("This file type isn't allowed.")).toBeInTheDocument();
    await user.upload(
      input,
      new File([new Uint8Array(2 * 1024 * 1024)], "big.pdf", { type: "application/pdf" }),
    );
    expect(screen.getByText("Each file must be 1 MB or less.")).toBeInTheDocument();
    await user.upload(input, new File(["%PDF"], "letter.pdf", { type: "application/pdf" }));
    expect(screen.getByText("letter.pdf")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Send request" }));
    expect(onComplete).toHaveBeenCalled();
  });

  it("renders Arabic labels", () => {
    renderWithProviders(<Harness onComplete={vi.fn()} />, { locale: "ar" });
    expect(screen.getByRole("heading", { name: "مناسبتك" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "التالي" })).toBeInTheDocument();
  });
});
