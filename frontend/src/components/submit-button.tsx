'use client'

import { useFormStatus } from 'react-dom'
import { Button } from '@/components/ui/button'
import type { ComponentProps } from 'react'

/** A submit button that shows a spinner while its form's server action runs. */
export function SubmitButton(props: Omit<ComponentProps<typeof Button>, 'type' | 'loading'>) {
  const { pending } = useFormStatus()
  return <Button {...props} type="submit" loading={pending} />
}
