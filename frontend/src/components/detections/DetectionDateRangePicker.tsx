import { useEffect, useRef, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'

import { useLanguage } from '../../i18n/LanguageContext'

interface DetectionDateRangePickerProps {
  startDate: string
  endDate: string
  disabled?: boolean
  maxRangeDays?: number
  variant?: 'field' | 'segmented'
  active?: boolean
  onOpen?: () => void
  onChange: (range: { startDate: string; endDate: string }) => void
}

type DateSelection = 'start' | 'end'

const dateFromValue = (value: string) => new Date(`${value}T00:00:00`)
const formatDateValue = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

export function DetectionDateRangePicker({ startDate, endDate, disabled = false, maxRangeDays, variant = 'field', active = false, onOpen, onChange }: DetectionDateRangePickerProps) {
  const { language, text } = useLanguage()
  const [isOpen, setIsOpen] = useState(false)
  const [selection, setSelection] = useState<DateSelection>('start')
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const today = new Date()
    return new Date(today.getFullYear(), today.getMonth(), 1)
  })
  const pickerRef = useRef<HTMLDivElement>(null)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  useEffect(() => {
    if (!isOpen) return
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!pickerRef.current?.contains(event.target as Node)) setIsOpen(false)
    }
    document.addEventListener('pointerdown', closeOnOutsidePointer)
    return () => document.removeEventListener('pointerdown', closeOnOutsidePointer)
  }, [isOpen])

  const displayDate = (value: string) => value
    ? dateFromValue(value).toLocaleDateString(language === 'th' ? 'th-TH' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : text('เลือกวัน', 'Select date')

  const openPicker = () => {
    const fallback = formatDateValue(today)
    const focusDate = dateFromValue(selection === 'start' ? startDate || fallback : endDate || startDate || fallback)
    setCalendarMonth(new Date(focusDate.getFullYear(), focusDate.getMonth(), 1))
    onOpen?.()
    setIsOpen(true)
  }

  const selectDate = (date: Date) => {
    const value = formatDateValue(date)
    if (selection === 'start') {
      onChange({ startDate: value, endDate: endDate && value > endDate ? '' : endDate })
      setSelection('end')
      return
    }
    if (!startDate || value < startDate) {
      onChange({ startDate: value, endDate: '' })
      setSelection('end')
      return
    }
    onChange({ startDate, endDate: value })
    setIsOpen(false)
    setSelection('start')
  }

  const calendarDays = Array.from({ length: 42 }, (_, index) => {
    const day = index - calendarMonth.getDay() + 1
    const value = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day)
    return value.getMonth() === calendarMonth.getMonth() ? value : null
  })
  const isPickerVisible = isOpen && (variant === 'field' || active)

  return (
    <div ref={pickerRef} className={`relative z-20 flex min-w-0 flex-col text-[12px] font-medium text-[var(--muted)] ${variant === 'field' ? 'gap-1' : ''}`}>
      {variant === 'field' && <span className="inline-flex items-center gap-1.5"><CalendarDays size={15} aria-hidden="true" />{text('ช่วงวันที่', 'Date range')}</span>}
      <button type="button" onClick={openPicker} disabled={disabled} aria-expanded={isPickerVisible} aria-controls="detection-date-range-calendar" className={variant === 'segmented' ? (active ? 'min-h-11 shrink-0 cursor-pointer rounded-full border-0 bg-[#0066cc] px-5 text-[14px] font-semibold text-white transition active:scale-95' : 'min-h-11 shrink-0 cursor-pointer rounded-full border-0 bg-transparent px-5 text-[14px] font-semibold text-[#0066cc] transition active:scale-95') : 'flex min-h-10 items-center justify-between rounded-lg border border-[var(--line)] bg-white px-3 text-left text-[14px] text-[var(--ink)] outline-none transition-colors hover:bg-[#f5f5f7] focus:border-[var(--blue)] disabled:cursor-not-allowed disabled:opacity-50'}>
        <span className="truncate">{variant === 'segmented' ? text('กำหนดเอง', 'Custom') : startDate || endDate ? `${displayDate(startDate)} - ${displayDate(endDate)}` : text('เลือกช่วงวันที่', 'Select date range')}</span>
        {variant === 'field' && <CalendarDays size={16} className="ml-2 shrink-0 text-[var(--muted)]" aria-hidden="true" />}
      </button>
      {isPickerVisible && (
        <div id="detection-date-range-calendar" className={`absolute top-full z-50 mt-2 w-[min(21rem,calc(100vw-2.5rem))] rounded-lg border border-[var(--line)] bg-white p-3 shadow-[0_8px_24px_rgba(0,0,0,0.12)] ${variant === 'segmented' ? 'right-0' : 'left-0'}`}>
          <div className="grid grid-cols-2 gap-2">
            {(['start', 'end'] as DateSelection[]).map((option) => <button key={option} type="button" onClick={() => setSelection(option)} className={`rounded-md border px-2 py-2 text-left text-[12px] transition-colors ${selection === option ? 'border-[var(--blue)] bg-[#f0f7ff] text-[var(--blue)]' : 'border-[var(--line)] text-[var(--muted)] hover:bg-[#f5f5f7]'}`}><span className="block">{option === 'start' ? text('วันเริ่มต้น', 'Start date') : text('วันสิ้นสุด', 'End date')}</span><strong className="mt-0.5 block truncate text-[13px] font-semibold text-[var(--ink)]">{displayDate(option === 'start' ? startDate : endDate)}</strong></button>)}
          </div>
          <div className="mt-3 flex items-center justify-between gap-2">
            <button type="button" onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))} aria-label={text('เดือนก่อนหน้า', 'Previous month')} className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--ink)] hover:bg-[#f5f5f7]"><ChevronLeft size={16} aria-hidden="true" /></button>
            <strong className="text-[13px] text-[var(--ink)]">{calendarMonth.toLocaleDateString(language === 'th' ? 'th-TH' : 'en-GB', { month: 'long', year: 'numeric' })}</strong>
            <button type="button" onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))} disabled={calendarMonth.getFullYear() === today.getFullYear() && calendarMonth.getMonth() === today.getMonth()} aria-label={text('เดือนถัดไป', 'Next month')} className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--ink)] hover:bg-[#f5f5f7] disabled:cursor-not-allowed disabled:opacity-30"><ChevronRight size={16} aria-hidden="true" /></button>
          </div>
          <div className="mt-2 grid grid-cols-7 text-center text-[11px] text-[var(--muted)]">
            {(language === 'th' ? ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'] : ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']).map((day) => <span key={day} className="py-1">{day}</span>)}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {calendarDays.map((date, index) => {
              if (!date) return <span key={index} className="h-9" />
              const value = formatDateValue(date)
              const isSelected = value === startDate || value === endDate
              const isInRange = Boolean(startDate && endDate && value > startDate && value < endDate)
              const exceedsRange = Boolean(selection === 'end' && startDate && maxRangeDays && (
                date.getTime() > dateFromValue(startDate).getTime() + (maxRangeDays - 1) * 86_400_000
              ))
              return <button key={value} type="button" disabled={date > today || exceedsRange} onClick={() => selectDate(date)} aria-pressed={isSelected} className={`h-9 rounded-md text-[13px] transition-colors ${isSelected ? 'bg-[var(--blue)] font-semibold text-white' : isInRange ? 'bg-[#e8f2ff] text-[var(--blue)]' : 'text-[var(--ink)] hover:bg-[#f5f5f7]'} disabled:cursor-not-allowed disabled:text-[#c7c7cc] disabled:hover:bg-transparent`}>{date.getDate()}</button>
            })}
          </div>
        </div>
      )}
    </div>
  )
}
