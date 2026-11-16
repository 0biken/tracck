import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { LoaderCircle } from "lucide-react"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        primary: "border border-ink bg-ink text-canvas hover:opacity-85",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        danger: "border border-danger bg-transparent text-danger-ink hover:bg-danger-tint",
        "danger-solid": "border border-danger bg-danger text-on-danger hover:opacity-90",
        inverse: "border border-on-inverse bg-on-inverse text-inverse hover:opacity-90",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        md: "min-h-11 px-[18px] text-sm leading-5",
        lg: "h-11 rounded-md px-8",
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

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  loading?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, disabled, children, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading ? true : undefined}
        {...props}
      >
        {loading && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
        {children}
      </Comp>
    )
  },
)
Button.displayName = "Button"

export function buttonClass(
  variant: VariantProps<typeof buttonVariants>["variant"] = "primary",
  size: VariantProps<typeof buttonVariants>["size"] = "md",
  extra = ""
) {
  return cn(buttonVariants({ variant, size }), extra)
}

export { Button, buttonVariants }
