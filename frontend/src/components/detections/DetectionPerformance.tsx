import { useLanguage } from '../../i18n/LanguageContext'
import { API_ORIGIN } from '../../services/api'
import type { BrowserPerformance, Detection } from '../../types'

interface Props {
  detection?: Detection | null
  metrics?: BrowserPerformance | null
  fps?: number
  error?: string
  live?: boolean
  stale?: boolean
}

export function DetectionPerformance({ detection, metrics, fps, error, live = false, stale = false }: Props) {
  const { text } = useLanguage()
  const sample = metrics ?? detection?.summary?.browser_performance
  const runtime = detection?.summary?.runtime
  const missing = text('ไม่ได้บันทึก', 'Not recorded')
  const measuredFps = sample ? sample.completed * 1000 / sample.elapsed_ms : fps
  const processing = live && sample ? sample.processing_ms : detection?.processing_time_ms
  const attempts = sample ? sample.completed + sample.failed : 0
  const confidence = detection?.detected_objects?.map((item) => item.confidence).filter((value) => Number.isFinite(value) && value >= 0 && value <= 1) ?? []
  const averageConfidence = confidence.length ? confidence.reduce((sum, value) => sum + value, 0) / confidence.length * 100 : null
  const timely = sample && !stale && measuredFps != null && measuredFps >= 0.9 * 1000 / sample.target_interval_ms && sample.delay_ms <= sample.target_interval_ms && sample.failed / attempts <= 0.05
  const host = sample?.api_host ?? (live ? new URL(API_ORIGIN).host : text('ไม่ได้บันทึกเซิร์ฟเวอร์', 'Server not recorded'))
  const rows = [
    [text('ความเร็วในการตรวจจับ (FPS)', 'Detection speed (FPS)'), measuredFps != null ? `${(stale ? 0 : measuredFps).toFixed(2)} FPS` : missing],
    [text('ระยะเวลาประมวลผลต่อเฟรม (ms)', 'Processing time per frame (ms)'), processing != null ? `${processing.toFixed(2)} ms${live ? text(' · เฉลี่ย', ' · mean') : ''}` : missing],
    [text('ความถูกต้องในการตรวจจับ (%)', 'Detection accuracy (%)'), text('ยังไม่ได้ประเมินกับผลอ้างอิง', 'Not evaluated against ground truth')],
    [text('ความมั่นใจของโมเดล (%)', 'Model confidence (%)'), averageConfidence != null ? `${averageConfidence.toFixed(1)}%` : text('ไม่มีวัตถุที่ตรวจพบ', 'No detected objects')],
    [text('ความต่อเนื่องของการตรวจจับ', 'Detection continuity'), sample ? `${(sample.completed / attempts * 100).toFixed(1)}% · ${sample.completed}/${attempts} ${text('สำเร็จ', 'successful')} · ${sample.skipped} ${text('รอบข้าม', 'skipped cycles')}` : missing],
    [text('ความล่าช้าในการแสดงผล (Delay)', 'Result delay'), sample ? `${sample.delay_ms.toFixed(2)} ms${text(' · เฉลี่ยตั้งแต่จับภาพจนรับผล', ' · mean capture-to-response')}` : missing],
    [text('ความสามารถในการใช้งานแบบ Real-time', 'Real-time capability'), sample ? `${timely ? text('ทันรอบเป้าหมาย', 'Meeting target') : text('ไม่ทันรอบเป้าหมาย', 'Below target')} · ${(1000 / sample.target_interval_ms).toFixed(1)} FPS` : text('ข้อมูลไม่พอประเมิน', 'Insufficient measurements')],
    [text('ข้อจำกัดที่พบ', 'Observed limitations'), error || (stale ? text('ยังไม่ได้รับผลใหม่', 'No recent result') : sample ? text('Delay รวมการส่งข้อมูลและรอเซิร์ฟเวอร์; ยังไม่มีผลทดสอบความถูกต้อง', 'Delay includes transfer and server wait; accuracy has not been evaluated') : text('ไม่มีข้อมูล FPS, Delay และความต่อเนื่องของช่วงกล้อง', 'Camera FPS, delay and continuity were not recorded'))],
  ]

  return (
    <section className="mt-4 min-w-0 border-t border-[var(--line)] pt-4" aria-label={text('ประสิทธิภาพการตรวจจับ', 'Detection performance')}>
      <h3 className="m-0 text-[15px] font-semibold text-[var(--ink)]">{text('ประสิทธิภาพการตรวจจับ', 'Detection performance')}</h3>
      <p className="mt-1 break-words text-[12px] text-[var(--muted)]">{host}{runtime ? ` · ${runtime.environment} · ${runtime.device} · ${runtime.model_version}` : ''}</p>
      {sample && <p className="mt-1 text-[12px] text-[var(--muted)]">{live ? text('ช่วงกล้อง', 'Camera session') : text('ช่วงกล้องก่อนบันทึกรายการ', 'Camera session before recording')} · {(sample.elapsed_ms / 1000).toFixed(1)} s · {sample.completed} {text('เฟรมสำเร็จ', 'completed frames')}</p>}
      <dl className="m-0 divide-y divide-[var(--line)]">{rows.map(([label, value]) => (
        <div key={label} className="grid min-w-0 gap-1 py-2.5 text-[13px] sm:grid-cols-2 sm:gap-4">
          <dt className="min-w-0 text-[var(--muted)]">{label}</dt>
          <dd className="m-0 min-w-0 break-words font-medium text-[var(--ink)]" title={sample ? text(`เกณฑ์: FPS ≥ ${(900 / sample.target_interval_ms).toFixed(2)}, Delay ≤ ${sample.target_interval_ms} ms, เฟรมล้มเหลว ≤ 5%`, `Criteria: FPS ≥ ${(900 / sample.target_interval_ms).toFixed(2)}, delay ≤ ${sample.target_interval_ms} ms, failed frames ≤ 5%`) : undefined}>{value}</dd>
        </div>
      ))}</dl>
    </section>
  )
}
