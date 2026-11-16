"use client"

import * as React from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { LoaderCircle } from "lucide-react"

import { cn } from "@/lib/utils"
import { buttonVariants, type ButtonVariantsProps } from "./button-variants"

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

type ButtonHTMLAttributesForMotion = Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  | "onAnimationEnd"
  | "onAnimationIteration"
  | "onAnimationStart"
  | "onDrag"
  | "onDragEnd"
  | "onDragEnter"
  | "onDragExit"
  | "onDragLeave"
  | "onDragOver"
  | "onDragStart"
  | "onDrop"
>

export interface InteractiveButtonProps
  extends ButtonHTMLAttributesForMotion,
    ButtonVariantsProps {
  asChild?: boolean
  loading?: boolean
  href?: string
  effect?: boolean
}

export const InteractiveButton = React.forwardRef<HTMLButtonElement, InteractiveButtonProps>(
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
    const isNoColorButton =
      variant === "ghost" ||
      (variant === "outline" && !className?.includes("bg-white") && !className?.includes("bg-canvas"))
    const isWhiteButton =
      variant === "secondary" ||
      variant === "inverse" ||
      className?.includes("bg-white") ||
      className?.includes("bg-canvas") ||
      (!isNoColorButton && variant === "outline")

    const hasEffect = effect !== undefined ? effect : (isWhiteButton || isNoColorButton)

    const overlayClass = isWhiteButton
      ? "bg-[#8ce2b2] dark:bg-[#1a5336]"
      : "bg-signal/20 dark:bg-signal/30"

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
        className={cn(
          "pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full",
          overlayClass
        )}
        initial={false}
        style={{
          height: coverSize,
          left: origin.x,
          top: origin.y,
          width: coverSize,
        }}
        transition={{ duration: showFill ? 0.45 : 0.3, ease: FILL_EASE }}
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
      showFill && (isWhiteButton ? "border-signal text-ink" : "border-signal/70 text-ink"),
      className
    )

    if (href && !isDisabled) {
      return (
        <motion.div whileTap={{ scale: 0.985 }} className="inline-flex">
          <Link
            href={href}
            ref={setMergedRef as any}
            className={finalClassName}
            {...(eventHandlers as any)}
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
InteractiveButton.displayName = "InteractiveButton"
