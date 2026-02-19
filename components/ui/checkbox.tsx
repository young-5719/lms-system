'use client'

import * as React from 'react'

interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  onCheckedChange?: (checked: boolean) => void
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, onCheckedChange, ...props }, ref) => {
    return (
      <input
        type="checkbox"
        ref={ref}
        className={`h-4 w-4 rounded border border-gray-300 text-blue-600 focus:ring-blue-500 ${className || ''}`}
        onChange={(e) => onCheckedChange?.(e.target.checked)}
        {...props}
      />
    )
  }
)
Checkbox.displayName = 'Checkbox'

export { Checkbox }
