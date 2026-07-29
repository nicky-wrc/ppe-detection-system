import { useCallback, useEffect, useState } from 'react'
import { Layout } from '../components/layout/Layout'
import { detectionService } from '../services/detection'
import type { Detection } from '../types'
import toast from 'react-hot-toast'
import { saveDetectionPdf } from '../utils/detectionPdfReport'
import { ProtectedDetectionImage } from '../components/ui/ProtectedDetectionImage'
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  ChevronLeft,
  ChevronRight,
  X,
  Users,
  FileText,
  Download,
  Eye,
  ShieldCheck,
} from 'lucide-react'

export function HistoryPage() {
  const [detections, setDetections] = useState<Detection[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [selectedDetection, setSelectedDetection] = useState<Detection | null>(null)

  const loadHistory = useCallback(async () => {
    setLoading(true)
    try {
      const data = await detectionService.getHistory(page, 12)
      setDetections(data.items || [])
      setTotalPages(data.total_pages || 1)
      setTotal(data.total || 0)
    } catch (error) {
      console.error('Error loading history:', error)
    } finally {
      setLoading(false)
    }
  }, [page])

  useEffect(() => { loadHistory() }, [loadHistory])

  const violationCount = detections.filter(d => d.has_violation).length
  const complianceCount = detections.filter(d => !d.has_violation).length

  const handleDownloadPdf = async (detectionId: number) => {
    try {
      const detection = await detectionService.getDetection(detectionId)
      await saveDetectionPdf(detection, () => detectionService.getResultMediaBlob(detectionId))
      toast.success('ดาวน์โหลดรายงาน PDF แล้ว')
    } catch (error) {
      console.error('PDF generation failed:', error)
      toast.error('ไม่สามารถสร้างหรือดาวน์โหลด PDF ได้ กรุณาลองใหม่')
    }
  }

  if (loading && detections.length === 0) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="flex flex-col items-center gap-4">
            <div className="w-9 h-9 border-2 border-[#e2e8f0] border-t-[#3b82f6] rounded-full animate-spin" />
            <span className="text-[13px] text-[#94a3b8] font-medium tracking-wide">Loading records...</span>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      {/* ── Page wrapper with generous padding ── */}
      <div className="flex flex-col gap-8 max-w-[1140px] mx-auto px-4 sm:px-6 py-4">

        {/* ── Header ── */}
        <div className="flex flex-col gap-2 pt-2">
          <h1 className="flex items-center gap-3.5 text-[22px] font-semibold text-[#0f172a] m-0 leading-tight">
            <span className="inline-flex items-center justify-center w-11 h-11 rounded-2xl bg-[#eff6ff] border border-[#dbeafe] shrink-0">
              <ShieldCheck size={20} className="text-[#2563eb]" strokeWidth={1.8} />
            </span>
            Safety Reports &amp; Analytics
          </h1>
          <p className="text-[13.5px] text-[#64748b] m-0 pl-[58px] leading-relaxed">
            Detection history and safety compliance records
          </p>
        </div>

        {/* ── Stat cards (spacing / typography match DashboardPage metric cards) ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">

          <div
            className="bg-white border border-[#e2e8f0] rounded-[16px] shadow-sm min-h-[118px] flex flex-col justify-between p-8 box-border text-left"
          >
            <div className="flex items-start justify-between gap-3">
              <p className="text-[13px] text-[#64748b] font-medium m-0 leading-snug">Total Violations</p>
              <AlertTriangle size={18} className="text-[#94a3b8] shrink-0" strokeWidth={2} />
            </div>
            <div className="mt-2 flex flex-col gap-0.5">
              <p className="text-[34px] font-extrabold text-[#0f172a] m-0 leading-none tracking-tight tabular-nums">
                {violationCount.toLocaleString()}
              </p>
              <p className="text-[12px] text-[#94a3b8] font-medium m-0 pt-0.5">This page</p>
            </div>
          </div>

          <div
            className="bg-white border border-[#e2e8f0] rounded-[16px] shadow-sm min-h-[118px] flex flex-col justify-between p-8 box-border text-left"
          >
            <div className="flex items-start justify-between gap-3">
              <p className="text-[13px] text-[#64748b] font-medium m-0 leading-snug">Compliant</p>
              <CheckCircle size={18} className="text-[#94a3b8] shrink-0" strokeWidth={2} />
            </div>
            <div className="mt-2 flex flex-col gap-0.5">
              <p className="text-[34px] font-extrabold text-[#0f172a] m-0 leading-none tracking-tight tabular-nums">
                {complianceCount.toLocaleString()}
              </p>
              <p className="text-[12px] text-[#94a3b8] font-medium m-0 pt-0.5">This page</p>
            </div>
          </div>

          <div
            className="bg-white border border-[#e2e8f0] rounded-[16px] shadow-sm min-h-[118px] flex flex-col justify-between p-8 box-border text-left"
          >
            <div className="flex items-start justify-between gap-3">
              <p className="text-[13px] text-[#64748b] font-medium m-0 leading-snug">Total Records</p>
              <FileText size={18} className="text-[#94a3b8] shrink-0" strokeWidth={2} />
            </div>
            <div className="mt-2 flex flex-col gap-0.5">
              <p className="text-[34px] font-extrabold text-[#0f172a] m-0 leading-none tracking-tight tabular-nums">
                {total.toLocaleString()}
              </p>
              <p className="text-[12px] text-[#94a3b8] font-medium m-0 pt-0.5">All time</p>
            </div>
          </div>

        </div>

        {/* ── Table card ── */}
        {detections.length === 0 && !loading ? (
          <div className="bg-white rounded-2xl border border-[#e2e8f0] py-24 flex flex-col items-center gap-4 shadow-sm">
            <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-[#f8fafc] border border-[#e2e8f0]">
              <Clock size={28} className="text-[#cbd5e1]" />
            </div>
            <p className="text-[15px] font-semibold text-[#475569] m-0">No detection records yet</p>
            <p className="text-[13px] text-[#94a3b8] m-0 text-center max-w-[280px] leading-relaxed">
              Detection results will appear here after running the system.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-[#e2e8f0] overflow-hidden shadow-sm">

            {/* Top bar */}
            <div className="flex items-center justify-between px-7 py-5 border-b border-[#f1f5f9]">
              <h2 className="text-[15px] font-semibold text-[#0f172a] m-0">Detection records</h2>
              <span className="text-[12px] text-[#64748b] bg-[#f8fafc] border border-[#e2e8f0] rounded-lg px-3.5 py-2 font-medium">
                {total} total
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-[#f8fafc]">
                    {[
                      { label: 'Thumbnail', w: 'w-[100px]' },
                      { label: 'Date & time', w: 'min-w-[180px]' },
                      { label: 'Persons', w: 'w-[100px]' },
                      { label: 'Violations', w: '' },
                      { label: 'Status', w: 'w-[130px]' },
                      { label: 'Actions', w: 'w-[110px]' },
                    ].map(col => (
                      <th
                        key={col.label}
                        className={`px-6 py-4 text-left text-[10.5px] font-semibold text-[#94a3b8] uppercase tracking-widest border-b border-[#f1f5f9] ${col.w}`}
                      >
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {detections.map((detection, idx) => (
                    <tr
                      key={detection.id}
                      className="group transition-colors duration-100 hover:bg-[#f8faff]"
                      style={{ backgroundColor: idx % 2 !== 0 ? '#fafbfc' : '#ffffff' }}
                    >
                      {/* Thumbnail */}
                      <td className="px-6 py-4 border-b border-[#f1f5f9] align-middle">
                        <div className="w-13 h-13 rounded-xl overflow-hidden border border-[#e2e8f0] bg-[#f8fafc] shrink-0" style={{ width: 52, height: 52 }}>
                          <ProtectedDetectionImage
                            detectionId={detection.id}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        </div>
                      </td>

                      {/* Date */}
                      <td className="px-6 py-4 border-b border-[#f1f5f9] align-middle whitespace-nowrap">
                        <span className="text-[13.5px] font-medium text-[#334155] leading-relaxed">
                          {new Date(detection.created_at).toLocaleString('en-GB', {
                            day: '2-digit', month: 'short', year: 'numeric',
                            hour: '2-digit', minute: '2-digit',
                          })}
                        </span>
                      </td>

                      {/* Persons */}
                      <td className="px-6 py-4 border-b border-[#f1f5f9] align-middle">
                        <span className="inline-flex items-center gap-2 text-[13.5px] text-[#334155]">
                          <Users size={14} className="text-[#94a3b8]" strokeWidth={1.8} />
                          <span className="font-semibold text-[#0f172a]">{detection.person_count}</span>
                        </span>
                      </td>

                      {/* Violations */}
                      <td className="px-6 py-4 border-b border-[#f1f5f9] align-middle">
                        {detection.violations && detection.violations.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {detection.violations.slice(0, 2).map((v, i) => (
                              <span
                                key={i}
                                className="inline-flex items-center px-3 py-1.5 rounded-lg bg-[#fff1f2] border border-[#fecaca] text-[#e11d48] text-[11.5px] font-semibold leading-none"
                              >
                                {v}
                              </span>
                            ))}
                            {detection.violations.length > 2 && (
                              <span className="inline-flex items-center px-3 py-1.5 rounded-lg bg-[#f1f5f9] text-[#64748b] text-[11.5px] font-medium leading-none">
                                +{detection.violations.length - 2} more
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[#cbd5e1] text-[15px]">—</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4 border-b border-[#f1f5f9] align-middle">
                        {detection.has_violation ? (
                          <span className="inline-flex items-center gap-2 text-[12.5px] font-semibold text-[#e11d48]">
                            <span className="w-2 h-2 rounded-full bg-[#e11d48] shrink-0" />
                            Violation
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-2 text-[12.5px] font-semibold text-[#16a34a]">
                            <span className="w-2 h-2 rounded-full bg-[#22c55e] shrink-0" />
                            Compliant
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 border-b border-[#f1f5f9] align-middle">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={e => { e.stopPropagation(); void handleDownloadPdf(detection.id) }}
                            title="Download PDF"
                            className="flex items-center justify-center w-9 h-9 rounded-xl border border-[#e2e8f0] bg-white text-[#64748b] hover:bg-[#eff6ff] hover:text-[#2563eb] hover:border-[#bfdbfe] transition-all duration-150 cursor-pointer"
                          >
                            <Download size={14} strokeWidth={1.8} />
                          </button>
                          <button
                            onClick={e => { e.stopPropagation(); setSelectedDetection(detection) }}
                            title="View Detail"
                            className="flex items-center justify-center w-9 h-9 rounded-xl border border-[#e2e8f0] bg-white text-[#64748b] hover:bg-[#eff6ff] hover:text-[#2563eb] hover:border-[#bfdbfe] transition-all duration-150 cursor-pointer"
                          >
                            <Eye size={14} strokeWidth={1.8} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-7 py-5 border-t border-[#f1f5f9]">
                <span className="text-[12.5px] text-[#94a3b8]">
                  Page <span className="font-semibold text-[#475569]">{page}</span> of {totalPages}
                </span>
                <div className="flex items-center gap-2.5">
                  <button
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page === 1}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[13px] font-medium border border-[#e2e8f0] bg-white text-[#475569] hover:bg-[#f8fafc] disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150 cursor-pointer"
                  >
                    <ChevronLeft size={14} strokeWidth={2} />
                    Previous
                  </button>
                  <button
                    onClick={() => setPage(Math.min(totalPages, page + 1))}
                    disabled={page === totalPages}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[13px] font-medium border border-[#e2e8f0] bg-white text-[#475569] hover:bg-[#f8fafc] disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150 cursor-pointer"
                  >
                    Next
                    <ChevronRight size={14} strokeWidth={2} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Detail Modal ── */}
      {selectedDetection && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <div
            className="absolute inset-0 bg-[rgba(15,23,42,0.55)] backdrop-blur-[2px]"
            onClick={() => setSelectedDetection(null)}
          />
          <div className="relative w-full max-w-[900px] max-h-[92vh] bg-white rounded-3xl border border-[#e2e8f0] shadow-[0_40px_100px_rgba(15,23,42,0.25)] overflow-hidden flex flex-col">

            {/* Modal Header */}
            <div className="flex items-center justify-between px-8 py-6 border-b border-[#f1f5f9] shrink-0">
              <div className="flex items-center gap-3">
                <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-[#eff6ff] border border-[#dbeafe] shrink-0">
                  <FileText size={16} className="text-[#2563eb]" strokeWidth={1.8} />
                </span>
                <h2 className="text-[17px] font-semibold text-[#0f172a] m-0 leading-tight">Detection detail</h2>
              </div>
              <button
                onClick={() => setSelectedDetection(null)}
                className="flex items-center justify-center w-9 h-9 rounded-xl border border-[#e2e8f0] bg-transparent text-[#94a3b8] hover:bg-[#f1f5f9] hover:text-[#475569] transition-all duration-150 cursor-pointer shrink-0"
              >
                <X size={15} strokeWidth={2} />
              </button>
            </div>

            {/* Modal Body — scrollable */}
            <div className="overflow-y-auto flex-1">
              <div className="px-8 py-7 flex flex-col gap-6">

                {/* Detection Image */}
                <div className="rounded-2xl overflow-hidden border border-[#e2e8f0] bg-[#f8fafc]">
                  <ProtectedDetectionImage
                    detectionId={selectedDetection.id}
                    alt="Detection result"
                    className="w-full max-h-[380px] object-contain"
                  />
                </div>

                {/* Date + Ref */}
                <div className="grid grid-cols-2 gap-5">
                  <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-2xl px-6 py-5">
                    <p className="text-[10.5px] font-semibold text-[#94a3b8] uppercase tracking-widest m-0 mb-3 leading-none">
                      Date &amp; time
                    </p>
                    <p className="text-[15.5px] font-semibold text-[#0f172a] m-0 leading-snug">
                      {new Date(selectedDetection.created_at).toLocaleString('th-TH')}
                    </p>
                  </div>
                  <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-2xl px-6 py-5">
                    <p className="text-[10.5px] font-semibold text-[#94a3b8] uppercase tracking-widest m-0 mb-3 leading-none">
                      Reference ID
                    </p>
                    <p className="text-[24px] font-bold text-[#0f172a] m-0 tracking-tight leading-none">
                      DET-{String(selectedDetection.id).padStart(5, '0')}
                    </p>
                  </div>
                </div>

                {/* Summary block */}
                <div className="border border-[#e2e8f0] rounded-2xl overflow-hidden">
                  <div className="flex items-center justify-between px-6 py-4 bg-[#f8fafc] border-b border-[#e2e8f0]">
                    <p className="text-[10.5px] font-semibold text-[#94a3b8] uppercase tracking-widest m-0 leading-none">
                      Summary
                    </p>
                    <span className={`text-[11.5px] font-semibold px-3.5 py-1.5 rounded-lg leading-none ${
                      selectedDetection.has_violation
                        ? 'bg-[#fff1f2] text-[#e11d48] border border-[#fecaca]'
                        : 'bg-[#f0fdf4] text-[#16a34a] border border-[#bbf7d0]'
                    }`}>
                      {selectedDetection.has_violation ? '● Violation detected' : '● All compliant'}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 divide-x divide-[#f1f5f9]">
                    {[
                      { label: 'Persons detected', value: String(selectedDetection.person_count), color: '' },
                      {
                        label: 'Violations',
                        value: String(selectedDetection.violation_count),
                        color: selectedDetection.violation_count > 0 ? 'text-[#e11d48]' : 'text-[#16a34a]',
                      },
                      {
                        label: 'Processing time',
                        value: selectedDetection.processing_time_ms != null
                          ? `${selectedDetection.processing_time_ms} ms`
                          : '—',
                        color: '',
                      },
                    ].map(s => (
                      <div key={s.label} className="px-6 py-6 text-center">
                        <p className="text-[10.5px] font-semibold text-[#94a3b8] uppercase tracking-widest m-0 mb-3 leading-none">
                          {s.label}
                        </p>
                        <p className={`text-[28px] font-bold m-0 leading-none tracking-tight ${s.color || 'text-[#0f172a]'}`}>
                          {s.value}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Violation types */}
                {selectedDetection.violations && selectedDetection.violations.length > 0 && (
                  <div className="bg-white border border-[#e2e8f0] rounded-2xl px-6 py-5">
                    <p className="text-[10.5px] font-semibold text-[#94a3b8] uppercase tracking-widest m-0 mb-4 leading-none">
                      Violation types
                    </p>
                    <div className="flex flex-wrap gap-2.5">
                      {selectedDetection.violations.map((v, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center px-3.5 py-2 rounded-xl bg-[#fff1f2] border border-[#fecaca] text-[#e11d48] text-[12px] font-semibold leading-none"
                        >
                          {v.toUpperCase().includes('HELMET') ? 'Missing helmet'
                            : v.toUpperCase().includes('VEST') ? 'Missing vest'
                            : v}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Person breakdown */}
                {selectedDetection.persons && selectedDetection.persons.length > 0 && (
                  <div className="bg-white border border-[#e2e8f0] rounded-2xl overflow-hidden">
                    <div className="flex items-center justify-between px-6 py-4 bg-[#f8fafc] border-b border-[#e2e8f0]">
                      <p className="text-[10.5px] font-semibold text-[#94a3b8] uppercase tracking-widest m-0 leading-none">
                        Person breakdown
                      </p>
                      <span className="text-[11.5px] font-semibold px-3.5 py-1.5 rounded-lg bg-[#f1f5f9] text-[#475569] border border-[#e2e8f0] leading-none">
                        {selectedDetection.person_count} total
                      </span>
                    </div>
                    <div className="px-6 py-5 flex flex-col gap-3">
                      {selectedDetection.persons.filter(p => !p.is_compliant).map(person => (
                        <div
                          key={person.id}
                          className="flex items-start gap-4 rounded-2xl border border-[#fecaca] bg-[#fff9f9] px-5 py-4"
                        >
                          <span className="flex items-center justify-center w-7 h-7 rounded-full bg-[#fee2e2] text-[#e11d48] text-[12px] font-bold shrink-0 mt-0.5">
                            {person.id}
                          </span>
                          <div className="flex flex-col gap-2.5 min-w-0">
                            <p className="text-[13.5px] font-semibold text-[#e11d48] m-0 leading-none">Violation detected</p>
                            <div className="flex flex-wrap gap-2">
                              {person.not_wearing?.map((item, idx) => (
                                <span
                                  key={idx}
                                  className="text-[12px] text-[#64748b] bg-[#f1f5f9] border border-[#e2e8f0] px-2.5 py-1 rounded-lg leading-none"
                                >
                                  × Missing {item}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}
                      {selectedDetection.persons.filter(p => p.is_compliant).length > 0 && (
                        <p className="text-[13px] text-[#94a3b8] m-0 pt-1 leading-relaxed">
                          + {selectedDetection.persons.filter(p => p.is_compliant).length} person(s) fully compliant
                        </p>
                      )}
                    </div>
                  </div>
                )}

              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 px-8 py-6 border-t border-[#f1f5f9] bg-[#fafbfc] shrink-0">
              <button
                onClick={() => setSelectedDetection(null)}
                className="px-6 py-3 rounded-xl text-[13.5px] font-medium text-[#475569] border border-[#e2e8f0] bg-white hover:bg-[#f8fafc] transition-all duration-150 cursor-pointer leading-none"
              >
                Close
              </button>
              <button
                onClick={() => void handleDownloadPdf(selectedDetection.id)}
                className="flex items-center gap-2 px-6 py-3 rounded-xl text-[13.5px] font-semibold bg-[#2563eb] text-white border-none hover:bg-[#1d4ed8] transition-all duration-150 cursor-pointer leading-none shadow-sm shadow-blue-200"
              >
                <Download size={14} strokeWidth={2} />
                Download PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
