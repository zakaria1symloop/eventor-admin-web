import { fireEvent, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import { WeeklyHoursEditor, type WeeklyHour } from "./weekly-hours";

function Harness({ initial, onChange }: { initial: WeeklyHour[]; onChange: (v: WeeklyHour[]) => void }) {
  const [value, setValue] = useState(initial);
  return (
    <WeeklyHoursEditor
      value={value}
      onValueChange={(v) => {
        setValue(v);
        onChange(v);
      }}
    />
  );
}

describe("WeeklyHoursEditor", () => {
  it("opens a day with default hours and closes it again", () => {
    const onChange = vi.fn();
    renderWithProviders(<Harness initial={[]} onChange={onChange} />);

    fireEvent.click(screen.getByRole("switch", { name: "Friday" }));
    expect(onChange).toHaveBeenLastCalledWith([{ weekday: 5, startTime: "09:00", endTime: "18:00" }]);

    fireEvent.click(screen.getByRole("switch", { name: "Friday" }));
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it("marks an overnight range and edits its end time", () => {
    const onChange = vi.fn();
    renderWithProviders(
      <Harness initial={[{ weekday: 6, startTime: "20:00", endTime: "02:00" }]} onChange={onChange} />,
    );

    expect(screen.getByText("next day")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Saturday: to"), { target: { value: "23:00" } });

    expect(onChange).toHaveBeenLastCalledWith([{ weekday: 6, startTime: "20:00", endTime: "23:00" }]);
    expect(screen.queryByText("next day")).not.toBeInTheDocument();
  });
});
