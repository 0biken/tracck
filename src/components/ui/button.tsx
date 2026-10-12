import { LoaderCircle } from "lucide-react";
import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "danger-solid";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-md border border-transparent " +
  "font-semibold whitespace-nowrap no-underline transition-colors duration-150 ease-standard " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent " +
  "disabled:bg-sunken disabled:text-ink-subtle disabled:border-line disabled:cursor-not-allowed " +
  "aria-disabled:bg-sunken aria-disabled:text-ink-subtle aria-disabled:border-line aria-busy:cursor-progress";

const sizes: Record<Size, string> = {
  sm: "min-h-8 px-3 text-small pointer-coarse:min-h-9",
  md: "min-h-10 px-4 text-label pointer-coarse:min-h-11",
  lg: "min-h-12 px-5 text-body",
};

const variants: Record<Variant, string> = {
  primary: "bg-accent text-on-accent hover:bg-accent-hover active:bg-accent-press",
  secondary: "bg-surface text-ink border-line-input hover:bg-sunken",
  ghost: "bg-transparent text-ink hover:bg-sunken",
  danger: "bg-surface text-danger-ink border-danger hover:bg-danger-tint",
  "danger-solid": "bg-danger text-surface hover:bg-danger-ink",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", extra = "") {
  return `${base} ${sizes[size]} ${variants[variant]} ${extra}`.trim();
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  /** Keeps the label, adds a spinner, and ignores repeat clicks. */
  loading?: boolean;
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  className = "",
  type = "button",
  children,
  onClick,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClass(variant, size, className)}
      aria-busy={loading || undefined}
      aria-disabled={loading || undefined}
      onClick={loading ? (event) => event.preventDefault() : onClick}
      {...rest}
    >
      {loading && (
        <LoaderCircle className="size-4 animate-spin" strokeWidth={1.75} aria-hidden="true" />
      )}
      {children}
    </button>
  );
}
