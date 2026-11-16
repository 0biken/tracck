"use client"

import * as React from "react"
import Link from "next/link"
import { motion } from "framer-motion"

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

export type OriginButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  children?: React.ReactNode
  loading?: boolean
  href?: string
}

export const OriginButton = React.forwardRef<HTMLButtonElement, OriginButtonProps>(
  (
    {
      children,
      className,
      disabled = false,
      loading = false,
      type = "button",
      href,
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

    const showFill = !isDisabled && (hovered || isPressed)

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

    const fillTransition = { duration: FILL_DURATION, ease: FILL_EASE }

    const setMergedRef = React.useCallback(
      (node: HTMLElement | null) => {
        buttonRef.current = node
        assignRef(ref, node as HTMLButtonElement | null)
      },
      [ref]
    )

    const commonClasses = cn(
      "relative inline-flex h-11 cursor-pointer touch-manipulation select-none items-center justify-center overflow-hidden rounded-md px-6 font-semibold text-sm tracking-[0.02em]",
      "border border-line-input bg-canvas text-ink",
      "transition-[border-color,color] duration-200",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2",
      "disabled:pointer-events-none disabled:opacity-50",
      showFill && "border-signal/50",
      className
    )

    const animatedSpan = (
      <motion.span
        animate={{ scale: showFill && coverSize > 0 ? 1 : 0 }}
        aria-hidden="true"
        className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-signal-tint text-signal"
        initial={false}
        style={{
          height: coverSize,
          left: origin.x,
          top: origin.y,
          width: coverSize,
        }}
        transition={fillTransition}
      />
    )

    const content = (
      <>
        {animatedSpan}
        <span className="relative z-10 inline-flex items-center justify-center gap-2">
          {children}
        </span>
      </>
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

    if (href && !isDisabled) {
      return (
        <motion.div whileTap={{ scale: 0.985 }} className="inline-flex">
          <Link
            href={href}
            ref={setMergedRef as any}
            className={commonClasses}
            {...eventHandlers}
          >
            {content}
          </Link>
        </motion.div>
      )
    }

    return (
      <motion.button
        {...props}
        ref={setMergedRef as any}
        type={type}
        disabled={isDisabled}
        aria-busy={loading || undefined}
        className={commonClasses}
        whileTap={isDisabled ? undefined : { scale: 0.985 }}
        {...eventHandlers}
      >
        {content}
      </motion.button>
    )
  }
)
OriginButton.displayName = "OriginButton"
