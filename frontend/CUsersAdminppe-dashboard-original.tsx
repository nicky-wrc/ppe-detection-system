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
  Activity,
  AlertTriangle,
  CheckCircle,
  Camera,
  ShieldAlert,
  Clock,
} from 'lucide-react'

interface ViolationRow {
  id: string
  dateTime: string
  cameraId: string
  violationType: string
  confidence: string
  status: string
}

interface ChartDataPoint {
  name: string
  value: number
  compliance?: number
}

export function DashboardPage() {
  const [stats, setStats] = useState<DetectionStats | null>(null)
  const [violations, setViolations] = useState<ViolationRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [statsData, historyData] = await Promise.all([
        detectionService.getStats(),
        detectionService.getHistory(1, 20).catch(() => ({ items: [] })),
      ])
      setStats(statsData)

      // Build violations from history (detections with has_violation)
      const items = historyData?.items || []
      const violationRows: ViolationRow[] = []
      items
        .filter((d: { has_violation: boolean }) => d.has_violation)
        .forEach((d: { id: number; created_at: string; zone_id?: number; violations: string[] }) => {
          const violationsList = d.violations?.length ? d.violations : ['Unknown']
          violationsList.forEach((v, i) => {
            violationRows.push({
              id: `${d.id}-${i}`,
              dateTime: new Date(d.created_at).toLocaleString(),
              cameraId: d.zone_id ? `Cam-${d.zone_id}` : '—',
              violationType: v,
              confidence: '—',
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

  // Chart data: use analytics if available, else sample/empty
  const [dailyComplianceData, setDailyComplianceData] = useState<ChartDataPoint[]>([])
  const [weeklyViolationsData, setWeeklyViolationsData] = useState<ChartDataPoint[]>([])

  useEffect(() => {
    const loadAnalytics = async () => {
      try {
        const analytics = await detectionService.getAnalytics(7)
        if (analytics?.daily?.length) {
          setDailyComplianceData(
            analytics.daily.map((d) => ({
              name: d.day || d.date?.slice(5) || '',
              value: d.violations ?? 0,
              compliance: d.compliance ?? 0,
            }))
          )
          setWeeklyViolationsData(
            analytics.daily.map((d) => ({
              name: d.day || d.date?.slice(5) || '',
              value: d.violations ?? 0,
            }))
          )
        } else {
          // Sample/empty data for charts
          const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
          setDailyComplianceData(days.map((d) => ({ name: d, value: 0, compliance: 0 })))
          setWeeklyViolationsData(days.map((d) => ({ name: d, value: 0 })))
        }
      } catch {
        const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
        setDailyComplianceData(days.map((d) => ({ name: d, value: 0, compliance: 0 })))
        setWeeklyViolationsData(days.map((d) => ({ name: d, value: 0 })))
      }
    }
    loadAnalytics()
  }, [])

  const getViolationBadgeClass = (type: string) => {
    const t = type.toUpperCase()
    if (t.includes('HELMET') || t.includes('HARDHAT') || t.includes('หมวก')) return 'bg-red-500/20 text-red-400 border-red-500/40'
    if (t.includes('VEST') || t.includes('เสื้อ')) return 'bg-orange-500/20 text-orange-400 border-orange-500/40'
    return 'bg-amber-500/20 text-amber-400 border-amber-500/40'
  }

  const chartStyle = {
    grid: { stroke: '#334155' },
    text: { fill: '#d1d5db' },
    tooltip: {
      contentStyle: {
        backgroundColor: '#111827',
        border: '1px solid #1e293b',
        borderRadius: '8px',
      },
      labelStyle: { color: '#d1d5db' },
    },
  }

  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center items-center h-[calc(100vh-100px)] bg-[#0a0e17]">
          <div className="flex flex-col items-center gap-4">
            <div className="w-10 h-10 border-4 border-[#1e293b] border-t-cyan-500 rounded-full animate-spin" />
            <div className="text-gray-400 font-medium">Loading dashboard...</div>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="text-gray-300">
        <div className="space-y-8">
          {/* Header */}
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">
              PPE Detection Dashboard
            </h1>
            <p className="text-base text-gray-400 mt-2">
              Industrial safety monitoring and compliance overview
            </p>
          </div>

          {/* 4 Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-[#111827] border border-[#1e293b] rounded-2xl p-7">
              <div className="flex items-center gap-5">
                <div className="w-14 h-14 rounded-xl bg-blue-500/20 flex items-center justify-center">
                  <Activity className="w-7 h-7 text-blue-400" />
                </div>
                <div>
                  <p className="text-4xl font-bold text-white">
                    {stats?.total_detections?.toLocaleString() ?? 0}
                  </p>
                  <p className="text-base text-gray-400 mt-1">Total Detections</p>
                </div>
              </div>
            </div>

            <div className="bg-[#111827] border border-[#1e293b] rounded-2xl p-7">
              <div className="flex items-center gap-5">
                <div className="w-14 h-14 rounded-xl bg-red-500/20 flex items-center justify-center">
                  <AlertTriangle className="w-7 h-7 text-red-400" />
                </div>
                <div>
                  <p className="text-4xl font-bold text-white">
                    {stats?.total_violations?.toLocaleString() ?? 0}
                  </p>
                  <p className="text-base text-gray-400 mt-1">Total Violations</p>
                </div>
              </div>
            </div>

            <div className="bg-[#111827] border border-[#1e293b] rounded-2xl p-7">
              <div className="flex items-center gap-5">
                <div className="w-14 h-14 rounded-xl bg-green-500/20 flex items-center justify-center">
                  <CheckCircle className="w-7 h-7 text-green-400" />
                </div>
                <div>
                  <p className="text-4xl font-bold text-white">
                    {stats?.compliance_rate ?? 0}%
                  </p>
                  <p className="text-base text-gray-400 mt-1">Compliance Rate</p>
                </div>
              </div>
            </div>

            <div className="bg-[#111827] border border-[#1e293b] rounded-2xl p-7">
              <div className="flex items-center gap-5">
                <div className="w-14 h-14 rounded-xl bg-gray-500/20 flex items-center justify-center">
                  <Camera className="w-7 h-7 text-gray-400" />
                </div>
                <div>
                  <p className="text-4xl font-bold text-white">4</p>
                  <p className="text-base text-gray-400 mt-1">Active Cameras</p>
                </div>
              </div>
            </div>
          </div>

          {/* 2 Charts side by side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-[#111827] border border-[#1e293b] rounded-2xl p-8">
              <h2 className="text-xl font-semibold text-white mb-6">Daily Compliance</h2>
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dailyComplianceData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartStyle.grid.stroke} />
                    <XAxis
                      dataKey="name"
                      tick={chartStyle.text}
                      tickLine={false}
                      axisLine={{ stroke: '#334155' }}
                    />
                    <YAxis
                      tick={chartStyle.text}
                      tickLine={false}
                      axisLine={{ stroke: '#334155' }}
                      domain={[0, 100]}
                    />
                    <Tooltip contentStyle={chartStyle.tooltip.contentStyle} />
                    <Line
                      type="monotone"
                      dataKey="compliance"
                      stroke="#22d3ee"
                      strokeWidth={2}
                      dot={{ fill: '#22d3ee' }}
                      name="Compliance %"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-[#111827] border border-[#1e293b] rounded-2xl p-8">
              <h2 className="text-xl font-semibold text-white mb-6">Weekly Violations</h2>
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weeklyViolationsData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartStyle.grid.stroke} vertical={false} />
                    <XAxis
                      dataKey="name"
                      tick={chartStyle.text}
                      tickLine={false}
                      axisLine={{ stroke: '#334155' }}
                    />
                    <YAxis
                      tick={chartStyle.text}
                      tickLine={false}
                      axisLine={{ stroke: '#334155' }}
                    />
                    <Tooltip contentStyle={chartStyle.tooltip.contentStyle} />
                    <Bar dataKey="value" fill="#22d3ee" radius={[4, 4, 0, 0]} name="Violations" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Recent Violations Table */}
          <div className="bg-[#111827] border border-[#1e293b] rounded-2xl overflow-hidden">
            <div className="px-8 py-6 border-b border-[#1e293b]">
              <h2 className="text-xl font-semibold text-white flex items-center gap-3">
                <ShieldAlert className="w-6 h-6 text-red-400" />
                Recent Violations
              </h2>
            </div>

            {violations.length === 0 ? (
              <div className="py-20 text-center">
                <Clock className="w-20 h-20 text-gray-600 mx-auto mb-5" />
                <p className="text-lg text-gray-400 font-medium">No violations recorded</p>
                <p className="text-base text-gray-500 mt-2">Violations will appear here when detected</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#1e293b]">
                      <th className="text-left py-5 px-8 text-sm font-semibold text-gray-400 uppercase">Date & Time</th>
                      <th className="text-left py-5 px-8 text-sm font-semibold text-gray-400 uppercase">Camera ID</th>
                      <th className="text-left py-5 px-8 text-sm font-semibold text-gray-400 uppercase">Violation Type</th>
                      <th className="text-left py-5 px-8 text-sm font-semibold text-gray-400 uppercase">Confidence</th>
                      <th className="text-left py-5 px-8 text-sm font-semibold text-gray-400 uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {violations.map((row) => (
                      <tr
                        key={row.id}
                        className="border-b border-[#1e293b] hover:bg-[#1e293b]/50 transition-colors"
                      >
                        <td className="py-5 px-8 text-base text-gray-300">{row.dateTime}</td>
                        <td className="py-5 px-8 text-base text-gray-300">{row.cameraId}</td>
                        <td className="py-5 px-8">
                          <span
                            className={`inline-flex px-3 py-1.5 rounded-lg text-xs font-semibold border ${getViolationBadgeClass(
                              row.violationType
                            )}`}
                          >
                            {row.violationType}
                          </span>
                        </td>
                        <td className="py-5 px-8 text-base text-gray-300">{row.confidence}</td>
                        <td className="py-5 px-8">
                          <span className="text-amber-400 text-base font-medium">{row.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  )
}
