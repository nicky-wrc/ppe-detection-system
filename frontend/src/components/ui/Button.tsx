import type { ButtonHTMLAttributes, ReactNode } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
  variant?: 'primary' | 'secondary' | 'danger'
  isLoading?: boolean
}

export function Button({ 
  children, 
  variant = 'primary', 
  isLoading, 
  className = '',
  disabled,
  ...props 
}: ButtonProps) {
  const variants = {
    primary: 'btn-apple-primary',
    secondary: 'btn-apple-secondary',
    danger: 'btn-apple-danger',
  }

  return (
    <button
      className={`${variants[variant]} ${className}`}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      {...props}
    >
      {isLoading ? 'กำลังดำเนินการ…' : children}
    </button>
  )
}
