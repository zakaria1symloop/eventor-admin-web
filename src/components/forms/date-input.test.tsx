import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import { DateInput } from "./inputs";

describe("DateInput", () => {
  it("opens the browser calendar on a click anywhere in the field", () => {
    renderWithProviders(<DateInput aria-label="Event date" value="" onValueChange={() => {}} />);
    const input = screen.getByLabelText("Event date") as HTMLInputElement;
    const showPicker = vi.fn();
    input.showPicker = showPicker;

    fireEvent.click(input);

    expect(showPicker).toHaveBeenCalledOnce();
  });

  it("does not open it when disabled, and survives a browser that refuses", () => {
    renderWithProviders(
      <>
        <DateInput aria-label="Off" value="" onValueChange={() => {}} disabled />
        <DateInput aria-label="Refusing" value="" onValueChange={() => {}} />
      </>,
    );
    const off = screen.getByLabelText("Off") as HTMLInputElement;
    const refusing = screen.getByLabelText("Refusing") as HTMLInputElement;
    off.showPicker = vi.fn();
    refusing.showPicker = vi.fn(() => {
      throw new DOMException("not allowed", "NotAllowedError");
    });

    fireEvent.click(off);
    expect(() => fireEvent.click(refusing)).not.toThrow();

    expect(off.showPicker).not.toHaveBeenCalled();
  });

  it("still accepts a typed date", () => {
    const onValueChange = vi.fn();
    renderWithProviders(<DateInput aria-label="Typed" value="" onValueChange={onValueChange} />);

    fireEvent.change(screen.getByLabelText("Typed"), { target: { value: "2026-11-14" } });

    expect(onValueChange).toHaveBeenCalledWith("2026-11-14");
  });
});
