import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { useLanguage } from '../../i18n/LanguageContext'

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
  const { text } = useLanguage()
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
      {isLoading ? text('กำลังดำเนินการ…', 'Processing…') : children}
    </button>
  )
}
