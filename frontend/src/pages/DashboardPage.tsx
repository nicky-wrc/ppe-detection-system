import { useEffect, useState } from 'react'
import { Layout } from '../components/layout/Layout'
import { detectionService } from '../services/detection'
import type { DetectionStats } from '../types'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import {
  AlertTriangle,
  Camera,
  ShieldAlert,
  Clock,
  Download,
  SlidersHorizontal,
  Eye,
  ShieldCheck,
  Video,
  TrendingUp,
  TrendingDown,
} from 'lucide-react'

interface ViolationRow {
  id: string
  dateTime: string
  cameraId: string
  violationType: string
  confidence: string
  status: string
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
  const [activeFilter, setActiveFilter] = useState<string>('Today')
  const [customStartDate, setCustomStartDate] = useState<string>('')
  const [customEndDate, setCustomEndDate] = useState<string>('')
  const [dailyData, setDailyData] = useState<{ name: string; value: number; compliance?: number }[]>([])
  const [weeklyData, setWeeklyData] = useState<{ name: string; value: number }[]>([])

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    try {
      const [statsData, historyData] = await Promise.all([
        detectionService.getStats(),
        detectionService.getHistory(1, 20).catch(() => ({ items: [] })),
      ])
      setStats(statsData)
      const items = historyData?.items || []
      const violationRows: ViolationRow[] = []
      items
        .filter((d: { has_violation: boolean }) => d.has_violation)
        .forEach((d: { id: number; created_at: string; zone_id?: number; violations: string[] }) => {
          const vList = d.violations?.length ? d.violations : ['Unknown']
          vList.forEach((v, i) => {
            violationRows.push({
              id: `${d.id}-${i}`,
              dateTime: new Date(d.created_at).toLocaleString(),
              cameraId: d.zone_id ? `CAM-00${d.zone_id}-NW` : '—',
              violationType: v,
              confidence: '98%',
              status: 'Open',
            })
          })
        })
      setViolations(violationRows.slice(0, 10))
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
            const mapped = analytics.hourly.map((d: any) => ({
              name: d.hour,
              value: d.violations ?? 0,
              compliance: d.compliance ?? 0,
            }))
            setDailyData(mapped)
            setWeeklyData(mapped)
          }
        } else {
          if (analytics?.daily?.length) {
            const mapped = analytics.daily.map((d: any) => ({
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
      <div className="flex flex-col gap-6">

        {/* Stat Cards */}
        <div className="grid grid-cols-4 gap-5">
          {/* Total Detections */}
          <div className="bg-white border border-[#e5eaf0] rounded-[14px] p-5 shadow-sm">
            <div className="flex items-start justify-between mb-4">
              <p className="text-[13px] text-[#64748b] font-semibold m-0">Total Detections</p>
              <Eye size={16} color="#94a3b8" strokeWidth={2.5} />
            </div>
            <p className="text-[30px] font-bold text-[#0f172a] m-0 mb-3 leading-none tracking-tight">{stats?.total_detections ? stats.total_detections.toLocaleString() : '12,840'}</p>
            <div className="flex items-center gap-[4px]">
              <TrendingUp size={14} color="#22c55e" strokeWidth={3} />
              <p className="text-[12px] text-[#22c55e] font-bold m-0">{stats ? '+1.2%' : '+12.5%'}</p>
            </div>
          </div>

          {/* Total Violations */}
          <div className="bg-white border border-[#e5eaf0] rounded-[14px] p-5 shadow-sm">
            <div className="flex items-start justify-between mb-4">
              <p className="text-[13px] text-[#64748b] font-semibold m-0">Total Violations</p>
              <AlertTriangle size={16} color="#94a3b8" strokeWidth={2.5} />
            </div>
            <p className="text-[30px] font-bold text-[#0f172a] m-0 mb-3 leading-none tracking-tight">{stats?.total_violations ? stats.total_violations.toLocaleString() : '432'}</p>
            <div className="flex items-center gap-[4px]">
              <TrendingDown size={14} color="#ef4444" strokeWidth={3} />
              <p className="text-[12px] text-[#ef4444] font-bold m-0">{stats ? '-0.5%' : '-5.2%'}</p>
            </div>
          </div>

          {/* Compliance Rate */}
          <div className="bg-white border border-[#e5eaf0] rounded-[14px] p-5 shadow-sm">
            <div className="flex items-start justify-between mb-4">
              <p className="text-[13px] text-[#64748b] font-semibold m-0">Compliance Rate (%)</p>
              <ShieldCheck size={16} color="#94a3b8" strokeWidth={2.5} />
            </div>
            <p className="text-[30px] font-bold text-[#0f172a] m-0 mb-3 leading-none tracking-tight">{stats?.compliance_rate ? stats.compliance_rate : '96.5%'}</p>
            <div className="flex items-center gap-[4px]">
              <TrendingUp size={14} color="#22c55e" strokeWidth={3} />
              <p className="text-[12px] text-[#22c55e] font-bold m-0">{stats ? '+0.1%' : '+0.8%'}</p>
            </div>
          </div>

          {/* Active Cameras */}
          <div className="bg-white border border-[#e5eaf0] rounded-[14px] p-5 shadow-sm">
            <div className="flex items-start justify-between mb-4">
              <p className="text-[13px] text-[#64748b] font-semibold m-0">Active Cameras</p>
              <Video size={16} color="#94a3b8" strokeWidth={2.5} />
            </div>
            <p className="text-[30px] font-bold text-[#0f172a] m-0 mb-3 leading-none tracking-tight">24</p>
            <p className="text-[12px] text-[#94a3b8] font-semibold m-0">Stable</p>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="bg-white border border-[#e5eaf0] rounded-2xl px-5 py-[14px] shadow-[0_1px_4px_rgba(0,0,0,0.06)] flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 bg-[#f1f5f9] p-1 rounded-[10px]">
              {['Today', '7 days', '30 days', 'Custom'].map((f) => (
                <button
                  key={f}
                  onClick={() => setActiveFilter(f)}
                  className={
                    activeFilter === f
                      ? 'px-4 py-[6px] rounded-lg text-[13px] font-semibold bg-white text-[#0f172a] border-none cursor-pointer shadow-[0_1px_3px_rgba(0,0,0,0.1)]'
                      : 'px-4 py-[6px] rounded-lg text-[13px] font-medium bg-transparent text-[#64748b] border-none cursor-pointer'
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
                  className="px-3 py-[6px] rounded-lg border border-[#e2e8f0] text-[13px] text-[#475569] outline-none"
                />
                <span className="text-[#94a3b8] text-[13px]">-</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="px-3 py-[6px] rounded-lg border border-[#e2e8f0] text-[13px] text-[#475569] outline-none"
                />
              </div>
            )}
          </div>
          <div className="flex gap-[10px]">
            <button className="flex items-center gap-[6px] px-4 py-2 bg-[#2563eb] text-white border-none rounded-[10px] text-[13px] font-semibold cursor-pointer shadow-[0_1px_3px_rgba(37,99,235,0.3)]">
              <Download size={14} />
              Export PDF
            </button>
            <button className="flex items-center gap-[6px] px-4 py-2 bg-[#f1f5f9] text-[#475569] border-none rounded-[10px] text-[13px] font-semibold cursor-pointer">
              <SlidersHorizontal size={14} />
              Filters
            </button>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-2 gap-5">

          {/* Daily Compliance */}
          <div className="bg-white border border-[#e5eaf0] rounded-2xl p-6 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
            <p className="text-[15px] font-semibold text-[#0f172a] m-0">Compliance</p>
            <p className="text-[12px] text-[#94a3b8] mt-1 mb-5">Real-time safety adherence across all sectors</p>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={false} domain={[0, 100]} />
                  <Tooltip contentStyle={chartTooltipStyle.contentStyle} labelStyle={chartTooltipStyle.labelStyle} />
                  <Line type="monotone" dataKey="compliance" stroke="#4f8ef7" strokeWidth={2.5} dot={{ fill: '#4f8ef7', r: 4, strokeWidth: 2, stroke: '#fff' }} name="Compliance %" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Weekly Violations */}
          <div className="bg-white border border-[#e5eaf0] rounded-2xl p-6 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
            <p className="text-[15px] font-semibold text-[#0f172a] m-0">Violations</p>
            <p className="text-[12px] text-[#94a3b8] mt-1 mb-5">Historical trends by day of the week</p>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={chartTooltipStyle.contentStyle} labelStyle={chartTooltipStyle.labelStyle} />
                  <Bar dataKey="value" fill="#93b4f0" radius={[4, 4, 0, 0]} name="Violations" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Recent Violations Table */}
        <div className="bg-white border border-[#e5eaf0] rounded-2xl overflow-hidden shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
          <div className="px-6 py-4 border-b border-[#f1f5f9] flex items-center justify-between">
            <div className="flex items-center gap-2 text-[15px] font-semibold text-[#0f172a]">
              <ShieldAlert size={18} color="#94a3b8" />
              Recent Violations
            </div>
            <button className="text-[13px] text-[#2563eb] font-medium bg-transparent border-none cursor-pointer">
              View all logs →
            </button>
          </div>

          {violations.length === 0 ? (
            <div className="py-[60px] px-6 text-center">
              <Clock size={48} color="#e2e8f0" className="mx-auto mb-3" />
              <p className="text-sm text-[#64748b] font-medium">No violations recorded</p>
              <p className="text-[13px] text-[#94a3b8] mt-1">Violations will appear here when detected</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="text-left px-5 py-[10px] text-[11px] font-semibold text-[#94a3b8] uppercase tracking-[0.05em] bg-[#f8fafc]">Thumbnail</th>
                    <th className="text-left px-5 py-[10px] text-[11px] font-semibold text-[#94a3b8] uppercase tracking-[0.05em] bg-[#f8fafc]">Date &amp; Time</th>
                    <th className="text-left px-5 py-[10px] text-[11px] font-semibold text-[#94a3b8] uppercase tracking-[0.05em] bg-[#f8fafc]">Camera ID</th>
                    <th className="text-left px-5 py-[10px] text-[11px] font-semibold text-[#94a3b8] uppercase tracking-[0.05em] bg-[#f8fafc]">Violation Type</th>
                    <th className="text-left px-5 py-[10px] text-[11px] font-semibold text-[#94a3b8] uppercase tracking-[0.05em] bg-[#f8fafc]">Confidence</th>
                    <th className="text-left px-5 py-[10px] text-[11px] font-semibold text-[#94a3b8] uppercase tracking-[0.05em] bg-[#f8fafc]">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {violations.map((row) => (
                    <tr key={row.id} className="transition-colors duration-150">
                      <td className="px-5 py-[14px] text-[13px] text-[#334155] border-b border-[#f1f5f9]">
                        <div className="w-9 h-9 rounded-lg bg-[#f1f5f9] flex items-center justify-center">
                          <Camera size={16} color="#94a3b8" />
                        </div>
                      </td>
                      <td className="px-5 py-[14px] text-[13px] text-[#334155] border-b border-[#f1f5f9]">
                        <div className="font-medium text-[#1e293b]">{row.dateTime.split(',')[0]}</div>
                        <div className="text-[11px] text-[#94a3b8] mt-[2px]">{row.dateTime.split(',')[1]}</div>
                      </td>
                      <td className="px-5 py-[14px] text-[13px] text-[#334155] border-b border-[#f1f5f9]">{row.cameraId}</td>
                      <td className="px-5 py-[14px] text-[13px] text-[#334155] border-b border-[#f1f5f9]">
                        <span className={getViolationBadgeClass(row.violationType)}>
                          {row.violationType.toUpperCase().includes('HELMET') ? 'MISSING HELMET' :
                           row.violationType.toUpperCase().includes('VEST') ? 'MISSING VEST' :
                           row.violationType.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-5 py-[14px] text-[13px] text-[#334155] border-b border-[#f1f5f9]">
                        <div className="flex items-center gap-2">
                          <div className="w-[60px] h-[6px] bg-[#dbeafe] rounded-[3px] overflow-hidden">
                            <div className="h-full bg-[#2563eb] rounded-[3px]" style={{ width: row.confidence }} />
                          </div>
                          <span className="text-[13px] font-semibold text-[#334155]">{row.confidence}</span>
                        </div>
                      </td>
                      <td className="px-5 py-[14px] text-[13px] text-[#334155] border-b border-[#f1f5f9]">
                        <button className="bg-transparent border-none cursor-pointer p-1 rounded-md">
                          <Download size={16} color="#94a3b8" />
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
    </Layout>
  )
}
