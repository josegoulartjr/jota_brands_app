import * as React from 'react'
import { cn } from '@/lib/utils'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'ghost' | 'destructive' | 'secondary'
  size?: 'sm' | 'md' | 'lg' | 'icon'
}

export function Button({ className, variant = 'default', size = 'md', ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 disabled:opacity-50 disabled:pointer-events-none',
        {
          'bg-violet-600 text-white hover:bg-violet-700': variant === 'default',
          'border border-zinc-700 bg-transparent text-zinc-300 hover:bg-zinc-800 hover:text-white': variant === 'outline',
          'bg-transparent text-zinc-400 hover:bg-zinc-800 hover:text-white': variant === 'ghost',
          'bg-red-600 text-white hover:bg-red-700': variant === 'destructive',
          'bg-zinc-800 text-zinc-200 hover:bg-zinc-700': variant === 'secondary',
        },
        {
          'h-8 px-3 text-xs gap-1.5': size === 'sm',
          'h-9 px-4 text-sm gap-2': size === 'md',
          'h-11 px-6 text-base gap-2': size === 'lg',
          'h-9 w-9 p-0': size === 'icon',
        },
        className
      )}
      {...props}
    />
  )
}
