import { useCallback, useEffect, useState } from 'react'
import { Layout } from '../components/layout/Layout'
import { detectionService } from '../services/detection'
import type { Detection } from '../types'
import { jsPDF } from 'jspdf'
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

  const blobToDataUrl = (blob: Blob) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(String(reader.result))
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })

  const handleDownloadPdf = async (detectionId: number) => {
    try {
      const detection = await detectionService.getDetection(detectionId)
      const imageUrl = detectionService.getResultImageUrl(detectionId)
      const response = await fetch(imageUrl)
      if (!response.ok) throw new Error('Failed to fetch image')
      const blob = await response.blob()
      const imageDataUrl = await blobToDataUrl(blob)

      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      const refId = `DET-${String(detection.id).padStart(5, '0')}`

      pdf.setFontSize(17)
      pdf.text('PPE Detection Report', 14, 16)
      pdf.setFontSize(11)
      pdf.setTextColor(70, 85, 105)
      pdf.text(`Reference ID: ${refId}`, 14, 24)
      pdf.text(`Date/Time: ${new Date(detection.created_at).toLocaleString('th-TH')}`, 14, 30)
      pdf.text(`Persons Detected: ${detection.person_count}`, 14, 36)
      pdf.text(`Violations: ${detection.violation_count}`, 14, 42)
      pdf.setTextColor(15, 23, 42)

      const imgW = pageWidth - 28
      const imgH = 92
      pdf.addImage(imageDataUrl, 'JPEG', 14, 48, imgW, imgH)

      let y = 146
      pdf.setFontSize(13)
      pdf.text('Violation Details', 14, y)
      y += 7

      const violators = (detection.persons || []).filter((p) => !p.is_compliant)
      if (violators.length === 0) {
        pdf.setFontSize(11)
        pdf.setTextColor(22, 163, 74)
        pdf.text('- All detected persons are compliant with PPE requirements.', 14, y)
        pdf.setTextColor(15, 23, 42)
      } else {
        pdf.setFontSize(11)
        for (const person of violators) {
          const missingItems = (person.not_wearing || []).length
            ? person.not_wearing!.join(', ')
            : 'unspecified items'
          const line = `- Person ${person.id}: missing ${missingItems}`
          if (y > pageHeight - 14) {
            pdf.addPage()
            y = 20
          }
          pdf.text(line, 14, y)
          y += 7
        }
      }

      const messageText = detection.summary?.message || ''
      if (messageText) {
        y += 3
        if (y > pageHeight - 25) {
          pdf.addPage()
          y = 20
        }
        pdf.setFontSize(12)
        pdf.text('Summary Message', 14, y)
        y += 6
        pdf.setFontSize(11)
        const wrapped = pdf.splitTextToSize(messageText, pageWidth - 28)
        pdf.text(wrapped, 14, y)
      }

      pdf.save(`report-${refId}.pdf`)
    } catch (error) {
      console.error('PDF generation failed:', error)
      window.alert('ไม่สามารถดาวน์โหลด PDF ได้ในตอนนี้')
    }
  }

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
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <path
                  d="M12 3.2 18.2 5.6v5.6c0 4.1-2.3 7.8-6.2 9.6-3.9-1.8-6.2-5.5-6.2-9.6V5.6L12 3.2Z"
                  fill="#2563EB"
                />
                <path
                  d="M9 12.2h6M9.9 9.3h4.2M10.1 15.1h3.8"
                  stroke="#DBEAFE"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                />
                <circle cx="16.9" cy="16.9" r="3.1" fill="#F8FAFC" stroke="#1D4ED8" strokeWidth="1.2" />
                <path d="m15.9 16.9.7.7 1.3-1.3" stroke="#1D4ED8" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
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
                            onClick={e => { e.stopPropagation(); void handleDownloadPdf(detection.id) }}
                            title="Download PDF"
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
            <div
              className="absolute inset-0 bg-[rgba(15,23,42,0.45)]"
              onClick={() => setSelectedDetection(null)}
            />
            <div className="relative w-full max-w-[900px] max-h-[95vh] bg-white rounded-3xl border border-[#dbe3ee] shadow-[0_24px_70px_rgba(15,23,42,0.2)] overflow-hidden flex flex-col">
              <div className="flex items-center justify-between px-8 py-6 border-b border-[#e9eff6] bg-[#f8fbff]">
                <div className="flex items-center gap-2">
                  <FileText size={16} className="text-[#4f46e5]" />
                  <h2 className="text-[18px] font-bold text-[#0f172a] m-0">Detection Detail</h2>
                </div>
                <button
                  onClick={() => setSelectedDetection(null)}
                  className="w-10 h-10 rounded-xl border-none bg-[#eef2f7] text-[#64748b] cursor-pointer hover:bg-[#e2e8f0] transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="overflow-y-auto bg-[#f8fafc] px-8 py-8">
                <div className="w-full max-w-[740px] mx-auto space-y-7">
                  <div className="rounded-2xl overflow-hidden border border-[#d6e0ec] bg-white shadow-[0_6px_18px_rgba(15,23,42,0.08)]">
                    <img
                      src={detectionService.getResultImageUrl(selectedDetection.id)}
                      alt="Result"
                      className="w-full h-[400px] object-contain bg-[#f8fafc]"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-5">
                    <div className="bg-white border border-[#e2e8f0] rounded-2xl p-5 shadow-sm">
                      <p className="text-[12px] text-[#94a3b8] font-bold tracking-[0.08em] uppercase m-0 mb-1">Date & Time</p>
                      <p className="text-[22px] font-semibold text-[#0f172a] m-0 leading-tight">
                        {new Date(selectedDetection.created_at).toLocaleString('th-TH')}
                      </p>
                    </div>
                    <div className="bg-white border border-[#e2e8f0] rounded-2xl p-5 shadow-sm">
                      <p className="text-[12px] text-[#94a3b8] font-bold tracking-[0.08em] uppercase m-0 mb-1">Reference ID</p>
                      <p className="text-[28px] font-semibold text-[#0f172a] m-0 leading-tight">
                        DET-{String(selectedDetection.id).padStart(5, '0')}
                      </p>
                    </div>
                  </div>

                  <div className="bg-white border border-[#e2e8f0] rounded-2xl p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-[12px] text-[#94a3b8] font-bold tracking-[0.08em] uppercase m-0">Summary</p>
                      <span className={`text-[12px] font-semibold px-3 py-1 rounded-md ${selectedDetection.has_violation ? 'bg-[#fee2e2] text-[#dc2626]' : 'bg-[#dcfce7] text-[#16a34a]'}`}>
                        {selectedDetection.has_violation ? 'Violation Detected' : 'Compliant'}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-4 py-3">
                        <p className="text-[12px] text-[#94a3b8] m-0 mb-1 uppercase font-semibold">Persons</p>
                        <p className="text-[24px] font-bold text-[#0f172a] m-0">{selectedDetection.person_count}</p>
                      </div>
                      <div className="rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-4 py-3">
                        <p className="text-[12px] text-[#94a3b8] m-0 mb-1 uppercase font-semibold">Violations</p>
                        <p className={`text-[24px] font-bold m-0 ${selectedDetection.violation_count > 0 ? 'text-[#dc2626]' : 'text-[#0f172a]'}`}>{selectedDetection.violation_count}</p>
                      </div>
                      <div className="rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-4 py-3">
                        <p className="text-[12px] text-[#94a3b8] m-0 mb-1 uppercase font-semibold">Processing</p>
                        <p className="text-[24px] font-bold text-[#0f172a] m-0">{selectedDetection.processing_time_ms ?? '—'}ms</p>
                      </div>
                    </div>
                  </div>

                  {selectedDetection.violations && selectedDetection.violations.length > 0 && (
                    <div className="bg-white border border-[#e2e8f0] rounded-2xl p-5 shadow-sm">
                      <p className="text-[12px] text-[#94a3b8] font-bold tracking-[0.08em] uppercase m-0 mb-3">Violation Type</p>
                      <div className="flex flex-wrap gap-2">
                        {selectedDetection.violations.map((v, i) => (
                          <span key={i} className="inline-flex px-[10px] py-[3px] rounded-[6px] text-[11px] font-bold bg-[#fee2e2] text-[#dc2626] border border-[#fecaca]">
                            {v.toUpperCase().includes('HELMET') ? 'MISSING HELMET' :
                             v.toUpperCase().includes('VEST') ? 'MISSING VEST' :
                             v.toUpperCase()}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedDetection.persons && selectedDetection.persons.length > 0 && (
                    <div className="bg-white border border-[#e2e8f0] rounded-2xl p-5 shadow-sm">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-[12px] text-[#94a3b8] font-bold tracking-[0.08em] uppercase m-0">Detailed Breakdown</p>
                        <span className="text-[12px] px-3 py-1 rounded-md bg-[#e2e8f0] text-[#0f172a] font-semibold">
                          Total Persons Detected: {selectedDetection.person_count}
                        </span>
                      </div>
                      {selectedDetection.persons.filter((p) => !p.is_compliant).map((person) => (
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
                        + {selectedDetection.persons.filter((p) => p.is_compliant).length} person(s) fully compliant
                      </p>
                    </div>
                  )}

                  <div className="flex justify-end pt-2">
                    <button
                      onClick={() => setSelectedDetection(null)}
                      className="px-7 py-3 rounded-xl border-none bg-[#e2e8f0] text-[#334155] text-[14px] font-semibold cursor-pointer hover:bg-[#cbd5e1]"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </Layout>
  )
}
