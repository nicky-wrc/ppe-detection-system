import { useEffect, useState } from 'react'
import { Layout } from '../components/layout/Layout'
import { detectionService } from '../services/detection'
import type { DetectionStats } from '../types'
import { Users, AlertTriangle, CheckCircle, Camera, Activity, TrendingDown } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts'

export function DashboardPage() {
  const [stats, setStats] = useState<DetectionStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const statsData = await detectionService.getStats()
      setStats(statsData)
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center items-center h-[calc(100vh-100px)]">
          <div className="flex flex-col items-center gap-4">
            <div className="spinner w-10 h-10 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin"></div>
            <div className="text-slate-500 font-medium animate-pulse">กำลังโหลดข้อมูล...</div>
          </div>
        </div>
      </Layout>
    )
  }

  // Prepare data for recharts
  const violationData = stats?.violation_by_type
    ? Object.entries(stats.violation_by_type)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
    : []

  const COLORS = ['#ef4444', '#f97316', '#eab308', '#3b82f6', '#8b5cf6']

  return (
    <Layout>
      <div className="space-y-6 sm:space-y-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">ภาพรวมระบบ</h1>
          <p className="text-slate-500 mt-1">สถิติและข้อมูลการตรวจจับอุปกรณ์ PPE แบบเรียลไทม์</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 hover:shadow-md transition-shadow relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform duration-500">
              <Camera className="w-24 h-24 text-blue-600" />
            </div>
            <div className="relative z-10 flex flex-col gap-4">
              <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                <Camera className="w-6 h-6" />
              </div>
              <div>
                <p className="text-3xl font-bold text-slate-900">{stats?.total_detections.toLocaleString() || 0}</p>
                <p className="text-sm font-medium text-slate-500 mt-1">จำนวนการตรวจจับทั้งหมด</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 hover:shadow-md transition-shadow relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform duration-500">
              <Users className="w-24 h-24 text-indigo-600" />
            </div>
            <div className="relative z-10 flex flex-col gap-4">
              <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <p className="text-3xl font-bold text-slate-900">{stats?.total_persons.toLocaleString() || 0}</p>
                <p className="text-sm font-medium text-slate-500 mt-1">จำนวนคนที่ตรวจพบ</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 hover:shadow-md transition-shadow relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform duration-500">
              <AlertTriangle className="w-24 h-24 text-rose-600" />
            </div>
            <div className="relative z-10 flex flex-col gap-4">
              <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <p className="text-3xl font-bold text-rose-600">{stats?.total_violations.toLocaleString() || 0}</p>
                <p className="text-sm font-medium text-slate-500 mt-1">การฝ่าฝืนที่พบ</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 hover:shadow-md transition-shadow relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform duration-500">
              <CheckCircle className="w-24 h-24 text-emerald-600" />
            </div>
            <div className="relative z-10 flex flex-col gap-4">
              <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
                <CheckCircle className="w-6 h-6" />
              </div>
              <div className="flex items-baseline gap-2">
                <p className="text-3xl font-bold text-emerald-600">{stats?.compliance_rate || 0}%</p>
                {stats && stats.compliance_rate < 100 && (
                  <span className="flex items-center text-xs font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full">
                    <TrendingDown className="w-3 h-3 mr-1" />
                    ต้องปรับปรุง
                  </span>
                )}
              </div>
              <p className="text-sm font-medium text-slate-500">อัตราความปลอดภัย</p>
            </div>
          </div>
        </div>

        {/* Charts Section */}
        {violationData.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">สถิติการฝ่าฝืนแยกตามประเภท</h2>
                  <p className="text-sm text-slate-500">แสดงจำนวนครั้งที่พบการฝ่าฝืนแต่ละประเภท</p>
                </div>
                <div className="p-2 bg-slate-50 rounded-lg text-slate-400">
                  <Activity className="w-5 h-5" />
                </div>
              </div>
              <div className="h-[300px] w-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={violationData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 12 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fill: '#64748b', fontSize: 12 }} tickLine={false} axisLine={false} />
                    <RechartsTooltip 
                      cursor={{ fill: '#f1f5f9' }}
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }}
                    />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={60}>
                      {violationData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-col">
              <h2 className="text-lg font-bold text-slate-900 mb-2">สัดส่วนการฝ่าฝืน</h2>
              <p className="text-sm text-slate-500 mb-6">เทียบเป็นเปอร์เซ็นต์</p>
              
              <div className="flex-1 min-h-[250px] relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={violationData}
                      cx="50%"
                      cy="45%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {violationData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip 
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                {/* Custom Legend */}
                <div className="mt-4 space-y-2">
                  {violationData.map((item, index) => (
                    <div key={item.name} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                        <span className="text-slate-700 font-medium">{item.name}</span>
                      </div>
                      <span className="text-slate-900 font-bold">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}

