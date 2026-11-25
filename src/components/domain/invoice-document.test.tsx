import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "@/test/render";
import { contentDispositionFileName, type Invoice } from "@/lib/api/bookings";
import { InvoiceDocument } from "./invoice-document";

const party = { id: "p", name: "Sofiane Brahimi", businessName: null, email: "s@x.dz", phone: null };
const invoice = (issuer: Partial<Invoice["issuer"]>): Invoice => ({
  id: "i1",
  bookingId: "b1",
  bookingReference: "EVT-001918",
  number: "INV-2026-0419",
  version: 1,
  issuedAt: "2026-11-25T10:00:00.000Z",
  currency: "DZD",
  issuer: { name: "Eventor", address: "", nif: "", rc: "", email: "", phone: "", ...issuer },
  client: party,
  provider: { ...party, id: "q", name: "Karim Belkacem" },
  titleEn: "Wedding photo",
  titleAr: "تصوير",
  eventDate: "2026-12-19",
  eventType: "wedding",
  lines: [],
  subtotal: "170000.00",
  discountTotal: "0.00",
  total: "170000.00",
  feePercent: "10",
  feeAmount: "17000.00",
  providerAmount: "153000.00",
  pdfReady: true,
  sentToClientAt: null,
  versions: [1],
});

describe("L-27 invoice", () => {
  it("hides the issuer fields that are empty — no bare “NIF · RC”", () => {
    renderWithProviders(<InvoiceDocument invoice={invoice({})} />);
    const header = screen.getByRole("article").querySelector("header")!;
    expect(header.textContent).not.toMatch(/NIF|RC|·\s*$/);
    expect(header.textContent).toContain("Eventor");
  });

  it("shows only the filled ones, with a separator only between two values", () => {
    const { unmount } = renderWithProviders(
      <InvoiceDocument invoice={invoice({ nif: "001216099999999" })} />,
    );
    expect(screen.getByText("NIF 001216099999999")).toBeInTheDocument();
    expect(screen.queryByText(/RC/)).not.toBeInTheDocument();
    unmount();
    renderWithProviders(
      <InvoiceDocument
        invoice={invoice({ name: "Symloop SARL", address: "Alger", nif: "0012", rc: "16/00-123" })}
      />,
    );
    expect(screen.getByText("Symloop SARL")).toBeInTheDocument();
    expect(screen.getByText("Alger")).toBeInTheDocument();
    expect(screen.getByText("NIF 0012 · RC 16/00-123")).toBeInTheDocument();
  });

  it("reads the PDF file name from Content-Disposition", () => {
    expect(contentDispositionFileName('inline; filename="INV-2026-0419.pdf"')).toBe("INV-2026-0419.pdf");
    expect(contentDispositionFileName("attachment; filename*=UTF-8''INV%202026.pdf")).toBe("INV 2026.pdf");
    expect(contentDispositionFileName("attachment; filename=INV-1.pdf")).toBe("INV-1.pdf");
    expect(contentDispositionFileName("inline")).toBeNull();
    expect(contentDispositionFileName(null)).toBeNull();
  });
});
