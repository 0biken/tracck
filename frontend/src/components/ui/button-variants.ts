import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

export const buttonVariants = cva(
  "relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-semibold tracking-[0.02em] ring-offset-background transition-[color,border-color,background-color] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 overflow-hidden cursor-pointer select-none",
  {
    variants: {
      variant: {
        default: "border border-ink bg-ink text-canvas hover:opacity-90",
        primary: "border border-ink bg-ink text-canvas hover:opacity-85",
        secondary:
          "border border-line-input bg-white dark:bg-card text-ink hover:border-signal",
        outline:
          "border border-line-input bg-transparent text-ink hover:border-signal",
        inverse:
          "border border-on-inverse bg-white dark:bg-card text-ink hover:border-signal",
        destructive:
          "border border-danger bg-danger text-on-danger hover:opacity-90",
        danger:
          "border border-danger bg-transparent text-danger-ink hover:bg-danger-tint",
        "danger-solid":
          "border border-danger bg-danger text-on-danger hover:opacity-90",
        ghost: "bg-transparent text-ink hover:bg-signal/10",
        link: "text-signal underline-offset-4 hover:underline",
      },
      size: {
        default: "min-h-11 px-[18px] text-sm leading-5",
        sm: "min-h-9 px-3 text-[13px] leading-[18px]",
        md: "min-h-11 px-[18px] text-sm leading-5",
        lg: "min-h-12 px-6 text-[15px] leading-5",
        xl: "min-h-[52px] px-7 text-base leading-5",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
)

export type ButtonVariantsProps = VariantProps<typeof buttonVariants>

export function buttonClass(
  variant: ButtonVariantsProps["variant"] = "primary",
  size: ButtonVariantsProps["size"] = "md",
  extra = ""
) {
  return cn(buttonVariants({ variant, size }), extra)
}
