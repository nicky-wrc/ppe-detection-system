import type { InputHTMLAttributes } from 'react'
import { forwardRef, useId } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = '', id, ...props }, ref) => {
    const generatedId = useId()
    const inputId = id || generatedId
    const errorId = error ? `${inputId}-error` : undefined

    return (
      <div className="mb-5">
        {label && (
          <label htmlFor={inputId} className="mb-2 block text-[14px] font-semibold leading-[1.29] tracking-[-0.016em] text-[var(--ink)]">
            {label}
          </label>
        )}
        <input
          id={inputId}
          ref={ref}
          aria-invalid={Boolean(error)}
          aria-describedby={errorId}
          className={`min-h-11 w-full rounded-[11px] border px-4 py-2.5 text-[17px] leading-[1.47] text-[var(--ink)] outline-none ${
            error ? 'border-[#d70015]' : 'border-black/10'
          } ${className}`}
          {...props}
        />
        {error && <p id={errorId} className="mt-2 text-[13px] leading-relaxed text-[#d70015]">{error}</p>}
      </div>
    )
  }
)
