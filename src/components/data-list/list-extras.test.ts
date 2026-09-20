import { describe, expect, it } from "vitest";
import { quickFilterMatches } from "./list-extras";

describe("quickFilterMatches", () => {
  it("never marks a card that only clears filters as selected", () => {
    expect(quickFilterMatches({ translation: null, usage: null }, {})).toBe(false);
    expect(quickFilterMatches({ providers: null }, {})).toBe(false);
  });

  it("matches set values, and null keys must be empty", () => {
    expect(quickFilterMatches({ usage: "used" }, { usage: "used" })).toBe(true);
    expect(quickFilterMatches({ usage: "used" }, {})).toBe(false);
    expect(quickFilterMatches({ date: "today", level: null }, { date: "today" })).toBe(true);
    expect(quickFilterMatches({ date: "today", level: null }, { date: "today", level: "x" })).toBe(false);
    expect(quickFilterMatches({ source: ["ios", "web"] }, { source: ["web", "ios"] })).toBe(true);
  });
});
