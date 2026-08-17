import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle,
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

export function HistoryPage() {
  const [detections, setDetections] = useState<Detection[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [selectedDetection, setSelectedDetection] = useState<Detection | null>(null)
  const [downloadingId, setDownloadingId] = useState<number | null>(null)
  const historyRequestRef = useRef(0)
  const closeDetectionDetail = useCallback(() => setSelectedDetection(null), [])
  const detectionDialogRef = useDialogFocus<HTMLElement>(Boolean(selectedDetection), closeDetectionDetail)

  const loadHistory = useCallback(async () => {
    const requestId = historyRequestRef.current + 1
    historyRequestRef.current = requestId
    setLoading(true)
    setLoadError(false)
    try {
      const data = await detectionService.getHistory(page, 12)
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
  }, [page])

  useEffect(() => {
    void loadHistory()
    return () => {
      historyRequestRef.current += 1
    }
  }, [loadHistory])

  const violationCount = detections.filter((detection) => detection.has_violation).length
  const complianceCount = detections.filter((detection) => !detection.has_violation).length

  const handleDownloadPdf = async (detectionId: number) => {
    setDownloadingId(detectionId)
    try {
      const detection = await detectionService.getDetection(detectionId)
      await saveDetectionPdf(detection, () => detectionService.getResultMediaBlob(detectionId))
      toast.success('ดาวน์โหลดรายงาน PDF แล้ว')
    } catch (error) {
      console.error('PDF generation failed:', error)
      toast.error('ไม่สามารถสร้างหรือดาวน์โหลด PDF ได้ กรุณาลองใหม่')
    } finally {
      setDownloadingId(null)
    }
  }

  return (
    <Layout>
      <div className="mx-auto flex max-w-[1240px] flex-col gap-8 sm:gap-10">
        <header className="page-heading">
          <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-full bg-[var(--ink)] text-white" aria-hidden="true">
            <ShieldCheck size={20} strokeWidth={1.8} />
          </div>
          <h1>Safety Reports &amp; Analytics</h1>
          <p className="max-w-3xl !mt-3 !text-[17px] !leading-[1.47]">Detection history and safety compliance records.</p>
        </header>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-6" aria-label="Detection summary">
          {[
            { label: 'Violations', value: violationCount, note: 'On this page', icon: AlertTriangle, iconClassName: 'text-[#d70015]' },
            { label: 'Compliant', value: complianceCount, note: 'On this page', icon: CheckCircle, iconClassName: 'text-[#15803d]' },
            { label: 'Total records', value: total, note: 'All time', icon: FileText, iconClassName: 'text-[var(--muted)]' },
          ].map((stat) => (
            <div key={stat.label} className="surface-card min-h-40 p-6 sm:p-7">
              <div className="flex items-start justify-between gap-4">
                <p className="text-[14px] text-[var(--muted)]">{stat.label}</p>
                <stat.icon size={19} className={stat.iconClassName} strokeWidth={1.8} aria-hidden="true" />
              </div>
              <p className="mt-6 text-[40px] font-semibold leading-none tracking-[-0.04em] text-[var(--ink)] tabular-nums">{stat.value.toLocaleString()}</p>
              <p className="mt-2 text-[13px] text-[var(--muted)]">{stat.note}</p>
            </div>
          ))}
        </section>

        {loading && detections.length === 0 ? (
          <div className="surface-card flex min-h-72 items-center justify-center gap-3 text-[15px] text-[var(--muted)]" role="status">
            <Loader2 size={21} className="animate-spin text-[var(--blue)]" aria-hidden="true" />
            Loading records…
          </div>
        ) : loadError ? (
          <div className="surface-card flex min-h-72 flex-col items-center justify-center gap-4 px-6 text-center" role="alert">
            <AlertTriangle size={28} className="text-[#d70015]" strokeWidth={1.6} aria-hidden="true" />
            <p className="text-[21px] font-semibold tracking-[-0.01em] text-[var(--ink)]">Unable to load detection history</p>
            <p className="max-w-md text-[15px] leading-relaxed text-[var(--muted)]">Check the backend connection, then try loading the records again.</p>
            <button type="button" onClick={() => void loadHistory()} className="btn-apple-secondary !min-h-11 text-[var(--blue)]">Try again</button>
          </div>
        ) : detections.length === 0 ? (
          <div className="surface-card flex min-h-72 flex-col items-center justify-center gap-4 px-6 text-center">
            <Clock size={30} className="text-[var(--muted)]" strokeWidth={1.5} aria-hidden="true" />
            <p className="text-[21px] font-semibold tracking-[-0.01em] text-[var(--ink)]">No detection records yet</p>
            <p className="max-w-sm text-[15px] leading-relaxed text-[var(--muted)]">Detection results will appear here after the system processes media or a camera feed.</p>
          </div>
        ) : (
          <section className="surface-card overflow-hidden" aria-labelledby="records-title">
            <div className="flex min-h-16 items-center justify-between gap-4 border-b border-[var(--line)] px-6 sm:px-8">
              <h2 id="records-title" className="text-[21px] font-semibold tracking-[-0.01em] text-[var(--ink)]">Detection records</h2>
              <span className="shrink-0 rounded-full bg-[#f5f5f7] px-4 py-2 text-[13px] text-[var(--muted)]">{total.toLocaleString()} total</span>
            </div>

            <div className="overflow-x-auto">
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
                                {violation}
                              </span>
                            ))}
                            {detection.violations.length > 2 && (
                              <span className="inline-flex rounded-full bg-[#f5f5f7] px-3 py-1.5 text-[12px] text-[var(--muted)]">+{detection.violations.length - 2} more</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[var(--muted)]">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 align-middle">
                        <span className={`inline-flex items-center gap-2 text-[13px] font-semibold ${detection.has_violation ? 'text-[#d70015]' : 'text-[#15803d]'}`}>
                          <span className={`h-2 w-2 rounded-full ${detection.has_violation ? 'bg-[#d70015]' : 'bg-[#34c759]'}`} aria-hidden="true" />
                          {detection.has_violation ? 'Violation' : 'Compliant'}
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
            </div>

            {totalPages > 1 && (
              <div className="flex flex-col items-center justify-between gap-4 border-t border-[var(--line)] px-6 py-5 sm:flex-row sm:px-8">
                <span className="text-[14px] text-[var(--muted)]">Page <strong className="font-semibold text-[var(--ink)]">{page}</strong> of {totalPages}</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={loading || page === 1}
                    className="btn-apple-secondary !min-h-11 active:scale-95"
                  >
                    <ChevronLeft size={16} aria-hidden="true" />
                    Previous
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage(Math.min(totalPages, page + 1))}
                    disabled={loading || page === totalPages}
                    className="btn-apple-secondary !min-h-11 active:scale-95"
                  >
                    Next
                    <ChevronRight size={16} aria-hidden="true" />
                  </button>
                </div>
              </div>
            )}
          </section>
        )}
      </div>

      {selectedDetection && (
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
                        : 'border-[#b9dfc2] bg-[#f3fbf5] text-[#15803d]'
                    }`}>
                      {selectedDetection.has_violation ? 'Violation detected' : 'All compliant'}
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
                          {violation.toUpperCase().includes('HELMET') ? 'Missing helmet' : violation.toUpperCase().includes('VEST') ? 'Missing vest' : violation}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {selectedDetection.persons && selectedDetection.persons.length > 0 && (
                  <div className="overflow-hidden rounded-[18px] border border-[var(--line)]">
                    <div className="flex items-center justify-between gap-3 border-b border-[var(--line)] bg-[#f5f5f7] px-5 py-4 sm:px-6">
                      <p className="text-[14px] font-semibold text-[var(--ink)]">Person breakdown</p>
                      <span className="rounded-full bg-white px-3 py-1.5 text-[12px] text-[var(--muted)]">{selectedDetection.person_count} total</span>
                    </div>
                    <div className="space-y-3 p-5 sm:p-6">
                      {selectedDetection.persons.filter((person) => !person.is_compliant).map((person) => (
                        <div key={person.id} className="flex items-start gap-4 rounded-[18px] border border-[#f0c3c8] bg-[#fff8f8] p-4">
                          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#d70015] text-[12px] font-semibold text-white">{person.id}</span>
                          <div className="min-w-0">
                            <p className="text-[15px] font-semibold text-[#d70015]">Violation detected</p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {person.not_wearing?.map((item, index) => (
                                <span key={`${item}-${index}`} className="rounded-full bg-white px-3 py-1.5 text-[12px] text-[var(--muted)]">Missing {item}</span>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}
                      {selectedDetection.persons.filter((person) => person.is_compliant).length > 0 && (
                        <p className="pt-1 text-[14px] text-[var(--muted)]">+ {selectedDetection.persons.filter((person) => person.is_compliant).length} person(s) fully compliant</p>
                      )}
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
    </Layout>
  )
}
