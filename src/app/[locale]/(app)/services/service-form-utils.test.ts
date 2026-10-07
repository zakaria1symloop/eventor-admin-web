import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/errors";
import {
  apiErrorToFields,
  emptyServiceValues,
  firstErrorField,
  langForErrors,
  publishErrorsToFields,
  validateDraft,
  valuesToBody,
} from "./service-form-utils";

const t = (key: string) => `msg:${key}`;
const publishInvalid = (missing: string[]) =>
  new ApiError({
    status: 422,
    code: "SERVICE_PUBLISH_INVALID",
    message: "Cannot publish",
    details: { missing },
  });

describe("SERVICE_PUBLISH_INVALID → form fields", () => {
  it("maps every missing key onto its form field", () => {
    expect(
      publishErrorsToFields(
        ["titleEn", "titleAr", "descriptionEn", "descriptionAr", "price", "photos", "category", "wilayas"],
        t,
      ),
    ).toEqual({
      title_en: "msg:publishErrors.titleEn",
      title_ar: "msg:publishErrors.titleAr",
      description_en: "msg:publishErrors.descriptionEn",
      description_ar: "msg:publishErrors.descriptionAr",
      basePrice: "msg:publishErrors.price",
      photos: "msg:publishErrors.photos",
      categoryId: "msg:publishErrors.category",
      wilayaCodes: "msg:publishErrors.wilayas",
    });
  });

  it("scrolls to the first error in form order and opens the Arabic tab when only Arabic is missing", () => {
    const errors = apiErrorToFields(publishInvalid(["wilayas", "photos", "descriptionAr"]), t);
    expect(Object.keys(errors).sort()).toEqual(["description_ar", "photos", "wilayaCodes"]);
    expect(firstErrorField(errors)).toBe("description_ar");
    expect(langForErrors(errors)).toBe("ar");
    expect(langForErrors({ title_en: "x", title_ar: "y" })).toBe("en");
  });

  it("maps other field-shaped errors and ignores the rest", () => {
    expect(
      apiErrorToFields(new ApiError({ status: 422, code: "CATEGORY_HIDDEN", message: "Hidden" }), t),
    ).toEqual({
      categoryId: "Hidden",
    });
    expect(
      apiErrorToFields(
        new ApiError({
          status: 400,
          code: "VALIDATION_FAILED",
          message: "Invalid",
          details: [{ field: "titleAr", code: "too_long", message: "Too long" }],
        }),
        t,
      ),
    ).toEqual({ title_ar: "Too long" });
    expect(apiErrorToFields(new ApiError({ status: 500, code: "INTERNAL_ERROR", message: "x" }), t)).toEqual(
      {},
    );
  });
});

describe("booking schedule (issues 3 #6–#8)", () => {
  const base = () => ({ ...emptyServiceValues(), basePrice: 1000, categoryId: "c1" });
  const t = (key: string) => `msg:${key}`;

  it("sends hours only when set hours are on, and empty dates as null", () => {
    const hours = [{ weekday: 5, startTime: "20:00", endTime: "02:00" }];
    expect(valuesToBody({ ...base(), hoursEnabled: false, hours })).toMatchObject({
      hours: [],
      availableFrom: null,
      availableUntil: null,
      allowSimultaneous: false,
    });
    expect(
      valuesToBody({ ...base(), hoursEnabled: true, hours, availableFrom: "2027-03-01", allowSimultaneous: true }),
    ).toMatchObject({ hours, availableFrom: "2027-03-01", availableUntil: null, allowSimultaneous: true });
    expect(valuesToBody(base())).not.toHaveProperty("concurrentClients");
  });

  it("refuses a period that ends before it starts, no open day and equal times", () => {
    const errors = validateDraft(
      {
        ...base(),
        availableFrom: "2027-03-10",
        availableUntil: "2027-03-01",
        hoursEnabled: true,
        hours: [],
      },
      t,
      "p1",
    );
    expect(errors).toMatchObject({
      availablePeriod: "msg:errors.availablePeriod",
      hours: "msg:errors.hoursEmpty",
    });
    const same = validateDraft(
      { ...base(), hoursEnabled: true, hours: [{ weekday: 1, startTime: "10:00", endTime: "10:00" }] },
      t,
      "p1",
    );
    expect(same.hours).toBe("msg:errors.hoursSameTime");
  });

  it("puts API validation details for hours and dates on the schedule fields", () => {
    const error = new ApiError({
      status: 400,
      code: "VALIDATION_FAILED",
      message: "Invalid",
      details: [
        { field: "hours.1", code: "OVERLAP", message: "overlap" },
        { field: "availableUntil", code: "BEFORE_FROM", message: "before" },
      ],
    });
    expect(apiErrorToFields(error, t)).toEqual({ hours: "overlap", availablePeriod: "before" });
  });
});

describe("Only one booking per day", () => {
  it("is ticked for a new service and sends onePerDay, never a number", () => {
    const values = { ...emptyServiceValues(), basePrice: 1000, categoryId: "c1" };
    expect(values.onePerDay).toBe(true);
    const body = valuesToBody({ ...values, onePerDay: false });
    expect(body).toMatchObject({ onePerDay: false });
    expect(body).not.toHaveProperty("maxEventsPerDay");
  });

  it("puts an old maxEventsPerDay validation error on the checkbox", () => {
    const error = new ApiError({
      status: 400,
      code: "VALIDATION_FAILED",
      message: "Invalid",
      details: [{ field: "maxEventsPerDay", code: "MAX", message: "too many" }],
    });
    expect(apiErrorToFields(error, (k) => k)).toEqual({ onePerDay: "too many" });
  });
});
