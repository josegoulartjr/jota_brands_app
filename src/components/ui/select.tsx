import * as React from 'react'
import { cn } from '@/lib/utils'

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {}

export function Select({ className, children, ...props }: SelectProps) {
  return (
    <select
      className={cn(
        'flex h-9 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1 text-sm text-white focus:outline-none focus:ring-2 focus:ring-red-700 disabled:opacity-50',
        className
      )}
      {...props}
    >
      {children}
    </select>
  )
}
