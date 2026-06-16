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
        'inline-flex items-center justify-center rounded-lg font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 disabled:opacity-50 disabled:pointer-events-none cursor-pointer',
        {
          'text-white hover:opacity-90 active:scale-95': variant === 'default',
          'border text-white/70 hover:text-white hover:bg-white/5 active:scale-95': variant === 'outline',
          'text-white/50 hover:bg-white/5 hover:text-white': variant === 'ghost',
          'bg-red-700 text-white hover:bg-red-800 active:scale-95': variant === 'destructive',
          'text-white/70 hover:bg-white/10 hover:text-white': variant === 'secondary',
        },
        {
          'h-8 px-3 text-xs gap-1.5': size === 'sm',
          'h-9 px-4 text-sm gap-2': size === 'md',
          'h-11 px-6 text-base gap-2': size === 'lg',
          'h-9 w-9 p-0': size === 'icon',
        },
        className
      )}
      style={variant === 'default' ? { backgroundColor: '#B72818', ...props.style } : variant === 'outline' ? { borderColor: '#2E2E2E', ...props.style } : variant === 'secondary' ? { backgroundColor: '#222', ...props.style } : props.style}
      {...props}
    />
  )
}
