import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/errors";
import {
  apiErrorToFields,
  firstErrorField,
  langForErrors,
  publishErrorsToFields,
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
