import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { packTotals } from "@/lib/api/packs";
import { renderWithProviders } from "@/test/render";
import { PackPriceCard } from "./pack-form";
import { ServicePicker, type PickedService } from "./service-picker";

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

const listServices = vi.fn();
vi.mock("@/lib/api/services", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/services")>()),
  listServices: (...args: unknown[]) => listServices(...args),
}));

const svc = (id: string, titleEn: string, basePrice: string) => ({
  id,
  titleEn,
  titleAr: "",
  basePrice,
  coverUrl: null,
});

function Harness({ providerId }: { providerId: string }) {
  const [items, setItems] = useState<PickedService[]>([]);
  const [price, setPrice] = useState<number | null>(300000);
  const { sum } = packTotals(
    items.map((i) => i.price),
    price,
  );
  return (
    <>
      <ServicePicker providerId={providerId} value={items} onChange={setItems} />
      <PackPriceCard
        sum={sum}
        price={price}
        maxGuests={null}
        onPrice={setPrice}
        onMaxGuests={() => undefined}
      />
    </>
  );
}

beforeEach(() => listServices.mockReset());

describe("PCK-03 service picker", () => {
  it("asks for the provider first", () => {
    renderWithProviders(<ServicePicker providerId={null} value={[]} onChange={() => undefined} />);
    expect(screen.getByText(/Pick the provider first/)).toBeInTheDocument();
    expect(listServices).not.toHaveBeenCalled();
  });

  it("only lists the provider's published services and updates the savings live", async () => {
    const user = userEvent.setup();
    listServices.mockResolvedValue({
      data: [
        svc("s1", "Grande salle", "220000"),
        svc("s2", "Photo package", "45000"),
        svc("s3", "Menu", "75000"),
      ],
      meta: { page: 1, limit: 100, total: 3, totalPages: 1, counts: {} },
    });
    renderWithProviders(<Harness providerId="prov-1" />);

    await screen.findByText("Grande salle");
    expect(listServices).toHaveBeenCalledWith(
      expect.objectContaining({ providerId: "prov-1", tab: "published" }),
    );
    expect(screen.getByTestId("pack-savings")).toHaveTextContent("Add services and a price");

    await user.click(screen.getByRole("checkbox", { name: /Grande salle/ }));
    // 220 000 < 300 000: not a saving yet.
    expect(screen.getByTestId("pack-savings")).toHaveTextContent("Must be lower");

    await user.click(screen.getByRole("checkbox", { name: /Photo package/ }));
    await user.click(screen.getByRole("checkbox", { name: /Menu/ }));
    await waitFor(() => expect(screen.getByTestId("pack-sum")).toHaveTextContent("340 000 DA"));
    expect(screen.getByTestId("pack-savings")).toHaveTextContent("Client saves 40 000 DA (11.8%)");
    expect(screen.getByText("3 / 6")).toBeInTheDocument();

    // Removing an item recomputes.
    await user.click(screen.getByRole("button", { name: "Remove Photo package" }));
    expect(screen.getByTestId("pack-sum")).toHaveTextContent("295 000 DA");
    expect(screen.getByTestId("pack-savings")).toHaveTextContent("Must be lower");
  });

  it("computes totals", () => {
    expect(packTotals(["220000.00", "45000"], 240000)).toEqual({
      sum: 265000,
      savings: 25000,
      percent: 9.4,
      belowSum: true,
    });
  });
});
