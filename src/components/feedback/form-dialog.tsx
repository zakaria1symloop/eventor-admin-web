"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState, type ReactNode } from "react";
import {
  Controller,
  useForm,
  type DefaultValues,
  type FieldValues,
  type Path,
  type Resolver,
  type UseFormReturn,
} from "react-hook-form";
import { useTranslations } from "next-intl";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Checkbox,
  Field,
  Select,
  TextInput,
  Textarea,
  Toggle,
  type SelectOption,
} from "@/components/forms/fields";
import { ApiError } from "@/lib/api/errors";
import { Banner } from "./banner";
import { DialogContent, DialogRoot, DrawerContent } from "./dialog";
import { UnsavedChangesGuard, useUnsavedChanges } from "./unsaved-changes-guard";

export type FormFieldConfig<T extends FieldValues> =
  | {
      name: Path<T>;
      label: ReactNode;
      type: "text" | "email" | "password" | "number" | "textarea";
      placeholder?: string;
      hint?: ReactNode;
      required?: boolean;
    }
  | {
      name: Path<T>;
      label: ReactNode;
      type: "select";
      options: SelectOption[];
      placeholder?: string;
      hint?: ReactNode;
      required?: boolean;
    }
  | { name: Path<T>; label: ReactNode; type: "checkbox" | "toggle"; hint?: ReactNode; required?: boolean };

export interface FormDialogProps<TSchema extends z.ZodType<FieldValues, FieldValues>> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  schema: TSchema;
  defaultValues: DefaultValues<z.input<TSchema>>;
  /** Declarative fields, or a render function for custom layouts. */
  fields: FormFieldConfig<z.input<TSchema>>[] | ((form: UseFormReturn<z.input<TSchema>>) => ReactNode);
  submitLabel?: ReactNode;
  /** Async. Throwing an ApiError VALIDATION_FAILED maps `details[]` onto fields. */
  onSubmit: (values: z.output<TSchema>) => void | Promise<void>;
  width?: number;
  /** Left side of the footer ("Role can't be changed after creation"). */
  footerNote?: ReactNode;
}

function renderFields<T extends FieldValues>(form: UseFormReturn<T>, fields: FormFieldConfig<T>[]) {
  return fields.map((f) => (
    <Controller
      key={f.name}
      control={form.control}
      name={f.name}
      render={({ field, fieldState }) => {
        const error = fieldState.error?.message;
        if (f.type === "checkbox") {
          return <Checkbox label={f.label} checked={!!field.value} onCheckedChange={field.onChange} />;
        }
        if (f.type === "toggle") {
          return <Toggle label={f.label} checked={!!field.value} onCheckedChange={field.onChange} />;
        }
        return (
          <Field label={f.label} required={f.required} hint={f.hint} error={error}>
            {f.type === "select" ? (
              <Select
                name={field.name}
                value={(field.value as string) ?? ""}
                onChange={field.onChange}
                onBlur={field.onBlur}
                options={f.options}
                placeholder={("placeholder" in f && f.placeholder) || ""}
              />
            ) : f.type === "textarea" ? (
              <Textarea
                {...field}
                value={(field.value as string) ?? ""}
                placeholder={"placeholder" in f ? f.placeholder : undefined}
              />
            ) : (
              <TextInput
                {...field}
                value={(field.value as string | number) ?? ""}
                type={f.type}
                placeholder={"placeholder" in f ? f.placeholder : undefined}
              />
            )}
          </Field>
        );
      }}
    />
  ));
}

function useFormPanel<TSchema extends z.ZodType<FieldValues, FieldValues>>(props: FormDialogProps<TSchema>) {
  const form = useForm<z.input<TSchema>, unknown, z.output<TSchema>>({
    resolver: zodResolver(props.schema as never) as unknown as Resolver<
      z.input<TSchema>,
      unknown,
      z.output<TSchema>
    >,
    defaultValues: props.defaultValues,
  });
  const [formError, setFormError] = useState<string | null>(null);

  const { reset } = form;
  const { open, defaultValues } = props;
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setFormError(null);
  }
  useEffect(() => {
    if (open) reset(defaultValues);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const submit = form.handleSubmit(async (values) => {
    setFormError(null);
    try {
      await props.onSubmit(values);
      form.reset(form.getValues());
      props.onOpenChange(false);
    } catch (e) {
      if (e instanceof ApiError && e.fieldErrors.length > 0) {
        for (const d of e.fieldErrors) {
          form.setError(d.field as Path<z.input<TSchema>>, { message: d.message });
        }
      } else {
        setFormError(e instanceof Error ? e.message : String(e));
      }
    }
  });

  const body = (
    <form id="form-panel" onSubmit={submit} className="flex flex-col gap-4" noValidate>
      {formError && <Banner tone="red" title={formError} />}
      {typeof props.fields === "function"
        ? props.fields(form as unknown as UseFormReturn<z.input<TSchema>>)
        : renderFields(form as unknown as UseFormReturn<z.input<TSchema>>, props.fields)}
    </form>
  );
  return { form, body };
}

function Footer({
  submitting,
  submitLabel,
  onCancel,
  note,
}: {
  submitting: boolean;
  submitLabel?: ReactNode;
  onCancel: () => void;
  note?: ReactNode;
}) {
  const t = useTranslations("common");
  return (
    <>
      <span className="me-auto text-12 text-muted">{note}</span>
      <Button variant="secondary" onClick={onCancel} disabled={submitting}>
        {t("cancel")}
      </Button>
      <Button type="submit" form="form-panel" loading={submitting}>
        {submitLabel ?? t("save")}
      </Button>
    </>
  );
}

export function FormDialog<TSchema extends z.ZodType<FieldValues, FieldValues>>(
  props: FormDialogProps<TSchema>,
) {
  const { form, body } = useFormPanel(props);
  return (
    <DialogRoot open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent
        title={props.title}
        description={props.description}
        width={props.width ?? 520}
        footer={
          <Footer
            submitting={form.formState.isSubmitting}
            submitLabel={props.submitLabel}
            note={props.footerNote}
            onCancel={() => props.onOpenChange(false)}
          />
        }
      >
        {body}
      </DialogContent>
    </DialogRoot>
  );
}

/** Same as FormDialog in a 460–520 px side panel; closing with changes asks first (STA-06). */
export function FormDrawer<TSchema extends z.ZodType<FieldValues, FieldValues>>(
  props: FormDialogProps<TSchema>,
) {
  const { form, body } = useFormPanel(props);
  return (
    <UnsavedChangesGuard when={props.open && form.formState.isDirty}>
      <DrawerInner {...props} submitting={form.formState.isSubmitting}>
        {body}
      </DrawerInner>
    </UnsavedChangesGuard>
  );
}

function DrawerInner<TSchema extends z.ZodType<FieldValues, FieldValues>>(
  props: FormDialogProps<TSchema> & { submitting: boolean; children: ReactNode },
) {
  const { confirmLeave } = useUnsavedChanges();
  const requestClose = () => confirmLeave(() => props.onOpenChange(false));
  return (
    <DialogRoot open={props.open} onOpenChange={(o) => (o ? props.onOpenChange(true) : requestClose())}>
      <DrawerContent
        title={props.title}
        description={props.description}
        width={props.width ?? 480}
        footer={
          <Footer
            submitting={props.submitting}
            submitLabel={props.submitLabel}
            note={props.footerNote}
            onCancel={requestClose}
          />
        }
      >
        {props.children}
      </DrawerContent>
    </DialogRoot>
  );
}
