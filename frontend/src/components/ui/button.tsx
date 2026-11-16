import * as React from "react"
import {
  buttonVariants,
  buttonClass,
  type ButtonVariantsProps,
} from "./button-variants"
import {
  InteractiveButton,
  type InteractiveButtonProps,
} from "./button-client"

export type ButtonProps = InteractiveButtonProps

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (props, ref) => {
    return <InteractiveButton ref={ref} {...props} />
  }
)
Button.displayName = "Button"

export { buttonVariants, buttonClass }
