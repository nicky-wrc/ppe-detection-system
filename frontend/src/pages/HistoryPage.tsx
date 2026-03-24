import { useCallback, useEffect, useState } from 'react'
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
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[#eff6ff] border border-[#dbeafe]">
              <FileText size={18} className="text-[#2563eb]" />
            </span>
            Safety Reports &amp; Analytics
          </h1>
          <p className="text-[13px] text-[#64748b] m-0">Detection history and safety compliance records</p>
        </div>

        {/* ── Summary stat cards ── */}
        <div className="grid grid-cols-3" style={{ gap: '24px' }}>
          {/* Violations */}
          <div className="bg-white border border-[#e2e8f0] rounded-[16px] shadow-sm min-h-[110px] flex flex-col justify-between" style={{ padding: '24px', boxSizing: 'border-box' }}>
            <div className="flex items-start justify-between">
              <p className="text-[13px] text-[#64748b] font-medium m-0">Total Violations</p>
              <AlertTriangle size={18} className="text-[#94a3b8]" strokeWidth={2} />
            </div>
            <div className="mt-2 text-left">
              <p className="text-[34px] font-extrabold text-[#0f172a] m-0 leading-[1] tracking-tight">{violationCount}</p>
            </div>
          </div>

          {/* Compliant */}
          <div className="bg-white border border-[#e2e8f0] rounded-[16px] shadow-sm min-h-[110px] flex flex-col justify-between" style={{ padding: '24px', boxSizing: 'border-box' }}>
            <div className="flex items-start justify-between">
              <p className="text-[13px] text-[#64748b] font-medium m-0">Compliant</p>
              <CheckCircle size={18} className="text-[#94a3b8]" strokeWidth={2} />
            </div>
            <div className="mt-2 text-left">
              <p className="text-[34px] font-extrabold text-[#0f172a] m-0 leading-[1] tracking-tight">{complianceCount}</p>
            </div>
          </div>

          {/* Total Records */}
          <div className="bg-white border border-[#e2e8f0] rounded-[16px] shadow-sm min-h-[110px] flex flex-col justify-between" style={{ padding: '24px', boxSizing: 'border-box' }}>
            <div className="flex items-start justify-between">
              <p className="text-[13px] text-[#64748b] font-medium m-0">Total Records</p>
              <FileText size={18} className="text-[#94a3b8]" strokeWidth={2} />
            </div>
            <div className="mt-2 text-left">
              <p className="text-[34px] font-extrabold text-[#0f172a] m-0 leading-[1] tracking-tight">{total}</p>
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
                    {['Thumbnail', 'Date & Time', 'Persons', 'Violations', 'Actions'].map(col => (
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
                          <Users size={14} className="text-[#94a3b8]" />
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
            <div className="relative bg-white rounded-[20px] border border-[#e5eaf0] shadow-[0_20px_60px_rgba(0,0,0,0.15)] w-full max-w-[720px] max-h-[90vh] flex flex-col overflow-hidden">
              {/* Modal header */}
              <div className="flex items-center justify-between border-b border-[#f1f5f9]" style={{ padding: '20px 24px' }}>
                <h2 className="text-[17px] font-bold text-[#0f172a] m-0">Detection Detail</h2>
                <button
                  onClick={() => setSelectedDetection(null)}
                  className="flex items-center justify-center w-8 h-8 rounded-lg border-none bg-[#f1f5f9] text-[#64748b] cursor-pointer hover:bg-[#e2e8f0] transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="overflow-y-auto flex flex-col" style={{ padding: '24px', gap: '24px' }}>
                {/* Result image */}
                <div className="rounded-xl overflow-hidden border border-[#e5eaf0] bg-[#f8fafc] flex items-center justify-center">
                  <img
                    src={detectionService.getResultImageUrl(selectedDetection.id)}
                    alt="Result"
                    className="w-full object-contain"
                    style={{ maxHeight: '45vh' }}
                  />
                </div>

                {/* Status banner */}
                <div className="flex items-center gap-[12px] rounded-xl border" style={{ padding: '16px 20px', backgroundColor: selectedDetection.has_violation ? '#fff1f2' : '#f0fdf4', borderColor: selectedDetection.has_violation ? '#fecaca' : '#bbf7d0' }}>
                  {selectedDetection.has_violation
                    ? <AlertTriangle size={24} color="#dc2626" className="shrink-0" />
                    : <CheckCircle size={24} color="#16a34a" className="shrink-0" />
                  }
                  <div>
                    <p className="text-[15px] font-bold m-0 mb-[2px]" style={{ color: selectedDetection.has_violation ? '#dc2626' : '#16a34a' }}>
                      {selectedDetection.has_violation ? 'Safety Violation Detected' : 'Fully Compliant — No Violations'}
                    </p>
                    <p className="text-[13px] text-[#64748b] m-0">
                      {new Date(selectedDetection.created_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-3" style={{ gap: '16px' }}>
                  {[
                    { icon: <Users size={20} className="text-[#6366f1]" />, label: 'Persons', value: selectedDetection.person_count, valueColor: '#0f172a' },
                    { icon: <AlertTriangle size={20} className={selectedDetection.violation_count > 0 ? 'text-[#f43f5e]' : 'text-[#94a3b8]'} />, label: 'Violations', value: selectedDetection.violation_count, valueColor: selectedDetection.violation_count > 0 ? '#e11d48' : '#0f172a' },
                    { icon: <Clock size={20} className="text-[#64748b]" />, label: 'Processing', value: `${selectedDetection.processing_time_ms ?? '—'}ms`, valueColor: '#0f172a' },
                  ].map((s, i) => (
                    <div key={i} className="bg-[#f8fafc] border border-[#e5eaf0] rounded-xl text-center" style={{ padding: '20px 16px' }}>
                      <div className="flex justify-center mb-[8px]">{s.icon}</div>
                      <p className="text-[26px] font-bold m-0 mb-[4px]" style={{ color: s.valueColor }}>{s.value}</p>
                      <p className="text-[12px] text-[#94a3b8] m-0 font-semibold tracking-wide uppercase">{s.label}</p>
                    </div>
                  ))}
                </div>

                {/* Violations list */}
                {selectedDetection.violations && selectedDetection.violations.length > 0 && (
                  <div>
                    <p className="text-[13px] font-bold text-[#64748b] uppercase tracking-[0.06em] m-0 mb-3">Violations Found</p>
                    <div className="flex flex-wrap" style={{ gap: '8px' }}>
                      {selectedDetection.violations.map((v, i) => (
                        <span key={i} className="px-3 py-[6px] bg-[#fee2e2] text-[#dc2626] text-[13px] font-semibold rounded-lg border border-[#fecaca]" style={{ padding: '6px 12px' }}>
                          {v}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Per-person breakdown */}
                {selectedDetection.persons && selectedDetection.persons.length > 0 && (
                  <div>
                    <p className="text-[13px] font-bold text-[#64748b] uppercase tracking-[0.06em] m-0 mb-3">Per-Person PPE Status</p>
                    <div className="flex flex-col" style={{ gap: '12px' }}>
                      {selectedDetection.persons.map((person) => (
                        <div
                          key={person.id}
                          className="flex items-start justify-between rounded-xl border"
                          style={{ padding: '16px', backgroundColor: person.is_compliant ? '#f0fdf4' : '#fff1f2', borderColor: person.is_compliant ? '#bbf7d0' : '#fecaca' }}
                        >
                          <div>
                            <p className="text-[14px] font-bold text-[#0f172a] m-0 mb-2">Person {person.id}</p>
                            <div className="flex flex-wrap gap-2">
                              {person.wearing?.map((item, i) => (
                                <span key={`w${i}`} className="text-[12px] font-medium text-[#16a34a] flex items-center gap-[4px] bg-[#dcfce7] px-2 py-1 rounded-md">
                                  <CheckCircle size={12} /> {item}
                                </span>
                              ))}
                              {person.not_wearing?.map((item, i) => (
                                <span key={`nw${i}`} className="text-[12px] font-medium text-[#dc2626] flex items-center gap-[4px] bg-[#fee2e2] px-2 py-1 rounded-md">
                                  <X size={12} /> {item}
                                </span>
                              ))}
                            </div>
                          </div>
                          <span className="text-[12px] font-bold rounded-lg shrink-0" style={{ padding: '4px 10px', backgroundColor: person.is_compliant ? '#dcfce7' : '#fee2e2', color: person.is_compliant ? '#16a34a' : '#dc2626' }}>
                            {Math.round(person.confidence * 100)}% Match
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
