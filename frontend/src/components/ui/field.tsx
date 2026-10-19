import { ChevronDown, CircleX } from "lucide-react";
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

const control =
  "w-full rounded-sm border border-line-input bg-canvas px-3.5 text-ink " +
  "placeholder:text-ink-muted/80 hover:border-ink " +
  "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-signal " +
  "aria-invalid:border-danger disabled:cursor-not-allowed disabled:bg-sunken disabled:text-ink-muted";

const sizes = {
  md: "min-h-11 text-[15px]",
  // 16px stops iOS zooming into the field.
  lg: "min-h-12 text-base",
} as const;

type Common = {
  /** Also used as the `name` unless one is given. */
  id: string;
  label: ReactNode;
  help?: string;
  error?: string;
  size?: keyof typeof sizes;
};

function describedBy(id: string, help?: string, error?: string) {
  const ids = [error && `${id}-error`, help && `${id}-help`].filter(Boolean);
  return ids.length ? ids.join(" ") : undefined;
}

function Messages({ id, help, error }: Pick<Common, "id" | "help" | "error">) {
  return (
    <>
      {help && (
        <span id={`${id}-help`} className="text-[13px] leading-[19px] text-ink-muted">
          {help}
        </span>
      )}
      {error && (
        <span id={`${id}-error`} className="flex items-start gap-1.5 text-[13px] leading-[19px] text-danger-ink">
          <CircleX className="mt-px size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
          {error}
        </span>
      )}
    </>
  );
}

function Label({ htmlFor, children }: { htmlFor: string; children: ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="t-label">
      {children}
    </label>
  );
}

export function TextField({
  id,
  label,
  help,
  error,
  size = "md",
  className = "",
  ...rest
}: Common & Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "size">) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <Label htmlFor={id}>{label}</Label>
      <input
        id={id}
        name={id}
        className={`${control} ${sizes[size]}`}
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
  rows = 4,
  ...rest
}: Common & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id" | "size">) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <Label htmlFor={id}>{label}</Label>
      <textarea
        id={id}
        name={id}
        rows={rows}
        className={`${control} min-h-11 resize-y py-3 text-[15px] leading-[22px]`}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, help, error)}
        {...rest}
      />
      <Messages id={id} help={help} error={error} />
    </div>
  );
}

export function SelectField({
  id,
  label,
  help,
  error,
  size = "md",
  className = "",
  children,
  ...rest
}: Common & Omit<SelectHTMLAttributes<HTMLSelectElement>, "id" | "size">) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <select
          id={id}
          name={id}
          className={`${control} ${sizes[size]} cursor-pointer appearance-none pr-10`}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, help, error)}
          {...rest}
        >
          {children}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted"
          strokeWidth={1.75}
          aria-hidden="true"
        />
      </div>
      <Messages id={id} help={help} error={error} />
    </div>
  );
}

/** A native select without a visible label, for filters. Pass `aria-label`. */
export function BareSelect({ className = "", children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className={`relative ${className}`}>
      <select
        className={`${control} min-h-10 cursor-pointer appearance-none pr-9 text-sm font-semibold`}
        {...rest}
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted"
        strokeWidth={1.75}
        aria-hidden="true"
      />
    </div>
  );
}

/** A labelled checkbox row. The whole row is the click target. */
export function CheckField({
  children,
  className = "",
  ...rest
}: { children: ReactNode } & Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  return (
    <label className={`flex cursor-pointer items-center gap-3 ${className}`}>
      <input type="checkbox" className="size-5 shrink-0 cursor-pointer accent-ink" {...rest} />
      {children}
    </label>
  );
}
