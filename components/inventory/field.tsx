import * as React from 'react'

import { cn } from '@/lib/utils'
import { Label } from '@/components/ui/label'

export const selectClassName =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50'

interface FieldProps {
  label: string
  htmlFor: string
  hint?: string
  className?: string
  children: React.ReactNode
}

export function Field({
  label,
  htmlFor,
  hint,
  className,
  children
}: FieldProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}
