import { Download, Eye, Loader2, Users } from 'lucide-react'

import { useLanguage } from '../../i18n/LanguageContext'
import type { Detection } from '../../types'
import { ProtectedDetectionImage } from '../ui/ProtectedDetectionImage'

interface DetectionRecordsTableProps {
  detections: Detection[]
  onView: (detection: Detection) => void
  onDownload?: (detection: Detection) => void
  downloadingId?: number | null
  maxHeightClassName?: string
}

const isPersonOnlyDetection = (detection: Detection) => (
  detection.summary?.status === 'person_only'
  || detection.summary?.settings?.ppe_check_enabled === false
)

export function DetectionRecordsTable({
  detections,
  onView,
  onDownload,
  downloadingId = null,
  maxHeightClassName = '',
}: DetectionRecordsTableProps) {
  const { language, text } = useLanguage()

  const violationLabel = (value: string) => {
    const normalized = value.trim().toLowerCase()
    if (normalized === 'no_helmet' || normalized === 'no_hardhat' || normalized.includes('helmet') || normalized.includes('hardhat') || normalized.includes('หมวก')) {
      return text('ไม่สวมหมวกนิรภัย', 'No safety helmet')
    }
    if (normalized === 'no_safety_vest' || normalized === 'no_vest' || normalized.includes('vest') || normalized.includes('เสื้อสะท้อนแสง')) {
      return text('ไม่สวมเสื้อสะท้อนแสง', 'No safety vest')
    }
    if (normalized.includes('glasses') || normalized.includes('แว่น')) return text('ไม่สวมแว่นตานิรภัย', 'No safety glasses')
    if (normalized.includes('gloves') || normalized.includes('ถุงมือ')) return text('ไม่สวมถุงมือ', 'No safety gloves')
    if (normalized.includes('shoes') || normalized.includes('รองเท้า')) return text('ไม่สวมรองเท้านิรภัย', 'No safety shoes')
    if (normalized.includes('mask') || normalized.includes('หน้ากาก')) return text('ไม่สวมหน้ากาก', 'No face mask')
    return value
  }

  const statusLabel = (detection: Detection) => {
    if (detection.has_violation) return text('พบการฝ่าฝืน', 'Violation')
    return isPersonOnlyDetection(detection)
      ? text('ตรวจพบคนเท่านั้น', 'Person only')
      : text('สวมใส่ครบ', 'Compliant')
  }

  return (
    <div className={`overflow-auto ${maxHeightClassName}`.trim()}>
      <table className="w-full min-w-[900px] border-collapse">
        <thead>
          <tr className="bg-[#f5f5f7] text-left text-[12px] font-semibold uppercase tracking-[0.04em] text-[var(--muted)]">
            <th scope="col" className="w-[110px] px-6 py-4 sm:pl-8">{text('ภาพ', 'Preview')}</th>
            <th scope="col" className="min-w-[190px] px-6 py-4">{text('วันที่และเวลา', 'Date & time')}</th>
            <th scope="col" className="w-[110px] px-6 py-4">{text('จำนวนคน', 'Persons')}</th>
            <th scope="col" className="px-6 py-4">{text('ผลการตรวจ', 'Detection result')}</th>
            <th scope="col" className="w-[140px] px-6 py-4">{text('สถานะ', 'Status')}</th>
            <th scope="col" className="w-[140px] px-6 py-4 sm:pr-8">{text('ดำเนินการ', 'Actions')}</th>
          </tr>
        </thead>
        <tbody>
          {detections.map((detection, index) => {
            const personOnly = isPersonOnlyDetection(detection)
            return (
              <tr key={detection.id} className={`border-t border-[var(--line)] transition-colors hover:bg-[#f5f5f7] ${index % 2 === 0 ? 'bg-white' : 'bg-[#fafafc]'}`}>
                <td className="px-6 py-4 align-middle sm:pl-8">
                  <div className="h-14 w-14 overflow-hidden rounded-[11px] border border-[var(--line)] bg-[#f5f5f7]">
                    <ProtectedDetectionImage detectionId={detection.id} alt={text(`ภาพการตรวจจับ ${detection.id}`, `Detection ${detection.id} preview`)} className="h-full w-full object-cover" />
                  </div>
                </td>
                <td className="whitespace-nowrap px-6 py-4 align-middle text-[15px] text-[var(--ink)]">
                  {new Date(detection.created_at).toLocaleString(language === 'th' ? 'th-TH' : 'en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </td>
                <td className="px-6 py-4 align-middle">
                  <span className="inline-flex items-center gap-2 text-[15px] text-[var(--ink)]"><Users size={15} className="text-[var(--muted)]" strokeWidth={1.8} aria-hidden="true" /><span className="font-semibold tabular-nums">{detection.person_count}</span></span>
                </td>
                <td className="px-6 py-4 align-middle">
                  {detection.violations?.length ? (
                    <div className="flex flex-wrap gap-2">
                      {detection.violations.slice(0, 2).map((violation, violationIndex) => <span key={`${violation}-${violationIndex}`} className="inline-flex rounded-full border border-[#f0c3c8] bg-[#fff8f8] px-3 py-1.5 text-[12px] font-semibold text-[#d70015]">{violationLabel(violation)}</span>)}
                      {detection.violations.length > 2 && <span className="inline-flex rounded-full bg-[#f5f5f7] px-3 py-1.5 text-[12px] text-[var(--muted)]">+{detection.violations.length - 2} {text('รายการ', 'more')}</span>}
                    </div>
                  ) : (
                    <span className={`inline-flex rounded-full border px-3 py-1.5 text-[12px] font-semibold ${personOnly ? 'border-[#c7d2fe] bg-[#eef2ff] text-[#1d4ed8]' : 'border-[#b9dfc2] bg-[#f3fbf5] text-[#15803d]'}`}>{personOnly ? text('ตรวจพบคน', 'Person detected') : text('สวมใส่ครบ', 'Compliant')}</span>
                  )}
                </td>
                <td className="px-6 py-4 align-middle">
                  <span className={`inline-flex items-center gap-2 text-[13px] font-semibold ${detection.has_violation ? 'text-[#d70015]' : personOnly ? 'text-[#1d4ed8]' : 'text-[#15803d]'}`}>
                    <span className={`h-2 w-2 rounded-full ${detection.has_violation ? 'bg-[#d70015]' : personOnly ? 'bg-[#3b82f6]' : 'bg-[#34c759]'}`} aria-hidden="true" />
                    {statusLabel(detection)}
                  </span>
                </td>
                <td className="px-6 py-4 align-middle sm:pr-8">
                  <div className="flex items-center gap-2">
                    {onDownload && <button type="button" onClick={(event) => { event.stopPropagation(); onDownload(detection) }} disabled={downloadingId === detection.id} aria-label={text(`ดาวน์โหลด PDF รายการ ${detection.id}`, `Download PDF for detection ${detection.id}`)} className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[var(--line)] bg-white text-[var(--blue)] transition-colors hover:bg-[#f5f5f7] active:scale-95 disabled:opacity-50">{downloadingId === detection.id ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Download size={16} strokeWidth={1.8} aria-hidden="true" />}</button>}
                    <button type="button" onClick={(event) => { event.stopPropagation(); onView(detection) }} aria-label={text(`ดูการตรวจจับ ${detection.id}`, `View detection ${detection.id}`)} className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[var(--line)] bg-white text-[var(--blue)] transition-colors hover:bg-[#f5f5f7] active:scale-95"><Eye size={16} strokeWidth={1.8} aria-hidden="true" /></button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
