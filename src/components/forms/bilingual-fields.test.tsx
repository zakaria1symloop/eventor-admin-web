import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "@/test/render";
import { BilingualFields, countMissing, type BilingualFieldConfig } from "./bilingual-fields";

const fields: BilingualFieldConfig[] = [
  { name: "title", label: "Title" },
  { name: "description", label: "Description", multiline: true },
  { name: "note", label: "Note", required: false },
];

function Harness({ initial }: { initial: Record<string, string> }) {
  const [values, setValues] = useState(initial);
  return (
    <BilingualFields
      fields={fields}
      values={values}
      onChange={(k, v) => setValues((s) => ({ ...s, [k]: v }))}
    />
  );
}

describe("BilingualFields", () => {
  it("counts only required empty fields per language", () => {
    const values = { title_en: "Wedding photo", description_en: " ", title_ar: "", note_ar: "" };
    expect(countMissing(fields, values, "en")).toBe(1);
    expect(countMissing(fields, values, "ar")).toBe(2);
  });

  it("shows the missing count on each tab and updates it while typing", async () => {
    const u = userEvent.setup();
    renderWithProviders(<Harness initial={{ title_en: "Wedding photo", description_en: "Full day" }} />);

    const enTab = screen.getByRole("tab", { name: /English/ });
    const arTab = screen.getByRole("tab", { name: /العربية/ });
    expect(enTab).not.toHaveTextContent("missing");
    expect(arTab).toHaveTextContent("2 missing");

    await u.click(arTab);
    const arTitle = screen.getByRole("textbox", { name: "Title" });
    expect(arTitle).toHaveAttribute("dir", "rtl");
    expect(arTitle).toHaveAttribute("lang", "ar");
    await u.type(arTitle, "تصوير");
    expect(arTab).toHaveTextContent("1 missing");

    await u.type(screen.getByRole("textbox", { name: "Description" }), "يوم كامل");
    expect(arTab).not.toHaveTextContent("missing");
  });
});
