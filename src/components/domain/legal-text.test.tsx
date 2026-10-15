import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LegalText } from "./legal-text";

describe("LegalText", () => {
  it("renders headings, bullets, bold and links as elements, never as HTML", () => {
    const { container } = render(
      <LegalText
        body={[
          "Last updated: 15 October 2026",
          "## 1. Data we collect",
          "- **Account data:** your name.\n- Delete it at https://admin.eventor.dz/en/delete-account.",
          "<script>alert(1)</script>",
        ].join("\n\n")}
      />,
    );
    expect(screen.getByRole("heading", { name: "1. Data we collect" })).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByText("Account data:").closest("strong")).not.toBeNull();
    expect(screen.getByRole("link")).toHaveAttribute("href", "https://admin.eventor.dz/en/delete-account");
    expect(container.querySelector("script")).toBeNull();
    expect(screen.getByText("<script>alert(1)</script>")).toBeInTheDocument();
  });
});
