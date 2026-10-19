import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export type Tone = "neutral" | "accent" | "success" | "warning" | "danger";

const tones: Record<Tone, string> = {
  neutral: "border-line-input text-ink-muted",
  accent: "border-ink text-ink",
  success: "border-signal text-signal",
  warning: "border-line-strong bg-sunken text-ink",
  danger: "border-danger bg-danger-tint text-danger-ink",
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
      className={`inline-flex h-6 items-center gap-1.5 rounded-sm border px-2 font-mono text-[11px] font-medium uppercase tracking-[0.06em] whitespace-nowrap ${tones[tone]}`}
    >
      <Icon className={`size-3.5 ${spin ? "animate-spin" : ""}`} strokeWidth={1.75} aria-hidden="true" />
      {children}
    </span>
  );
}

const tagTones = {
  muted: "border-line-input text-ink-muted",
  ink: "border-ink text-ink",
  signal: "border-signal text-signal",
  danger: "border-danger bg-danger-tint text-danger-ink",
} as const;

/** A small mono label for a status or a skill. Use Badge when status must not rely on colour. */
export function Tag({
  tone = "muted",
  children,
  className = "",
}: {
  tone?: keyof typeof tagTones;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-block rounded-sm border px-1.5 py-[3px] font-mono text-xs whitespace-nowrap ${tagTones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
