import { useEffect, useRef, useState } from 'react'
import { Layout } from '../components/layout/Layout'
import { detectionService } from '../services/detection'
import { alertsService } from '../services/alerts'
import { zonesService } from '../services/zones'
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
  SlidersHorizontal,
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
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
    fontSize: '12px',
  },
  labelStyle: { color: '#475569' },
}

export function DashboardPage() {
  const [stats, setStats] = useState<DetectionStats | null>(null)
  const [violations, setViolations] = useState<ViolationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [activeZones, setActiveZones] = useState(0)
  const [activeFilter, setActiveFilter] = useState<string>('Today')
  const [customStartDate, setCustomStartDate] = useState<string>('')
  const [customEndDate, setCustomEndDate] = useState<string>('')
  const [dailyData, setDailyData] = useState<{ name: string; value: number; compliance?: number }[]>([])
  const [weeklyData, setWeeklyData] = useState<{ name: string; value: number }[]>([])
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
  const complianceChartRef = useRef<HTMLDivElement | null>(null)
  const violationChartRef = useRef<HTMLDivElement | null>(null)
  const navigate = useNavigate()

  useEffect(() => { loadData() }, [])

  useEffect(() => {
    if (selectedViolation) {
      setIsLoadingDetails(true)
      detectionService.getDetection(selectedViolation.detectionId)
        .then(data => setFullDetectionDetails(data))
        .catch(err => console.error('Failed to load detection details:', err))
        .finally(() => setIsLoadingDetails(false))
    } else {
      setFullDetectionDetails(null)
    }
  }, [selectedViolation])

  const loadData = async () => {
    try {
      const [statsData, alertsData, zonesData] = await Promise.all([
        detectionService.getStats(),
        alertsService.list(1, 20).catch(() => ({ items: [] as Alert[], total: 0, page: 1, per_page: 20 })),
        zonesService.list().catch(() => []),
      ])
      setStats(statsData)
      setActiveZones((zonesData || []).filter((z) => z.is_active).length)

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
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const loadAnalytics = async () => {
      try {
        let days: number | undefined = undefined
        let start: string | undefined = undefined
        let end: string | undefined = undefined

        if (activeFilter === 'Today') days = 1
        else if (activeFilter === '7 days') days = 7
        else if (activeFilter === '30 days') days = 30
        else if (activeFilter === 'Custom') {
          if (!customStartDate || !customEndDate) return
          start = customStartDate
          end = customEndDate
        }

        const analytics = await detectionService.getAnalytics(days, start, end)

        if (activeFilter === 'Today' || (activeFilter === 'Custom' && start === end)) {
          if (analytics?.hourly?.length) {
            const mapped = analytics.hourly.map((d: { hour: string; violations?: number; compliance?: number }) => ({
              name: d.hour,
              value: d.violations ?? 0,
              compliance: d.compliance ?? 0,
            }))
            setDailyData(mapped)
            setWeeklyData(mapped)
          }
        } else {
          if (analytics?.daily?.length) {
            const mapped = analytics.daily.map((d: { day?: string; date: string; violations?: number; compliance?: number }) => ({
              name: d.day || d.date?.slice(5) || '',
              value: d.violations ?? 0,
              compliance: d.compliance ?? 0,
            }))
            setDailyData(mapped)
            setWeeklyData(mapped)
          } else {
            setDailyData([])
            setWeeklyData([])
          }
        }
      } catch (e) {
        console.error('Error loading analytics:', e)
        setDailyData([])
        setWeeklyData([])
      }
    }
    loadAnalytics()
  }, [activeFilter, customStartDate, customEndDate])

  useEffect(() => {
    const loadComparisons = async () => {
      try {
        const today = new Date()
        const yesterday = new Date()
        yesterday.setDate(today.getDate() - 1)
        const toYmd = (d: Date) => d.toISOString().slice(0, 10)

        const [todayAnalytics, yesterdayAnalytics] = await Promise.all([
          detectionService.getAnalytics(1, toYmd(today), toYmd(today)),
          detectionService.getAnalytics(1, toYmd(yesterday), toYmd(yesterday)),
        ])

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
        console.error('Error loading day comparisons:', error)
      }
    }

    loadComparisons()
  }, [])

  const getChange = (current: number, previous: number) => {
    if (!previous && !current) return { value: 0, isUp: false }
    if (previous === 0) return { value: 100, isUp: true }
    const diff = ((current - previous) / previous) * 100
    return { value: Math.abs(diff), isUp: diff >= 0 }
  }

  const cardChange = {
    detections: getChange(todaySummary.detections, yesterdaySummary.detections),
    violations: getChange(todaySummary.violations, yesterdaySummary.violations),
    compliance: getChange(todaySummary.compliance, yesterdaySummary.compliance),
  }



  const renderTrend = (change: { value: number; isUp: boolean }) => {
    const color = change.isUp ? 'text-[#10b981]' : 'text-[#ef4444]'
    return (
      <div className={`flex items-center gap-[3px] text-[12px] font-semibold ${color} mt-1.5`}>
        {change.isUp ? '↑' : '↓'} {change.isUp ? '+' : '-'}{change.value.toFixed(1)}%
      </div>
    )
  }

  const handleExportPdf = async () => {
    const selectedBlocks: Array<{ title: string; element: HTMLDivElement | null }> = []
    if (exportTarget.compliance) selectedBlocks.push({ title: 'Compliance', element: complianceChartRef.current })
    if (exportTarget.violation) selectedBlocks.push({ title: 'Violation', element: violationChartRef.current })
    if (selectedBlocks.length === 0) return

    setIsExporting(true)
    try {
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      let isFirstPage = true

      for (const block of selectedBlocks) {
        if (!block.element) continue
        const canvas = await html2canvas(block.element, { scale: 2, backgroundColor: '#ffffff' })
        const imgData = canvas.toDataURL('image/png')
        const pageWidth = pdf.internal.pageSize.getWidth()
        const pageHeight = pdf.internal.pageSize.getHeight()
        const maxWidth = pageWidth - 20
        const ratio = maxWidth / canvas.width
        const imgWidth = maxWidth
        const imgHeight = canvas.height * ratio
        const y = Math.max(10, (pageHeight - imgHeight) / 2)

        if (!isFirstPage) {
          pdf.addPage()
        }
        pdf.setFontSize(14)
        pdf.text(`${block.title} Chart`, 10, 10)
        pdf.addImage(imgData, 'PNG', 10, y, imgWidth, Math.min(imgHeight, pageHeight - 20))
        isFirstPage = false
      }

      pdf.save(`dashboard-report-${new Date().toISOString().slice(0, 10)}.pdf`)
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
      return 'inline-flex px-[10px] py-[3px] rounded-[6px] text-[11px] font-bold bg-[#fee2e2] text-[#dc2626] border border-[#fecaca]'
    if (t.includes('VEST') || t.includes('เสื้อ'))
      return 'inline-flex px-[10px] py-[3px] rounded-[6px] text-[11px] font-bold bg-[#ffedd5] text-[#ea580c] border border-[#fed7aa]'
    return 'inline-flex px-[10px] py-[3px] rounded-[6px] text-[11px] font-bold bg-[#fef3c7] text-[#d97706] border border-[#fde68a]'
  }

  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center items-center" style={{ height: 'calc(100vh - 100px)' }}>
          <div className="text-center">
            <div className="w-9 h-9 border-4 border-[#e2e8f0] border-t-[#2563eb] rounded-full animate-spin mx-auto mb-3" />
            <p className="text-[#64748b] text-sm">Loading dashboard...</p>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="flex flex-col" style={{ gap: '32px' }}>

        {/* Stat Cards */}
        <div className="grid grid-cols-4" style={{ gap: '24px' }}>
          {/* Total Detections */}
          <div className="bg-white border border-[#e2e8f0] rounded-[16px] shadow-sm min-h-[110px] flex flex-col justify-between" style={{ padding: '24px', boxSizing: 'border-box' }}>
            <div className="flex items-start justify-between">
              <p className="text-[13px] text-[#64748b] font-medium m-0">Total Detections</p>
              <Activity size={18} className="text-[#94a3b8]" strokeWidth={2} />
            </div>
            <div className="mt-2">
              <p className="text-[34px] font-extrabold text-[#0f172a] m-0 leading-[1] tracking-tight">
                {(stats?.total_detections ?? 0).toLocaleString()}
              </p>
              {renderTrend(cardChange.detections)}
            </div>
          </div>

          {/* Total Violations */}
          <div className="bg-white border border-[#e2e8f0] rounded-[16px] shadow-sm min-h-[110px] flex flex-col justify-between" style={{ padding: '24px', boxSizing: 'border-box' }}>
            <div className="flex items-start justify-between">
              <p className="text-[13px] text-[#64748b] font-medium m-0">Total Violations</p>
              <AlertTriangle size={18} className="text-[#94a3b8]" strokeWidth={2} />
            </div>
            <div className="mt-2">
              <p className="text-[34px] font-extrabold text-[#0f172a] m-0 leading-[1] tracking-tight">
                {(stats?.total_violations ?? 0).toLocaleString()}
              </p>
              {renderTrend(cardChange.violations)}
            </div>
          </div>

          {/* Compliance Rate */}
          <div className="bg-white border border-[#e2e8f0] rounded-[16px] shadow-sm min-h-[110px] flex flex-col justify-between" style={{ padding: '24px', boxSizing: 'border-box' }}>
            <div className="flex items-start justify-between">
              <p className="text-[13px] text-[#64748b] font-medium m-0">Compliance Rate (%)</p>
              <CheckCircle size={18} className="text-[#94a3b8]" strokeWidth={2} />
            </div>
            <div className="mt-2">
              <p className="text-[34px] font-extrabold text-[#0f172a] m-0 leading-[1] tracking-tight">
                {stats ? stats.compliance_rate : 0}%
              </p>
              {renderTrend(cardChange.compliance)}
            </div>
          </div>

          {/* Active Cameras */}
          <div className="bg-white border border-[#e2e8f0] rounded-[16px] shadow-sm min-h-[110px] flex flex-col justify-between" style={{ padding: '24px', boxSizing: 'border-box' }}>
            <div className="flex items-start justify-between">
              <p className="text-[13px] text-[#64748b] font-medium m-0">Active Cameras</p>
              <Camera size={18} className="text-[#94a3b8]" strokeWidth={2} />
            </div>
            <div className="mt-2 flex flex-col gap-[2px]">
              <p className="text-[34px] font-extrabold text-[#0f172a] m-0 leading-[1] tracking-tight">{activeZones}</p>
              <p className="text-[12px] text-[#94a3b8] font-medium m-0 mt-[2px]">Stable</p>
            </div>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="bg-white border border-[#e2e8f0] rounded-[16px] shadow-sm flex items-center justify-between flex-wrap" style={{ padding: '16px 24px', gap: '8px', boxSizing: 'border-box' }}>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 bg-[#f1f5f9] p-1 rounded-full border border-[#f1f5f9]">
              {['Today', '7 days', '30 days', 'Custom'].map((f) => (
                <button
                  key={f}
                  onClick={() => setActiveFilter(f)}
                  className={
                    activeFilter === f
                      ? 'px-4 py-1.5 rounded-full text-[13px] font-semibold bg-white text-[#0f172a] shadow-sm cursor-pointer transition-all'
                      : 'px-4 py-1.5 rounded-full text-[13px] font-medium bg-transparent text-[#64748b] cursor-pointer hover:text-[#0f172a]'
                  }
                >
                  {f}
                </button>
              ))}
            </div>
            {activeFilter === 'Custom' && (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="px-3 py-1.5 rounded-lg border border-[#e2e8f0] text-[13px] text-[#475569] outline-none"
                />
                <span className="text-[#94a3b8] text-[13px]">-</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="px-3 py-1.5 rounded-lg border border-[#e2e8f0] text-[13px] text-[#475569] outline-none"
                />
              </div>
            )}
          </div>
          <div className="flex gap-3 pr-1">
            <button
              onClick={() => setIsExportOpen(true)}
              className="flex items-center justify-center gap-2 bg-[#2563eb] text-white border-none rounded-full cursor-pointer hover:bg-[#1d4ed8]"
              style={{ padding: '10px 24px', fontSize: '14px', fontWeight: 700, letterSpacing: '-0.2px' }}
            >
              <Download size={18} strokeWidth={2.5} />
              Export PDF
            </button>
            <button
              onClick={() => navigate('/reports')}
              className="flex items-center justify-center gap-2 bg-[#f8fafc] text-[#475569] border-none rounded-full cursor-pointer hover:bg-[#f1f5f9]"
              style={{ padding: '10px 24px', fontSize: '14px', fontWeight: 700, letterSpacing: '-0.2px' }}
            >
              <SlidersHorizontal size={18} strokeWidth={2.5} className="text-[#64748b]" />
              Filters
            </button>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-2" style={{ gap: '24px' }}>

          {/* Daily Compliance */}
          <div ref={complianceChartRef} className="bg-white border border-[#e2e8f0] rounded-[16px] shadow-sm" style={{ padding: '24px', boxSizing: 'border-box' }}>
            <p className="text-[15px] font-bold text-[#0f172a] m-0 tracking-tight">Daily Compliance</p>
            <p className="text-[13px] text-[#64748b] mt-1 mb-6 m-0">Real-time safety adherence across all sectors</p>
            <div className="h-[232px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={false} domain={[0, 100]} />
                  <Tooltip contentStyle={chartTooltipStyle.contentStyle} labelStyle={chartTooltipStyle.labelStyle} />
                  <Line type="monotone" dataKey="compliance" stroke="#3b82f6" strokeWidth={2.5} dot={{ fill: '#3b82f6', r: 4, strokeWidth: 2, stroke: '#fff' }} name="Compliance %" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Weekly Violations */}
          <div ref={violationChartRef} className="bg-white border border-[#e2e8f0] rounded-[16px] shadow-sm" style={{ padding: '24px', boxSizing: 'border-box' }}>
            <p className="text-[15px] font-bold text-[#0f172a] m-0 tracking-tight">Weekly Violations</p>
            <p className="text-[13px] text-[#64748b] mt-1 mb-6 m-0">Historical trends by day of the week</p>
            <div className="h-[232px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={weeklyData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={chartTooltipStyle.contentStyle} labelStyle={chartTooltipStyle.labelStyle} />
                  <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2.5} dot={{ fill: '#3b82f6', r: 4, strokeWidth: 2, stroke: '#fff' }} name="Violations" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Recent Violations Table */}
        <div className="bg-white border border-[#e2e8f0] rounded-[16px] overflow-hidden shadow-sm">
          <div className="border-b border-[#f1f5f9] flex items-center justify-between" style={{ padding: '20px 24px' }}>
            <div className="flex items-center gap-2 text-[15px] font-bold text-[#0f172a] tracking-tight">
              <ShieldAlert size={18} className="text-[#64748b]" strokeWidth={2} />
              Recent Violations
            </div>
            <button
              onClick={() => navigate('/reports')}
              className="text-[13px] text-[#2563eb] font-semibold bg-transparent border-none cursor-pointer hover:underline"
            >
              View all logs →
            </button>
          </div>

          {violations.length === 0 ? (
            <div className="py-[70px] px-6 text-center">
              <Clock size={44} className="text-[#cbd5e1] mx-auto mb-4" strokeWidth={1.5} />
              <p className="text-[15px] font-bold text-[#0f172a] m-0 tracking-tight">No violations recorded</p>
              <p className="text-[13px] text-[#64748b] mt-1 m-0">Violations will appear here when detected</p>
            </div>
          ) : (
            <div className="overflow-x-auto" style={{ maxHeight: '480px', overflowY: 'auto' }}>
              <table className="w-full border-collapse relative">
                <thead className="sticky top-0 z-10 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
                  <tr>
                    <th className="text-left text-[11px] font-semibold text-[#94a3b8] uppercase tracking-[0.05em] bg-[#f8fafc] m-0" style={{ padding: '12px 24px' }}>Thumbnail</th>
                    <th className="text-left text-[11px] font-semibold text-[#94a3b8] uppercase tracking-[0.05em] bg-[#f8fafc] m-0" style={{ padding: '12px 24px' }}>Date &amp; Time</th>
                    <th className="text-left text-[11px] font-semibold text-[#94a3b8] uppercase tracking-[0.05em] bg-[#f8fafc] m-0" style={{ padding: '12px 24px' }}>Reference</th>
                    <th className="text-left text-[11px] font-semibold text-[#94a3b8] uppercase tracking-[0.05em] bg-[#f8fafc] m-0" style={{ padding: '12px 24px' }}>Violation Type</th>
                    <th className="text-left text-[11px] font-semibold text-[#94a3b8] uppercase tracking-[0.05em] bg-[#f8fafc] m-0" style={{ padding: '12px 24px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {violations.map((row) => (
                    <tr key={row.id} className="transition-colors duration-150">
                      <td className="text-[13px] text-[#334155] border-b border-[#f1f5f9]" style={{ padding: '16px 24px' }}>
                        <div className="w-14 h-14 rounded-lg bg-[#f1f5f9] overflow-hidden border border-[#e5eaf0]">
                          <img
                            src={detectionService.getResultImageUrl(row.detectionId)}
                            alt={row.refId}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      </td>
                      <td className="text-[13px] text-[#334155] border-b border-[#f1f5f9]" style={{ padding: '16px 24px' }}>
                        <div className="font-medium text-[#1e293b]">{new Date(row.createdAt).toLocaleDateString()}</div>
                        <div className="text-[11px] text-[#94a3b8] mt-[2px]">{new Date(row.createdAt).toLocaleTimeString()}</div>
                      </td>
                      <td className="text-[13px] text-[#334155] border-b border-[#f1f5f9]" style={{ padding: '16px 24px' }}>{row.refId}</td>
                      <td className="text-[13px] text-[#334155] border-b border-[#f1f5f9]" style={{ padding: '16px 24px' }}>
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
                      <td className="text-[13px] text-[#334155] border-b border-[#f1f5f9]" style={{ padding: '16px 24px' }}>
                        <button
                          onClick={() => setSelectedViolation(row)}
                          className="flex items-center justify-center w-8 h-8 rounded-lg border border-[#e5eaf0] bg-[#f8fafc] text-[#64748b] cursor-pointer hover:bg-[#eff6ff] hover:text-[#2563eb] transition-colors"
                          title="View Details"
                        >
                          <Eye size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
      {isExportOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[rgba(15,23,42,0.45)]" onClick={() => setIsExportOpen(false)} />
          <div className="relative w-full max-w-[420px] rounded-2xl bg-white border border-[#e5eaf0] shadow-[0_20px_60px_rgba(0,0,0,0.18)]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#f1f5f9]">
              <h3 className="text-[16px] font-semibold text-[#0f172a] m-0">Export PDF</h3>
              <button
                onClick={() => setIsExportOpen(false)}
                className="w-8 h-8 rounded-lg bg-[#f1f5f9] border-none text-[#64748b] cursor-pointer flex items-center justify-center"
              >
                <X size={16} />
              </button>
            </div>
            <div className="px-5 py-4 flex flex-col gap-3">
              <label className="flex items-center gap-2 text-[14px] text-[#334155]">
                <input
                  type="checkbox"
                  checked={exportTarget.compliance}
                  onChange={(e) => setExportTarget((prev) => ({ ...prev, compliance: e.target.checked }))}
                />
                Compliance chart
              </label>
              <label className="flex items-center gap-2 text-[14px] text-[#334155]">
                <input
                  type="checkbox"
                  checked={exportTarget.violation}
                  onChange={(e) => setExportTarget((prev) => ({ ...prev, violation: e.target.checked }))}
                />
                Violation chart
              </label>
            </div>
            <div className="px-5 py-4 border-t border-[#f1f5f9] flex justify-end gap-2">
              <button
                onClick={() => setIsExportOpen(false)}
                className="px-4 py-2 text-[13px] font-semibold rounded-lg border border-[#e2e8f0] bg-white text-[#475569] cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleExportPdf}
                disabled={(!exportTarget.compliance && !exportTarget.violation) || isExporting}
                className="px-4 py-2 text-[13px] font-semibold rounded-lg border-none bg-[#2563eb] text-white cursor-pointer disabled:opacity-50"
              >
                {isExporting ? 'Exporting...' : 'Export'}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedViolation && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[rgba(15,23,42,0.45)]" onClick={() => setSelectedViolation(null)} />
          <div className="relative w-full max-w-[960px] max-h-[90vh] bg-white rounded-2xl border border-[#e2e8f0] shadow-[0_20px_60px_rgba(0,0,0,0.18)] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-7 py-5 border-b border-[#eef2f7]">
              <div className="flex items-center gap-2">
                <ShieldAlert size={16} className="text-[#6366f1]" />
                <p className="text-[18px] font-bold text-[#1e293b] m-0 leading-none">Violation Details</p>
              </div>
              <button
                onClick={() => setSelectedViolation(null)}
                className="w-9 h-9 rounded-xl bg-[#f1f5f9] border-none text-[#64748b] cursor-pointer flex items-center justify-center"
              >
                <X size={17} />
              </button>
            </div>

            <div className="px-7 py-6 bg-[#fbfcfe] overflow-y-auto">
              {isLoadingDetails ? (
                <div className="py-12 text-center text-[#64748b] text-[14px]">Loading details...</div>
              ) : (
                <div className="flex justify-center">
                  <div className="w-full max-w-[760px] space-y-6">
                    <div className="rounded-2xl overflow-hidden border border-[#dbe3ee] bg-white">
                      <img
                        src={detectionService.getResultImageUrl(selectedViolation.detectionId)}
                        alt={selectedViolation.refId}
                        className="w-full h-[360px] object-contain"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-5">
                      <div className="bg-white border border-[#e2e8f0] rounded-xl p-4">
                        <p className="text-[14px] text-[#94a3b8] font-bold tracking-[0.06em] uppercase m-0 mb-1">Date & Time</p>
                        <p className="text-[20px] font-semibold text-[#0f172a] m-0 leading-tight">
                          {new Date(selectedViolation.createdAt).toLocaleString('th-TH')}
                        </p>
                      </div>
                      <div className="bg-white border border-[#e2e8f0] rounded-xl p-4">
                        <p className="text-[14px] text-[#94a3b8] font-bold tracking-[0.06em] uppercase m-0 mb-1">Reference ID</p>
                        <p className="text-[24px] font-semibold text-[#0f172a] m-0 leading-tight">{selectedViolation.refId}</p>
                      </div>
                    </div>

                    <div className="px-1">
                      <p className="text-[14px] text-[#94a3b8] font-bold tracking-[0.06em] uppercase m-0 mb-2">Violation Type</p>
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

                    <div className="px-1">
                      <p className="text-[14px] text-[#94a3b8] font-bold tracking-[0.06em] uppercase m-0 mb-2">Message</p>
                      <div className="rounded-xl border border-[#e2e8f0] bg-[#f3f6fb] px-5 py-4 text-[15px] text-[#334155] leading-relaxed">
                        {selectedViolation.message || fullDetectionDetails?.summary?.message || selectedViolation.violationTypes.join(', ')}
                      </div>
                    </div>

                    {fullDetectionDetails?.persons && (
                      <div className="px-1">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-[14px] text-[#94a3b8] font-bold tracking-[0.06em] uppercase m-0">Detailed Breakdown</p>
                          <span className="text-[12px] px-3 py-1 rounded-md bg-[#e2e8f0] text-[#0f172a] font-semibold">
                            Total Persons Detected: {fullDetectionDetails.person_count}
                          </span>
                        </div>
                        {fullDetectionDetails.persons.filter((p) => !p.is_compliant).map((person) => (
                          <div key={person.id} className="rounded-xl border border-[#fecaca] bg-[#fff1f2] px-4 py-3 mb-3">
                            <p className="text-[14px] font-semibold text-[#dc2626] m-0 mb-1">Person {person.id} (Violation)</p>
                            <div className="flex flex-wrap gap-2">
                              {person.not_wearing?.map((item, idx) => (
                                <span key={idx} className="text-[13px] text-[#dc2626]">x Missing {item}</span>
                              ))}
                            </div>
                          </div>
                        ))}
                        <p className="text-[14px] text-[#64748b] m-0">
                          + {fullDetectionDetails.persons.filter((p) => p.is_compliant).length} person(s) fully compliant
                        </p>
                      </div>
                    )}

                    <div className="flex justify-end pt-1">
                      <button
                        onClick={() => setSelectedViolation(null)}
                        className="px-6 py-3 rounded-xl border-none bg-[#e2e8f0] text-[#334155] text-[14px] font-semibold cursor-pointer hover:bg-[#cbd5e1]"
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
