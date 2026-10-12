import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export type Tone = "neutral" | "accent" | "success" | "warning" | "danger";

const tones: Record<Tone, string> = {
  neutral: "bg-sunken text-ink-muted border-line",
  accent: "bg-accent-tint text-accent-ink border-transparent",
  success: "bg-success-tint text-success-ink border-transparent",
  warning: "bg-warning-tint text-warning-ink border-transparent",
  danger: "bg-danger-tint text-danger-ink border-transparent",
};

/** Status is never color-only: every badge carries an icon and a text label. */
export function Badge({
  tone = "neutral",
  icon: Icon,
  spin = false,
  children,
}: {
  tone?: Tone;
  icon: LucideIcon;
  spin?: boolean;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex h-6 items-center gap-1.5 rounded-full border pl-2 pr-2.5 text-caption font-semibold whitespace-nowrap ${tones[tone]}`}
    >
      <Icon className={`size-3.5 ${spin ? "animate-spin" : ""}`} strokeWidth={1.75} aria-hidden="true" />
      {children}
    </span>
  );
}
