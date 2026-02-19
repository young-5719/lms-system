import * as React from 'react'

interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'outline'
}

function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  const base = 'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold'
  const variants: Record<string, string> = {
    default: 'bg-gray-100 text-gray-800',
    secondary: 'bg-gray-200 text-gray-700',
    outline: 'border border-gray-300 text-gray-700',
  }
  return (
    <div className={`${base} ${variants[variant] || ''} ${className || ''}`} {...props} />
  )
}

export { Badge }
