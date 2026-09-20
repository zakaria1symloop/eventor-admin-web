import { describe, expect, it } from "vitest";
import type { FormSchema } from "./schema";
import { cleanAnswers, validateAnswers, visibleKeys } from "./validate";

const today = "2026-09-16";

const schema: FormSchema = {
  fields: [
    {
      key: "title",
      type: "short_text",
      label_en: "Title",
      label_ar: "",
      required: true,
      validation: { minLength: 3, maxLength: 10 },
    },
    {
      key: "code",
      type: "short_text",
      label_en: "Code",
      label_ar: "",
      validation: { pattern: "^[A-Z]{3}$" },
    },
    {
      key: "attendees",
      type: "number",
      label_en: "Attendees",
      label_ar: "",
      validation: { min: 10, max: 500, integer: true },
    },
    {
      key: "date",
      type: "date",
      label_en: "Date",
      label_ar: "",
      required: true,
      validation: { minOffsetDays: 7 },
    },
    {
      key: "venue",
      type: "single_choice",
      label_en: "Venue?",
      label_ar: "",
      required: true,
      options: [
        { value: "yes", label_en: "Yes", label_ar: "" },
        { value: "no", label_en: "No", label_ar: "" },
      ],
    },
    {
      key: "venue_name",
      type: "short_text",
      label_en: "Venue name",
      label_ar: "",
      required: true,
      showIf: { field: "venue", equals: "yes" },
    },
    {
      key: "venue_notes",
      type: "long_text",
      label_en: "Notes",
      label_ar: "",
      required: true,
      showIf: { field: "venue_name", notEmpty: true },
    },
    {
      key: "programme",
      type: "file",
      label_en: "Programme",
      label_ar: "",
      required: true,
      validation: { maxFiles: 2, types: ["pdf"], maxSizeMb: 2 },
    },
    { key: "consent", type: "consent", label_en: "I agree", label_ar: "", required: true },
  ],
};

const pdf = (mb: number) => ({ mimeType: "application/pdf", sizeBytes: mb * 1024 * 1024 });
const valid = { title: "Science", date: "2026-09-30", venue: "no", consent: true };

describe("FormRenderer validation", () => {
  it("accepts a complete answer set", () => {
    expect(validateAnswers(schema, valid, { today, files: { programme: [pdf(1)] }, maxUploadMb: 5 })).toEqual(
      [],
    );
  });

  it("checks required, length, pattern, number and date offset rules", () => {
    const issues = validateAnswers(
      schema,
      { title: "ab", code: "abc", attendees: 5.5, date: "2026-09-20", venue: "no" },
      { today, files: { programme: [pdf(1)] } },
    );
    expect(issues).toEqual([
      { fieldKey: "title", code: "TOO_SHORT" },
      { fieldKey: "code", code: "PATTERN_MISMATCH" },
      { fieldKey: "attendees", code: "NOT_INTEGER" },
      { fieldKey: "date", code: "DATE_TOO_EARLY" },
      { fieldKey: "consent", code: "CONSENT_REQUIRED" },
    ]);
  });

  it("only validates fields shown by their showIf chain", () => {
    expect([...visibleKeys(schema, { venue: "no" })]).not.toContain("venue_name");
    const shown = validateAnswers(
      schema,
      { ...valid, venue: "yes" },
      { today, files: { programme: [pdf(1)] } },
    );
    expect(shown).toEqual([{ fieldKey: "venue_name", code: "REQUIRED" }]);
    const chained = validateAnswers(
      schema,
      { ...valid, venue: "yes", venue_name: "Amphi A" },
      { today, files: { programme: [pdf(1)] } },
    );
    expect(chained).toEqual([{ fieldKey: "venue_notes", code: "REQUIRED" }]);
    // Hidden answers are not sent.
    expect(cleanAnswers(schema, { ...valid, venue_name: "stale", title: "  Science " })).toEqual({
      ...valid,
      title: "Science",
    });
  });

  it("enforces file count, type and size (capped by the upload setting)", () => {
    const run = (files: { mimeType: string; sizeBytes: number }[], maxUploadMb = 5) =>
      validateAnswers(schema, valid, {
        today,
        files: { programme: files },
        maxUploadMb,
        keys: ["programme"],
      });
    expect(run([])).toEqual([{ fieldKey: "programme", code: "REQUIRED" }]);
    expect(run([pdf(1), pdf(1), pdf(1)])).toEqual([{ fieldKey: "programme", code: "TOO_MANY_FILES" }]);
    expect(run([{ mimeType: "image/png", sizeBytes: 100 }])).toEqual([
      { fieldKey: "programme", code: "FILE_TYPE_NOT_ALLOWED" },
    ]);
    expect(run([pdf(3)])).toEqual([{ fieldKey: "programme", code: "FILE_TOO_LARGE" }]);
    expect(run([pdf(1.5)], 1)).toEqual([{ fieldKey: "programme", code: "FILE_TOO_LARGE" }]);
  });
});
