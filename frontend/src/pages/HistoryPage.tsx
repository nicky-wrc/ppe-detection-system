import { useEffect, useState } from 'react'
import { Layout } from '../components/layout/Layout'
import { detectionService } from '../services/detection'
import type { Detection } from '../types'
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
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react'

export function HistoryPage() {
  const [detections, setDetections] = useState<Detection[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [selectedDetection, setSelectedDetection] = useState<Detection | null>(null)

  useEffect(() => { loadHistory() }, [page])

  const loadHistory = async () => {
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
  }

  const violationCount = detections.filter(d => d.has_violation).length
  const complianceCount = detections.filter(d => !d.has_violation).length

  if (loading && detections.length === 0) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="flex flex-col items-center gap-[14px]">
            <div className="w-9 h-9 border-[3px] border-[#e5eaf0] border-t-[#2563eb] rounded-full animate-spin" />
            <span className="text-[14px] text-[#64748b] font-medium">Loading records...</span>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="flex flex-col gap-5">

        {/* ── Header ── */}
        <div>
          <h1 className="text-[22px] font-bold text-[#0f172a] m-0 mb-1 flex items-center gap-[10px]">
            <FileText size={22} color="#2563eb" />
            Safety Reports &amp; Analytics
          </h1>
          <p className="text-[13px] text-[#64748b] m-0">Detection history and safety compliance records</p>
        </div>

        {/* ── Summary stat cards ── */}
        <div className="grid grid-cols-3 gap-[14px]">
          {/* Violations */}
          <div className="bg-white border border-[#e5eaf0] rounded-2xl overflow-hidden shadow-[0_1px_4px_rgba(0,0,0,0.06)] px-6 py-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-[#fee2e2] flex items-center justify-center shrink-0">
              <AlertTriangle size={22} color="#dc2626" />
            </div>
            <div>
              <p className="text-[32px] font-bold text-[#0f172a] m-0 leading-none">{violationCount}</p>
              <p className="text-[12px] text-[#94a3b8] mt-1 font-medium">Total Violations</p>
            </div>
          </div>

          {/* Compliant */}
          <div className="bg-white border border-[#e5eaf0] rounded-2xl overflow-hidden shadow-[0_1px_4px_rgba(0,0,0,0.06)] px-6 py-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-[#dcfce7] flex items-center justify-center shrink-0">
              <CheckCircle size={22} color="#16a34a" />
            </div>
            <div>
              <p className="text-[32px] font-bold text-[#0f172a] m-0 leading-none">{complianceCount}</p>
              <p className="text-[12px] text-[#94a3b8] mt-1 font-medium">Compliant</p>
            </div>
          </div>

          {/* Total Records */}
          <div className="bg-white border border-[#e5eaf0] rounded-2xl overflow-hidden shadow-[0_1px_4px_rgba(0,0,0,0.06)] px-6 py-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-[#dbeafe] flex items-center justify-center shrink-0">
              <FileText size={22} color="#2563eb" />
            </div>
            <div>
              <p className="text-[32px] font-bold text-[#0f172a] m-0 leading-none">{total}</p>
              <p className="text-[12px] text-[#94a3b8] mt-1 font-medium">Total Records</p>
            </div>
          </div>
        </div>

        {/* ── Detection Records Table ── */}
        {detections.length === 0 && !loading ? (
          <div className="bg-white border border-[#e5eaf0] rounded-2xl overflow-hidden shadow-[0_1px_4px_rgba(0,0,0,0.06)] py-[60px] px-5 text-center">
            <Clock size={40} color="#cbd5e1" className="mx-auto mb-3" />
            <p className="text-[15px] font-semibold text-[#475569] m-0 mb-[6px]">No detection records yet</p>
            <p className="text-[13px] text-[#94a3b8] m-0">Detection results will appear here after running the system.</p>
          </div>
        ) : (
          <div className="bg-white border border-[#e5eaf0] rounded-2xl overflow-hidden shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
            {/* Table header bar */}
            <div className="flex items-center justify-between px-5 py-[14px] border-b border-[#e5eaf0]">
              <h2 className="text-[14px] font-semibold text-[#0f172a] m-0">Detection Records</h2>
              <span className="text-[12px] text-[#94a3b8]">{total} records</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    {['Thumbnail', 'Date & Time', 'Persons', 'Violations', 'Status', 'Actions'].map(col => (
                      <th
                        key={col}
                        className="px-4 py-[11px] text-[11px] font-semibold text-[#94a3b8] uppercase tracking-[0.06em] text-left bg-[#f8fafc] border-b border-[#e5eaf0]"
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {detections.map((detection, idx) => (
                    <tr
                      key={detection.id}
                      style={{ backgroundColor: idx % 2 === 0 ? '#ffffff' : '#fafbfc', cursor: 'pointer' }}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f0f6ff')}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = idx % 2 === 0 ? '#ffffff' : '#fafbfc')}
                    >
                      {/* Thumbnail */}
                      <td className="px-4 py-3 text-[13px] text-[#334155] border-b border-[#f1f5f9] align-middle">
                        <div className="w-14 h-14 rounded-lg overflow-hidden border border-[#e5eaf0] bg-[#f1f5f9] shrink-0">
                          <img
                            src={detectionService.getResultImageUrl(detection.id)}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        </div>
                      </td>

                      {/* Date & Time */}
                      <td className="px-4 py-3 text-[13px] text-[#334155] border-b border-[#f1f5f9] align-middle">
                        {new Date(detection.created_at).toLocaleString('en-GB', {
                          day: '2-digit', month: 'short', year: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </td>

                      {/* Persons */}
                      <td className="px-4 py-3 text-[13px] text-[#334155] border-b border-[#f1f5f9] align-middle">
                        <span className="inline-flex items-center gap-[5px]">
                          <Users size={14} color="#94a3b8" />
                          <span className="font-semibold text-[#0f172a]">{detection.person_count}</span>
                        </span>
                      </td>

                      {/* Violations chips */}
                      <td className="px-4 py-3 text-[13px] text-[#334155] border-b border-[#f1f5f9] align-middle">
                        {detection.violations && detection.violations.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {detection.violations.slice(0, 2).map((v, i) => (
                              <span key={i} className="px-2 py-[2px] bg-[#fee2e2] text-[#dc2626] text-[11px] font-semibold rounded-md border border-[#fecaca]">
                                {v}
                              </span>
                            ))}
                            {detection.violations.length > 2 && (
                              <span className="px-2 py-[2px] bg-[#f1f5f9] text-[#64748b] text-[11px] rounded-md">
                                +{detection.violations.length - 2}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[12px] text-[#cbd5e1]">—</span>
                        )}
                      </td>

                      {/* Status badge */}
                      <td className="px-4 py-3 text-[13px] text-[#334155] border-b border-[#f1f5f9] align-middle">
                        {detection.has_violation ? (
                          <span className="inline-flex items-center gap-[5px] px-[10px] py-1 bg-[#fee2e2] text-[#dc2626] text-[12px] font-semibold rounded-lg border border-[#fecaca]">
                            <ShieldAlert size={13} /> Violation
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-[5px] px-[10px] py-1 bg-[#dcfce7] text-[#16a34a] text-[12px] font-semibold rounded-lg border border-[#bbf7d0]">
                            <ShieldCheck size={13} /> Compliant
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-[13px] text-[#334155] border-b border-[#f1f5f9] align-middle">
                        <div className="flex items-center gap-[6px]">
                          <button
                            onClick={e => { e.stopPropagation(); window.open(detectionService.getResultImageUrl(detection.id), '_blank') }}
                            title="Download"
                            className="flex items-center justify-center w-8 h-8 rounded-lg border border-[#e5eaf0] bg-[#f8fafc] text-[#64748b] cursor-pointer hover:bg-[#eff6ff] hover:text-[#2563eb] transition-colors"
                          >
                            <Download size={14} />
                          </button>
                          <button
                            onClick={e => { e.stopPropagation(); setSelectedDetection(detection) }}
                            title="View Detail"
                            className="flex items-center justify-center w-8 h-8 rounded-lg border border-[#e5eaf0] bg-[#f8fafc] text-[#64748b] cursor-pointer hover:bg-[#eff6ff] hover:text-[#2563eb] transition-colors"
                          >
                            <Eye size={14} />
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
              <div className="flex items-center justify-center gap-2 px-5 py-[14px] border-t border-[#f1f5f9]">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="flex items-center justify-center w-8 h-8 rounded-lg border border-[#e5eaf0] bg-white text-[#64748b] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="text-[13px] font-medium text-[#475569] px-[14px] py-[6px] bg-[#f8fafc] rounded-lg border border-[#e5eaf0]">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  className="flex items-center justify-center w-8 h-8 rounded-lg border border-[#e5eaf0] bg-white text-[#64748b] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Detail Modal ── */}
        {selectedDetection && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-[rgba(15,23,42,0.5)] backdrop-blur-sm"
              onClick={() => setSelectedDetection(null)}
            />
            {/* Modal */}
            <div className="relative bg-white rounded-[20px] border border-[#e5eaf0] shadow-[0_20px_60px_rgba(0,0,0,0.15)] w-full max-w-[680px] max-h-[90vh] flex flex-col overflow-hidden">
              {/* Modal header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-[#f1f5f9]">
                <h2 className="text-[15px] font-bold text-[#0f172a] m-0">Detection Detail</h2>
                <button
                  onClick={() => setSelectedDetection(null)}
                  className="flex items-center justify-center w-8 h-8 rounded-lg border-none bg-[#f1f5f9] text-[#64748b] cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="overflow-y-auto p-5 flex flex-col gap-4">
                {/* Result image */}
                <div className="rounded-xl overflow-hidden border border-[#e5eaf0] bg-[#f8fafc]">
                  <img
                    src={detectionService.getResultImageUrl(selectedDetection.id)}
                    alt="Result"
                    className="w-full object-contain"
                    style={{ maxHeight: '45vh' }}
                  />
                </div>

                {/* Status banner */}
                <div className={`flex items-center gap-[10px] px-4 py-[14px] rounded-xl border ${selectedDetection.has_violation ? 'bg-[#fff1f2] border-[#fecaca]' : 'bg-[#f0fdf4] border-[#bbf7d0]'}`}>
                  {selectedDetection.has_violation
                    ? <AlertTriangle size={20} color="#dc2626" className="shrink-0" />
                    : <CheckCircle size={20} color="#16a34a" className="shrink-0" />
                  }
                  <div>
                    <p className={`text-[14px] font-bold m-0 mb-[2px] ${selectedDetection.has_violation ? 'text-[#dc2626]' : 'text-[#16a34a]'}`}>
                      {selectedDetection.has_violation ? 'Safety Violation Detected' : 'Fully Compliant — No Violations'}
                    </p>
                    <p className="text-[12px] text-[#64748b] m-0">
                      {new Date(selectedDetection.created_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-3 gap-[10px]">
                  {[
                    { icon: <Users size={18} color="#2563eb" />, label: 'Persons', value: selectedDetection.person_count, valueColor: '#0f172a' },
                    { icon: <AlertTriangle size={18} color={selectedDetection.violation_count > 0 ? '#dc2626' : '#94a3b8'} />, label: 'Violations', value: selectedDetection.violation_count, valueColor: selectedDetection.violation_count > 0 ? '#dc2626' : '#0f172a' },
                    { icon: <Clock size={18} color="#0ea5e9" />, label: 'Processing', value: `${selectedDetection.processing_time_ms ?? '—'}ms`, valueColor: '#0f172a' },
                  ].map((s, i) => (
                    <div key={i} className="bg-[#f8fafc] border border-[#e5eaf0] rounded-[10px] p-[14px] text-center">
                      <div className="flex justify-center mb-[6px]">{s.icon}</div>
                      <p className="text-[22px] font-bold m-0 mb-[2px]" style={{ color: s.valueColor }}>{s.value}</p>
                      <p className="text-[11px] text-[#94a3b8] m-0 font-medium">{s.label}</p>
                    </div>
                  ))}
                </div>

                {/* Violations list */}
                {selectedDetection.violations && selectedDetection.violations.length > 0 && (
                  <div>
                    <p className="text-[12px] font-semibold text-[#64748b] uppercase tracking-[0.06em] m-0 mb-2">Violations Found</p>
                    <div className="flex flex-wrap gap-[6px]">
                      {selectedDetection.violations.map((v, i) => (
                        <span key={i} className="px-3 py-1 bg-[#fee2e2] text-[#dc2626] text-[12px] font-semibold rounded-lg border border-[#fecaca]">
                          {v}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Per-person breakdown */}
                {selectedDetection.persons && selectedDetection.persons.length > 0 && (
                  <div>
                    <p className="text-[12px] font-semibold text-[#64748b] uppercase tracking-[0.06em] m-0 mb-2">Per-Person PPE Status</p>
                    <div className="flex flex-col gap-2">
                      {selectedDetection.persons.map((person) => (
                        <div
                          key={person.id}
                          className={`flex items-start justify-between px-[14px] py-[10px] rounded-[10px] border ${person.is_compliant ? 'bg-[#f0fdf4] border-[#bbf7d0]' : 'bg-[#fff1f2] border-[#fecaca]'}`}
                        >
                          <div>
                            <p className="text-[13px] font-semibold text-[#0f172a] m-0 mb-1">Person {person.id}</p>
                            <div className="flex flex-wrap gap-1">
                              {person.wearing?.map((item, i) => (
                                <span key={`w${i}`} className="text-[11px] text-[#16a34a] flex items-center gap-[3px]">
                                  <CheckCircle size={11} /> {item}
                                </span>
                              ))}
                              {person.not_wearing?.map((item, i) => (
                                <span key={`nw${i}`} className="text-[11px] text-[#dc2626] flex items-center gap-[3px]">
                                  <X size={11} /> {item}
                                </span>
                              ))}
                            </div>
                          </div>
                          <span className={`text-[11px] font-semibold px-2 py-[2px] rounded-md shrink-0 ${person.is_compliant ? 'bg-[#dcfce7] text-[#16a34a]' : 'bg-[#fee2e2] text-[#dc2626]'}`}>
                            {Math.round(person.confidence * 100)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

      </div>
    </Layout>
  )
}
