import { useState } from 'react'
import { Layout } from '../components/layout/Layout'
import { Bell, AlertTriangle, CheckCircle, Clock, ShieldAlert } from 'lucide-react'
import toast from 'react-hot-toast'

interface Alert {
  id: number
  type: string
  message: string
  timestamp: string
  status: 'new' | 'read' | 'resolved'
}

export function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([
    {
      id: 1,
      type: 'no_hardhat',
      message: 'ตรวจพบบุคคลไม่สวมหมวกนิรภัย (พื้นที่ A)',
      timestamp: '2026-01-08T15:30:00',
      status: 'new'
    },
    {
      id: 2,
      type: 'no_safety_vest',
      message: 'ตรวจพบบุคคลไม่สวมเสื้อสะท้อนแสง (พื้นที่ C)',
      timestamp: '2026-01-08T14:45:00',
      status: 'read'
    },
    {
      id: 3,
      type: 'multiple',
      message: 'ตรวจพบการฝ่าฝืนหลายรายการ (โซนประกอบ)',
      timestamp: '2026-01-08T13:20:00',
      status: 'resolved'
    }
  ])

  const handleMarkRead = (id: number) => {
    setAlerts(alerts.map(a => a.id === id ? { ...a, status: 'read' as const } : a))
    toast.success('ทำเครื่องหมายว่าอ่านแล้ว')
  }

  const handleResolve = (id: number) => {
    setAlerts(alerts.map(a => a.id === id ? { ...a, status: 'resolved' as const } : a))
    toast.success('บันทึกการแก้ไขแล้ว', { icon: '✅' })
  }

  const newAlertsCount = alerts.filter(a => a.status === 'new').length
  const readAlertsCount = alerts.filter(a => a.status === 'read').length
  const resolvedAlertsCount = alerts.filter(a => a.status === 'resolved').length

  return (
    <Layout>
      <div className="space-y-6 sm:space-y-8">
        {/* Page Title */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
              <Bell className="w-8 h-8 text-blue-600" />
              ศูนย์การแจ้งเตือน
            </h1>
            <p className="text-slate-500 mt-1">รายการแจ้งเตือนและเหตุการณ์ฝ่าฝืนกฎความปลอดภัย</p>
          </div>
          
          {newAlertsCount > 0 && (
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-rose-50 text-rose-700 rounded-full text-sm font-semibold border border-rose-100 shadow-sm animate-pulse">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
              </span>
              พบ {newAlertsCount} แจ้งเตือนใหม่
            </div>
          )}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col items-center sm:items-start relative overflow-hidden group hover:shadow-md transition-shadow">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform duration-500">
              <ShieldAlert className="w-24 h-24 text-rose-600" />
            </div>
            <div className="w-12 h-12 bg-rose-50 rounded-xl flex items-center justify-center mb-4 relative z-10">
              <Bell className="w-6 h-6 text-rose-600" />
            </div>
            <div className="relative z-10 text-center sm:text-left">
              <p className="text-3xl font-bold text-slate-900">{newAlertsCount}</p>
              <p className="text-sm font-medium text-slate-500 mt-1 uppercase">แจ้งเตือนใหม่</p>
            </div>
          </div>
          
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col items-center sm:items-start relative overflow-hidden group hover:shadow-md transition-shadow">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform duration-500">
              <Clock className="w-24 h-24 text-amber-500" />
            </div>
            <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center mb-4 relative z-10">
              <Clock className="w-6 h-6 text-amber-600" />
            </div>
            <div className="relative z-10 text-center sm:text-left">
              <p className="text-3xl font-bold text-slate-900">{readAlertsCount}</p>
              <p className="text-sm font-medium text-slate-500 mt-1 uppercase">รับทราบ/รอดำเนินการ</p>
            </div>
          </div>
          
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col items-center sm:items-start relative overflow-hidden group hover:shadow-md transition-shadow">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform duration-500">
              <CheckCircle className="w-24 h-24 text-emerald-600" />
            </div>
            <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center mb-4 relative z-10">
              <CheckCircle className="w-6 h-6 text-emerald-600" />
            </div>
            <div className="relative z-10 text-center sm:text-left">
              <p className="text-3xl font-bold text-slate-900">{resolvedAlertsCount}</p>
              <p className="text-sm font-medium text-slate-500 mt-1 uppercase">แก้ไขเรียบร้อยแล้ว</p>
            </div>
          </div>
        </div>

        {/* Alerts List */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-5 sm:p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">รายการแจ้งเตือน</h2>
            <div className="text-sm text-slate-500 font-medium">ทั้งหมด {alerts.length} รายการ</div>
          </div>
          
          <div className="p-0 sm:p-2 divide-y divide-slate-100">
            {alerts.length === 0 ? (
              <div className="text-center py-16 px-4">
                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Bell className="w-10 h-10 text-slate-300" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-1">ยอดเยี่ยม! ไม่มีแจ้งเตือนใหม่</h3>
                <p className="text-slate-500 max-w-sm mx-auto">
                  ทุกอย่างอยู่ในความสงบเรียบร้อย ไม่พบการฝ่าฝืนกฎความปลอดภัยรอบบริเวณนี้
                </p>
              </div>
            ) : (
              <div className="flex flex-col">
                {alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`p-5 sm:p-6 transition-colors hover:bg-slate-50 ${
                      alert.status === 'new' ? 'bg-rose-50/30' : ''
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      {/* Left side: Icon + Message */}
                      <div className="flex items-start gap-4">
                        <div className={`shrink-0 p-3 rounded-xl ${
                          alert.status === 'new' 
                            ? 'bg-rose-100 text-rose-600' 
                            : alert.status === 'read'
                              ? 'bg-amber-100 text-amber-600'
                              : 'bg-emerald-100 text-emerald-600'
                        }`}>
                          {alert.status === 'resolved' ? (
                            <CheckCircle className="w-6 h-6" />
                          ) : (
                            <AlertTriangle className="w-6 h-6" />
                          )}
                        </div>
                        
                        <div>
                          <p className={`font-semibold text-base sm:text-lg mb-1 leading-tight ${
                            alert.status === 'new' ? 'text-slate-900' : 'text-slate-700'
                          }`}>
                            {alert.message}
                          </p>
                          <div className="flex items-center gap-3 text-sm text-slate-500">
                            <span className="flex items-center gap-1 font-medium">
                              <Clock className="w-4 h-4" />
                              {new Date(alert.timestamp).toLocaleString('th-TH', {
                                year: 'numeric', month: 'short', day: 'numeric',
                                hour: '2-digit', minute: '2-digit'
                              })}
                            </span>
                            <span className="text-slate-300">•</span>
                            <span className="uppercase text-xs font-bold tracking-wider">
                              ID: {alert.id.toString().padStart(5, '0')}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Right side: Badges & Actions */}
                      <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-3 pl-14 sm:pl-0 border-t border-slate-100 sm:border-0 pt-4 sm:pt-0">
                        {/* Badges */}
                        <div>
                          {alert.status === 'new' && (
                            <span className="px-3 py-1 bg-rose-100 text-rose-700 text-xs font-bold rounded-full border border-rose-200 shadow-sm">ใหม่ล่าสุด</span>
                          )}
                          {alert.status === 'read' && (
                            <span className="px-3 py-1 bg-amber-100 text-amber-700 text-xs font-bold rounded-full border border-amber-200 shadow-sm">รับทราบแล้ว</span>
                          )}
                          {alert.status === 'resolved' && (
                            <span className="px-3 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full border border-emerald-200 shadow-sm">แก้ไขเรียบร้อย</span>
                          )}
                        </div>

                        {/* Action Buttons */}
                        {alert.status !== 'resolved' && (
                          <div className="flex items-center gap-2">
                            {alert.status === 'new' && (
                              <button
                                onClick={() => handleMarkRead(alert.id)}
                                className="px-3 py-1.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:text-blue-600 focus:ring-2 focus:ring-blue-100 transition-all shadow-sm"
                              >
                                รับทราบ
                              </button>
                            )}
                            <button
                              onClick={() => handleResolve(alert.id)}
                              className="px-3 py-1.5 text-sm font-medium text-white bg-emerald-600 border border-transparent rounded-lg hover:bg-emerald-700 focus:ring-2 focus:ring-emerald-200 transition-all shadow-sm"
                            >
                              ปิดจ็อบ
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  )
}

