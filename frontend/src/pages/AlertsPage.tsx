import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  Bell,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  Loader2,
  ShieldAlert,
  X,
} from 'lucide-react'
import toast from 'react-hot-toast'

import { Layout } from '../components/layout/Layout'
import { ProtectedDetectionImage } from '../components/ui/ProtectedDetectionImage'
import { useDialogFocus } from '../hooks/useDialogFocus'
import { alertsService } from '../services/alerts'
import { detectionService } from '../services/detection'
import { eventsService } from '../services/events'
import { useAuthStore } from '../stores/authStore'
import type { Alert, Detection } from '../types'

interface AlertGroup extends Alert {
  alert_ids: number[]
  alert_types: string[]
}

const ALERTS_PER_PAGE = 20

const statusPresentation = {
  new: {
    label: 'ใหม่ล่าสุด',
    className: 'border-[#f0c3c8] bg-[#fff8f8] text-[#d70015]',
    dotClassName: 'bg-[#d70015]',
  },
  acknowledged: {
    label: 'รับทราบแล้ว',
    className: 'border-[#efd39c] bg-[#fffaf0] text-[#b45309]',
    dotClassName: 'bg-[#d97706]',
  },
  resolved: {
    label: 'แก้ไขเรียบร้อย',
    className: 'border-[#b9dfc2] bg-[#f3fbf5] text-[#15803d]',
    dotClassName: 'bg-[#34c759]',
  },
}

export function AlertsPage() {
  const canManageAlerts = useAuthStore((state) => (
    state.user?.role === 'admin' || state.user?.role === 'safety_officer'
  ))
  const [alerts, setAlerts] = useState<AlertGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [activeStatus, setActiveStatus] = useState<string | undefined>(undefined)
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null)
  const [selectedDetection, setSelectedDetection] = useState<Detection | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [clipUrl, setClipUrl] = useState<string | null>(null)
  const detailRequestRef = useRef(0)
  const listRequestRef = useRef(0)

  const closeDetail = useCallback(() => {
    detailRequestRef.current += 1
    setSelectedAlert(null)
    setSelectedDetection(null)
    setClipUrl(null)
    setLoadingDetail(false)
  }, [])
  const detailDialogRef = useDialogFocus<HTMLElement>(Boolean(selectedAlert), closeDetail)

  useEffect(() => () => {
    detailRequestRef.current += 1
  }, [])

  useEffect(() => () => {
    if (clipUrl) URL.revokeObjectURL(clipUrl)
  }, [clipUrl])

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / ALERTS_PER_PAGE)), [total])

  const load = useCallback(async () => {
    const requestId = listRequestRef.current + 1
    listRequestRef.current = requestId
    setLoading(true)
    setLoadError(false)
    try {
      const response = await alertsService.list(page, ALERTS_PER_PAGE, activeStatus)
      if (listRequestRef.current !== requestId) return
      const grouped = (response.items || []).reduce<Record<number, AlertGroup>>((accumulator, current) => {
        const key = current.detection_id
        if (!accumulator[key]) {
          accumulator[key] = {
            ...current,
            alert_ids: [current.id],
            alert_types: [current.alert_type],
          }
        } else {
          accumulator[key].alert_ids.push(current.id)
          if (!accumulator[key].alert_types.includes(current.alert_type)) {
            accumulator[key].alert_types.push(current.alert_type)
          }
          if (current.status === 'new' || (current.status === 'acknowledged' && accumulator[key].status === 'resolved')) {
            accumulator[key].status = current.status
          }
          if (new Date(current.created_at).getTime() > new Date(accumulator[key].created_at).getTime()) {
            accumulator[key].created_at = current.created_at
          }
        }
        return accumulator
      }, {})

      setAlerts(Object.values(grouped).sort(
        (first, second) => new Date(second.created_at).getTime() - new Date(first.created_at).getTime(),
      ))
      setTotal(response.total || 0)
    } catch (error) {
      if (listRequestRef.current !== requestId) return
      console.error(error)
      setLoadError(true)
      toast.error('โหลดการแจ้งเตือนไม่สำเร็จ')
    } finally {
      if (listRequestRef.current === requestId) setLoading(false)
    }
  }, [activeStatus, page])

  useEffect(() => {
    void load()
    return () => {
      listRequestRef.current += 1
    }
  }, [load])

  const handleAcknowledge = async (alertGroup: AlertGroup) => {
    try {
      const ids = alertGroup.alert_ids.length ? alertGroup.alert_ids : [alertGroup.id]
      await Promise.all(ids.map((id) => alertsService.acknowledge(id)))
      setAlerts((previous) => previous.map((alert) => (
        alert.detection_id === alertGroup.detection_id ? { ...alert, status: 'acknowledged' } : alert
      )))
      toast.success('รับทราบแล้ว')
    } catch (error) {
      console.error(error)
      toast.error('ทำรายการไม่สำเร็จ')
    }
  }

  const handleResolve = async (alertGroup: AlertGroup) => {
    try {
      const ids = alertGroup.alert_ids.length ? alertGroup.alert_ids : [alertGroup.id]
      await Promise.all(ids.map((id) => alertsService.resolve(id)))
      setAlerts((previous) => previous.map((alert) => (
        alert.detection_id === alertGroup.detection_id ? { ...alert, status: 'resolved' } : alert
      )))
      toast.success('ปิดการแจ้งเตือนแล้ว')
    } catch (error) {
      console.error(error)
      toast.error('ทำรายการไม่สำเร็จ')
    }
  }

  const handleViewDetail = async (alert: Alert) => {
    const requestId = detailRequestRef.current + 1
    detailRequestRef.current = requestId
    setSelectedAlert(alert)
    setSelectedDetection(null)
    setClipUrl(null)
    setLoadingDetail(true)
    try {
      const detection = await detectionService.getDetection(alert.detection_id)
      if (detailRequestRef.current !== requestId) return
      setSelectedDetection(detection)
      if (alert.violation_log_id) {
        try {
          const clip = await eventsService.getEvidenceBlob(alert.violation_log_id, 'clip')
          if (detailRequestRef.current !== requestId) return
          setClipUrl(URL.createObjectURL(clip))
        } catch {
          if (detailRequestRef.current !== requestId) return
          // Evidence may be disabled or the clip may still be recording.
        }
      }
    } catch (error) {
      if (detailRequestRef.current !== requestId) return
      console.error(error)
      toast.error('โหลดรายละเอียดการตรวจจับไม่สำเร็จ')
    } finally {
      if (detailRequestRef.current === requestId) setLoadingDetail(false)
    }
  }

  const newAlertsCount = alerts.filter((alert) => alert.status === 'new').length
  const acknowledgedAlertsCount = alerts.filter((alert) => alert.status === 'acknowledged').length
  const resolvedAlertsCount = alerts.filter((alert) => alert.status === 'resolved').length

  const setStatusFilter = (status: string | undefined) => {
    setPage(1)
    setActiveStatus(status)
  }

  return (
    <Layout>
      <div className="mx-auto flex max-w-[1240px] flex-col gap-8 sm:gap-10">
        <header className="page-heading flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-full bg-[var(--ink)] text-white" aria-hidden="true">
              <Bell size={20} strokeWidth={1.8} />
            </div>
            <h1>ศูนย์การแจ้งเตือน</h1>
            <p className="max-w-3xl !mt-3 !text-[17px] !leading-[1.47]">รายการแจ้งเตือนและเหตุการณ์ฝ่าฝืนกฎความปลอดภัย</p>
          </div>
          {newAlertsCount > 0 && (
            <div className="inline-flex min-h-11 w-fit items-center gap-2 rounded-full border border-[#f0c3c8] bg-[#fff8f8] px-4 text-[14px] font-semibold text-[#d70015]" role="status">
              <span className="h-2 w-2 rounded-full bg-[#d70015]" aria-hidden="true" />
              พบ {newAlertsCount} แจ้งเตือนใหม่
            </div>
          )}
        </header>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-6" aria-label="Alert summary">
          {[
            { label: 'แจ้งเตือนใหม่', value: newAlertsCount, icon: Bell, iconClassName: 'text-[#d70015]' },
            { label: 'รับทราบ / รอดำเนินการ', value: acknowledgedAlertsCount, icon: Clock, iconClassName: 'text-[#b45309]' },
            { label: 'แก้ไขเรียบร้อยแล้ว', value: resolvedAlertsCount, icon: CheckCircle, iconClassName: 'text-[#15803d]' },
          ].map((stat) => (
            <div key={stat.label} className="surface-card min-h-36 p-6 sm:p-7">
              <div className="flex items-start justify-between gap-4">
                <p className="text-[14px] leading-relaxed text-[var(--muted)]">{stat.label}</p>
                <stat.icon size={19} className={stat.iconClassName} strokeWidth={1.8} aria-hidden="true" />
              </div>
              <p className="mt-5 text-[40px] font-semibold leading-none tracking-[-0.04em] text-[var(--ink)] tabular-nums">{stat.value.toLocaleString()}</p>
            </div>
          ))}
        </section>

        <section className="surface-card overflow-hidden" aria-labelledby="alerts-list-title">
          <div className="flex flex-col gap-5 border-b border-[var(--line)] px-6 py-6 sm:px-8 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 id="alerts-list-title" className="text-[21px] font-semibold tracking-[-0.01em] text-[var(--ink)]">รายการแจ้งเตือน</h2>
              <p className="mt-1 text-[14px] text-[var(--muted)]">{total.toLocaleString()} total alerts</p>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Filter alerts by status">
              {[
                { label: 'ทั้งหมด', value: undefined },
                { label: 'ใหม่', value: 'new' },
                { label: 'รับทราบ', value: 'acknowledged' },
                { label: 'ปิดแล้ว', value: 'resolved' },
              ].map((filter) => {
                const isActive = activeStatus === filter.value
                return (
                  <button
                    key={filter.label}
                    type="button"
                    onClick={() => setStatusFilter(filter.value)}
                    disabled={loading}
                    aria-pressed={isActive}
                    className={`min-h-11 shrink-0 rounded-full border px-5 text-[14px] font-semibold transition-colors active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 ${
                      isActive
                        ? 'border-[var(--blue)] bg-[var(--blue)] text-white'
                        : 'border-[var(--line)] bg-white text-[var(--blue)] hover:bg-[#f5f5f7]'
                    }`}
                  >
                    {filter.label}
                  </button>
                )
              })}
            </div>
          </div>

          {loading ? (
            <div className="flex min-h-72 items-center justify-center gap-3 text-[15px] text-[var(--muted)]" role="status">
              <Loader2 size={21} className="animate-spin text-[var(--blue)]" aria-hidden="true" />
              กำลังโหลดการแจ้งเตือน…
            </div>
          ) : loadError ? (
            <div className="flex min-h-72 flex-col items-center justify-center gap-4 px-6 text-center" role="alert">
              <AlertTriangle size={28} className="text-[#d70015]" strokeWidth={1.6} aria-hidden="true" />
              <p className="text-[21px] font-semibold tracking-[-0.01em] text-[var(--ink)]">โหลดการแจ้งเตือนไม่สำเร็จ</p>
              <p className="max-w-md text-[15px] leading-relaxed text-[var(--muted)]">ตรวจสอบการเชื่อมต่อกับ backend แล้วลองอีกครั้ง</p>
              <button type="button" onClick={() => void load()} className="btn-apple-secondary !min-h-11 text-[var(--blue)]">ลองอีกครั้ง</button>
            </div>
          ) : alerts.length === 0 ? (
            <div className="flex min-h-72 flex-col items-center justify-center gap-4 px-6 text-center">
              <Bell size={30} className="text-[var(--muted)]" strokeWidth={1.5} aria-hidden="true" />
              <p className="text-[21px] font-semibold tracking-[-0.01em] text-[var(--ink)]">ไม่มีการแจ้งเตือนในสถานะนี้</p>
              <p className="max-w-sm text-[15px] leading-relaxed text-[var(--muted)]">เมื่อระบบพบเหตุการณ์ รายการที่ตรงกับตัวกรองจะปรากฏที่นี่</p>
            </div>
          ) : (
            <div className="divide-y divide-[var(--line)]">
              {alerts.map((alert) => {
                const presentation = statusPresentation[alert.status as keyof typeof statusPresentation] || statusPresentation.new
                return (
                  <article key={alert.id} className={`p-6 transition-colors hover:bg-[#f5f5f7] sm:p-8 ${alert.status === 'new' ? 'bg-[#fffafa]' : 'bg-white'}`}>
                    <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                      <div className="flex min-w-0 items-start gap-4 sm:gap-5">
                        <span className={`inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border ${presentation.className}`} aria-hidden="true">
                          {alert.status === 'resolved' ? <CheckCircle size={21} /> : <AlertTriangle size={21} />}
                        </span>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-[17px] font-semibold leading-snug text-[var(--ink)]">ตรวจพบ: {alert.alert_types.join(', ')}</h3>
                            <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] font-semibold ${presentation.className}`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${presentation.dotClassName}`} aria-hidden="true" />
                              {presentation.label}
                            </span>
                          </div>
                          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-[14px] text-[var(--muted)]">
                            <span className="inline-flex items-center gap-1.5">
                              <Clock size={15} aria-hidden="true" />
                              {new Date(alert.created_at).toLocaleString('th-TH', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                            <span aria-hidden="true">•</span>
                            <span className="font-semibold tabular-nums">ID {alert.id.toString().padStart(5, '0')}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 lg:justify-end">
                        <button type="button" onClick={() => void handleViewDetail(alert)} className="btn-apple-secondary !min-h-11 text-[var(--blue)] active:scale-95">
                          <Eye size={16} aria-hidden="true" />
                          ดูรายละเอียด
                        </button>
                        {canManageAlerts && alert.status === 'new' && (
                          <button type="button" onClick={() => void handleAcknowledge(alert)} className="btn-apple-secondary !min-h-11 text-[var(--blue)] active:scale-95">รับทราบ</button>
                        )}
                        {canManageAlerts && alert.status !== 'resolved' && (
                          <button type="button" onClick={() => void handleResolve(alert)} className="btn-apple-primary !min-h-11 active:scale-95">ปิดจ็อบ</button>
                        )}
                      </div>
                    </div>
                  </article>
                )
              })}

              {totalPages > 1 && (
                <div className="flex flex-col items-center justify-between gap-4 bg-[#f5f5f7] px-6 py-5 sm:flex-row sm:px-8">
                  <span className="text-[14px] text-[var(--muted)]">หน้า <strong className="font-semibold text-[var(--ink)]">{page}</strong> / {totalPages}</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setPage((current) => Math.max(1, current - 1))}
                      disabled={loading || page === 1}
                      className="btn-apple-secondary !min-h-11 active:scale-95"
                    >
                      <ChevronLeft size={16} aria-hidden="true" />
                      ก่อนหน้า
                    </button>
                    <button
                      type="button"
                      onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                      disabled={loading || page === totalPages}
                      className="btn-apple-secondary !min-h-11 active:scale-95"
                    >
                      ถัดไป
                      <ChevronRight size={16} aria-hidden="true" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      {selectedAlert && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6">
          <button
            type="button"
            aria-label="Close violation details"
            className="absolute inset-0 h-full w-full cursor-default border-0 bg-black/55 backdrop-blur-[2px]"
            onClick={closeDetail}
          />
          <section
            ref={detailDialogRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-labelledby="violation-detail-title"
            className="relative flex max-h-[92vh] w-full max-w-[960px] flex-col overflow-hidden rounded-[18px] border border-[var(--line)] bg-white"
          >
            <header className="flex min-h-[72px] shrink-0 items-center justify-between gap-4 border-b border-[var(--line)] px-5 sm:px-8">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#f5f5f7] text-[#d70015]" aria-hidden="true">
                  <ShieldAlert size={19} strokeWidth={1.8} />
                </span>
                <div>
                  <h2 id="violation-detail-title" className="text-[21px] font-semibold tracking-[-0.01em] text-[var(--ink)]">Violation details</h2>
                  <p className="mt-0.5 text-[13px] text-[var(--muted)]">Alert {selectedAlert.id.toString().padStart(5, '0')}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeDetail}
                aria-label="Close"
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#f5f5f7] text-[var(--ink)] transition-colors hover:text-[var(--blue)] active:scale-95"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto bg-[#fafafc] p-5 sm:p-8">
              {loadingDetail ? (
                <div className="flex min-h-64 items-center justify-center gap-3 text-[15px] text-[var(--muted)]" role="status">
                  <Loader2 size={21} className="animate-spin text-[var(--blue)]" aria-hidden="true" />
                  กำลังโหลดรายละเอียด…
                </div>
              ) : selectedDetection ? (
                <div className="mx-auto flex max-w-[780px] flex-col gap-6">
                  <div className="overflow-hidden rounded-[18px] border border-[var(--line)] bg-white">
                    <ProtectedDetectionImage
                      detectionId={selectedDetection.id}
                      alt={`Detection ${selectedDetection.id} result`}
                      className="h-auto max-h-[420px] w-full object-contain"
                    />
                  </div>

                  {clipUrl && (
                    <div className="overflow-hidden rounded-[18px] border border-[var(--line)] bg-black">
                      <video src={clipUrl} controls className="max-h-[420px] w-full" aria-label="Violation evidence clip" />
                    </div>
                  )}

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="rounded-[18px] border border-[var(--line)] bg-white p-5">
                      <p className="text-[13px] text-[var(--muted)]">Date &amp; time</p>
                      <p className="mt-2 text-[17px] font-semibold text-[var(--ink)]">{new Date(selectedDetection.created_at).toLocaleString('th-TH')}</p>
                    </div>
                    <div className="rounded-[18px] border border-[var(--line)] bg-white p-5">
                      <p className="text-[13px] text-[var(--muted)]">Reference ID</p>
                      <p className="mt-2 text-[24px] font-semibold tracking-[-0.02em] text-[var(--ink)]">DET-{String(selectedDetection.id).padStart(5, '0')}</p>
                    </div>
                  </div>

                  <div className="rounded-[18px] border border-[var(--line)] bg-white p-5 sm:p-6">
                    <p className="mb-4 text-[14px] font-semibold text-[var(--ink)]">Violation type</p>
                    <div className="flex flex-wrap gap-2">
                      {(selectedDetection.violations || [selectedAlert.alert_type]).map((violation, index) => (
                        <span key={`${violation}-${index}`} className="rounded-full border border-[#f0c3c8] bg-[#fff8f8] px-4 py-2 text-[13px] font-semibold text-[#d70015]">
                          {violation.toUpperCase().includes('HELMET') ? 'Missing helmet' : violation.toUpperCase().includes('VEST') ? 'Missing vest' : violation}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-[18px] border border-[var(--line)] bg-white p-5 sm:p-6">
                    <p className="mb-3 text-[14px] font-semibold text-[var(--ink)]">Message</p>
                    <p className="rounded-[11px] bg-[#f5f5f7] px-5 py-4 text-[15px] leading-relaxed text-[var(--ink)]">
                      {(() => {
                        const types = selectedDetection.violations?.length
                          ? selectedDetection.violations
                          : selectedAlert.alert_type
                            ? [selectedAlert.alert_type]
                            : []
                        if (types.length > 0) return `ตรวจพบ: ${types.join(' และ ')}`
                        return selectedDetection.summary?.message || selectedAlert.message || '—'
                      })()}
                    </p>
                  </div>

                  <div className="overflow-hidden rounded-[18px] border border-[var(--line)] bg-white">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] bg-[#f5f5f7] px-5 py-4 sm:px-6">
                      <p className="text-[14px] font-semibold text-[var(--ink)]">Detailed breakdown</p>
                      <span className="rounded-full bg-white px-3 py-1.5 text-[12px] text-[var(--muted)]">{selectedDetection.person_count} people detected</span>
                    </div>
                    <div className="space-y-3 p-5 sm:p-6">
                      {selectedDetection.persons?.filter((person) => !person.is_compliant).map((person) => (
                        <div key={person.id} className="rounded-[18px] border border-[#f0c3c8] bg-[#fff8f8] p-4">
                          <p className="text-[15px] font-semibold text-[#d70015]">Person {person.id} · Violation</p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {person.not_wearing?.map((item, index) => (
                              <span key={`${item}-${index}`} className="rounded-full bg-white px-3 py-1.5 text-[12px] text-[var(--muted)]">Missing {item}</span>
                            ))}
                          </div>
                        </div>
                      ))}
                      <p className="pt-1 text-[14px] text-[var(--muted)]">+ {selectedDetection.persons?.filter((person) => person.is_compliant).length ?? 0} person(s) fully compliant</p>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button type="button" onClick={closeDetail} className="btn-apple-primary !min-h-11 px-6 active:scale-95">Close</button>
                  </div>
                </div>
              ) : (
                <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-center" role="alert">
                  <AlertTriangle size={28} className="text-[#d70015]" strokeWidth={1.6} aria-hidden="true" />
                  <p className="text-[17px] font-semibold text-[var(--ink)]">ไม่พบข้อมูล detection</p>
                </div>
              )}
            </div>
          </section>
        </div>
      )}
    </Layout>
  )
}
