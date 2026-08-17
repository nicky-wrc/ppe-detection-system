import type { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
  title?: string
}

export function Card({ children, className = '', title }: CardProps) {
  return (
    <section className={`surface-card p-6 ${className}`}>
      {title && <h3 className="mb-5 text-[21px] font-semibold leading-tight tracking-[-0.02em] text-[var(--ink)]">{title}</h3>}
      {children}
    </section>
  )
}
