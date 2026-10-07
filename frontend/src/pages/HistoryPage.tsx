import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Eye,
  FileText,
  Loader2,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react'
import toast from 'react-hot-toast'

import { Layout } from '../components/layout/Layout'
import { ProtectedDetectionImage } from '../components/ui/ProtectedDetectionImage'
import { useDialogFocus } from '../hooks/useDialogFocus'
import { detectionService } from '../services/detection'
import type { Detection } from '../types'
import { saveDetectionPdf } from '../utils/detectionPdfReport'
import { useLanguage } from '../i18n/LanguageContext'
import { DetectionRecordsTable } from '../components/detections/DetectionRecordsTable'
import { DetectionDateRangePicker } from '../components/detections/DetectionDateRangePicker'
import { DetectionDetailsDialog } from '../components/detections/DetectionDetailsDialog'

interface HistoryPageProps {
  embedded?: boolean
}

type MissingPpeFilter = '' | 'helmet' | 'vest' | 'both'
type PpeFilterMode = '' | 'missing' | 'detected'
type DateSelection = 'start' | 'end'

const REPORTS_FILTER_STORAGE_KEY = 'ppe_reports_filter_query'
const REPORTS_FILTER_PARAMS = ['result', 'missing_ppe', 'start_date', 'end_date', 'page']
const renderLegacyDetectionTable: boolean = false
const renderLegacyDatePicker: boolean = false
const renderLegacyDetailsDialog: boolean = false

const todayDate = () => {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

const dateFromValue = (value: string) => new Date(`${value}T00:00:00`)

const formatDateValue = (date: Date) => {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

const displayDate = (value: string) => value
  ? dateFromValue(value).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })
  : 'เลือกวัน'

const isReportFilterMode = (value: string | null): value is PpeFilterMode => (
  value === '' || value === 'missing' || value === 'detected'
)

const isMissingPpeFilter = (value: string | null): value is MissingPpeFilter => (
  value === '' || value === 'helmet' || value === 'vest' || value === 'both'
)

const hasReportsFilterParams = (params: URLSearchParams) => (
  REPORTS_FILTER_PARAMS.some((name) => params.has(name))
)

const safeDateParam = (value: string | null) => (
  value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : ''
)

const readReportsFilterParams = (params: URLSearchParams) => {
  const result = params.get('result')
  const mode: PpeFilterMode = isReportFilterMode(result) ? result : ''
  const rawMissingPpe = params.get('missing_ppe')
  const missingPpe: MissingPpeFilter = mode === 'missing' && isMissingPpeFilter(rawMissingPpe) ? rawMissingPpe : ''
  const parsedPage = Number(params.get('page') || 1)

  return {
    startDate: safeDateParam(params.get('start_date')),
    endDate: safeDateParam(params.get('end_date')),
    page: Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1,
    ppeFilterMode: mode,
    missingPpe,
  }
}

const buildReportsFilterParams = ({
  startDate,
  endDate,
  page,
  ppeFilterMode,
  missingPpe,
}: {
  startDate: string
  endDate: string
  page: number
  ppeFilterMode: PpeFilterMode
  missingPpe: MissingPpeFilter
}) => {
  const params = new URLSearchParams()
  if (startDate) params.set('start_date', startDate)
  if (endDate) params.set('end_date', endDate)
  if (ppeFilterMode) params.set('result', ppeFilterMode)
  if (ppeFilterMode === 'missing' && missingPpe) params.set('missing_ppe', missingPpe)
  if (page > 1) params.set('page', String(page))
  return params
}

const isPersonOnlyDetection = (detection: Detection) => (
  detection.summary?.status === 'person_only'
  || detection.summary?.settings?.ppe_check_enabled === false
)

const reportTag = (detection: Detection) => {
  if (detection.violations && detection.violations.length > 0) return null
  return isPersonOnlyDetection(detection) ? 'ตรวจพบบุคคล' : 'สวมใส่ครบถ้วน'
}

const reportStatus = (detection: Detection) => {
  if (detection.has_violation) return 'Violation'
  return isPersonOnlyDetection(detection) ? 'Person only' : 'Compliant'
}

const formatViolationLabel = (value: string) => {
  const normalized = value.trim().toLowerCase()
  if (normalized === 'no_helmet' || normalized === 'no_hardhat' || normalized.includes('helmet') || normalized.includes('hardhat')) {
    return 'ไม่สวมหมวกนิรภัย'
  }
  if (normalized === 'no_safety_vest' || normalized === 'no_vest' || normalized.includes('vest')) {
    return 'ไม่สวมเสื้อสะท้อนแสง'
  }
  return value
}

export function HistoryPage({ embedded = false }: HistoryPageProps = {}) {
  const { text } = useLanguage()
  const [searchParams, setSearchParams] = useSearchParams()
  const initialFilterQueryRef = useRef<string | null>(null)
  const restoredStoredFilterRef = useRef(false)
  if (initialFilterQueryRef.current === null) {
    const hasUrlFilter = hasReportsFilterParams(searchParams)
    let initialQuery = hasUrlFilter ? searchParams.toString() : ''
    if (!initialQuery && typeof window !== 'undefined') {
      initialQuery = window.sessionStorage.getItem(REPORTS_FILTER_STORAGE_KEY) || ''
    }
    restoredStoredFilterRef.current = Boolean(initialQuery && !hasUrlFilter)
    initialFilterQueryRef.current = initialQuery
  }
  const initialFilters = readReportsFilterParams(new URLSearchParams(initialFilterQueryRef.current))
  const [detections, setDetections] = useState<Detection[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [page, setPage] = useState(initialFilters.page)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [startDate, setStartDate] = useState(initialFilters.startDate)
  const [endDate, setEndDate] = useState(initialFilters.endDate)
  const [ppeFilterMode, setPpeFilterMode] = useState<PpeFilterMode>(initialFilters.ppeFilterMode)
  const [missingPpe, setMissingPpe] = useState<MissingPpeFilter>(initialFilters.missingPpe)
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(false)
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false)
  const [dateSelection, setDateSelection] = useState<DateSelection>('start')
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const today = dateFromValue(todayDate())
    return new Date(today.getFullYear(), today.getMonth(), 1)
  })
  const [selectedDetection, setSelectedDetection] = useState<Detection | null>(null)
  const [downloadingId, setDownloadingId] = useState<number | null>(null)
  const historyRequestRef = useRef(0)
  const datePickerRef = useRef<HTMLDivElement>(null)
  const closeDetectionDetail = useCallback(() => setSelectedDetection(null), [])
  const detectionDialogRef = useDialogFocus<HTMLElement>(Boolean(selectedDetection), closeDetectionDetail)

  useEffect(() => {
    if (!hasReportsFilterParams(searchParams) && restoredStoredFilterRef.current) {
      restoredStoredFilterRef.current = false
      return
    }
    const next = readReportsFilterParams(searchParams)
    setStartDate((current) => current === next.startDate ? current : next.startDate)
    setEndDate((current) => current === next.endDate ? current : next.endDate)
    setPpeFilterMode((current) => current === next.ppeFilterMode ? current : next.ppeFilterMode)
    setMissingPpe((current) => current === next.missingPpe ? current : next.missingPpe)
    setPage((current) => current === next.page ? current : next.page)
  }, [searchParams])

  useEffect(() => {
    const params = buildReportsFilterParams({ startDate, endDate, page, ppeFilterMode, missingPpe })
    const nextQuery = params.toString()
    if (typeof window !== 'undefined') {
      if (nextQuery) window.sessionStorage.setItem(REPORTS_FILTER_STORAGE_KEY, nextQuery)
      else window.sessionStorage.removeItem(REPORTS_FILTER_STORAGE_KEY)
    }
    if (nextQuery !== searchParams.toString()) {
      setSearchParams(params, { replace: true })
    }
  }, [endDate, missingPpe, page, ppeFilterMode, searchParams, setSearchParams, startDate])

  const loadHistory = useCallback(async () => {
    const requestId = historyRequestRef.current + 1
    historyRequestRef.current = requestId
    setLoading(true)
    setLoadError(false)
    const activeMissingPpe = ppeFilterMode === 'missing' ? missingPpe : ''
    const activeDetectedPpe = ppeFilterMode === 'detected' ? 'both' : ''
    try {
      const data = await detectionService.getHistory(page, 12, {
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        hasViolation: ppeFilterMode === 'missing' ? true : undefined,
        missingPpe: activeMissingPpe || undefined,
        detectedPpe: activeDetectedPpe || undefined,
      })
      if (historyRequestRef.current !== requestId) return
      setDetections(data.items || [])
      setTotalPages(data.total_pages || 1)
      setTotal(data.total || 0)
    } catch (error) {
      if (historyRequestRef.current !== requestId) return
      console.error('Error loading history:', error)
      setLoadError(true)
    } finally {
      if (historyRequestRef.current === requestId) setLoading(false)
    }
  }, [endDate, missingPpe, page, ppeFilterMode, startDate])

  useEffect(() => {
    void loadHistory()
    return () => {
      historyRequestRef.current += 1
    }
  }, [loadHistory])

  useEffect(() => {
    if (!isDatePickerOpen) return
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!datePickerRef.current?.contains(event.target as Node)) setIsDatePickerOpen(false)
    }
    document.addEventListener('pointerdown', closeOnOutsidePointer)
    return () => document.removeEventListener('pointerdown', closeOnOutsidePointer)
  }, [isDatePickerOpen])

  const violationCount = detections.filter((detection) => detection.has_violation).length
  const complianceCount = detections.filter((detection) => !detection.has_violation).length

  const updateFilters = (next: Partial<{ startDate: string; endDate: string; missingPpe: MissingPpeFilter }>) => {
    setPage(1)
    if (next.startDate !== undefined) setStartDate(next.startDate)
    if (next.endDate !== undefined) setEndDate(next.endDate)
    if (next.missingPpe !== undefined) {
      setMissingPpe(next.missingPpe)
    }
  }

  const updatePpeFilterMode = (mode: PpeFilterMode) => {
    setPage(1)
    setPpeFilterMode(mode)
    if (mode === 'detected') {
      setMissingPpe('')
      return
    }
    if (mode === 'missing') return
    setMissingPpe('')
  }

  const clearFilters = () => {
    setPage(1)
    setStartDate('')
    setEndDate('')
    setPpeFilterMode('')
    setMissingPpe('')
  }

  const hasActiveFilters = Boolean(startDate || endDate || ppeFilterMode || missingPpe)
  const today = todayDate()
  const todayCalendarDate = dateFromValue(today)
  const calendarDays = Array.from({ length: 42 }, (_, index) => {
    const firstWeekday = calendarMonth.getDay()
    const day = index - firstWeekday + 1
    const value = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day)
    return value.getMonth() === calendarMonth.getMonth() ? value : null
  })

  const openDatePicker = () => {
    const focusDate = dateFromValue(dateSelection === 'start' ? startDate || today : endDate || startDate || today)
    setCalendarMonth(new Date(focusDate.getFullYear(), focusDate.getMonth(), 1))
    setIsDatePickerOpen(true)
  }

  const selectCalendarDate = (date: Date) => {
    const value = formatDateValue(date)
    if (dateSelection === 'start') {
      updateFilters({ startDate: value, endDate: endDate && value > endDate ? '' : endDate })
      return
    }
    if (!startDate || value < startDate) {
      updateFilters({ startDate: value, endDate: '' })
      return
    }
    updateFilters({ endDate: value })
  }

  const handleDownloadPdf = async (detectionId: number) => {
    setDownloadingId(detectionId)
    try {
      const detection = await detectionService.getDetection(detectionId)
      await saveDetectionPdf(detection, () => detectionService.getResultMediaBlob(detectionId))
      toast.success(text('ดาวน์โหลดรายงาน PDF แล้ว', 'PDF report downloaded'))
    } catch (error) {
      console.error('PDF generation failed:', error)
      toast.error(text('ไม่สามารถสร้างหรือดาวน์โหลด PDF ได้ กรุณาลองใหม่', 'Unable to create or download the PDF. Please try again.'))
    } finally {
      setDownloadingId(null)
    }
  }

  const content = (
    <>
      <div className={`${embedded ? '' : 'mx-auto max-w-[1240px] '}flex flex-col gap-5 sm:gap-10`}>
        {!embedded && <header className="page-heading">
          <div className="flex items-start gap-4">
            <div className="mt-3 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--ink)] text-white" aria-hidden="true">
              <ShieldCheck size={20} strokeWidth={1.8} />
            </div>
            <div className="min-w-0">
              <h1>Safety Reports &amp; Analytics</h1>
              <p className="max-w-3xl !mt-2 !text-[17px] !leading-[1.47]">Detection history and safety compliance records.</p>
            </div>
          </div>
        </header>}

        <section className="grid grid-cols-3 gap-2 sm:gap-6" aria-label="Detection summary">
          {[
            { label: text('พบการฝ่าฝืน', 'Violations'), compactLabel: text('ฝ่าฝืน', 'Violations'), value: violationCount, note: text('ในหน้านี้', 'On this page'), icon: AlertTriangle, iconClassName: 'text-[#d70015]' },
            { label: text('สวมใส่ครบ', 'Compliant'), compactLabel: text('ใส่ครบ', 'Compliant'), value: complianceCount, note: text('ในหน้านี้', 'On this page'), icon: CheckCircle, iconClassName: 'text-[#15803d]' },
            { label: text('รายการทั้งหมด', 'Total records'), compactLabel: text('ทั้งหมด', 'Total'), value: total, note: text('ทุกช่วงเวลา', 'All time'), icon: FileText, iconClassName: 'text-[var(--muted)]' },
          ].map((stat) => (
            <div key={stat.label} className="surface-card min-w-0 p-2.5 sm:min-h-40 sm:p-7">
              <div className="flex flex-col-reverse items-start gap-1.5 sm:flex-row sm:justify-between sm:gap-4">
                <p className="text-[12px] leading-[18px] text-[var(--muted)] sm:text-[14px]">
                  <span className="sm:hidden">{stat.compactLabel}</span>
                  <span className="hidden sm:inline">{stat.label}</span>
                </p>
                <stat.icon size={19} className={`h-4 w-4 shrink-0 sm:h-[19px] sm:w-[19px] ${stat.iconClassName}`} strokeWidth={1.8} aria-hidden="true" />
              </div>
              <p className="mt-2 text-[24px] font-semibold leading-none tracking-normal text-[var(--ink)] tabular-nums sm:mt-6 sm:text-[40px]">{stat.value.toLocaleString()}</p>
              <p className="mt-1.5 text-[11px] leading-4 text-[var(--muted)] sm:mt-2 sm:text-[13px]">{stat.note}</p>
            </div>
          ))}
        </section>

        <section className={`surface-card ${isFiltersExpanded ? 'overflow-visible' : 'overflow-hidden'}`} aria-labelledby="history-filters-title">
          <button
            type="button"
            onClick={() => setIsFiltersExpanded((current) => !current)}
            aria-expanded={isFiltersExpanded}
            aria-controls="history-filters-content"
            className={`group flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-[#f8f8fa] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--blue)] sm:px-6 ${isFiltersExpanded ? 'border-b border-[var(--line)]' : ''}`}
          >
            <span className="min-w-0">
              <span id="history-filters-title" className="block text-[16px] font-semibold text-[var(--ink)]">{text('ตัวกรองประวัติ', 'History filters')}</span>
              <span className="mt-0.5 block text-[13px] text-[var(--muted)]">{text('ค้นหาตามวันที่และผลการตรวจ', 'Filter by date and detection result.')}</span>
            </span>
            <span className="flex shrink-0 items-center gap-2">
              {hasActiveFilters && <span className="rounded-full bg-[#e8f2ff] px-2.5 py-1 text-[11px] font-semibold text-[var(--blue)]">{text('ใช้ตัวกรองอยู่', 'Filtered')}</span>}
              <span className="flex items-center gap-2 rounded-full border border-[var(--line)] bg-white px-3 py-2 text-[13px] font-semibold text-[var(--ink)] group-hover:border-[var(--blue)] group-hover:text-[var(--blue)]">
                {isFiltersExpanded ? text('พับ', 'Collapse') : text('เปิด', 'Expand')}
                <ChevronDown size={17} className={`transition-transform duration-200 ${isFiltersExpanded ? 'rotate-180' : ''}`} aria-hidden="true" />
              </span>
            </span>
          </button>
          {isFiltersExpanded && (
          <div id="history-filters-content" className="grid grid-cols-1 gap-2 p-4 sm:grid-cols-2 lg:grid-cols-4">
            <DetectionDateRangePicker
              startDate={startDate}
              endDate={endDate}
              disabled={loading}
              onChange={(range) => updateFilters(range)}
            />
            {renderLegacyDatePicker && <div ref={datePickerRef} className="relative flex min-w-0 flex-col gap-1 text-[12px] font-medium text-[var(--muted)]">
              <span className="inline-flex items-center gap-1.5"><CalendarDays size={15} aria-hidden="true" /> ช่วงวันที่</span>
              <button type="button" onClick={openDatePicker} disabled={loading} aria-expanded={isDatePickerOpen} className="flex min-h-10 items-center justify-between rounded-lg border border-[var(--line)] bg-white px-3 text-left text-[14px] text-[var(--ink)] outline-none transition-colors hover:bg-[#f5f5f7] focus:border-[var(--blue)] disabled:cursor-not-allowed disabled:opacity-50">
                <span className="truncate">{startDate || endDate ? `${displayDate(startDate)} - ${displayDate(endDate)}` : 'เลือกช่วงวัน'}</span>
                <CalendarDays size={16} className="ml-2 shrink-0 text-[var(--muted)]" aria-hidden="true" />
              </button>
              {isDatePickerOpen && (
                <div className="absolute left-0 top-full z-30 mt-2 w-[min(21rem,calc(100vw-2.5rem))] rounded-lg border border-[var(--line)] bg-white p-3 shadow-[0_8px_24px_rgba(0,0,0,0.12)]">
                  <div className="grid grid-cols-2 gap-2">
                    {(['start', 'end'] as DateSelection[]).map((selection) => (
                      <button key={selection} type="button" onClick={() => setDateSelection(selection)} className={`rounded-md border px-2 py-2 text-left text-[12px] transition-colors ${dateSelection === selection ? 'border-[var(--blue)] bg-[#f0f7ff] text-[var(--blue)]' : 'border-[var(--line)] text-[var(--muted)] hover:bg-[#f5f5f7]'}`}>
                        <span className="block">{selection === 'start' ? 'วันเริ่มต้น' : 'วันสิ้นสุด'}</span>
                        <strong className="mt-0.5 block truncate text-[13px] font-semibold text-[var(--ink)]">{displayDate(selection === 'start' ? startDate : endDate)}</strong>
                      </button>
                    ))}
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <button type="button" onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))} aria-label="เดือนก่อนหน้า" className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--ink)] hover:bg-[#f5f5f7]"><ChevronLeft size={16} aria-hidden="true" /></button>
                    <strong className="text-[13px] text-[var(--ink)]">{calendarMonth.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })}</strong>
                    <button type="button" onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))} disabled={calendarMonth.getFullYear() === todayCalendarDate.getFullYear() && calendarMonth.getMonth() === todayCalendarDate.getMonth()} aria-label="เดือนถัดไป" className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--ink)] hover:bg-[#f5f5f7] disabled:cursor-not-allowed disabled:opacity-30"><ChevronRight size={16} aria-hidden="true" /></button>
                  </div>
                  <div className="mt-2 grid grid-cols-7 text-center text-[11px] text-[var(--muted)]">
                    {['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'].map((day) => <span key={day} className="py-1">{day}</span>)}
                  </div>
                  <div className="grid grid-cols-7 gap-0.5">
                    {calendarDays.map((date, index) => {
                      if (!date) return <span key={index} className="h-9" />
                      const value = formatDateValue(date)
                      const isSelected = value === startDate || value === endDate
                      const isInRange = Boolean(startDate && endDate && value > startDate && value < endDate)
                      const isFuture = date > todayCalendarDate
                      return (
                        <button key={value} type="button" disabled={isFuture} onClick={() => selectCalendarDate(date)} aria-pressed={isSelected} className={`h-9 rounded-md text-[13px] transition-colors ${isSelected ? 'bg-[var(--blue)] font-semibold text-white' : isInRange ? 'bg-[#e8f2ff] text-[var(--blue)]' : 'text-[var(--ink)] hover:bg-[#f5f5f7]'} disabled:cursor-not-allowed disabled:text-[#c7c7cc] disabled:hover:bg-transparent`}>
                          {date.getDate()}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>}
            <label className="flex min-w-0 flex-col gap-1 text-[12px] font-medium text-[var(--muted)]">
              <span>{text('ประเภทผลตรวจ', 'Detection result type')}</span>
              <select value={ppeFilterMode} onChange={(event) => updatePpeFilterMode(event.target.value as PpeFilterMode)} disabled={loading} className="min-h-10 rounded-lg border border-[var(--line)] bg-white px-3 text-[14px] text-[var(--ink)] outline-none focus:border-[var(--blue)] disabled:cursor-not-allowed disabled:opacity-50">
                <option value="">{text('ทั้งหมด', 'All')}</option>
                <option value="missing">{text('พบการฝ่าฝืน', 'Violation')}</option>
                <option value="detected">{text('สวมใส่ครบถ้วน', 'Compliant')}</option>
              </select>
            </label>
            {ppeFilterMode === 'missing' ? (
              <label className="flex min-w-0 flex-col gap-1 text-[12px] font-medium text-[var(--muted)]">
                <span>{text('รายการที่ตรวจไม่พบ', 'Missing PPE')}</span>
                <select value={missingPpe} onChange={(event) => updateFilters({ missingPpe: event.target.value as MissingPpeFilter })} disabled={loading} className="min-h-10 rounded-lg border border-[var(--line)] bg-white px-3 text-[14px] text-[var(--ink)] outline-none focus:border-[var(--blue)] disabled:cursor-not-allowed disabled:opacity-50">
                  <option value="">{text('เลือก PPE ที่ตรวจไม่พบ', 'Select missing PPE')}</option>
                  <option value="helmet">{text('หมวกนิรภัย', 'Safety helmet')}</option>
                  <option value="vest">{text('เสื้อสะท้อนแสง', 'Safety vest')}</option>
                  <option value="both">{text('ตรวจไม่พบทั้งคู่', 'Both items missing')}</option>
                </select>
              </label>
            ) : ppeFilterMode === 'detected' ? (
              <div className="flex min-w-0 flex-col gap-1 text-[12px] font-medium text-[var(--muted)]">
                <span>{text('รายการที่ตรวจพบ', 'Detected PPE')}</span>
                <div className="flex min-h-10 items-center rounded-lg border border-[#b9dfc2] bg-[#f3fbf5] px-3 text-[14px] font-semibold text-[#15803d]">
                  {text('สวมใส่ครบถ้วน', 'Compliant')}
                </div>
              </div>
            ) : (
              <div className="hidden lg:block" aria-hidden="true" />
            )}
            <div className="flex items-end">
              <button type="button" onClick={clearFilters} disabled={loading || !hasActiveFilters} className="btn-apple-secondary min-h-10 w-full text-[var(--blue)] disabled:cursor-not-allowed disabled:opacity-50">{text('ล้างการเลือก', 'Clear filters')}</button>
            </div>
          </div>
          )}
        </section>

        {loading && detections.length === 0 ? (
          <div className="surface-card flex min-h-72 items-center justify-center gap-3 text-[15px] text-[var(--muted)]" role="status">
            <Loader2 size={21} className="animate-spin text-[var(--blue)]" aria-hidden="true" />
            {text('กำลังโหลดประวัติการตรวจจับ…', 'Loading records…')}
          </div>
        ) : loadError ? (
          <div className="surface-card flex min-h-72 flex-col items-center justify-center gap-4 px-6 text-center" role="alert">
            <AlertTriangle size={28} className="text-[#d70015]" strokeWidth={1.6} aria-hidden="true" />
            <p className="text-[21px] font-semibold tracking-[-0.01em] text-[var(--ink)]">{text('โหลดประวัติการตรวจจับไม่สำเร็จ', 'Unable to load detection history')}</p>
            <p className="max-w-md text-[15px] leading-relaxed text-[var(--muted)]">{text('ตรวจสอบการเชื่อมต่อกับระบบ แล้วลองโหลดข้อมูลอีกครั้ง', 'Check the backend connection, then try loading the records again.')}</p>
            <button type="button" onClick={() => void loadHistory()} className="btn-apple-secondary !min-h-11 text-[var(--blue)]">{text('ลองอีกครั้ง', 'Try again')}</button>
          </div>
        ) : detections.length === 0 ? (
          <div className="surface-card flex min-h-72 flex-col items-center justify-center gap-4 px-6 text-center">
            <Clock size={30} className="text-[var(--muted)]" strokeWidth={1.5} aria-hidden="true" />
            <p className="text-[21px] font-semibold tracking-[-0.01em] text-[var(--ink)]">{hasActiveFilters ? text('ไม่พบรายการตามตัวกรองนี้', 'No records match these filters') : text('ยังไม่มีประวัติการตรวจจับ', 'No detection records yet')}</p>
            <p className="max-w-sm text-[15px] leading-relaxed text-[var(--muted)]">
              {hasActiveFilters ? text('ลองปรับช่วงวันหรือชนิดอุปกรณ์ที่ต้องการค้นหา', 'Try changing the date range or equipment filters.') : text('ผลการตรวจจับจะแสดงที่นี่หลังจากระบบประมวลผลรูปภาพ วิดีโอ หรือกล้อง', 'Detection results will appear here after the system processes an image, video, or camera feed.')}
            </p>
            {hasActiveFilters && (
              <button type="button" onClick={clearFilters} className="btn-apple-secondary !min-h-11 text-[var(--blue)]">{text('ล้างตัวกรอง', 'Clear filters')}</button>
            )}
          </div>
        ) : (
          <section className="surface-card overflow-hidden" aria-labelledby="records-title">
            <div className="flex min-h-16 items-center justify-between gap-4 border-b border-[var(--line)] px-6 sm:px-8">
              <h2 id="records-title" className="text-[21px] font-semibold tracking-[-0.01em] text-[var(--ink)]">{text('ประวัติการตรวจจับ', 'Detection records')}</h2>
              <span className="shrink-0 rounded-full bg-[#f5f5f7] px-4 py-2 text-[13px] text-[var(--muted)]">{text(`ทั้งหมด ${total.toLocaleString()} รายการ`, `${total.toLocaleString()} total`)}</span>
            </div>

            <DetectionRecordsTable
              detections={detections}
              onView={setSelectedDetection}
              onDownload={(detection) => void handleDownloadPdf(detection.id)}
              downloadingId={downloadingId}
            />

            {renderLegacyDetectionTable && <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] border-collapse">
                <thead>
                  <tr className="bg-[#f5f5f7] text-left text-[12px] font-semibold uppercase tracking-[0.04em] text-[var(--muted)]">
                    <th scope="col" className="w-[110px] px-6 py-4 sm:pl-8">Preview</th>
                    <th scope="col" className="min-w-[190px] px-6 py-4">Date &amp; time</th>
                    <th scope="col" className="w-[110px] px-6 py-4">Persons</th>
                    <th scope="col" className="px-6 py-4">Violations</th>
                    <th scope="col" className="w-[140px] px-6 py-4">Status</th>
                    <th scope="col" className="w-[140px] px-6 py-4 sm:pr-8">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {detections.map((detection, index) => (
                    <tr key={detection.id} className={`border-t border-[var(--line)] transition-colors hover:bg-[#f5f5f7] ${index % 2 === 0 ? 'bg-white' : 'bg-[#fafafc]'}`}>
                      <td className="px-6 py-4 align-middle sm:pl-8">
                        <div className="h-14 w-14 overflow-hidden rounded-[11px] border border-[var(--line)] bg-[#f5f5f7]">
                          <ProtectedDetectionImage
                            detectionId={detection.id}
                            alt={`Detection ${detection.id} preview`}
                            className="h-full w-full object-cover"
                          />
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 align-middle text-[15px] text-[var(--ink)]">
                        {new Date(detection.created_at).toLocaleString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="px-6 py-4 align-middle">
                        <span className="inline-flex items-center gap-2 text-[15px] text-[var(--ink)]">
                          <Users size={15} className="text-[var(--muted)]" strokeWidth={1.8} aria-hidden="true" />
                          <span className="font-semibold tabular-nums">{detection.person_count}</span>
                        </span>
                      </td>
                      <td className="px-6 py-4 align-middle">
                        {detection.violations && detection.violations.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {detection.violations.slice(0, 2).map((violation, violationIndex) => (
                              <span key={`${violation}-${violationIndex}`} className="inline-flex rounded-full border border-[#f0c3c8] bg-[#fff8f8] px-3 py-1.5 text-[12px] font-semibold text-[#d70015]">
                                {formatViolationLabel(violation)}
                              </span>
                            ))}
                            {detection.violations.length > 2 && (
                              <span className="inline-flex rounded-full bg-[#f5f5f7] px-3 py-1.5 text-[12px] text-[var(--muted)]">+{detection.violations.length - 2} more</span>
                            )}
                          </div>
                        ) : (
                          <span className={`inline-flex rounded-full border px-3 py-1.5 text-[12px] font-semibold ${
                            isPersonOnlyDetection(detection)
                              ? 'border-[#c7d2fe] bg-[#eef2ff] text-[#1d4ed8]'
                              : 'border-[#b9dfc2] bg-[#f3fbf5] text-[#15803d]'
                          }`}>
                            {reportTag(detection)}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 align-middle">
                        <span className={`inline-flex items-center gap-2 text-[13px] font-semibold ${
                          detection.has_violation
                            ? 'text-[#d70015]'
                            : isPersonOnlyDetection(detection) ? 'text-[#1d4ed8]' : 'text-[#15803d]'
                        }`}>
                          <span className={`h-2 w-2 rounded-full ${
                            detection.has_violation
                              ? 'bg-[#d70015]'
                              : isPersonOnlyDetection(detection) ? 'bg-[#3b82f6]' : 'bg-[#34c759]'
                          }`} aria-hidden="true" />
                          {reportStatus(detection)}
                        </span>
                      </td>
                      <td className="px-6 py-4 align-middle sm:pr-8">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={(event) => { event.stopPropagation(); void handleDownloadPdf(detection.id) }}
                            disabled={downloadingId === detection.id}
                            aria-label={`Download PDF for detection ${detection.id}`}
                            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[var(--line)] bg-white text-[var(--blue)] transition-colors hover:bg-[#f5f5f7] active:scale-95 disabled:opacity-50"
                          >
                            {downloadingId === detection.id ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Download size={16} strokeWidth={1.8} aria-hidden="true" />}
                          </button>
                          <button
                            type="button"
                            onClick={(event) => { event.stopPropagation(); setSelectedDetection(detection) }}
                            aria-label={`View detection ${detection.id}`}
                            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[var(--line)] bg-white text-[var(--blue)] transition-colors hover:bg-[#f5f5f7] active:scale-95"
                          >
                            <Eye size={16} strokeWidth={1.8} aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>}

            {totalPages > 1 && (
              <div className="flex flex-col items-center justify-between gap-4 border-t border-[var(--line)] px-6 py-5 sm:flex-row sm:px-8">
                <span className="text-[14px] text-[var(--muted)]">{text('หน้า', 'Page')} <strong className="font-semibold text-[var(--ink)]">{page}</strong> {text('จาก', 'of')} {totalPages}</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={loading || page === 1}
                    className="btn-apple-secondary !min-h-11 active:scale-95"
                  >
                    <ChevronLeft size={16} aria-hidden="true" />
                    {text('ก่อนหน้า', 'Previous')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage(Math.min(totalPages, page + 1))}
                    disabled={loading || page === totalPages}
                    className="btn-apple-secondary !min-h-11 active:scale-95"
                  >
                    {text('ถัดไป', 'Next')}
                    <ChevronRight size={16} aria-hidden="true" />
                  </button>
                </div>
              </div>
            )}
          </section>
        )}
      </div>

      <DetectionDetailsDialog
        open={Boolean(selectedDetection)}
        detection={selectedDetection}
        onClose={() => setSelectedDetection(null)}
        onDownload={(detection) => void handleDownloadPdf(detection.id)}
        downloading={downloadingId === selectedDetection?.id}
      />

      {renderLegacyDetailsDialog && selectedDetection && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6">
          <button
            type="button"
            aria-label="Close detection details"
            className="absolute inset-0 h-full w-full cursor-default border-0 bg-black/55 backdrop-blur-[2px]"
            onClick={() => setSelectedDetection(null)}
          />
          <section
            ref={detectionDialogRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-labelledby="detection-detail-title"
            className="relative flex max-h-[92vh] w-full max-w-[900px] flex-col overflow-hidden rounded-[18px] border border-[var(--line)] bg-white"
          >
            <header className="flex min-h-[72px] shrink-0 items-center justify-between gap-4 border-b border-[var(--line)] px-5 sm:px-8">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#f5f5f7] text-[var(--ink)]" aria-hidden="true">
                  <FileText size={18} strokeWidth={1.8} />
                </span>
                <div>
                  <h2 id="detection-detail-title" className="text-[21px] font-semibold tracking-[-0.01em] text-[var(--ink)]">Detection detail</h2>
                  <p className="mt-0.5 text-[13px] text-[var(--muted)]">DET-{String(selectedDetection.id).padStart(5, '0')}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDetection(null)}
                aria-label="Close"
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#f5f5f7] text-[var(--ink)] transition-colors hover:text-[var(--blue)] active:scale-95"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto p-5 sm:p-8">
              <div className="flex flex-col gap-6">
                <div className="overflow-hidden rounded-[18px] border border-[var(--line)] bg-[#f5f5f7]">
                  <ProtectedDetectionImage
                    detectionId={selectedDetection.id}
                    alt={`Detection ${selectedDetection.id} result`}
                    className="w-full max-h-[420px] object-contain"
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="rounded-[18px] border border-[var(--line)] bg-[#f5f5f7] p-5">
                    <p className="text-[13px] text-[var(--muted)]">Date &amp; time</p>
                    <p className="mt-2 text-[17px] font-semibold text-[var(--ink)]">{new Date(selectedDetection.created_at).toLocaleString('th-TH')}</p>
                  </div>
                  <div className="rounded-[18px] border border-[var(--line)] bg-[#f5f5f7] p-5">
                    <p className="text-[13px] text-[var(--muted)]">Reference ID</p>
                    <p className="mt-2 text-[24px] font-semibold tracking-[-0.02em] text-[var(--ink)]">DET-{String(selectedDetection.id).padStart(5, '0')}</p>
                  </div>
                </div>

                <div className="overflow-hidden rounded-[18px] border border-[var(--line)]">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] bg-[#f5f5f7] px-5 py-4 sm:px-6">
                    <p className="text-[14px] font-semibold text-[var(--ink)]">Summary</p>
                    <span className={`inline-flex rounded-full border px-3 py-1.5 text-[12px] font-semibold ${
                      selectedDetection.has_violation
                        ? 'border-[#f0c3c8] bg-[#fff8f8] text-[#d70015]'
                        : isPersonOnlyDetection(selectedDetection)
                          ? 'border-[#c7d2fe] bg-[#eef2ff] text-[#1d4ed8]'
                          : 'border-[#b9dfc2] bg-[#f3fbf5] text-[#15803d]'
                    }`}>
                      {selectedDetection.has_violation ? text('พบการฝ่าฝืน', 'Violation detected') : isPersonOnlyDetection(selectedDetection) ? text('ตรวจพบบุคคลเท่านั้น', 'Person only') : text('ตรวจพบการสวมใส่ครบถ้วน', 'Compliant detection')}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 divide-y divide-[var(--line)] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                    {[
                      { label: 'Persons detected', value: String(selectedDetection.person_count), className: 'text-[var(--ink)]' },
                      { label: 'Violations', value: String(selectedDetection.violation_count), className: selectedDetection.violation_count > 0 ? 'text-[#d70015]' : 'text-[#15803d]' },
                      { label: 'Processing time', value: selectedDetection.processing_time_ms != null ? `${selectedDetection.processing_time_ms} ms` : '—', className: 'text-[var(--ink)]' },
                    ].map((summary) => (
                      <div key={summary.label} className="p-5 text-center sm:p-6">
                        <p className="text-[13px] text-[var(--muted)]">{summary.label}</p>
                        <p className={`mt-3 text-[28px] font-semibold tracking-[-0.02em] ${summary.className}`}>{summary.value}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {selectedDetection.violations && selectedDetection.violations.length > 0 && (
                  <div className="rounded-[18px] border border-[var(--line)] p-5 sm:p-6">
                    <p className="mb-4 text-[14px] font-semibold text-[var(--ink)]">Violation types</p>
                    <div className="flex flex-wrap gap-2">
                      {selectedDetection.violations.map((violation, index) => (
                        <span key={`${violation}-${index}`} className="inline-flex rounded-full border border-[#f0c3c8] bg-[#fff8f8] px-4 py-2 text-[13px] font-semibold text-[#d70015]">
                          {formatViolationLabel(violation)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {selectedDetection.summary?.settings && (
                  <div className="rounded-[18px] border border-[var(--line)] p-5 sm:p-6">
                    <p className="mb-4 text-[14px] font-semibold text-[var(--ink)]">Settings used</p>
                    <div className="grid gap-3 text-[14px] sm:grid-cols-3">
                      <div>
                        <p className="text-[var(--muted)]">Mode</p>
                        <p className="mt-1 font-semibold text-[var(--ink)]">{selectedDetection.summary.settings.detection_mode}</p>
                      </div>
                      <div>
                        <p className="text-[var(--muted)]">PPE rules</p>
                        <p className="mt-1 font-semibold text-[var(--ink)]">{selectedDetection.summary.settings.ppe_rules_label}</p>
                      </div>
                      <div>
                        <p className="text-[var(--muted)]">Confidence</p>
                        <p className="mt-1 font-semibold text-[var(--ink)]">{selectedDetection.summary.settings.confidence_settings}</p>
                      </div>
                    </div>
                  </div>
                )}

              </div>
            </div>

            <footer className="flex shrink-0 flex-col-reverse gap-3 border-t border-[var(--line)] bg-[#f5f5f7] px-5 py-5 sm:flex-row sm:justify-end sm:px-8">
              <button type="button" onClick={() => setSelectedDetection(null)} className="btn-apple-secondary !min-h-11 active:scale-95">Close</button>
              <button
                type="button"
                onClick={() => void handleDownloadPdf(selectedDetection.id)}
                disabled={downloadingId === selectedDetection.id}
                className="btn-apple-primary !min-h-11 active:scale-95"
              >
                {downloadingId === selectedDetection.id ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Download size={16} aria-hidden="true" />}
                Download PDF
              </button>
            </footer>
          </section>
        </div>
      )}
    </>
  )

  return embedded ? content : <Layout>{content}</Layout>
}
