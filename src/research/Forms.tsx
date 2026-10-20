import { useForm } from "react-hook-form";
import type { ReactNode } from "react";
import { z } from "zod";
import { Button, Modal } from "../components/ui";
export interface Field {
  key: string;
  label: string;
  type?:
    "text" | "textarea" | "date" | "number" | "checkbox" | "select" | "multi";
  required?: boolean;
  options?: { value: string; label: string }[];
  hint?: string;
  disabled?: boolean;
}
export type Values = Record<string, string | string[] | boolean>;
export const formValues = (x: object): Values =>
  Object.fromEntries(
    Object.entries(x).map(([k, v]) => [
      k,
      v === null ? "" : typeof v === "number" ? String(v) : v,
    ]),
  ) as Values;
export function Editor({
  title,
  fields,
  initial = {},
  onSave,
  onClose,
  busy,
  children,
}: {
  title: string;
  fields: Field[];
  initial?: Values;
  onSave: (v: Values) => Promise<void>;
  onClose: () => void;
  busy: boolean;
  children?: ReactNode;
}) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ defaultValues: initial });
  return (
    <Modal title={title} onClose={onClose}>
      {children}
      <form
        className="research-form"
        onSubmit={handleSubmit(async (v) => {
          try {
            const values = {
              ...initial,
              ...Object.fromEntries(
                Object.entries(v).filter(([, value]) => value !== undefined),
              ),
            };
            for (const f of fields) {
              const value = values[f.key];
              if (typeof value === "string")
                z.string()
                  .max(f.type === "textarea" ? 50000 : 2000)
                  .parse(value);
              if (
                f.required &&
                (!value || (Array.isArray(value) && !value.length))
              )
                throw Error(`${f.label} is required`);
            }
            await onSave(values);
          } catch (e) {
            setError("root", {
              message: e instanceof Error ? e.message : "Unable to save",
            });
          }
        })}
      >
        {fields.map((f) => (
          <label key={f.key}>
            {f.label}
            {f.type === "textarea" ? (
              <textarea
                rows={4}
                {...register(f.key)}
                required={f.required}
                disabled={f.disabled}
              />
            ) : f.type === "select" || f.type === "multi" ? (
              <select
                {...register(f.key)}
                multiple={f.type === "multi"}
                required={f.required}
                disabled={f.disabled}
              >
                {f.type === "select" && !f.required && (
                  <option value="">Not specified</option>
                )}
                {f.options?.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type={f.type || "text"}
                {...register(f.key)}
                required={f.required}
                disabled={f.disabled}
                min={f.type === "number" ? 0 : undefined}
              />
            )}{" "}
            {f.hint && <small>{f.hint}</small>}
          </label>
        ))}
        {errors.root && (
          <p role="alert" className="error-box">
            {errors.root.message}
          </p>
        )}
        <Button disabled={busy || isSubmitting} type="submit">
          Save changes
        </Button>
      </form>
    </Modal>
  );
}
export const choices = (values: string[]) =>
  values.map((value) => ({ value, label: value }));
