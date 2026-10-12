import { CircleX } from "lucide-react";
import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";

const control =
  "w-full min-h-10 px-3 py-2 rounded-md border border-line-input bg-surface text-ink text-base leading-6 " +
  "placeholder:text-ink-subtle hover:border-ink-muted " +
  "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent focus-visible:border-accent " +
  "aria-invalid:border-danger aria-invalid:shadow-[inset_0_0_0_1px_var(--danger)] " +
  "disabled:bg-sunken disabled:text-ink-subtle disabled:cursor-not-allowed pointer-coarse:min-h-11";

type Common = {
  /** Also used as the `name` unless one is given. */
  id: string;
  label: string;
  help?: string;
  error?: string;
};

function describedBy(id: string, help?: string, error?: string) {
  const ids = [error && `${id}-error`, help && `${id}-help`].filter(Boolean);
  return ids.length ? ids.join(" ") : undefined;
}

function Messages({ id, help, error }: Pick<Common, "id" | "help" | "error">) {
  return (
    <>
      {help && (
        <span id={`${id}-help`} className="text-small text-ink-muted">
          {help}
        </span>
      )}
      {error && (
        <span id={`${id}-error`} className="flex items-start gap-1.5 text-small text-danger-ink">
          <CircleX className="mt-px size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
          {error}
        </span>
      )}
    </>
  );
}

export function TextField({
  id,
  label,
  help,
  error,
  className = "",
  ...rest
}: Common & Omit<InputHTMLAttributes<HTMLInputElement>, "id">) {
  return (
    <div className={`flex max-w-105 flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="text-label font-semibold">
        {label}
      </label>
      <input
        id={id}
        name={id}
        className={control}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, help, error)}
        {...rest}
      />
      <Messages id={id} help={help} error={error} />
    </div>
  );
}

export function TextAreaField({
  id,
  label,
  help,
  error,
  className = "",
  ...rest
}: Common & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id">) {
  return (
    <div className={`flex max-w-105 flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="text-label font-semibold">
        {label}
      </label>
      <textarea
        id={id}
        name={id}
        className={`${control} min-h-26 resize-y`}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, help, error)}
        {...rest}
      />
      <Messages id={id} help={help} error={error} />
    </div>
  );
}
