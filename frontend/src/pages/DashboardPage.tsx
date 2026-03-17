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
  Download,
  SlidersHorizontal,
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

const s = {
  page: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '24px',
  },
  grid4: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '20px',
  },
  grid2: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '20px',
  },
  card: {
    backgroundColor: '#ffffff',
    border: '1px solid #e5eaf0',
    borderRadius: '16px',
    padding: '20px 24px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: '10px',
  },
  cardLabel: {
    fontSize: '13px',
    color: '#64748b',
    fontWeight: 500,
    margin: 0,
  },
  cardValue: {
    fontSize: '30px',
    fontWeight: 700,
    color: '#0f172a',
    margin: 0,
  },
  cardSubUp: {
    fontSize: '12px',
    color: '#22c55e',
    fontWeight: 500,
    marginTop: '6px',
  },
  cardSubDown: {
    fontSize: '12px',
    color: '#ef4444',
    fontWeight: 500,
    marginTop: '6px',
  },
  cardSubNeutral: {
    fontSize: '12px',
    color: '#94a3b8',
    fontWeight: 500,
    marginTop: '6px',
  },
  filterBar: {
    backgroundColor: '#ffffff',
    border: '1px solid #e5eaf0',
    borderRadius: '16px',
    padding: '14px 20px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap' as const,
    gap: '12px',
  },
  filterGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    backgroundColor: '#f1f5f9',
    padding: '4px',
    borderRadius: '10px',
  },
  filterBtnActive: {
    padding: '6px 16px',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: 600,
    background: '#ffffff',
    color: '#0f172a',
    border: 'none',
    cursor: 'pointer',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  },
  filterBtn: {
    padding: '6px 16px',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: 500,
    background: 'transparent',
    color: '#64748b',
    border: 'none',
    cursor: 'pointer',
  },
  btnPrimary: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 16px',
    backgroundColor: '#2563eb',
    color: '#ffffff',
    border: 'none',
    borderRadius: '10px',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    boxShadow: '0 1px 3px rgba(37,99,235,0.3)',
  },
  btnSecondary: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 16px',
    backgroundColor: '#f1f5f9',
    color: '#475569',
    border: 'none',
    borderRadius: '10px',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  chartCard: {
    backgroundColor: '#ffffff',
    border: '1px solid #e5eaf0',
    borderRadius: '16px',
    padding: '24px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
  },
  chartTitle: {
    fontSize: '15px',
    fontWeight: 600,
    color: '#0f172a',
    margin: 0,
  },
  chartSubtitle: {
    fontSize: '12px',
    color: '#94a3b8',
    marginTop: '4px',
    marginBottom: '20px',
  },
  tableCard: {
    backgroundColor: '#ffffff',
    border: '1px solid #e5eaf0',
    borderRadius: '16px',
    overflow: 'hidden',
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
  },
  tableHeader: {
    padding: '16px 24px',
    borderBottom: '1px solid #f1f5f9',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tableTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '15px',
    fontWeight: 600,
    color: '#0f172a',
  },
  viewAll: {
    fontSize: '13px',
    color: '#2563eb',
    fontWeight: 500,
    background: 'none',
    border: 'none',
    cursor: 'pointer',
  },
  th: {
    textAlign: 'left' as const,
    padding: '10px 20px',
    fontSize: '11px',
    fontWeight: 600,
    color: '#94a3b8',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    backgroundColor: '#f8fafc',
  },
  td: {
    padding: '14px 20px',
    fontSize: '13px',
    color: '#334155',
    borderBottom: '1px solid #f1f5f9',
  },
  badgeRed: {
    display: 'inline-flex',
    padding: '3px 10px',
    borderRadius: '6px',
    fontSize: '11px',
    fontWeight: 700,
    backgroundColor: '#fee2e2',
    color: '#dc2626',
    border: '1px solid #fecaca',
  },
  badgeOrange: {
    display: 'inline-flex',
    padding: '3px 10px',
    borderRadius: '6px',
    fontSize: '11px',
    fontWeight: 700,
    backgroundColor: '#ffedd5',
    color: '#ea580c',
    border: '1px solid #fed7aa',
  },
  badgeAmber: {
    display: 'inline-flex',
    padding: '3px 10px',
    borderRadius: '6px',
    fontSize: '11px',
    fontWeight: 700,
    backgroundColor: '#fef3c7',
    color: '#d97706',
    border: '1px solid #fde68a',
  },
  emptyState: {
    padding: '60px 24px',
    textAlign: 'center' as const,
  },
  thumbnail: {
    width: '36px',
    height: '36px',
    borderRadius: '8px',
    backgroundColor: '#f1f5f9',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
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

  const [dailyData, setDailyData] = useState<ChartDataPoint[]>([])
  const [weeklyData, setWeeklyData] = useState<ChartDataPoint[]>([])

  useEffect(() => {
    const load = async () => {
      try {
        const analytics = await detectionService.getAnalytics(7)
        if (analytics?.daily?.length) {
          setDailyData(analytics.daily.map((d) => ({ name: d.day || d.date?.slice(5) || '', value: d.violations ?? 0, compliance: d.compliance ?? 0 })))
          setWeeklyData(analytics.daily.map((d) => ({ name: d.day || d.date?.slice(5) || '', value: d.violations ?? 0 })))
        } else {
          const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
          setDailyData(days.map((d) => ({ name: d, value: 0, compliance: 0 })))
          setWeeklyData(days.map((d) => ({ name: d, value: 0 })))
        }
      } catch {
        const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
        setDailyData(days.map((d) => ({ name: d, value: 0, compliance: 0 })))
        setWeeklyData(days.map((d) => ({ name: d, value: 0 })))
      }
    }
    load()
  }, [])

  const getViolationBadge = (type: string) => {
    const t = type.toUpperCase()
    if (t.includes('HELMET') || t.includes('HARDHAT') || t.includes('หมวก')) return s.badgeRed
    if (t.includes('VEST') || t.includes('เสื้อ')) return s.badgeOrange
    return s.badgeAmber
  }

  if (loading) {
    return (
      <Layout>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 'calc(100vh - 100px)' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: '36px', height: '36px', border: '4px solid #e2e8f0', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
            <p style={{ color: '#64748b', fontSize: '14px' }}>Loading dashboard...</p>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div style={s.page}>

        {/* Stat Cards */}
        <div style={s.grid4}>
          <div style={s.card}>
            <div style={s.cardHeader}>
              <p style={s.cardLabel}>Total Detections</p>
              <Activity size={18} color="#cbd5e1" />
            </div>
            <p style={s.cardValue}>{stats?.total_detections?.toLocaleString() ?? 0}</p>
            <p style={s.cardSubUp}>↑ +12.5%</p>
          </div>

          <div style={s.card}>
            <div style={s.cardHeader}>
              <p style={s.cardLabel}>Total Violations</p>
              <AlertTriangle size={18} color="#cbd5e1" />
            </div>
            <p style={s.cardValue}>{stats?.total_violations?.toLocaleString() ?? 0}</p>
            <p style={s.cardSubDown}>↓ -5.2%</p>
          </div>

          <div style={s.card}>
            <div style={s.cardHeader}>
              <p style={s.cardLabel}>Compliance Rate (%)</p>
              <CheckCircle size={18} color="#cbd5e1" />
            </div>
            <p style={s.cardValue}>{stats?.compliance_rate ?? 0}%</p>
            <p style={s.cardSubUp}>↑ +0.8%</p>
          </div>

          <div style={s.card}>
            <div style={s.cardHeader}>
              <p style={s.cardLabel}>Active Cameras</p>
              <Camera size={18} color="#cbd5e1" />
            </div>
            <p style={s.cardValue}>4</p>
            <p style={s.cardSubNeutral}>Stable</p>
          </div>
        </div>

        {/* Filter Bar */}
        <div style={s.filterBar}>
          <div style={s.filterGroup}>
            {['Today', '7 days', '30 days', 'Custom'].map((f) => (
              <button key={f} style={activeFilter === f ? s.filterBtnActive : s.filterBtn} onClick={() => setActiveFilter(f)}>
                {f}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button style={s.btnPrimary}>
              <Download size={14} />
              Export PDF
            </button>
            <button style={s.btnSecondary}>
              <SlidersHorizontal size={14} />
              Filters
            </button>
          </div>
        </div>

        {/* Charts */}
        <div style={s.grid2}>
          <div style={s.chartCard}>
            <p style={s.chartTitle}>Daily Compliance</p>
            <p style={s.chartSubtitle}>Real-time safety adherence across all sectors</p>
            <div style={{ height: '260px' }}>
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

          <div style={s.chartCard}>
            <p style={s.chartTitle}>Weekly Violations</p>
            <p style={s.chartSubtitle}>Historical trends by day of the week</p>
            <div style={{ height: '260px' }}>
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
        <div style={s.tableCard}>
          <div style={s.tableHeader}>
            <div style={s.tableTitle}>
              <ShieldAlert size={18} color="#94a3b8" />
              Recent Violations
            </div>
            <button style={s.viewAll}>View all logs →</button>
          </div>

          {violations.length === 0 ? (
            <div style={s.emptyState}>
              <Clock size={48} color="#e2e8f0" style={{ margin: '0 auto 12px' }} />
              <p style={{ fontSize: '14px', color: '#64748b', fontWeight: 500 }}>No violations recorded</p>
              <p style={{ fontSize: '13px', color: '#94a3b8', marginTop: '4px' }}>Violations will appear here when detected</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={s.th}>Thumbnail</th>
                    <th style={s.th}>Date &amp; Time</th>
                    <th style={s.th}>Camera ID</th>
                    <th style={s.th}>Violation Type</th>
                    <th style={s.th}>Confidence</th>
                    <th style={s.th}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {violations.map((row) => (
                    <tr key={row.id} style={{ transition: 'background 0.15s' }}>
                      <td style={s.td}>
                        <div style={s.thumbnail}>
                          <Camera size={16} color="#94a3b8" />
                        </div>
                      </td>
                      <td style={s.td}>
                        <div style={{ fontWeight: 500, color: '#1e293b' }}>{row.dateTime.split(',')[0]}</div>
                        <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>{row.dateTime.split(',')[1]}</div>
                      </td>
                      <td style={s.td}>{row.cameraId}</td>
                      <td style={s.td}>
                        <span style={getViolationBadge(row.violationType)}>
                          {row.violationType.toUpperCase().includes('HELMET') ? 'MISSING HELMET' :
                           row.violationType.toUpperCase().includes('VEST') ? 'MISSING VEST' :
                           row.violationType.toUpperCase()}
                        </span>
                      </td>
                      <td style={s.td}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: '60px', height: '6px', backgroundColor: '#dbeafe', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ width: row.confidence, height: '100%', backgroundColor: '#2563eb', borderRadius: '3px' }} />
                          </div>
                          <span style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>{row.confidence}</span>
                        </div>
                      </td>
                      <td style={s.td}>
                        <button style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', borderRadius: '6px' }}>
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
