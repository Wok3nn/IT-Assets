"use client";
import { createContext, useContext, useActionState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { submitDatabaseAction } from "./actions";
const Errors = createContext<Record<string, string>>({});
export function FieldError({ name }: { name: string }) {
  const error = useContext(Errors)[name];
  return error ? <span role="alert" className="block text-sm text-rose-700 dark:text-rose-300">{error}</span> : null;
}
export function Form({
  op,
  id,
  version,
  revision,
  children,
  step,
}: {
  op: string;
  id?: string;
  version?: string;
  revision?: number;
  children: React.ReactNode;
  step?: string;
}) {
  const [state, action, pending] = useActionState(submitDatabaseAction, {
    error: "",
  });
  const ref = useRef<HTMLFormElement>(null),
    saved = useRef<Record<string, string>>({});
  const pathname = usePathname();
  useEffect(() => {
    if (state.error && ref.current)
      for (const input of Array.from(ref.current.elements)) {
        if (
          input instanceof HTMLInputElement ||
          input instanceof HTMLSelectElement
        ) {
          if (input.type === "password") input.value = "";
          else if (
            saved.current[input.name] !== undefined &&
            input.type !== "hidden"
          )
            if (input instanceof HTMLInputElement && input.type === "checkbox")
              input.checked = saved.current[input.name] === "true";
            else input.value = saved.current[input.name];
        }
      }
  }, [state]);
  return (
    <form
      ref={ref}
      action={action}
      className="space-y-3"
      onSubmit={() => {
        const values: Record<string, string> = {};
        for (const input of Array.from(ref.current?.elements ?? []))
          if (
            (input instanceof HTMLInputElement ||
              input instanceof HTMLSelectElement) &&
            !["password", "hidden"].includes(input.type)
          )
            values[input.name] =
              input instanceof HTMLInputElement && input.type === "checkbox"
                ? String(input.checked)
                : input.value;
        saved.current = values;
      }}
    >
      <div hidden>
      <input type="hidden" name="op" value={op} />
      <input
        type="hidden"
        name="context"
        value={pathname.startsWith("/setup") ? "setup" : "management"}
      />
      <input type="hidden" name="step" value={step ?? "3"} />
      <input type="hidden" name="revision" value={revision ?? 0} />
      <input type="hidden" name="id" value={id ?? ""} />
      <input type="hidden" name="version" value={version ?? ""} />
      </div>
      <fieldset disabled={pending} className="flex min-w-0 flex-col gap-3 [&>button]:self-start">
        <Errors.Provider value={state.fields ?? {}}>{children}</Errors.Provider>
      </fieldset>
      {pending && <p role="status">Working… Please wait.</p>}
      {state.error && !pending && (
        <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">
          {state.error}
        </p>
      )}
    </form>
  );
}
