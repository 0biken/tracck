"use client"

import * as React from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { cva, type VariantProps } from "class-variance-authority"
import { LoaderCircle } from "lucide-react"

import { cn } from "@/lib/utils"

const FILL_DURATION = 0.5
const FILL_EASE = [0.16, 1, 0.3, 1] as const

function getCoverDiameter(width: number, height: number, x: number, y: number) {
  return Math.ceil(
    2 *
      Math.max(
        Math.hypot(x, y),
        Math.hypot(width - x, y),
        Math.hypot(x, height - y),
        Math.hypot(width - x, height - y)
      )
  )
}

function assignRef<T>(ref: React.ForwardedRef<T>, value: T | null) {
  if (typeof ref === "function") {
    ref(value)
    return
  }
  if (ref) {
    ref.current = value
  }
}

const buttonVariants = cva(
  "relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-semibold tracking-[0.02em] ring-offset-background transition-[color,border-color,background-color] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 overflow-hidden cursor-pointer select-none",
  {
    variants: {
      variant: {
        default: "border border-ink bg-ink text-canvas hover:opacity-90",
        primary: "border border-ink bg-ink text-canvas hover:opacity-85",
        secondary:
          "border border-line-input bg-canvas text-ink hover:border-signal/50",
        outline:
          "border border-line-input bg-canvas text-ink hover:border-signal/50",
        inverse:
          "border border-on-inverse bg-canvas text-ink hover:border-signal/50",
        destructive:
          "border border-danger bg-danger text-on-danger hover:opacity-90",
        danger:
          "border border-danger bg-transparent text-danger-ink hover:bg-danger-tint",
        "danger-solid":
          "border border-danger bg-danger text-on-danger hover:opacity-90",
        ghost: "hover:bg-sunken text-ink",
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

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  loading?: boolean
  href?: string
  effect?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "default",
      size = "default",
      asChild = false,
      loading = false,
      disabled = false,
      href,
      effect,
      children,
      onBlur,
      onClick,
      onFocus,
      onKeyDown,
      onKeyUp,
      onPointerCancel,
      onPointerDown,
      onPointerEnter,
      onPointerLeave,
      onPointerUp,
      ...props
    },
    ref
  ) => {
    const isWhiteButton =
      variant === "secondary" || variant === "outline" || variant === "inverse"
    const hasEffect = effect !== undefined ? effect : isWhiteButton

    const buttonRef = React.useRef<HTMLElement | null>(null)
    const isDisabled = Boolean(disabled || loading)
    const [hovered, setHovered] = React.useState(false)
    const [isPressed, setIsPressed] = React.useState(false)
    const [origin, setOrigin] = React.useState({ x: 0, y: 0 })
    const [coverSize, setCoverSize] = React.useState(0)

    const updateOrigin = React.useCallback((x: number, y: number) => {
      const node = buttonRef.current
      if (!node) return
      const rect = node.getBoundingClientRect()
      setOrigin({ x, y })
      setCoverSize(getCoverDiameter(rect.width, rect.height, x, y))
    }, [])

    const updateOriginFromPointer = React.useCallback(
      (event: React.PointerEvent<HTMLElement>) => {
        const rect = event.currentTarget.getBoundingClientRect()
        updateOrigin(event.clientX - rect.left, event.clientY - rect.top)
      },
      [updateOrigin]
    )

    const updateOriginFromCenter = React.useCallback(() => {
      const node = buttonRef.current
      if (!node) return
      const rect = node.getBoundingClientRect()
      updateOrigin(rect.width / 2, rect.height / 2)
    }, [updateOrigin])

    const showFill = hasEffect && !isDisabled && (hovered || isPressed)

    React.useEffect(() => {
      const node = buttonRef.current
      if (!(node && showFill)) return

      const measure = () => {
        const rect = node.getBoundingClientRect()
        setCoverSize(getCoverDiameter(rect.width, rect.height, origin.x, origin.y))
      }

      measure()
      const observer = new ResizeObserver(measure)
      observer.observe(node)

      return () => observer.disconnect()
    }, [showFill, origin.x, origin.y])

    const setMergedRef = React.useCallback(
      (node: HTMLElement | null) => {
        buttonRef.current = node
        assignRef(ref, node as HTMLButtonElement | null)
      },
      [ref]
    )

    const eventHandlers = {
      onBlur: (event: React.FocusEvent<any>) => {
        onBlur?.(event)
        setIsPressed(false)
        if (!event.defaultPrevented) setHovered(false)
      },
      onClick,
      onFocus: (event: React.FocusEvent<any>) => {
        onFocus?.(event)
        if (isDisabled || event.defaultPrevented) return
        if (event.currentTarget.matches(":focus-visible")) {
          updateOriginFromCenter()
          setHovered(true)
        }
      },
      onKeyDown: (event: React.KeyboardEvent<any>) => {
        onKeyDown?.(event)
        if (event.defaultPrevented || isDisabled || event.repeat || (event.key !== " " && event.key !== "Enter")) {
          return
        }
        if (event.key === " ") event.preventDefault()
        updateOriginFromCenter()
        setIsPressed(true)
        setHovered(true)
      },
      onKeyUp: (event: React.KeyboardEvent<any>) => {
        onKeyUp?.(event)
        if (event.key === " " || event.key === "Enter") {
          setIsPressed(false)
          if (!event.currentTarget.matches(":focus-visible")) setHovered(false)
        }
      },
      onPointerCancel: (event: React.PointerEvent<any>) => {
        onPointerCancel?.(event)
        setIsPressed(false)
      },
      onPointerDown: (event: React.PointerEvent<any>) => {
        onPointerDown?.(event)
        if (event.defaultPrevented || isDisabled || event.button !== 0) return
        updateOriginFromPointer(event)
        setIsPressed(true)
        setHovered(true)
      },
      onPointerEnter: (event: React.PointerEvent<any>) => {
        onPointerEnter?.(event)
        if (isDisabled || event.defaultPrevented) return
        updateOriginFromPointer(event)
        setHovered(true)
      },
      onPointerLeave: (event: React.PointerEvent<any>) => {
        onPointerLeave?.(event)
        setHovered(false)
        setIsPressed(false)
      },
      onPointerUp: (event: React.PointerEvent<any>) => {
        onPointerUp?.(event)
        setIsPressed(false)
      },
    }

    const animatedSpan = hasEffect ? (
      <motion.span
        animate={{ scale: showFill && coverSize > 0 ? 1 : 0 }}
        aria-hidden="true"
        className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-signal-tint dark:bg-signal-tint/25 text-signal"
        initial={false}
        style={{
          height: coverSize,
          left: origin.x,
          top: origin.y,
          width: coverSize,
        }}
        transition={{ duration: FILL_DURATION, ease: FILL_EASE }}
      />
    ) : null

    const innerContent = (
      <>
        {animatedSpan}
        <span className="relative z-10 inline-flex items-center justify-center gap-2">
          {loading && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
          {children}
        </span>
      </>
    )

    const finalClassName = cn(
      buttonVariants({ variant, size }),
      showFill && "border-signal/50",
      className
    )

    if (href && !isDisabled) {
      return (
        <motion.div whileTap={{ scale: 0.985 }} className="inline-flex">
          <Link
            href={href}
            ref={setMergedRef as any}
            className={finalClassName}
            {...eventHandlers}
          >
            {innerContent}
          </Link>
        </motion.div>
      )
    }

    if (asChild && React.isValidElement(children)) {
      const child = children as React.ReactElement<any>
      return (
        <motion.div whileTap={isDisabled ? undefined : { scale: 0.985 }} className="inline-flex w-full">
          {React.cloneElement(
            child,
            {
              ref: setMergedRef,
              className: cn(finalClassName, child.props.className),
              ...eventHandlers,
              ...props,
            },
            <>
              {animatedSpan}
              <span className="relative z-10 inline-flex items-center justify-center gap-2">
                {child.props.children}
              </span>
            </>
          )}
        </motion.div>
      )
    }

    return (
      <motion.button
        {...props}
        ref={setMergedRef as any}
        type={props.type ?? "button"}
        disabled={isDisabled}
        aria-busy={loading ? true : undefined}
        className={finalClassName}
        whileTap={isDisabled ? undefined : { scale: 0.985 }}
        {...eventHandlers}
      >
        {innerContent}
      </motion.button>
    )
  }
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
