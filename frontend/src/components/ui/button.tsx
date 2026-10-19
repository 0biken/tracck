import { LoaderCircle } from "lucide-react";
import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "danger-solid" | "inverse";
type Size = "sm" | "md" | "lg" | "xl";

const base =
  "inline-flex items-center justify-center gap-2 rounded-md border font-semibold no-underline " +
  "whitespace-nowrap cursor-pointer tracking-[0.02em] transition-colors duration-150 ease-standard " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal " +
  "disabled:cursor-not-allowed disabled:border-line disabled:bg-sunken disabled:text-ink-muted " +
  "aria-disabled:cursor-not-allowed aria-busy:cursor-progress";

const sizes: Record<Size, string> = {
  sm: "min-h-9 px-3 text-[13px] leading-[18px]",
  md: "min-h-11 px-[18px] text-sm leading-5",
  lg: "min-h-12 px-6 text-[15px] leading-5",
  xl: "min-h-[52px] px-7 text-base leading-5",
};

const variants: Record<Variant, string> = {
  primary: "border-ink bg-ink text-canvas hover:opacity-85",
  secondary: "border-line-input bg-transparent text-ink hover:bg-sunken",
  ghost: "border-transparent bg-transparent text-ink hover:bg-sunken",
  danger: "border-danger bg-transparent text-danger-ink hover:bg-danger-tint",
  "danger-solid": "border-danger bg-danger text-on-danger hover:opacity-90",
  inverse: "border-on-inverse bg-on-inverse text-inverse hover:opacity-90",
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
      {loading && <LoaderCircle className="size-4 animate-spin" strokeWidth={1.75} aria-hidden="true" />}
      {children}
    </button>
  );
}
