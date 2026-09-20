import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { Checkbox, Field, RadioCards, Select, TextInput, Textarea, Toggle } from "./fields";

const meta: Meta = { title: "Forms/Fields" };
export default meta;
type Story = StoryObj;

function AllFields() {
  const [checked, setChecked] = useState(true);
  const [toggle, setToggle] = useState(false);
  const [radio, setRadio] = useState("cancel");
  return (
    <div className="grid max-w-[520px] gap-4">
      <Field label="Full name" required hint="As shown on the ID card">
        <TextInput placeholder="Karim Belkacem" />
      </Field>
      <Field label="Email" required error="This email is already used.">
        <TextInput defaultValue="karim@studiolumiere.dz" />
      </Field>
      <Field label="Reason" required>
        <Select
          placeholder="Select…"
          options={[
            { value: "a", label: "Repeated no-shows" },
            { value: "b", label: "Fraud" },
          ]}
        />
      </Field>
      <Field label="Message to the user">
        <Textarea placeholder="Why are you changing this booking?" />
      </Field>
      <Field label="Disabled">
        <TextInput disabled defaultValue="usr_8f21c4" />
      </Field>
      <Checkbox label="Notify client and provider" checked={checked} onCheckedChange={setChecked} />
      <Checkbox label="Indeterminate" checked="indeterminate" onCheckedChange={() => {}} />
      <Toggle label="Shown in app" checked={toggle} onCheckedChange={setToggle} />
      <RadioCards
        value={radio}
        onValueChange={setRadio}
        options={[
          {
            value: "cancel",
            label: "Cancel them and notify the clients",
            description: "Clients can book someone else.",
          },
          { value: "keep", label: "Keep them", description: "Only new bookings are blocked." },
        ]}
      />
    </div>
  );
}

export const Default: Story = { render: () => <AllFields /> };
export const RTL: Story = { render: () => <AllFields />, globals: { locale: "ar" } };
