import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import { ApiError } from "@/lib/api/errors";
import type { Category } from "@/lib/api/catalog";
import { DeleteCategoryDialog } from "./category-dialogs";

const deleteCategory = vi.fn();
vi.mock("@/lib/api/catalog", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/catalog")>()),
  deleteCategory: (...args: unknown[]) => deleteCategory(...args),
}));

const cat = (id: string, nameEn: string, servicesCount = 0): Category => ({
  id,
  slug: nameEn.toLowerCase(),
  nameEn,
  nameAr: "",
  descriptionEn: null,
  descriptionAr: null,
  icon: "camera",
  position: 0,
  isVisible: true,
  servicesCount,
  providersCount: 2,
  bookings30dCount: 0,
  missingTranslation: true,
});

describe("CAT delete with services", () => {
  it("asks where to move the services, then deletes with moveTo", async () => {
    const user = userEvent.setup();
    const photo = cat("c1", "Photography", 4);
    const video = cat("c2", "Video");
    deleteCategory
      .mockRejectedValueOnce(
        new ApiError({
          status: 409,
          code: "CATEGORY_HAS_SERVICES",
          message: "Has services",
          details: { servicesCount: 4, providersCount: 2 },
        }),
      )
      .mockResolvedValueOnce({});
    const onDeleted = vi.fn();

    renderWithProviders(
      <DeleteCategoryDialog
        category={photo}
        categories={[photo, video]}
        onOpenChange={() => undefined}
        onDeleted={onDeleted}
      />,
    );

    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Delete" }));
    expect(deleteCategory).toHaveBeenCalledWith("c1");

    const move = await screen.findByRole("dialog", { name: /Move 4 services before deleting Photography/ });
    const select = within(move).getByRole("combobox");
    expect(within(select).queryByRole("option", { name: "Photography" })).not.toBeInTheDocument();

    await user.click(within(move).getByRole("button", { name: "Move and delete" }));
    expect(await within(move).findByText("Pick a category")).toBeInTheDocument();
    expect(within(move).queryByText("Pick a reason")).not.toBeInTheDocument();
    expect(deleteCategory).toHaveBeenCalledTimes(1);

    await user.selectOptions(select, "c2");
    await user.click(within(move).getByRole("button", { name: "Move and delete" }));
    await waitFor(() => expect(deleteCategory).toHaveBeenLastCalledWith("c1", "c2"));
    expect(onDeleted).toHaveBeenCalled();
  });
});
