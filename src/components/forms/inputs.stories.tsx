import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { Field } from "./fields";
import {
  DateInput,
  DateRangeInput,
  EmailInput,
  NumberInput,
  PasswordInput,
  PhoneInput,
  SegmentedControl,
  TimeSelect,
} from "./inputs";
import { AsyncSelect, MultiSelect, type Option } from "./select-inputs";

const meta: Meta = { title: "Forms/Inputs" };
export default meta;
type Story = StoryObj;

const wilayas: Option[] = [
  "Adrar",
  "Alger",
  "Annaba",
  "Batna",
  "Béjaïa",
  "Blida",
  "Constantine",
  "Oran",
  "Sétif",
  "Tipaza",
  "Tlemcen",
  "Tizi Ouzou",
].map((w) => ({
  value: w,
  label: w,
}));

async function searchUsers(q: string): Promise<Option[]> {
  await new Promise((r) => setTimeout(r, 400));
  return [
    { value: "u1", label: "Karim Belkacem", sub: "Studio Lumière" },
    { value: "u2", label: "Amina Benali", sub: "amina.benali@email.com" },
    { value: "u3", label: "Farid Ouali", sub: "Salle Yasmine" },
  ].filter((o) => o.label.toLowerCase().includes(q.toLowerCase()));
}

function AllInputs() {
  const [fee, setFee] = useState<number | null>(10);
  const [price, setPrice] = useState<number | null>(45000);
  const [phone, setPhone] = useState("+213550123456");
  const [multi, setMulti] = useState(["Alger"]);
  const [asyncValue, setAsyncValue] = useState<Option | null>(null);
  const [role, setRole] = useState("provider");
  const [date, setDate] = useState("2026-03-14");
  const [range, setRange] = useState({ from: "", to: "" });
  const [time, setTime] = useState("18:00");
  return (
    <div className="grid max-w-[520px] gap-4">
      <div className="grid grid-cols-2 gap-4">
        <Field label="Commission" hint="Applied to new bookings">
          <NumberInput value={fee} onValueChange={setFee} suffix="%" />
        </Field>
        <Field label="Base price">
          <NumberInput value={price} onValueChange={setPrice} suffix="DA" />
        </Field>
      </div>
      <Field label="Phone" hint={`Stored as ${phone}`}>
        <PhoneInput value={phone} onValueChange={setPhone} />
      </Field>
      <Field label="Email">
        <EmailInput defaultValue="sara@eventor.dz" />
      </Field>
      <Field label="Password" hint="10+ characters, one number">
        <PasswordInput defaultValue="secret12345" />
      </Field>
      <Field label="Wilayas served">
        <MultiSelect value={multi} onValueChange={setMulti} options={wilayas} placeholder="Add a wilaya…" />
      </Field>
      <Field label="Provider">
        <AsyncSelect
          value={asyncValue}
          onValueChange={setAsyncValue}
          queryKey={["story-users-search"]}
          queryFn={searchUsers}
          placeholder="Search providers…"
        />
      </Field>
      <Field label="Role">
        <SegmentedControl
          value={role}
          onValueChange={setRole}
          options={[
            { value: "client", label: "Client" },
            { value: "provider", label: "Provider" },
          ]}
        />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Event date">
          <DateInput value={date} onValueChange={setDate} />
        </Field>
        <Field label="Start time">
          <TimeSelect value={time} onValueChange={setTime} from="08:00" to="23:30" />
        </Field>
      </div>
      <Field label="Joined between">
        <DateRangeInput value={range} onValueChange={setRange} />
      </Field>
      <Field label="Price (error)" error="Must be at least 1 000 DA">
        <NumberInput value={500} onValueChange={() => {}} suffix="DA" />
      </Field>
    </div>
  );
}

export const Default: Story = { render: () => <AllInputs /> };
export const RTL: Story = { render: () => <AllInputs />, globals: { locale: "ar" } };
