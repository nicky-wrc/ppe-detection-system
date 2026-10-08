import { Download, FileText, Loader2, ShieldAlert, X } from 'lucide-react'

import { useDialogFocus } from '../../hooks/useDialogFocus'
import { useLanguage } from '../../i18n/LanguageContext'
import type { Detection } from '../../types'
import { ProtectedDetectionImage } from '../ui/ProtectedDetectionImage'
import { DetectionPerformance } from './DetectionPerformance'

interface DetectionDetailsDialogProps {
  detection: Detection | null
  open: boolean
  onClose: () => void
  loading?: boolean
  error?: boolean
  violationOnly?: boolean
  onDownload?: (detection: Detection) => void
  downloading?: boolean
  clipUrl?: string | null
}

const isPersonOnly = (detection: Detection) => (
  detection.summary?.status === 'person_only'
  || detection.summary?.settings?.ppe_check_enabled === false
)

const closestPreset = <T extends { threshold: number }>(value: number, presets: T[]) => (
  presets.reduce((closest, preset) => (
    Math.abs(preset.threshold - value) < Math.abs(closest.threshold - value) ? preset : closest
  ))
)

export function DetectionDetailsDialog({
  detection,
  open,
  onClose,
  loading = false,
  error = false,
  violationOnly = false,
  onDownload,
  downloading = false,
  clipUrl,
}: DetectionDetailsDialogProps) {
  const { language, text } = useLanguage()
  const dialogRef = useDialogFocus<HTMLElement>(open, onClose)
  if (!open) return null

  const violationLabel = (value: string) => {
    const normalized = value.toLowerCase()
    if (normalized.includes('helmet') || normalized.includes('hardhat') || normalized.includes('หมวก')) return text('ไม่สวมหมวกนิรภัย', 'No safety helmet')
    if (normalized.includes('vest') || normalized.includes('เสื้อสะท้อนแสง')) return text('ไม่สวมเสื้อสะท้อนแสง', 'No safety vest')
    if (normalized.includes('glasses') || normalized.includes('แว่น')) return text('ไม่สวมแว่นตานิรภัย', 'No safety glasses')
    if (normalized.includes('gloves') || normalized.includes('ถุงมือ')) return text('ไม่สวมถุงมือ', 'No safety gloves')
    if (normalized.includes('shoes') || normalized.includes('รองเท้า')) return text('ไม่สวมรองเท้านิรภัย', 'No safety shoes')
    if (normalized.includes('mask') || normalized.includes('หน้ากาก')) return text('ไม่สวมหน้ากาก', 'No face mask')
    return value
  }

  const settings = detection?.summary?.settings
  const nonCompliant = detection?.persons?.filter((person) => !person.is_compliant) ?? []
  const compliantCount = detection?.persons?.filter((person) => person.is_compliant).length ?? 0
  const localizedSettings = settings ? (() => {
    const personPreset = closestPreset(settings.person_confidence_percent, [
      { threshold: 60, level: 40, th: 'ตรวจเฉพาะที่ชัดเจน', en: 'Clear detections only' },
      { threshold: 45, level: 55, th: 'ตรวจแบบปกติ', en: 'Balanced' },
      { threshold: 30, level: 70, th: 'ตรวจเพิ่มแม้ภาพไม่ชัด', en: 'Detect in unclear images' },
    ])
    const ppePreset = closestPreset(settings.ppe_confidence_percent, [
      { threshold: 33, level: 35, th: 'ตรวจเฉพาะที่ชัดเจน', en: 'Clear detections only' },
      { threshold: 24, level: 60, th: 'ตรวจแบบปกติ', en: 'Balanced' },
      { threshold: 19, level: 75, th: 'ตรวจเพิ่มแม้ภาพไม่ชัด', en: 'Detect in unclear images' },
    ])
    const ppeNames = settings.ppe_rules.map((rule) => {
      const normalized = rule.toLowerCase()
      if (normalized.includes('helmet') || normalized.includes('หมวก')) return text('หมวกนิรภัย', 'Safety helmet')
      if (normalized.includes('vest') || normalized.includes('เสื้อสะท้อนแสง')) return text('เสื้อสะท้อนแสง', 'Safety vest')
      return rule
    })

    return {
      mode: settings.detection_record_mode === 'violations_only'
        ? text('เฉพาะมีการฝ่าฝืน', 'Violations only')
        : settings.detection_record_mode === 'compliant_only'
          ? text('เฉพาะสวมใส่ครบ', 'Compliant only')
          : settings.detection_record_mode === 'both'
            ? text('บันทึกสองแบบ', 'Record both')
            : settings.ppe_check_enabled
              ? text('ตรวจจับบุคคลและตรวจ PPE', 'Person and PPE detection')
              : text('ตรวจจับบุคคลเท่านั้น', 'Person detection only'),
      rules: ppeNames.length > 0
        ? ppeNames.join(', ')
        : text('ไม่มีกฎ PPE ที่เปิดใช้งาน', 'No active PPE rules'),
      confidence: settings.ppe_check_enabled
        ? text(
          `บุคคล: ${personPreset.th} (${personPreset.level}%), PPE: ${ppePreset.th} (${ppePreset.level}%)`,
          `Person: ${personPreset.en} (${personPreset.level}%), PPE: ${ppePreset.en} (${ppePreset.level}%)`,
        )
        : text(
          `บุคคล: ${personPreset.th} (${personPreset.level}%)`,
          `Person: ${personPreset.en} (${personPreset.level}%)`,
        ),
    }
  })() : null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-5 sm:p-6">
      <button type="button" aria-label={text('ปิดรายละเอียด', 'Close details')} className="absolute inset-0 h-full w-full cursor-default border-0 bg-black/55 backdrop-blur-[2px]" onClick={onClose} />
      <section ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="detection-details-title" className="relative flex max-h-[82dvh] w-full max-w-[440px] flex-col overflow-hidden rounded-[14px] border border-[var(--line)] bg-white sm:max-h-[92dvh] sm:max-w-[900px] sm:rounded-[18px]">
        <header className="flex min-h-[64px] shrink-0 items-center justify-between gap-2 border-b border-[var(--line)] px-3 py-2 sm:min-h-[72px] sm:gap-4 sm:px-8">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#f5f5f7] sm:h-11 sm:w-11 ${violationOnly ? 'text-[#d70015]' : 'text-[var(--ink)]'}`} aria-hidden="true">
              {violationOnly ? <ShieldAlert size={19} strokeWidth={1.8} /> : <FileText size={18} strokeWidth={1.8} />}
            </span>
            <div className="min-w-0">
              <h2 id="detection-details-title" className="text-[17px] leading-snug font-semibold text-[var(--ink)] sm:text-[21px]">{text(violationOnly ? 'รายละเอียดการฝ่าฝืน' : 'รายละเอียดการตรวจจับ', violationOnly ? 'Violation details' : 'Detection details')}</h2>
              {detection && <p className="mt-0.5 text-[13px] text-[var(--muted)]">DET-{String(detection.id).padStart(5, '0')}</p>}
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label={text('ปิด', 'Close')} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#f5f5f7] text-[var(--ink)] hover:text-[var(--blue)]"><X size={18} aria-hidden="true" /></button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 sm:p-8">
          {loading ? (
            <div className="flex min-h-64 items-center justify-center gap-3 text-[var(--muted)]" role="status"><Loader2 size={20} className="animate-spin" />{text('กำลังโหลดรายละเอียด…', 'Loading details…')}</div>
          ) : !detection ? (
            <div className="flex min-h-64 items-center justify-center text-[var(--muted)]" role="alert">{text('ไม่พบข้อมูลการตรวจจับ', 'Detection data not found')}</div>
          ) : (
            <div className="flex flex-col gap-4 sm:gap-6">
              {error && <div className="rounded-[11px] border border-[#f2b8bd] bg-[#fff5f5] px-4 py-3 text-[14px] text-[#d70015]" role="alert">{text('โหลดรายละเอียดเพิ่มเติมไม่สำเร็จ ข้อมูลพื้นฐานยังแสดงอยู่', 'Additional details could not be loaded. Basic information is still available.')}</div>}
              <div className="overflow-hidden rounded-[18px] border border-[var(--line)] bg-[#f5f5f7]"><ProtectedDetectionImage detectionId={detection.id} alt={text(`ผลการตรวจจับ ${detection.id}`, `Detection ${detection.id} result`)} className="w-full max-h-[28dvh] object-contain sm:max-h-[420px]" /></div>
              {clipUrl && <div className="overflow-hidden rounded-[18px] border border-[var(--line)] bg-black"><video src={clipUrl} controls className="max-h-[28dvh] w-full sm:max-h-[420px]" aria-label={text('คลิปหลักฐานการฝ่าฝืน', 'Violation evidence clip')} /></div>}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-[18px] border border-[var(--line)] bg-[#f5f5f7] p-5"><p className="text-[13px] text-[var(--muted)]">{text('วันที่และเวลา', 'Date & time')}</p><p className="mt-2 text-[17px] font-semibold text-[var(--ink)]">{new Date(detection.created_at).toLocaleString(language === 'th' ? 'th-TH' : 'en-GB')}</p></div>
                <div className="rounded-[18px] border border-[var(--line)] bg-[#f5f5f7] p-5"><p className="text-[13px] text-[var(--muted)]">{text('เลขอ้างอิง', 'Reference ID')}</p><p className="mt-2 text-[24px] font-semibold text-[var(--ink)]">DET-{String(detection.id).padStart(5, '0')}</p></div>
              </div>

              <div className="overflow-hidden rounded-[18px] border border-[var(--line)]">
                <div className="flex items-center justify-between gap-3 border-b border-[var(--line)] bg-[#f5f5f7] px-5 py-4"><p className="text-[14px] font-semibold text-[var(--ink)]">{text('สรุปผล', 'Summary')}</p><span className={`rounded-full border px-3 py-1.5 text-[12px] font-semibold ${detection.has_violation ? 'border-[#f0c3c8] bg-[#fff8f8] text-[#d70015]' : 'border-[#b9dfc2] bg-[#f3fbf5] text-[#15803d]'}`}>{detection.has_violation ? text('พบการฝ่าฝืน', 'Violation') : isPersonOnly(detection) ? text('ตรวจพบคนเท่านั้น', 'Person only') : text('สวมใส่ครบ', 'Compliant')}</span></div>
                <div className="grid grid-cols-3 divide-x divide-[var(--line)]">{[
                  [text('จำนวนคน', 'Persons'), detection.person_count],
                  [text('การฝ่าฝืน', 'Violations'), detection.violation_count],
                  [text('เวลาประมวลผล', 'Processing time'), detection.processing_time_ms != null ? `${detection.processing_time_ms} ms` : '—'],
                ].map(([label, value]) => <div key={String(label)} className="min-w-0 p-2 text-center sm:p-5"><p className="text-[11px] text-[var(--muted)] sm:text-[13px]">{label}</p><p className="mt-2 text-[18px] font-semibold text-[var(--ink)] sm:mt-3 sm:text-[26px]">{value}</p></div>)}</div>
              </div>

              {!!detection.violations?.length && <div className="rounded-[18px] border border-[var(--line)] p-5"><p className="mb-4 text-[14px] font-semibold text-[var(--ink)]">{text('ประเภทการฝ่าฝืน', 'Violation types')}</p><div className="flex flex-wrap gap-2">{detection.violations.map((item, index) => <span key={`${item}-${index}`} className="rounded-full border border-[#f0c3c8] bg-[#fff8f8] px-4 py-2 text-[13px] font-semibold text-[#d70015]">{violationLabel(item)}</span>)}</div></div>}

              {!!detection.persons?.length && <div className="overflow-hidden rounded-[18px] border border-[var(--line)]"><div className="flex justify-between gap-3 border-b border-[var(--line)] bg-[#f5f5f7] px-5 py-4"><p className="text-[14px] font-semibold text-[var(--ink)]">{text('รายละเอียดรายบุคคล', 'Detailed breakdown')}</p><span className="text-[12px] text-[var(--muted)]">{text(`ตรวจพบ ${detection.person_count} คน`, `${detection.person_count} people detected`)}</span></div><div className="space-y-3 p-5">{nonCompliant.map((person) => <div key={person.id} className="rounded-[12px] border border-[#f0c3c8] bg-[#fff8f8] p-4"><p className="font-semibold text-[#d70015]">{text(`บุคคล ${person.id} · ฝ่าฝืน`, `Person ${person.id} · Violation`)}</p><div className="mt-2 flex flex-wrap gap-2">{person.not_wearing?.map((item, index) => <span key={`${item}-${index}`} className="rounded-full bg-white px-3 py-1.5 text-[12px] text-[var(--muted)]">{violationLabel(item)}</span>)}</div></div>)}<p className="text-[14px] text-[var(--muted)]">{text(`สวมใส่ครบ ${compliantCount} คน`, `${compliantCount} fully compliant`)}</p></div></div>}

              {localizedSettings && <div className="rounded-[18px] border border-[var(--line)] p-5"><p className="mb-4 text-[14px] font-semibold text-[var(--ink)]">{text('การตั้งค่าที่ใช้', 'Settings used')}</p><div className="grid gap-3 text-[14px] sm:grid-cols-3"><div><p className="text-[var(--muted)]">{text('โหมด', 'Mode')}</p><p className="mt-1 font-semibold">{localizedSettings.mode}</p></div><div><p className="text-[var(--muted)]">{text('กฎ PPE', 'PPE rules')}</p><p className="mt-1 font-semibold">{localizedSettings.rules}</p></div><div><p className="text-[var(--muted)]">{text('ระดับการตรวจจับ', 'Detection levels')}</p><p className="mt-1 font-semibold">{localizedSettings.confidence}</p></div></div></div>}
              <DetectionPerformance detection={detection} />
            </div>
          )}
        </div>

        <footer className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-[var(--line)] bg-[#f5f5f7] px-3 py-3 sm:gap-3 sm:px-8 sm:py-5">
          <button type="button" onClick={onClose} className="btn-apple-secondary !min-h-11">{text('ปิด', 'Close')}</button>
          {detection && onDownload && <button type="button" onClick={() => onDownload(detection)} disabled={downloading} className="btn-apple-primary !min-h-11">{downloading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}{text('ดาวน์โหลด PDF', 'Download PDF')}</button>}
        </footer>
      </section>
    </div>
  )
}
