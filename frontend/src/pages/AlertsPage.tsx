import { useEffect, useMemo, useState } from 'react'
import { Layout } from '../components/layout/Layout'
import { Bell, AlertTriangle, CheckCircle, Clock, Eye, X, ShieldAlert } from 'lucide-react'
import toast from 'react-hot-toast'
import { alertsService } from '../services/alerts'
import { detectionService } from '../services/detection'
import type { Alert, Detection } from '../types'

interface AlertGroup extends Alert {
  alert_ids: number[]
  alert_types: string[]
}

export function AlertsPage() {
  const [alerts, setAlerts] = useState<AlertGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [perPage] = useState(20)
  const [total, setTotal] = useState(0)
  const [activeStatus, setActiveStatus] = useState<string | undefined>(undefined) // undefined = all
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null)
  const [selectedDetection, setSelectedDetection] = useState<Detection | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / perPage)), [total, perPage])

  const load = async () => {
    setLoading(true)
    try {
      const res = await alertsService.list(page, perPage, activeStatus)
      const grouped = (res.items || []).reduce<Record<number, AlertGroup>>((acc, current) => {
        const key = current.detection_id
        if (!acc[key]) {
          acc[key] = {
            ...current,
            alert_ids: [current.id],
            alert_types: [current.alert_type],
          }
        } else {
          acc[key].alert_ids.push(current.id)
          if (!acc[key].alert_types.includes(current.alert_type)) {
            acc[key].alert_types.push(current.alert_type)
          }
          // Prefer newest status if any item is still "new", then "acknowledged", else "resolved"
          if (current.status === 'new' || (current.status === 'acknowledged' && acc[key].status === 'resolved')) {
            acc[key].status = current.status
          }
          // Keep latest creation time for ordering display
          if (new Date(current.created_at).getTime() > new Date(acc[key].created_at).getTime()) {
            acc[key].created_at = current.created_at
          }
        }
        return acc
      }, {})

      const sortedGroups = Object.values(grouped).sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      )
      setAlerts(sortedGroups)
      setTotal(res.total || 0)
    } catch (e) {
      console.error(e)
      toast.error('โหลดการแจ้งเตือนไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, activeStatus])

  const handleAcknowledge = async (alertGroup: AlertGroup) => {
    try {
      const ids = alertGroup.alert_ids.length ? alertGroup.alert_ids : [alertGroup.id]
      await Promise.all(ids.map((id) => alertsService.acknowledge(id)))
      setAlerts((prev) => prev.map((a) => (a.detection_id === alertGroup.detection_id ? { ...a, status: 'acknowledged' } : a)))
      toast.success('รับทราบแล้ว')
    } catch (e) {
      console.error(e)
      toast.error('ทำรายการไม่สำเร็จ')
    }
  }

  const handleResolve = async (alertGroup: AlertGroup) => {
    try {
      const ids = alertGroup.alert_ids.length ? alertGroup.alert_ids : [alertGroup.id]
      await Promise.all(ids.map((id) => alertsService.resolve(id)))
      setAlerts((prev) => prev.map((a) => (a.detection_id === alertGroup.detection_id ? { ...a, status: 'resolved' } : a)))
      toast.success('ปิดการแจ้งเตือนแล้ว')
    } catch (e) {
      console.error(e)
      toast.error('ทำรายการไม่สำเร็จ')
    }
  }

  const handleViewDetail = async (alert: Alert) => {
    setSelectedAlert(alert)
    setSelectedDetection(null)
    setLoadingDetail(true)
    try {
      const detection = await detectionService.getDetection(alert.detection_id)
      setSelectedDetection(detection)
    } catch (e) {
      console.error(e)
      toast.error('โหลดรายละเอียดการตรวจจับไม่สำเร็จ')
    } finally {
      setLoadingDetail(false)
    }
  }

  const newAlertsCount = alerts.filter(a => a.status === 'new').length
  const readAlertsCount = alerts.filter(a => a.status === 'acknowledged').length
  const resolvedAlertsCount = alerts.filter(a => a.status === 'resolved').length

  const getViolationBadgeClass = (type: string) => {
    const t = type.toUpperCase()
    if (t.includes('HELMET') || t.includes('HARDHAT') || t.includes('หมวก'))
      return 'inline-flex px-[10px] py-[3px] rounded-[6px] text-[11px] font-bold bg-[#fee2e2] text-[#dc2626] border border-[#fecaca]'
    if (t.includes('VEST') || t.includes('เสื้อ'))
      return 'inline-flex px-[10px] py-[3px] rounded-[6px] text-[11px] font-bold bg-[#ffedd5] text-[#ea580c] border border-[#fed7aa]'
    return 'inline-flex px-[10px] py-[3px] rounded-[6px] text-[11px] font-bold bg-[#fef3c7] text-[#d97706] border border-[#fde68a]'
  }

  return (
    <Layout>
      <div className="space-y-6 sm:space-y-8">
        {/* Page Title */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
              <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-[#eff6ff] border border-[#dbeafe]">
                <Bell className="w-5 h-5 text-blue-600" />
              </span>
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
        <div className="grid grid-cols-1 sm:grid-cols-3" style={{ gap: '24px' }}>
          {/* New Alerts */}
          <div className="bg-white border border-[#e2e8f0] rounded-[16px] shadow-sm min-h-[110px] flex flex-col justify-between" style={{ padding: '24px', boxSizing: 'border-box' }}>
            <div className="flex items-start justify-between">
              <p className="text-[13px] text-[#64748b] font-medium m-0">แจ้งเตือนใหม่</p>
              <Bell size={18} className="text-[#94a3b8]" strokeWidth={2} />
            </div>
            <div className="mt-2 text-left">
              <p className="text-[34px] font-extrabold text-[#0f172a] m-0 leading-[1] tracking-tight">{newAlertsCount}</p>
            </div>
          </div>

          {/* Pending Alerts */}
          <div className="bg-white border border-[#e2e8f0] rounded-[16px] shadow-sm min-h-[110px] flex flex-col justify-between" style={{ padding: '24px', boxSizing: 'border-box' }}>
            <div className="flex items-start justify-between">
              <p className="text-[13px] text-[#64748b] font-medium m-0">รับทราบ / รอดำเนินการ</p>
              <Clock size={18} className="text-[#94a3b8]" strokeWidth={2} />
            </div>
            <div className="mt-2 text-left">
              <p className="text-[34px] font-extrabold text-[#0f172a] m-0 leading-[1] tracking-tight">{readAlertsCount}</p>
            </div>
          </div>

          {/* Resolved Alerts */}
          <div className="bg-white border border-[#e2e8f0] rounded-[16px] shadow-sm min-h-[110px] flex flex-col justify-between" style={{ padding: '24px', boxSizing: 'border-box' }}>
            <div className="flex items-start justify-between">
              <p className="text-[13px] text-[#64748b] font-medium m-0">แก้ไขเรียบร้อยแล้ว</p>
              <CheckCircle size={18} className="text-[#94a3b8]" strokeWidth={2} />
            </div>
            <div className="mt-2 text-left">
              <p className="text-[34px] font-extrabold text-[#0f172a] m-0 leading-[1] tracking-tight">{resolvedAlertsCount}</p>
            </div>
          </div>
        </div>

        {/* Alerts List */}
        <div className="bg-white rounded-[20px] shadow-[0_1px_4px_rgba(0,0,0,0.06)] border border-[#e5eaf0] overflow-hidden">
          <div className="border-b border-[#e5eaf0] bg-[#f8fafc] flex flex-wrap items-center justify-between gap-4" style={{ padding: '16px 24px' }}>
            <h2 className="text-[16px] font-bold text-[#0f172a] m-0">รายการแจ้งเตือน</h2>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => { setPage(1); setActiveStatus(undefined) }}
                className={`rounded-full text-[13px] font-semibold border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  !activeStatus ? 'bg-[#2563eb] text-white border-[#2563eb] shadow-sm' : 'bg-white text-[#64748b] border-[#e5eaf0] hover:bg-[#f8fafc]'
                }`}
                style={{ padding: '8px 20px' }}
              >
                ทั้งหมด
              </button>
              <button
                onClick={() => { setPage(1); setActiveStatus('new') }}
                className={`rounded-full text-[13px] font-semibold border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  activeStatus === 'new' ? 'bg-[#e11d48] text-white border-[#e11d48] shadow-sm' : 'bg-white text-[#64748b] border-[#e5eaf0] hover:bg-[#f8fafc]'
                }`}
                style={{ padding: '8px 20px' }}
              >
                ใหม่
              </button>
              <button
                onClick={() => { setPage(1); setActiveStatus('acknowledged') }}
                className={`rounded-full text-[13px] font-semibold border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  activeStatus === 'acknowledged' ? 'bg-[#f59e0b] text-white border-[#f59e0b] shadow-sm' : 'bg-white text-[#64748b] border-[#e5eaf0] hover:bg-[#f8fafc]'
                }`}
                style={{ padding: '8px 20px' }}
              >
                รับทราบ
              </button>
              <button
                onClick={() => { setPage(1); setActiveStatus('resolved') }}
                className={`rounded-full text-[13px] font-semibold border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  activeStatus === 'resolved' ? 'bg-[#10b981] text-white border-[#10b981] shadow-sm' : 'bg-white text-[#64748b] border-[#e5eaf0] hover:bg-[#f8fafc]'
                }`}
                style={{ padding: '8px 20px' }}
              >
                ปิดแล้ว
              </button>
              <div className="text-[13px] text-[#64748b] font-medium ml-2">ทั้งหมด {total} รายการ</div>
            </div>
          </div>
          
          <div className="p-0 overflow-y-auto" style={{ maxHeight: '640px' }}>
            {loading ? (
              <div className="text-center py-16 px-4 text-slate-500 font-medium">กำลังโหลด...</div>
            ) : alerts.length === 0 ? (
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
                    className={`transition-colors border-b border-[#f1f5f9] last:border-0 hover:bg-[#f8fafc] ${
                      alert.status === 'new' ? 'bg-[#fff1f2]/40' : 'bg-white'
                    }`}
                    style={{ padding: '24px' }}
                  >
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                      {/* Left side: Icon + Message */}
                      <div className="flex items-start gap-5">
                        <div className={`shrink-0 p-3 rounded-xl border ${
                          alert.status === 'new' 
                            ? 'bg-[#fff1f2] text-[#e11d48] border-[#fecdd3]' 
                            : alert.status === 'acknowledged'
                              ? 'bg-[#fffbeb] text-[#d97706] border-[#fde68a]'
                              : 'bg-[#ecfdf5] text-[#059669] border-[#a7f3d0]'
                        }`}>
                          {alert.status === 'resolved' ? (
                            <CheckCircle size={24} />
                          ) : (
                            <AlertTriangle size={24} />
                          )}
                        </div>
                        
                        <div>
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            <p className={`font-bold text-[16px] m-0 leading-tight ${
                              alert.status === 'new' ? 'text-[#0f172a]' : 'text-[#334155]'
                            }`}>
                              {`ตรวจพบ: ${alert.alert_types.join(', ')}`}
                            </p>
                            <div className="flex items-center gap-1.5">
                              {alert.status === 'new' && (
                                <span className="bg-[#ffe4e6] text-[#e11d48] text-[11px] font-medium rounded-md border border-[#fda4af]" style={{ padding: '2px 8px' }}>ใหม่ล่าสุด</span>
                              )}
                              {alert.status === 'acknowledged' && (
                                <span className="bg-[#fef3c7] text-[#f59e0b] text-[11px] font-medium rounded-md border border-[#fde68a]" style={{ padding: '2px 8px' }}>รับทราบแล้ว</span>
                              )}
                              {alert.status === 'resolved' && (
                                <span className="bg-[#d1fae5] text-[#10b981] text-[11px] font-medium rounded-md border border-[#a7f3d0]" style={{ padding: '2px 8px' }}>แก้ไขเรียบร้อย</span>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-3 text-[13px] text-[#64748b]">
                            <span className="flex items-center gap-1.5 font-medium">
                              <Clock size={16} />
                              {new Date(alert.created_at).toLocaleString('th-TH', {
                                year: 'numeric', month: 'short', day: 'numeric',
                                hour: '2-digit', minute: '2-digit'
                              })}
                            </span>
                            <span className="text-[#cbd5e1]">•</span>
                            <span className="uppercase font-bold tracking-wider text-[#94a3b8]">
                              ID: {alert.id.toString().padStart(5, '0')}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Right side: Actions */}
                      <div className="flex flex-col items-start md:items-end gap-3 shrink-0">
                        {/* Action Buttons */}
                        <div className="flex flex-wrap items-center gap-2 mt-2 md:mt-0">
                          <button
                            onClick={() => handleViewDetail(alert)}
                            className="text-[13px] font-bold text-[#334155] bg-white border border-[#e2e8f0] rounded-full cursor-pointer hover:bg-[#f8fafc] hover:text-[#2563eb] hover:border-[#bfdbfe] transition-all inline-flex items-center gap-2"
                            style={{ padding: '8px 20px' }}
                          >
                            <Eye size={14} />
                            ดูรายละเอียด
                          </button>
                            {alert.status === 'new' && (
                              <button
                                onClick={() => handleAcknowledge(alert)}
                                className="text-[13px] font-bold text-[#475569] bg-white border border-[#e2e8f0] rounded-full cursor-pointer hover:bg-[#f8fafc] hover:text-[#2563eb] hover:border-[#bfdbfe] transition-all"
                                style={{ padding: '8px 24px' }}
                              >
                                รับทราบ
                              </button>
                            )}
                          {alert.status !== 'resolved' && (
                            <button
                              onClick={() => handleResolve(alert)}
                              className="text-[13px] font-bold text-white bg-[#10b981] border border-[#059669] rounded-full cursor-pointer hover:bg-[#059669] transition-all"
                              style={{ padding: '8px 24px' }}
                            >
                              ปิดจ็อบ
                            </button>
                          )}
                          </div>
                        </div>
                      </div>
                  </div>
                ))}

                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 p-4 text-sm">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white disabled:opacity-50"
                    >
                      ก่อนหน้า
                    </button>
                    <span className="text-slate-600 font-semibold">
                      หน้า {page} / {totalPages}
                    </span>
                    <button
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white disabled:opacity-50"
                    >
                      ถัดไป
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {selectedAlert && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[rgba(15,23,42,0.45)]" onClick={() => setSelectedAlert(null)} />
          <div className="relative w-full max-w-[960px] max-h-[90vh] bg-white rounded-2xl border border-[#e2e8f0] shadow-[0_20px_60px_rgba(0,0,0,0.18)] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-7 py-5 border-b border-[#eef2f7]">
              <div className="flex items-center gap-2">
                <ShieldAlert size={16} className="text-[#6366f1]" />
                <p className="text-[18px] font-bold text-[#1e293b] m-0 leading-none">Violation Details</p>
              </div>
              <button
                onClick={() => setSelectedAlert(null)}
                className="w-9 h-9 rounded-xl bg-[#f1f5f9] border-none text-[#64748b] cursor-pointer flex items-center justify-center"
              >
                <X size={17} />
              </button>
            </div>

            <div className="px-7 py-6 bg-[#fbfcfe] overflow-y-auto">
              {loadingDetail ? (
                <div className="py-12 text-center text-[#64748b] text-[14px]">กำลังโหลดรายละเอียด...</div>
              ) : selectedDetection ? (
                <div className="flex justify-center">
                <div className="w-full max-w-[760px] space-y-6">
                  <div className="rounded-2xl overflow-hidden border border-[#dbe3ee] bg-white">
                    <img
                      src={detectionService.getResultImageUrl(selectedDetection.id)}
                      alt="Detection result"
                      className="w-full h-[360px] object-contain"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-5">
                    <div className="bg-white border border-[#e2e8f0] rounded-xl p-4">
                      <p className="text-[14px] text-[#94a3b8] font-bold tracking-[0.06em] uppercase m-0 mb-1">Date & Time</p>
                      <p className="text-[20px] font-semibold text-[#0f172a] m-0 leading-tight">
                        {new Date(selectedDetection.created_at).toLocaleString('th-TH')}
                      </p>
                    </div>
                    <div className="bg-white border border-[#e2e8f0] rounded-xl p-4">
                      <p className="text-[14px] text-[#94a3b8] font-bold tracking-[0.06em] uppercase m-0 mb-1">Reference ID</p>
                      <p className="text-[24px] font-semibold text-[#0f172a] m-0 leading-tight">
                        DET-{String(selectedDetection.id).padStart(5, '0')}
                      </p>
                    </div>
                  </div>

                  <div className="px-1">
                    <p className="text-[14px] text-[#94a3b8] font-bold tracking-[0.06em] uppercase m-0 mb-2">Violation Type</p>
                    <div className="flex flex-wrap gap-2">
                      {(selectedDetection.violations || [selectedAlert.alert_type]).map((v, i) => (
                        <span key={i} className={getViolationBadgeClass(v)}>
                          {v.toUpperCase().includes('HELMET') ? 'MISSING HELMET' :
                           v.toUpperCase().includes('VEST') ? 'MISSING VEST' :
                           v.toUpperCase()}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="px-1">
                    <p className="text-[14px] text-[#94a3b8] font-bold tracking-[0.06em] uppercase m-0 mb-2">Message</p>
                    <div className="rounded-xl border border-[#e2e8f0] bg-[#f3f6fb] px-5 py-4 text-[15px] text-[#334155] leading-relaxed">
                      {(() => {
                        const types = selectedDetection.violations?.length
                          ? selectedDetection.violations
                          : selectedAlert.alert_type
                            ? [selectedAlert.alert_type]
                            : []
                        if (types.length > 0) {
                          return `ตรวจพบ: ${types.join(' และ ')}`
                        }
                        return (
                          selectedDetection.summary?.message ||
                          selectedAlert.message ||
                          '—'
                        )
                      })()}
                    </div>
                  </div>

                  <div className="px-1">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[14px] text-[#94a3b8] font-bold tracking-[0.06em] uppercase m-0">Detailed Breakdown</p>
                      <span className="text-[12px] px-3 py-1 rounded-md bg-[#e2e8f0] text-[#0f172a] font-semibold">
                        Total Persons Detected: {selectedDetection.person_count}
                      </span>
                    </div>
                    {selectedDetection.persons?.filter((p) => !p.is_compliant).map((person) => (
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
                      + {selectedDetection.persons?.filter((p) => p.is_compliant).length ?? 0} person(s) fully compliant
                    </p>
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      onClick={() => setSelectedAlert(null)}
                      className="px-6 py-3 rounded-xl border-none bg-[#e2e8f0] text-[#334155] text-[14px] font-semibold cursor-pointer hover:bg-[#cbd5e1]"
                    >
                      Close
                    </button>
                  </div>
                </div>
                </div>
              ) : (
                <div className="py-12 text-center text-[#64748b] text-[14px]">ไม่พบข้อมูล detection</div>
              )}
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}

