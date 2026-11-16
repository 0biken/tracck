import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

export type Tone = "neutral" | "accent" | "success" | "warning" | "danger"

const tones: Record<Tone, string> = {
  neutral: "border-line-input text-ink-muted",
  accent: "border-ink text-ink",
  success: "border-signal text-signal",
  warning: "border-line-strong bg-sunken text-ink",
  danger: "border-danger bg-danger-tint text-danger-ink",
}

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  tone?: Tone
  icon?: LucideIcon
  spin?: boolean
}

function Badge({ className, variant, tone, icon: Icon, spin = false, children, ...props }: BadgeProps) {
  if (tone || Icon) {
    return (
      <span
        className={cn(
          "inline-flex h-6 items-center gap-1.5 rounded-sm border px-2 font-mono text-[11px] font-medium uppercase tracking-[0.06em] whitespace-nowrap",
          tone ? tones[tone] : "",
          className
        )}
        {...(props as React.HTMLAttributes<HTMLSpanElement>)}
      >
        {Icon && (
          <Icon className={cn("size-3.5", spin && "animate-spin")} strokeWidth={1.75} aria-hidden="true" />
        )}
        {children}
      </span>
    )
  }

  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props}>
      {children}
    </div>
  )
}

const tagTones = {
  muted: "border-line-input text-ink-muted",
  ink: "border-ink text-ink",
  signal: "border-signal text-signal",
  danger: "border-danger bg-danger-tint text-danger-ink",
} as const

export function Tag({
  tone = "muted",
  children,
  className = "",
}: {
  tone?: keyof typeof tagTones
  children: React.ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        "inline-block rounded-sm border px-1.5 py-[3px] font-mono text-xs whitespace-nowrap",
        tagTones[tone],
        className
      )}
    >
      {children}
    </span>
  )
}

export { Badge, badgeVariants }
