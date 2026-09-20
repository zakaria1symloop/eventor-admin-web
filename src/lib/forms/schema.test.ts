import { describe, expect, it } from "vitest";
import {
  addField,
  formSteps,
  mappingOptions,
  missingMappings,
  missingTranslations,
  moveField,
  newField,
  removeField,
  schemaIssues,
  showIfOperators,
  showIfTargets,
  uniqueKey,
  updateField,
  type FormSchema,
} from "./schema";

const base = (): FormSchema => ({
  fields: [
    { key: "about", type: "section", label_en: "About you", label_ar: "معلوماتك" },
    {
      key: "full_name",
      type: "short_text",
      label_en: "Full name",
      label_ar: "الاسم",
      required: true,
      maps_to: "requester_name",
      section: "about",
    },
    {
      key: "venue",
      type: "single_choice",
      label_en: "Venue?",
      label_ar: "القاعة؟",
      section: "about",
      options: [
        { value: "yes", label_en: "Yes", label_ar: "نعم" },
        { value: "no", label_en: "No", label_ar: "لا" },
      ],
    },
    { key: "event", type: "section", label_en: "Event", label_ar: "المناسبة" },
    {
      key: "title",
      type: "short_text",
      label_en: "Title",
      label_ar: "العنوان",
      maps_to: "title",
      section: "event",
    },
  ],
});

describe("form schema builder", () => {
  it("adds a field with a unique key and places it in the section above", () => {
    const s = base();
    const field = newField(s, "short_text");
    expect(field.key).toBe("short_text");
    const next = addField(s, field, 3);
    expect(next.fields[3]).toMatchObject({ key: "short_text", section: "about" });
    expect(uniqueKey(next, "short_text")).toBe("short_text_2");
    expect(newField(next, "dropdown").options).toHaveLength(2);
  });

  it("reorders fields and re-derives their sections", () => {
    const next = moveField(base(), 4, 1);
    expect(next.fields.map((f) => f.key)).toEqual(["about", "title", "full_name", "venue", "event"]);
    expect(next.fields[1].section).toBe("about");
    // Moving a section before its fields re-owns them.
    const moved = moveField(base(), 3, 0);
    expect(moved.fields.map((f) => f.key)).toEqual(["event", "about", "full_name", "venue", "title"]);
    expect(moved.fields.find((f) => f.key === "title")?.section).toBe("about");
  });

  it("deletes a field and drops conditions that pointed to it", () => {
    let s = base();
    s = addField(
      s,
      {
        key: "venue_name",
        type: "short_text",
        label_en: "Venue name",
        label_ar: "اسم القاعة",
        showIf: { field: "venue", equals: "yes" },
      },
      3,
    );
    expect(s.fields[3].showIf).toEqual({ field: "venue", equals: "yes" });
    const next = removeField(s, "venue");
    expect(next.fields.find((f) => f.key === "venue")).toBeUndefined();
    expect(next.fields.find((f) => f.key === "venue_name")?.showIf).toBeUndefined();
  });

  it("follows a renamed key in showIf conditions", () => {
    let s = addField(
      base(),
      {
        key: "venue_name",
        type: "short_text",
        label_en: "x",
        label_ar: "x",
        showIf: { field: "venue", notEmpty: true },
      },
      3,
    );
    s = updateField(s, "venue", { key: "has_venue" });
    expect(s.fields.find((f) => f.key === "venue_name")?.showIf?.field).toBe("has_venue");
  });

  it("keeps each system mapping once and on a compatible type", () => {
    const s = base();
    const newText = newField(s, "short_text");
    const options = mappingOptions(addField(s, newText), newText);
    const title = options.find((o) => o.value === "title")!;
    expect(title).toMatchObject({ usedBy: "title", disabled: true });
    expect(options.find((o) => o.value === "institution_name")).toMatchObject({
      disabled: false,
      compatible: true,
    });
    expect(options.find((o) => o.value === "event_date")).toMatchObject({
      disabled: true,
      compatible: false,
    });

    const duplicate = updateField(addField(s, newText), newText.key, { maps_to: "title" });
    expect(schemaIssues(duplicate)).toContainEqual({ path: "fields[5].maps_to", code: "MAPPING_DUPLICATE" });
    expect(missingMappings(s)).toEqual(["event_date", "wilaya", "requester_phone"]);
    expect(schemaIssues(s, { publish: true }).filter((i) => i.code === "MAPPING_REQUIRED")).toHaveLength(3);
  });

  it("offers earlier, conditionable fields and type-specific operators for showIf", () => {
    let s = base();
    s = addField(s, { key: "programme", type: "file", label_en: "Programme", label_ar: "البرنامج" }, 3);
    s = addField(s, newField(s, "short_text"), 6);
    const targets = showIfTargets(s, "short_text").map((f) => f.key);
    expect(targets).toEqual(["full_name", "venue", "title"]);
    expect(showIfTargets(s, "full_name")).toEqual([]);
    expect(showIfOperators(s.fields.find((f) => f.key === "venue"))).toEqual(["equals", "in", "notEmpty"]);
    expect(showIfOperators(s.fields.find((f) => f.key === "title"))).toEqual(["equals", "notEmpty"]);
    expect(
      schemaIssues({
        fields: [
          { key: "a", type: "short_text", label_en: "", label_ar: "", showIf: { field: "b", equals: "x" } },
          { key: "b", type: "short_text", label_en: "", label_ar: "" },
        ],
      }),
    ).toContainEqual({ path: "fields[0].showIf.field", code: "SHOW_IF_FIELD_UNKNOWN" });
  });

  it("counts missing translations per language and splits steps by section", () => {
    const s = updateField(base(), "title", { label_ar: "" });
    expect(missingTranslations(s, "ar")).toEqual([
      { path: "fields[4].label_ar", code: "TRANSLATION_MISSING" },
    ]);
    expect(missingTranslations(s, "en")).toEqual([]);
    expect(formSteps(s).map((st) => st.fields.map((f) => f.key))).toEqual([
      ["full_name", "venue"],
      ["title"],
    ]);
  });
});
