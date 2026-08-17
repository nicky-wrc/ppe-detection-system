import { useCallback, useEffect, useRef, useState } from 'react'
import { Layout } from '../components/layout/Layout'
import { useDialogFocus } from '../hooks/useDialogFocus'
import { detectionService } from '../services/detection'
import { alertsService } from '../services/alerts'
import { camerasService } from '../services/cameras'
import { ProtectedDetectionImage } from '../components/ui/ProtectedDetectionImage'
import type { Alert, DetectionStats, Detection } from '../types'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import {
  AlertTriangle,
  ShieldAlert,
  Clock,
  Download,
  Activity,
  CheckCircle,
  Camera,
  Eye,
  X,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'

interface ViolationRow {
  id: string
  detectionId: number
  createdAt: string
  refId: string
  violationTypes: string[]
  message?: string
}

interface DailySummary {
  detections: number
  violations: number
  compliance: number
}

const chartTooltipStyle = {
  contentStyle: {
    backgroundColor: '#ffffff',
    border: '1px solid rgba(0, 0, 0, 0.08)',
    borderRadius: '11px',
    boxShadow: 'none',
    fontSize: '13px',
  },
  labelStyle: { color: '#6e6e73' },
}

function escapePdfHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function getDashboardExportPeriod(
  activeFilter: string,
  customStartDate: string,
  customEndDate: string
): { labelTh: string; labelEn: string; isHourly: boolean } {
  if (activeFilter === 'Today') {
    const d = new Date()
    return {
      labelTh: `วันนี้ — ${d.toLocaleDateString('th-TH', { dateStyle: 'long' })}`,
      labelEn: `Today — ${d.toLocaleDateString('en-GB', { dateStyle: 'full' })}`,
      isHourly: true,
    }
  }
  if (activeFilter === '7 days') {
    const end = new Date()
    const start = new Date()
    start.setDate(end.getDate() - 6)
    return {
      labelTh: `7 วันย้อนหลัง — ${start.toLocaleDateString('th-TH')} ถึง ${end.toLocaleDateString('th-TH')}`,
      labelEn: `Last 7 days — ${start.toLocaleDateString('en-GB')} to ${end.toLocaleDateString('en-GB')}`,
      isHourly: false,
    }
  }
  if (activeFilter === '30 days') {
    const end = new Date()
    const start = new Date()
    start.setDate(end.getDate() - 29)
    return {
      labelTh: `30 วันย้อนหลัง — ${start.toLocaleDateString('th-TH')} ถึง ${end.toLocaleDateString('th-TH')}`,
      labelEn: `Last 30 days — ${start.toLocaleDateString('en-GB')} to ${end.toLocaleDateString('en-GB')}`,
      isHourly: false,
    }
  }
  if (activeFilter === 'Custom' && customStartDate && customEndDate) {
    const same = customStartDate === customEndDate
    const s = new Date(`${customStartDate}T12:00:00`)
    const e = new Date(`${customEndDate}T12:00:00`)
    return {
      labelTh: same
        ? `วันเดียว — ${s.toLocaleDateString('th-TH', { dateStyle: 'long' })}`
        : `กำหนดเอง — ${s.toLocaleDateString('th-TH')} ถึง ${e.toLocaleDateString('th-TH')}`,
      labelEn: same
        ? `Custom — ${s.toLocaleDateString('en-GB', { dateStyle: 'full' })}`
        : `Custom range — ${s.toLocaleDateString('en-GB')} to ${e.toLocaleDateString('en-GB')}`,
      isHourly: same,
    }
  }
  return {
    labelTh: 'กำหนดเอง — ยังไม่ได้เลือกช่วงวันที่ในแดชบอร์ด',
    labelEn: 'Custom — select start and end dates on the dashboard filter bar',
    isHourly: false,
  }
}

async function dashboardPdfHtmlToCanvas(
  innerHtml: string,
  widthPx: number,
  compact = false
): Promise<{ dataUrl: string; cw: number; ch: number }> {
  const host = document.createElement('div')
  host.style.cssText = `position:fixed;left:-9000px;top:0;width:${widthPx}px;background:#ffffff;`
  host.innerHTML = `
  <style>
    .db-pdf { font-family: "SF Pro Text", system-ui, -apple-system, BlinkMacSystemFont, sans-serif; color: #1d1d1f; }
    .db-pdf h1 { margin: 0 0 10px; font-size: 20px; font-weight: 600; line-height: 1.3; letter-spacing: -0.01em; }
    .db-pdf h2 { margin: 0 0 8px; font-size: 15px; font-weight: 600; }
    .db-pdf p { margin: 0 0 8px; font-size: 11.5px; line-height: 1.5; color: #424245; }
    .db-pdf .muted { color: #6e6e73; font-size: 10.5px; }
    .db-pdf .box { border-left: 3px solid #0066cc; padding-left: 12px; margin-top: 12px; }
    .db-pdf--compact { padding: 14px 18px !important; }
    .db-pdf--compact h1 { font-size: 17px; margin-bottom: 6px; }
    .db-pdf--compact h2 { font-size: 13px; margin-top: 12px; margin-bottom: 5px; }
    .db-pdf--compact .box { margin-top: 8px; padding-left: 10px; }
    .db-pdf--compact p { font-size: 10.5px; margin-bottom: 5px; line-height: 1.42; }
    .db-pdf--compact .muted { font-size: 9.5px; }
  </style>
  <div class="db-pdf${compact ? ' db-pdf--compact' : ''}" style="padding:20px 22px;">${innerHtml}</div>`
  document.body.appendChild(host)
  try {
    const root = host.querySelector('.db-pdf') as HTMLElement
    if (document.fonts?.ready) await document.fonts.ready
    const canvas = await html2canvas(root, { scale: 2, backgroundColor: '#ffffff', logging: false })
    const dataUrl = canvas.toDataURL('image/png', 1.0)
    return { dataUrl, cw: canvas.width, ch: canvas.height }
  } finally {
    host.remove()
  }
}

function pdfAddImageFitWidth(
  pdf: InstanceType<typeof jsPDF>,
  dataUrl: string,
  cw: number,
  ch: number,
  x: number,
  y: number,
  maxWidthMm: number,
  maxHeightMm: number
): number {
  let w = maxWidthMm
  let h = (ch * w) / cw
  if (h > maxHeightMm) {
    h = maxHeightMm
    w = (cw * h) / ch
  }
  pdf.addImage(dataUrl, 'PNG', x, y, w, h)
  return h
}

export function DashboardPage() {
  const [stats, setStats] = useState<DetectionStats | null>(null)
  const [violations, setViolations] = useState<ViolationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [activeCameras, setActiveCameras] = useState(0)
  const [activeFilter, setActiveFilter] = useState<string>('Today')
  const [customStartDate, setCustomStartDate] = useState<string>('')
  const [customEndDate, setCustomEndDate] = useState<string>('')
  const [dailyData, setDailyData] = useState<{ name: string; value: number; compliance?: number }[]>([])
  const [weeklyData, setWeeklyData] = useState<{ name: string; value: number }[]>([])
  const [analyticsLoading, setAnalyticsLoading] = useState(true)
  const [todaySummary, setTodaySummary] = useState<DailySummary>({ detections: 0, violations: 0, compliance: 0 })
  const [yesterdaySummary, setYesterdaySummary] = useState<DailySummary>({ detections: 0, violations: 0, compliance: 0 })
  const [isExportOpen, setIsExportOpen] = useState(false)
  const [exportTarget, setExportTarget] = useState<{ compliance: boolean; violation: boolean }>({
    compliance: true,
    violation: true,
  })
  const [isExporting, setIsExporting] = useState(false)
  const [selectedViolation, setSelectedViolation] = useState<ViolationRow | null>(null)
  const [fullDetectionDetails, setFullDetectionDetails] = useState<Detection | null>(null)
  const [isLoadingDetails, setIsLoadingDetails] = useState(false)
  const [detailsError, setDetailsError] = useState(false)
  const closeExportDialog = useCallback(() => {
    if (!isExporting) setIsExportOpen(false)
  }, [isExporting])
  const closeViolationDialog = useCallback(() => setSelectedViolation(null), [])
  const exportDialogRef = useDialogFocus<HTMLDivElement>(isExportOpen, closeExportDialog)
  const violationDialogRef = useDialogFocus<HTMLDivElement>(Boolean(selectedViolation), closeViolationDialog)
  const complianceChartRef = useRef<HTMLDivElement | null>(null)
  const violationChartRef = useRef<HTMLDivElement | null>(null)
  const navigate = useNavigate()

  useEffect(() => { loadData() }, [])

  useEffect(() => {
    let cancelled = false
    if (selectedViolation) {
      setIsLoadingDetails(true)
      setDetailsError(false)
      detectionService.getDetection(selectedViolation.detectionId)
        .then(data => {
          if (!cancelled) setFullDetectionDetails(data)
        })
        .catch(err => {
          if (cancelled) return
          console.error('Failed to load detection details:', err)
          setDetailsError(true)
        })
        .finally(() => {
          if (!cancelled) setIsLoadingDetails(false)
        })
    } else {
      setFullDetectionDetails(null)
      setDetailsError(false)
    }
    return () => {
      cancelled = true
    }
  }, [selectedViolation])

  const loadData = async () => {
    setLoadError(false)
    try {
      const [statsData, alertsData, camerasData] = await Promise.all([
        detectionService.getStats(),
        alertsService.list(1, 20).catch(() => ({ items: [] as Alert[], total: 0, page: 1, per_page: 20 })),
        camerasService.list().catch(() => []),
      ])
      setStats(statsData)
      setActiveCameras((camerasData || []).filter((camera) => camera.is_online).length)

      const items = alertsData?.items || []
      
      type GroupedAlert = Alert & { alert_types: string[] }
      const groupedItems = items.reduce<GroupedAlert[]>((acc, current) => {
        const existing = acc.find((item) => item.detection_id === current.detection_id)
        if (existing) {
          if (!existing.alert_types.includes(current.alert_type)) {
            existing.alert_types.push(current.alert_type)
          }
        } else {
          acc.push({ ...current, alert_types: [current.alert_type] })
        }
        return acc
      }, [])

      const rows: ViolationRow[] = groupedItems.map((a) => ({
        id: String(a.id),
        detectionId: a.detection_id,
        createdAt: a.created_at,
        refId: `DET-${String(a.detection_id).padStart(5, '0')}`,
        violationTypes: a.alert_types,
        message: a.message,
      }))
      setViolations(rows.slice(0, 10))
    } catch (error) {
      console.error('Error loading data:', error)
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    const loadAnalytics = async () => {
      setAnalyticsLoading(true)
      try {
        let days: number | undefined = undefined
        let start: string | undefined = undefined
        let end: string | undefined = undefined

        if (activeFilter === 'Today') days = 1
        else if (activeFilter === '7 days') days = 7
        else if (activeFilter === '30 days') days = 30
        else if (activeFilter === 'Custom') {
          const customSpanDays = customStartDate && customEndDate
            ? (new Date(`${customEndDate}T12:00:00`).getTime() - new Date(`${customStartDate}T12:00:00`).getTime()) / 86_400_000
            : null
          if (!customStartDate || !customEndDate || customStartDate > customEndDate || (customSpanDays !== null && customSpanDays >= 30)) {
            if (!cancelled) {
              setDailyData([])
              setWeeklyData([])
              setAnalyticsLoading(false)
            }
            return
          }
          start = customStartDate
          end = customEndDate
        }

        const analytics = await detectionService.getAnalytics(days, start, end)
        if (cancelled) return
        const isSingleDay = activeFilter === 'Today' || (activeFilter === 'Custom' && start === end)

        if (isSingleDay) {
          if (analytics?.hourly?.length) {
            const mapped = analytics.hourly.map((d: { hour: string; violations?: number; compliance?: number }) => ({
              name: d.hour,
              value: d.violations ?? 0,
              compliance: d.compliance ?? 0,
            }))
            setDailyData(mapped)
            setWeeklyData(mapped)
          } else {
            setDailyData([])
            setWeeklyData([])
          }
        } else {
          if (analytics?.daily?.length) {
            const mapped = analytics.daily.map((d: { day?: string; date: string; violations?: number; compliance?: number }, idx: number) => {
              const isLongRange = (analytics?.daily?.length ?? 0) > 7
              return {
              // For long ranges, show date labels to avoid repeated weekday names.
              name: isLongRange ? d.date?.slice(5) || `D${idx + 1}` : d.day || d.date?.slice(5) || '',
              value: d.violations ?? 0,
              compliance: d.compliance ?? 0,
            }})
            setDailyData(mapped)
            setWeeklyData(mapped)
          } else {
            setDailyData([])
            setWeeklyData([])
          }
        }
      } catch (e) {
        if (cancelled) return
        console.error('Error loading analytics:', e)
        setDailyData([])
        setWeeklyData([])
      } finally {
        if (!cancelled) setAnalyticsLoading(false)
      }
    }
    void loadAnalytics()
    return () => {
      cancelled = true
    }
  }, [activeFilter, customStartDate, customEndDate])

  useEffect(() => {
    let cancelled = false
    const loadComparisons = async () => {
      try {
        const today = new Date()
        const yesterday = new Date()
        yesterday.setDate(today.getDate() - 1)
        const toYmd = (date: Date) => [
          date.getFullYear(),
          String(date.getMonth() + 1).padStart(2, '0'),
          String(date.getDate()).padStart(2, '0'),
        ].join('-')

        const [todayAnalytics, yesterdayAnalytics] = await Promise.all([
          detectionService.getAnalytics(1, toYmd(today), toYmd(today)),
          detectionService.getAnalytics(1, toYmd(yesterday), toYmd(yesterday)),
        ])
        if (cancelled) return

        const todayData = todayAnalytics?.daily?.[0]
        const yesterdayData = yesterdayAnalytics?.daily?.[0]

        setTodaySummary({
          detections: todayData?.detections ?? 0,
          violations: todayData?.violations ?? 0,
          compliance: todayData?.compliance ?? 0,
        })
        setYesterdaySummary({
          detections: yesterdayData?.detections ?? 0,
          violations: yesterdayData?.violations ?? 0,
          compliance: yesterdayData?.compliance ?? 0,
        })
      } catch (error) {
        if (cancelled) return
        console.error('Error loading day comparisons:', error)
      }
    }

    void loadComparisons()
    return () => {
      cancelled = true
    }
  }, [])

  /** Day-over-day trend vs yesterday. When yesterday had no baseline (0), % change is undefined — do not show fake +100%. */
  type DayTrend =
    | { kind: 'percent'; value: number; isUp: boolean }
    | { kind: 'stable' }
    | { kind: 'from_zero_count'; value: number }
    | { kind: 'from_zero_rate'; value: number }

  const getDayTrend = (current: number, previous: number, mode: 'count' | 'rate'): DayTrend => {
    if (previous === 0 && current === 0) return { kind: 'stable' }
    if (previous === 0) {
      return mode === 'count'
        ? { kind: 'from_zero_count', value: current }
        : { kind: 'from_zero_rate', value: current }
    }
    const diff = ((current - previous) / previous) * 100
    if (!Number.isFinite(diff)) return { kind: 'stable' }
    if (Math.abs(diff) < 0.05) return { kind: 'stable' }
    return { kind: 'percent', value: Math.abs(diff), isUp: diff >= 0 }
  }

  const cardChange = {
    detections: getDayTrend(todaySummary.detections, yesterdaySummary.detections, 'count'),
    violations: getDayTrend(todaySummary.violations, yesterdaySummary.violations, 'count'),
    compliance: getDayTrend(todaySummary.compliance, yesterdaySummary.compliance, 'rate'),
  }

  const renderTrend = (trend: DayTrend, favorableDirection: 'up' | 'down' | 'neutral') => {
    const sub = <span className="font-normal text-[var(--muted)]">vs yesterday</span>
    const directionColor = (isUp: boolean) => {
      if (favorableDirection === 'neutral') return 'text-[#6e6e73]'
      return (isUp && favorableDirection === 'up') || (!isUp && favorableDirection === 'down')
        ? 'text-[#248a3d]'
        : 'text-[#d70015]'
    }
    if (trend.kind === 'stable') {
      return (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[13px] font-semibold text-[#6e6e73]">
          Stable {sub}
        </div>
      )
    }
    if (trend.kind === 'from_zero_count') {
      return (
        <div className={`mt-2 flex flex-wrap items-center gap-1.5 text-[13px] font-semibold ${directionColor(true)}`}>
          ↑ +{trend.value.toLocaleString()} {sub}
        </div>
      )
    }
    if (trend.kind === 'from_zero_rate') {
      return (
        <div className={`mt-2 flex flex-wrap items-center gap-1.5 text-[13px] font-semibold ${directionColor(true)}`}>
          ↑ +{trend.value.toFixed(1)} pts {sub}
        </div>
      )
    }
    return (
      <div className={`mt-2 flex flex-wrap items-center gap-1.5 text-[13px] font-semibold ${directionColor(trend.isUp)}`}>
        {trend.isUp ? '↑' : '↓'} {trend.isUp ? '+' : '-'}
        {trend.value.toFixed(1)}% {sub}
      </div>
    )
  }

  const handleExportPdf = async () => {
    const blocks: Array<{ key: 'compliance' | 'violation'; element: HTMLDivElement | null }> = []
    if (exportTarget.compliance) blocks.push({ key: 'compliance', element: complianceChartRef.current })
    if (exportTarget.violation) blocks.push({ key: 'violation', element: violationChartRef.current })
    if (blocks.length === 0) return

    setIsExporting(true)
    try {
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const pageW = pdf.internal.pageSize.getWidth()
      const pageH = pdf.internal.pageSize.getHeight()
      const margin = 14
      const contentW = pageW - 2 * margin

      const period = getDashboardExportPeriod(activeFilter, customStartDate, customEndDate)
      const genTh = new Date().toLocaleString('th-TH', { dateStyle: 'long', timeStyle: 'medium' })
      const genEn = new Date().toLocaleString('en-GB', { dateStyle: 'full', timeStyle: 'medium' })
      const td = stats?.total_detections ?? 0
      const tv = stats?.total_violations ?? 0
      const cr = stats?.compliance_rate ?? 0

      /** Same official header on every chart page (harder to crop graph without context). */
      const reportHeaderHtml = `
      <h1>รายงานแดชบอร์ดความปลอดภัย (PPE)</h1>
      <p class="muted">PPE Detection System — Dashboard analytics export</p>
      <div class="box">
        <p><strong>วันที่และเวลาที่สร้างรายงาน</strong><br/>${escapePdfHtml(genTh)}</p>
        <p class="muted" style="margin-top:4px">${escapePdfHtml(genEn)}</p>
        <p style="margin-top:12px"><strong>ช่วงข้อมูลในกราฟ (ตามตัวกรองบนแดชบอร์ด)</strong><br/>${escapePdfHtml(period.labelTh)}</p>
        <p class="muted" style="margin-top:4px">${escapePdfHtml(period.labelEn)}</p>
        <p style="margin-top:12px"><strong>สรุปสถิติรวมระบบ (ณ เวลาที่ส่งออก)</strong><br/>
          การตรวจจับทั้งหมด ${td.toLocaleString()} รายการ · การฝ่าฝืนรวม ${tv.toLocaleString()} ครั้ง · อัตราความสอดคล้อง ${cr}%</p>
        <p class="muted" style="margin-top:8px">Total detections: ${td.toLocaleString()} · Total violations: ${tv.toLocaleString()} · Compliance rate: ${cr}%</p>
      </div>
    `

      const axisNoteTh = period.isHourly
        ? 'แกนนอน (X) แสดงชั่วโมงของวัน (00:00–23:00)'
        : 'แกนนอน (X) แสดงแต่ละวันในช่วงที่เลือก'
      const axisNoteEn = period.isHourly
        ? 'X-axis: hour of day (00:00–23:00) for the selected calendar day.'
        : 'X-axis: one column per calendar day in the selected range.'

      let firstChartPage = true
      for (const block of blocks) {
        if (!block.element) continue
        if (!firstChartPage) pdf.addPage()
        firstChartPage = false

        const sectionHtml =
          block.key === 'compliance'
            ? `
          <h2>กราฟความสอดคล้อง (Daily Compliance)</h2>
          <p><strong>คำอธิบาย</strong> แสดงอัตราการปฏิบัติตามกฎด้านความปลอดภัย (สัดส่วนผู้ที่ตรวจพบโดยไม่มีความผิดฝ่าฝืน) ในแต่ละช่วงเวลาของกราฟ แกนตั้ง (Y) 0–100 คือเปอร์เซ็นต์ความสอดคล้อง</p>
          <p class="muted">Compliance rate (% of detected persons without violations) per bucket. Y-axis: 0–100 (compliance %).</p>
          <p class="muted" style="margin-top:8px">${escapePdfHtml(axisNoteTh)}<br/>${escapePdfHtml(axisNoteEn)}</p>
        `
            : `
          <h2>กราฟแนวโน้มการฝ่าฝืน (Violations)</h2>
          <p><strong>คำอธิบาย</strong> แสดงจำนวนครั้งของความผิดฝ่าฝืนที่ระบบรวมได้ ต่อช่วงเวลาในกราฟ (แกนตั้ง Y = จำนวนครั้ง) เมื่อเลือกช่วงวันเดียว ข้อมูลจัดเป็นรายชั่วโมง เมื่อเลือกหลายวัน จัดเป็นรายวัน</p>
          <p class="muted">Violation counts per time bucket. Y-axis: number of violations. Single-day: hourly. Multi-day: per day.</p>
          <p class="muted" style="margin-top:8px">${escapePdfHtml(axisNoteTh)}<br/>${escapePdfHtml(axisNoteEn)}</p>
        `

        const topBlock = await dashboardPdfHtmlToCanvas(
          `${reportHeaderHtml}${sectionHtml}`,
          720,
          true
        )
        let y = 10
        const topMaxH = 118
        const topH = pdfAddImageFitWidth(
          pdf,
          topBlock.dataUrl,
          topBlock.cw,
          topBlock.ch,
          margin,
          y,
          contentW,
          topMaxH
        )
        y += topH + 5

        const chartCanvas = await html2canvas(block.element, {
          scale: 2,
          backgroundColor: '#ffffff',
          logging: false,
        })
        const chartDataUrl = chartCanvas.toDataURL('image/png', 1.0)
        const maxChartH = pageH - y - margin
        pdfAddImageFitWidth(
          pdf,
          chartDataUrl,
          chartCanvas.width,
          chartCanvas.height,
          margin,
          y,
          contentW,
          Math.max(40, maxChartH)
        )
      }

      const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
      pdf.save(`dashboard-report-${stamp}.pdf`)
      setIsExportOpen(false)
    } catch (error) {
      console.error('Export PDF failed:', error)
    } finally {
      setIsExporting(false)
    }
  }

  const getViolationBadgeClass = (type: string) => {
    const t = type.toUpperCase()
    if (t.includes('HELMET') || t.includes('HARDHAT') || t.includes('หมวก'))
      return 'inline-flex rounded-[8px] border border-[#f2b8bd] bg-[#fff5f5] px-2.5 py-1 text-[12px] font-semibold text-[#d70015]'
    if (t.includes('VEST') || t.includes('เสื้อ'))
      return 'inline-flex rounded-[8px] border border-[#f2d5a7] bg-[#fff9ed] px-2.5 py-1 text-[12px] font-semibold text-[#9a5b00]'
    return 'inline-flex rounded-[8px] border border-[#f2d5a7] bg-[#fff9ed] px-2.5 py-1 text-[12px] font-semibold text-[#9a5b00]'
  }

  const customRangeError = activeFilter === 'Custom'
    ? !customStartDate || !customEndDate
      ? 'เลือกวันที่เริ่มต้นและสิ้นสุดเพื่อโหลดกราฟ'
      : customStartDate > customEndDate
        ? 'วันที่เริ่มต้นต้องไม่อยู่หลังวันที่สิ้นสุด'
        : (new Date(`${customEndDate}T12:00:00`).getTime() - new Date(`${customStartDate}T12:00:00`).getTime()) / 86_400_000 >= 30
          ? 'เลือกช่วงเวลาได้สูงสุด 30 วัน'
          : null
    : null

  if (loading) {
    return (
      <Layout>
        <div
          className="flex min-h-[60vh] items-center justify-center px-6"
          role="status"
          aria-live="polite"
        >
          <div className="text-center">
            <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-[3px] border-[#d2d2d7] border-t-[#0066cc]" />
            <p className="m-0 text-[17px] leading-[1.47] text-[#6e6e73]">Loading dashboard…</p>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-8 lg:gap-12">
        <header className="page-heading max-w-[760px]">
          <h1>ภาพรวมความปลอดภัย</h1>
          <p>ติดตามสถานะกล้อง การตรวจจับ และแนวโน้มการปฏิบัติตาม PPE จากที่เดียว</p>
        </header>

        <section className="overflow-hidden bg-[#272729] text-white" aria-labelledby="safety-hero-title">
          <div className="grid gap-10 px-6 py-12 sm:px-10 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.65fr)] lg:items-end lg:px-14 lg:py-16">
            <div>
              <div className="mb-5 flex items-center gap-2 text-[12px] font-semibold tracking-[0.08em] text-white/70 uppercase">
                <span className="h-2 w-2 rounded-full bg-[#30d158]" aria-hidden="true" />
                Live safety operations
              </div>
              <h2
                id="safety-hero-title"
                className="m-0 max-w-[780px] text-[clamp(34px,5vw,60px)] font-semibold leading-[1.02] tracking-[-0.035em]"
              >
                เห็นความเสี่ยง ก่อนกลายเป็นอุบัติเหตุ
              </h2>
              <p className="mt-5 max-w-[700px] text-[17px] font-normal leading-[1.47] tracking-[-0.01em] text-white/70">
                ศูนย์ควบคุม PPE แบบเรียลไทม์ด้วย Hybrid YOLOv8m + YOLO11n
                สำหรับตรวจหมวกนิรภัยและเสื้อสะท้อนแสงจากกล้องหน้างาน
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <button type="button" className="btn-apple-primary min-h-11 px-5 text-[15px]" onClick={() => navigate('/camera')}>
                  <Camera size={17} aria-hidden="true" /> เปิดกล้องตรวจจับ
                </button>
                <button
                  type="button"
                  className="btn-apple-secondary min-h-11 !border-[#2997ff] !bg-transparent px-5 text-[15px] !text-[#2997ff]"
                  onClick={() => navigate('/detection')}
                >
                  <Activity size={17} aria-hidden="true" /> ทดสอบภาพหรือวิดีโอ
                </button>
              </div>
            </div>
            <div className="rounded-[18px] border border-white/15 bg-[#272729] p-6 sm:p-8">
              <span className="text-[12px] font-semibold tracking-[0.08em] text-white/60 uppercase">Compliance rate</span>
              <strong className="mt-3 block text-[clamp(42px,6vw,68px)] font-semibold leading-none tracking-[-0.045em]">
                {stats?.compliance_rate ?? 0}%
              </strong>
              <div className="my-6 h-px bg-white/15" />
              <div className="flex items-center gap-2 text-[15px] leading-[1.47] text-white/70">
                <Camera size={16} aria-hidden="true" />
                <span>{activeCameras} กล้องออนไลน์ · อัปเดตแบบเรียลไทม์</span>
              </div>
            </div>
          </div>
        </section>

        {loadError && (
          <div className="surface-card flex flex-col gap-4 border-[#f2b8bd] bg-[#fff7f7] p-5 sm:flex-row sm:items-center sm:justify-between" role="alert">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 shrink-0 text-[#d70015]" size={20} aria-hidden="true" />
              <div>
                <p className="m-0 text-[17px] font-semibold tracking-[-0.01em] text-[#1d1d1f]">โหลดข้อมูลบางส่วนไม่สำเร็จ</p>
                <p className="mt-1 text-[15px] leading-[1.47] text-[#6e6e73]">ตรวจสอบการเชื่อมต่อกับ backend แล้วลองใหม่อีกครั้ง</p>
              </div>
            </div>
            <button
              type="button"
              className="btn-apple-secondary shrink-0"
              onClick={() => {
                setLoading(true)
                void loadData()
              }}
            >
              ลองอีกครั้ง
            </button>
          </div>
        )}

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Key safety metrics">
          {/* Total Detections */}
          <article className="surface-card flex min-h-[156px] flex-col justify-between p-6">
            <div className="flex items-start justify-between">
              <p className="m-0 text-[15px] font-normal text-[#6e6e73]">Total detections</p>
              <Activity size={20} className="text-[#86868b]" strokeWidth={1.75} aria-hidden="true" />
            </div>
            <div className="mt-5">
              <p className="m-0 text-[38px] font-semibold leading-none tracking-[-0.035em] text-[#1d1d1f]">
                {(stats?.total_detections ?? 0).toLocaleString()}
              </p>
              {renderTrend(cardChange.detections, 'neutral')}
            </div>
          </article>

          {/* Total Violations */}
          <article className="surface-card flex min-h-[156px] flex-col justify-between p-6">
            <div className="flex items-start justify-between">
              <p className="m-0 text-[15px] font-normal text-[#6e6e73]">Total violations</p>
              <AlertTriangle size={20} className="text-[#d70015]" strokeWidth={1.75} aria-hidden="true" />
            </div>
            <div className="mt-5">
              <p className="m-0 text-[38px] font-semibold leading-none tracking-[-0.035em] text-[#1d1d1f]">
                {(stats?.total_violations ?? 0).toLocaleString()}
              </p>
              {renderTrend(cardChange.violations, 'down')}
            </div>
          </article>

          {/* Compliance Rate */}
          <article className="surface-card flex min-h-[156px] flex-col justify-between p-6">
            <div className="flex items-start justify-between">
              <p className="m-0 text-[15px] font-normal text-[#6e6e73]">Compliance rate</p>
              <CheckCircle size={20} className="text-[#248a3d]" strokeWidth={1.75} aria-hidden="true" />
            </div>
            <div className="mt-5">
              <p className="m-0 text-[38px] font-semibold leading-none tracking-[-0.035em] text-[#1d1d1f]">
                {stats ? stats.compliance_rate : 0}%
              </p>
              {renderTrend(cardChange.compliance, 'up')}
            </div>
          </article>

          {/* Active Cameras */}
          <article className="surface-card flex min-h-[156px] flex-col justify-between p-6">
            <div className="flex items-start justify-between">
              <p className="m-0 text-[15px] font-normal text-[#6e6e73]">Active cameras</p>
              <Camera size={20} className="text-[#86868b]" strokeWidth={1.75} aria-hidden="true" />
            </div>
            <div className="mt-5 flex flex-col gap-2">
              <p className="m-0 text-[38px] font-semibold leading-none tracking-[-0.035em] text-[#1d1d1f]">{activeCameras}</p>
              <p className="m-0 flex items-center gap-2 text-[13px] font-normal text-[#6e6e73]">
                <span className={`h-2 w-2 rounded-full ${activeCameras > 0 ? 'bg-[#248a3d]' : 'bg-[#86868b]'}`} aria-hidden="true" />
                {activeCameras > 0 ? 'Online now' : 'No camera online'}
              </p>
            </div>
          </article>
        </section>

        <section className="surface-card flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between" aria-label="Dashboard date controls">
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="flex max-w-full items-center gap-1 overflow-x-auto rounded-full bg-[#f5f5f7] p-1" aria-label="Date range">
              {['Today', '7 days', '30 days', 'Custom'].map((f) => (
                <button
                  type="button"
                  key={f}
                  onClick={() => setActiveFilter(f)}
                  aria-pressed={activeFilter === f}
                  className={
                    activeFilter === f
                      ? 'min-h-11 shrink-0 cursor-pointer rounded-full border-0 bg-[#0066cc] px-5 text-[14px] font-semibold text-white transition active:scale-95'
                      : 'min-h-11 shrink-0 cursor-pointer rounded-full border-0 bg-transparent px-5 text-[14px] font-semibold text-[#0066cc] transition active:scale-95'
                  }
                >
                  {f}
                </button>
              ))}
            </div>
            {activeFilter === 'Custom' && (
              <div className="flex flex-col gap-2 min-[480px]:flex-row min-[480px]:items-center">
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  max={customEndDate || undefined}
                  aria-label="Start date"
                  aria-invalid={Boolean(customRangeError)}
                  className="min-h-11 rounded-full border border-black/10 bg-white px-4 text-[14px] font-normal text-[#1d1d1f] outline-none transition focus:border-[#0066cc] focus:ring-2 focus:ring-[#0066cc]/20"
                />
                <span className="hidden text-[14px] text-[var(--muted)] min-[480px]:inline" aria-hidden="true">to</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  min={customStartDate || undefined}
                  max={customStartDate
                    ? (() => {
                      const maxDate = new Date(`${customStartDate}T12:00:00`)
                      maxDate.setDate(maxDate.getDate() + 29)
                      return [maxDate.getFullYear(), String(maxDate.getMonth() + 1).padStart(2, '0'), String(maxDate.getDate()).padStart(2, '0')].join('-')
                    })()
                    : undefined}
                  aria-label="End date"
                  aria-invalid={Boolean(customRangeError)}
                  className="min-h-11 rounded-full border border-black/10 bg-white px-4 text-[14px] font-normal text-[#1d1d1f] outline-none transition focus:border-[#0066cc] focus:ring-2 focus:ring-[#0066cc]/20"
                />
              </div>
            )}
            {customRangeError && (
              <p className="text-[13px] leading-5 text-[#b4232f]" role="status">{customRangeError}</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => setIsExportOpen(true)}
            disabled={analyticsLoading || Boolean(customRangeError)}
            className="btn-apple-primary w-full shrink-0 px-5 sm:w-auto"
          >
            <Download size={17} strokeWidth={2} aria-hidden="true" />
            Export PDF
          </button>
        </section>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-2" aria-label="Safety analytics">

          {/* Daily Compliance */}
          <article ref={complianceChartRef} className="surface-card p-6 sm:p-7">
            <h2 className="m-0 text-[21px] font-semibold tracking-[-0.02em] text-[#1d1d1f]">Daily compliance</h2>
            <p className="mt-1 text-[15px] leading-[1.47] text-[#6e6e73]">Real-time safety adherence across all sectors</p>
            {analyticsLoading ? (
              <div className="flex h-[248px] items-center justify-center gap-3 text-[14px] text-[var(--muted)]" role="status">
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#d2d2d7] border-t-[#0066cc]" aria-hidden="true" />
                Loading analytics…
              </div>
            ) : dailyData.length === 0 ? (
              <div className="flex h-[248px] flex-col items-center justify-center px-4 text-center" role="status">
                <Activity size={32} className="mb-3 text-[#b7b7bb]" strokeWidth={1.5} aria-hidden="true" />
                <p className="m-0 text-[15px] font-semibold text-[#1d1d1f]">No compliance data yet</p>
                <p className="mt-1 text-[13px] leading-[1.47] text-[var(--muted)]">Data will appear after detections are processed.</p>
              </div>
            ) : (
              <div className="mt-6 h-[248px]" aria-label="Compliance line chart">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dailyData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e7" vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: '#6e6e73', fontSize: 12 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fill: '#6e6e73', fontSize: 12 }} tickLine={false} axisLine={false} domain={[0, 100]} />
                    <Tooltip contentStyle={chartTooltipStyle.contentStyle} labelStyle={chartTooltipStyle.labelStyle} />
                    <Line type="monotone" dataKey="compliance" stroke="#0066cc" strokeWidth={2.5} dot={{ fill: '#0066cc', r: 4, strokeWidth: 2, stroke: '#fff' }} name="Compliance %" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </article>

          {/* Weekly Violations */}
          <article ref={violationChartRef} className="surface-card p-6 sm:p-7">
            <h2 className="m-0 text-[21px] font-semibold tracking-[-0.02em] text-[#1d1d1f]">Violation trend</h2>
            <p className="mt-1 text-[15px] leading-[1.47] text-[#6e6e73]">Historical violation counts for the selected period</p>
            {analyticsLoading ? (
              <div className="flex h-[248px] items-center justify-center gap-3 text-[14px] text-[var(--muted)]" role="status">
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#d2d2d7] border-t-[#0066cc]" aria-hidden="true" />
                Loading analytics…
              </div>
            ) : weeklyData.length === 0 ? (
              <div className="flex h-[248px] flex-col items-center justify-center px-4 text-center" role="status">
                <ShieldAlert size={32} className="mb-3 text-[#b7b7bb]" strokeWidth={1.5} aria-hidden="true" />
                <p className="m-0 text-[15px] font-semibold text-[#1d1d1f]">No violation data yet</p>
                <p className="mt-1 text-[13px] leading-[1.47] text-[var(--muted)]">Choose another date range or wait for new activity.</p>
              </div>
            ) : (
              <div className="mt-6 h-[248px]" aria-label="Violation line chart">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={weeklyData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e7" vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: '#6e6e73', fontSize: 12 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fill: '#6e6e73', fontSize: 12 }} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={chartTooltipStyle.contentStyle} labelStyle={chartTooltipStyle.labelStyle} />
                    <Line type="monotone" dataKey="value" stroke="#d70015" strokeWidth={2.5} dot={{ fill: '#d70015', r: 4, strokeWidth: 2, stroke: '#fff' }} name="Violations" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </article>
        </section>

        <section className="surface-card overflow-hidden" aria-labelledby="recent-violations-title">
          <div className="flex flex-col gap-3 border-b border-black/8 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <ShieldAlert size={20} className="text-[#d70015]" strokeWidth={1.75} aria-hidden="true" />
                <h2 id="recent-violations-title" className="m-0 text-[21px] font-semibold tracking-[-0.02em] text-[#1d1d1f]">
                  Recent violations
                </h2>
              </div>
              <p className="mt-1 text-[15px] leading-[1.47] text-[#6e6e73]">Latest events that require review</p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/reports')}
              className="min-h-11 self-start rounded-full border border-[#0066cc] bg-transparent px-5 text-[14px] font-semibold text-[#0066cc] transition active:scale-95 sm:self-auto"
            >
              View all logs
            </button>
          </div>

          {violations.length === 0 ? (
            <div className="px-6 py-16 text-center" role="status">
              <Clock size={40} className="mx-auto mb-4 text-[#b7b7bb]" strokeWidth={1.5} aria-hidden="true" />
              <p className="m-0 text-[17px] font-semibold tracking-[-0.01em] text-[#1d1d1f]">No violations recorded</p>
              <p className="mt-1 text-[15px] leading-[1.47] text-[#6e6e73]">Violations will appear here when detected.</p>
            </div>
          ) : (
            <div className="max-h-[480px] overflow-auto">
              <table className="relative w-full min-w-[780px] border-collapse">
                <thead className="sticky top-0 z-10">
                  <tr>
                    <th className="m-0 bg-[#f5f5f7] px-6 py-3 text-left text-[12px] font-semibold text-[#6e6e73]">Thumbnail</th>
                    <th className="m-0 bg-[#f5f5f7] px-6 py-3 text-left text-[12px] font-semibold text-[#6e6e73]">Date &amp; time</th>
                    <th className="m-0 bg-[#f5f5f7] px-6 py-3 text-left text-[12px] font-semibold text-[#6e6e73]">Reference</th>
                    <th className="m-0 bg-[#f5f5f7] px-6 py-3 text-left text-[12px] font-semibold text-[#6e6e73]">Violation type</th>
                    <th className="m-0 bg-[#f5f5f7] px-6 py-3 text-left text-[12px] font-semibold text-[#6e6e73]">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {violations.map((row) => (
                    <tr key={row.id} className="transition-colors hover:bg-[#fafafc]">
                      <td className="border-b border-black/8 px-6 py-4 text-[15px] text-[#424245]">
                        <div className="h-14 w-14 overflow-hidden rounded-[8px] border border-black/8 bg-[#f5f5f7]">
                          <ProtectedDetectionImage
                            detectionId={row.detectionId}
                            alt={row.refId}
                            className="h-full w-full object-cover"
                          />
                        </div>
                      </td>
                      <td className="border-b border-black/8 px-6 py-4 text-[15px] text-[#424245]">
                        <div className="font-semibold text-[#1d1d1f]">{new Date(row.createdAt).toLocaleDateString()}</div>
                        <div className="mt-0.5 text-[13px] text-[var(--muted)]">{new Date(row.createdAt).toLocaleTimeString()}</div>
                      </td>
                      <td className="border-b border-black/8 px-6 py-4 text-[15px] text-[#424245]">{row.refId}</td>
                      <td className="border-b border-black/8 px-6 py-4 text-[15px] text-[#424245]">
                        <div className="flex flex-wrap gap-2">
                          {row.violationTypes.map((type, idx) => (
                            <span key={idx} className={getViolationBadgeClass(type)}>
                              {type.toUpperCase().includes('HELMET') ? 'MISSING HELMET' :
                               type.toUpperCase().includes('VEST') ? 'MISSING VEST' :
                               type.toUpperCase()}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="border-b border-black/8 px-6 py-4 text-[15px] text-[#424245]">
                        <button
                          type="button"
                          onClick={() => setSelectedViolation(row)}
                          className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border border-[#0066cc] bg-transparent text-[#0066cc] transition active:scale-95"
                          aria-label={`View details for ${row.refId}`}
                        >
                          <Eye size={17} aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

      </div>
      {isExportOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 cursor-default border-0 bg-black/40 backdrop-blur-sm"
            onClick={closeExportDialog}
            disabled={isExporting}
            aria-label="Close export dialog"
          />
          <div
            ref={exportDialogRef}
            tabIndex={-1}
            className="relative w-full max-w-[440px] overflow-hidden rounded-[18px] border border-black/8 bg-white"
            role="dialog"
            aria-modal="true"
            aria-labelledby="export-dialog-title"
          >
            <div className="flex items-center justify-between border-b border-black/8 px-6 py-5">
              <div>
                <h2 id="export-dialog-title" className="m-0 text-[21px] font-semibold tracking-[-0.02em] text-[#1d1d1f]">Export PDF</h2>
                <p className="mt-1 text-[14px] text-[#6e6e73]">Choose the charts to include.</p>
              </div>
              <button
                type="button"
                onClick={closeExportDialog}
                disabled={isExporting}
                className="btn-apple-secondary h-11 w-11 !p-0"
                aria-label="Close export dialog"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            <div className="flex flex-col gap-3 px-6 py-6">
              <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-[11px] border border-black/8 px-4 text-[16px] text-[#1d1d1f]">
                <input
                  type="checkbox"
                  checked={exportTarget.compliance}
                onChange={(e) => setExportTarget((prev) => ({ ...prev, compliance: e.target.checked }))}
                disabled={isExporting}
                  className="h-5 w-5 accent-[#0066cc]"
                />
                Compliance chart
              </label>
              <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-[11px] border border-black/8 px-4 text-[16px] text-[#1d1d1f]">
                <input
                  type="checkbox"
                  checked={exportTarget.violation}
                  onChange={(e) => setExportTarget((prev) => ({ ...prev, violation: e.target.checked }))}
                  disabled={isExporting}
                  className="h-5 w-5 accent-[#0066cc]"
                />
                Violation chart
              </label>
            </div>
            <div className="flex justify-end gap-3 border-t border-black/8 bg-[#f5f5f7] px-6 py-5">
              <button
                type="button"
                onClick={closeExportDialog}
                disabled={isExporting}
                className="btn-apple-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExportPdf}
                disabled={(!exportTarget.compliance && !exportTarget.violation) || isExporting}
                className="btn-apple-primary"
              >
                {isExporting ? 'Exporting...' : 'Export'}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedViolation && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 cursor-default border-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setSelectedViolation(null)}
            aria-label="Close violation details"
          />
          <div
            ref={violationDialogRef}
            tabIndex={-1}
            className="relative flex max-h-[95vh] w-full max-w-[900px] flex-col overflow-hidden rounded-[18px] border border-black/8 bg-white"
            role="dialog"
            aria-modal="true"
            aria-labelledby="violation-dialog-title"
          >
            <div className="flex items-center justify-between border-b border-black/8 px-5 py-5 sm:px-8">
              <div className="flex items-center gap-2">
                <ShieldAlert size={20} className="text-[#d70015]" aria-hidden="true" />
                <h2 id="violation-dialog-title" className="m-0 text-[21px] font-semibold leading-none tracking-[-0.02em] text-[#1d1d1f]">Violation details</h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedViolation(null)}
                className="btn-apple-secondary h-11 w-11 !p-0"
                aria-label="Close violation details"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            <div className="overflow-y-auto bg-[#f5f5f7] px-4 py-6 sm:px-8 sm:py-8">
              {isLoadingDetails ? (
                <div className="py-12 text-center text-[15px] text-[#6e6e73]" role="status">Loading details…</div>
              ) : (
                <div className="flex justify-center">
                  <div className="w-full max-w-[740px] space-y-5">
                    {detailsError && (
                      <div className="rounded-[11px] border border-[#f2b8bd] bg-[#fff5f5] px-4 py-3 text-[14px] leading-[1.47] text-[#d70015]" role="alert">
                        โหลดรายละเอียดเพิ่มเติมไม่สำเร็จ ข้อมูลเหตุการณ์พื้นฐานยังแสดงด้านล่าง
                      </div>
                    )}

                    <div className="surface-card overflow-hidden">
                      <ProtectedDetectionImage
                        detectionId={selectedViolation.detectionId}
                        alt={selectedViolation.refId}
                        className="h-[260px] w-full bg-[#fafafc] object-contain sm:h-[400px]"
                      />
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="surface-card p-5">
                        <p className="m-0 mb-2 text-[12px] font-semibold tracking-[0.08em] text-[var(--muted)] uppercase">Date &amp; time</p>
                        <p className="m-0 text-[20px] font-semibold leading-tight tracking-[-0.02em] text-[#1d1d1f]">
                          {new Date(selectedViolation.createdAt).toLocaleString('th-TH')}
                        </p>
                      </div>
                      <div className="surface-card p-5">
                        <p className="m-0 mb-2 text-[12px] font-semibold tracking-[0.08em] text-[var(--muted)] uppercase">Reference ID</p>
                        <p className="m-0 text-[24px] font-semibold leading-tight tracking-[-0.025em] text-[#1d1d1f]">{selectedViolation.refId}</p>
                      </div>
                    </div>

                    <div className="surface-card p-5">
                      <p className="m-0 mb-3 text-[12px] font-semibold tracking-[0.08em] text-[var(--muted)] uppercase">Violation type</p>
                      <div className="flex flex-wrap gap-2">
                        {selectedViolation.violationTypes.map((type, idx) => (
                          <span key={idx} className={getViolationBadgeClass(type)}>
                            {type.toUpperCase().includes('HELMET') ? 'MISSING HELMET' :
                             type.toUpperCase().includes('VEST') ? 'MISSING VEST' :
                             type.toUpperCase()}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="surface-card p-5">
                      <p className="m-0 mb-3 text-[12px] font-semibold tracking-[0.08em] text-[var(--muted)] uppercase">Message</p>
                      <div className="rounded-[11px] border border-black/8 bg-[#f5f5f7] px-5 py-4 text-[15px] leading-[1.47] text-[#424245]">
                        {(() => {
                          const types =
                            (fullDetectionDetails?.violations?.length
                              ? fullDetectionDetails.violations
                              : selectedViolation.violationTypes) ?? []
                          if (types.length > 0) {
                            return `ตรวจพบ: ${types.join(' และ ')}`
                          }
                          return (
                            fullDetectionDetails?.summary?.message ||
                            selectedViolation.message ||
                            '—'
                          )
                        })()}
                      </div>
                    </div>

                    {fullDetectionDetails?.persons && (
                      <div className="surface-card p-5">
                        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <p className="m-0 text-[12px] font-semibold tracking-[0.08em] text-[var(--muted)] uppercase">Detailed breakdown</p>
                          <span className="self-start rounded-[8px] bg-[#f5f5f7] px-3 py-1.5 text-[12px] font-semibold text-[#1d1d1f]">
                            Total Persons Detected: {fullDetectionDetails.person_count}
                          </span>
                        </div>
                        {fullDetectionDetails.persons.filter((p) => !p.is_compliant).map((person) => (
                          <div key={person.id} className="mb-3 rounded-[11px] border border-[#f2b8bd] bg-[#fff5f5] px-4 py-3">
                            <p className="m-0 mb-1 text-[14px] font-semibold text-[#d70015]">Person {person.id} (Violation)</p>
                            <div className="flex flex-wrap gap-2">
                              {person.not_wearing?.map((item, idx) => (
                                <span key={idx} className="text-[13px] text-[#d70015]">× Missing {item}</span>
                              ))}
                            </div>
                          </div>
                        ))}
                        <p className="m-0 text-[14px] text-[#6e6e73]">
                          + {fullDetectionDetails.persons.filter((p) => p.is_compliant).length} person(s) fully compliant
                        </p>
                      </div>
                    )}

                    <div className="flex justify-end pt-2">
                      <button
                        type="button"
                        onClick={() => setSelectedViolation(null)}
                        className="btn-apple-primary px-6"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
