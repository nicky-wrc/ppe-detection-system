import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import type { Detection } from '../types'

const PPE_LABEL_TH: Record<string, string> = {
  helmet: 'หมวกนิรภัย',
  'safety-vest': 'เสื้อสะท้อนแสง',
  glasses: 'แว่นตานิรภัย',
  gloves: 'ถุงมือ',
  shoes: 'รองเท้านิรภัย',
  'face-mask': 'หน้ากาก',
  'face-guard': 'กระบังหน้า',
  'ear-mufs': 'ที่ครอบหู',
}

function esc(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function formatPpeList(items: string[] | undefined): string {
  if (!items?.length) return '—'
  return items.map((k) => PPE_LABEL_TH[k] || k).join(', ')
}

function drawToJpegDataUrl(
  source: ImageBitmap | HTMLImageElement,
  maxW: number,
  maxH: number
): string {
  let w = source.width
  let h = source.height
  if (w > maxW) {
    h = (h * maxW) / w
    w = maxW
  }
  if (h > maxH) {
    w = (w * maxH) / h
    h = maxH
  }
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(w))
  canvas.height = Math.max(1, Math.round(h))
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas not available')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', 0.9)
}

/** Converts image blob to JPEG data URL (PNG/WebP → JPEG for embedding in HTML/PDF). */
export async function imageBlobToJpegDataUrl(blob: Blob): Promise<string> {
  const maxW = 1654
  const maxH = 2200
  try {
    const bmp = await createImageBitmap(blob)
    try {
      return drawToJpegDataUrl(bmp, maxW, maxH)
    } finally {
      bmp.close()
    }
  } catch {
    const url = URL.createObjectURL(blob)
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image()
        el.onload = () => resolve(el)
        el.onerror = () => reject(new Error('Image decode failed'))
        el.src = url
      })
      if (!img.naturalWidth) throw new Error('Image has zero size')
      return drawToJpegDataUrl(img, maxW, maxH)
    } finally {
      URL.revokeObjectURL(url)
    }
  }
}

async function blobLooksLikeAviVideo(blob: Blob): Promise<boolean> {
  if (blob.size < 12) return false
  const buf = new Uint8Array(await blob.slice(0, 12).arrayBuffer())
  const riff = buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46
  const avi = buf[8] === 0x41 && buf[9] === 0x56 && buf[10] === 0x49
  return riff && avi
}

export function isVideoMediaBlob(blob: Blob): boolean {
  const t = (blob.type || '').toLowerCase()
  return t.startsWith('video/')
}

function buildReportHtml(
  detection: Detection,
  evidenceDataUrl: string | null,
  isVideo: boolean,
  mediaMissing: boolean
): string {
  const refId = `DET-${String(detection.id).padStart(5, '0')}`
  const inspectedAt = new Date(detection.created_at).toLocaleString('th-TH', {
    dateStyle: 'long',
    timeStyle: 'medium',
  })
  const generatedAt = new Date().toLocaleString('th-TH', {
    dateStyle: 'long',
    timeStyle: 'short',
  })
  const types = detection.violations?.filter(Boolean) ?? []
  const summaryMsg =
    types.length > 0
      ? `ตรวจพบ: ${types.join(' และ ')}`
      : (detection.summary?.message || '')

  const persons = detection.persons || []
  const personRows = persons
    .map((p) => {
      const st = p.is_compliant ? 'สอดคล้อง' : 'พบการฝ่าฝืน'
      const icon = p.is_compliant ? '✓' : '✗'
      return `
      <div class="person-card ${p.is_compliant ? 'ok' : 'bad'}">
        <div class="person-title">${icon} บุคคลที่ ${esc(String(p.id))} — ${esc(st)}</div>
        <div class="kv"><span class="k">สวมใส่</span> ${esc(formatPpeList(p.wearing))}</div>
        <div class="kv"><span class="k">ไม่พบ / ขาด</span> ${esc(p.not_wearing?.length ? formatPpeList(p.not_wearing) : '—')}</div>
        <div class="kv"><span class="k">ความมั่นใจของโมเดล</span> ${Math.round((p.confidence ?? 0) * 100)}%</div>
      </div>`
    })
    .join('')

  const statusTh = detection.has_violation
    ? 'พบการฝ่าฝืน (Non-compliant)'
    : 'สอดคล้องตามข้อกำหนด (Compliant)'

  let evidenceBlock = ''
  if (mediaMissing) {
    evidenceBlock =
      '<div class="note warn">ไม่สามารถโหลดไฟล์ภาพประกอบได้ กรุณาตรวจสอบการเชื่อมต่อหรือสิทธิ์การเข้าถึง</div>'
  } else if (isVideo) {
    evidenceBlock =
      '<div class="note">ผลลัพธ์รายการนี้เป็นวิดีโอ — กรุณาเปิดดูจากระบบหลัก ไฟล์ PDF นี้แนบเฉพาะข้อความรายงาน</div>'
  } else if (evidenceDataUrl) {
    evidenceBlock = `<div class="evidence-wrap"><div class="sec-title">ภาพประกอบผลการตรวจจับ (Annotated evidence)</div>
      <img class="evidence-img" src="${evidenceDataUrl}" alt="evidence" />
      <p class="caption">กรอบสีเขียว = สอดคล้อง · กรอบสีแดง = ฝ่าฝืน</p></div>`
  } else {
    evidenceBlock = '<div class="note warn">ไม่มีภาพประกอบในรายงานนี้</div>'
  }

  const typesLine =
    types.length > 0
      ? `<div class="kv"><span class="k">ประเภทการฝ่าฝืน</span> ${esc(types.join(' / '))}</div>`
      : !detection.has_violation
        ? '<div class="kv"><span class="k">ประเภทการฝ่าฝืน</span> ไม่พบ</div>'
        : ''

  return `
  <div class="report-root">
    <div class="brand">PPE Guard AI</div>
    <h1>รายงานผลการตรวจสอบอุปกรณ์ป้องกันส่วนบุคคล (PPE)</h1>
    <p class="subtitle">เอกสารออกโดยระบบตรวจสอบอัตโนมัติเพื่อประกอบบันทึกความปลอดภัยในงาน (Occupational safety record)</p>
    <div class="rule"></div>

    <div class="meta">
      <div class="kv"><span class="k">เลขที่อ้างอิง</span> ${esc(refId)}</div>
      <div class="kv"><span class="k">วันเวลาที่ตรวจจับ</span> ${esc(inspectedAt)}</div>
      <div class="kv"><span class="k">วันที่สร้างรายงาน</span> ${esc(generatedAt)}</div>
      <div class="kv status ${detection.has_violation ? 'bad' : 'ok'}"><span class="k">สถานะรวม</span> ${esc(statusTh)}</div>
    </div>

    <div class="sec-title">สรุปภาพรวม (Executive summary)</div>
    <div class="kv"><span class="k">จำนวนบุคคลที่ตรวจพบ</span> ${detection.person_count}</div>
    <div class="kv"><span class="k">จำนวนผู้ไม่สอดคล้อง / จำนวนเหตุฝ่าฝืน (ตามระบบ)</span> ${detection.violation_count}</div>
    ${typesLine}
    ${
      summaryMsg
        ? `<div class="summary-box"><span class="k">ข้อความสรุปจากระบบ</span><br/>${esc(summaryMsg)}</div>`
        : ''
    }

    <div class="sec-title">รายละเอียดรายบุคคล (Per-person detail)</div>
    ${
      persons.length === 0
        ? '<p class="muted">ไม่มีข้อมูลรายบุคคลในเรคอร์ดนี้</p>'
        : personRows
    }

    ${evidenceBlock}

    <div class="rule"></div>
    <p class="footer">
      คำชี้แจง: รายงานนี้สร้างโดยระบบปัญญาประดิษฐ์เพื่อช่วยตรวจสอบเบื้องต้น
      ผลการตัดสินใจด้านความปลอดภัยขั้นสุดท้ายควรพิจารณาร่วมกับบุคลากรที่มีหน้าที่รับผิดชอบ<br/>
      <span class="muted">Disclaimer: This automated report supports workplace safety monitoring; final compliance decisions should involve qualified personnel.</span>
    </p>
  </div>`
}

function injectReportStyles(container: HTMLDivElement, innerHtml: string): void {
  container.innerHTML = `
  <style>
    .report-root { width: 794px; background: #ffffff; color: #1d1d1f; font-family: "SF Pro Text", system-ui, -apple-system, "Segoe UI", sans-serif; font-size: 13px; line-height: 1.55; padding: 36px 40px; }
    .report-root * { box-sizing: border-box; }
    .brand { font-size: 14px; font-weight: 600; color: #0066cc; letter-spacing: 0.02em; margin-bottom: 6px; }
    h1 { font-size: 20px; font-weight: 600; margin: 0 0 8px; line-height: 1.35; color: #1d1d1f; }
    .subtitle { margin: 0 0 16px; font-size: 11.5px; color: #6e6e73; line-height: 1.45; }
    .rule { height: 1px; background: #e0e0e0; margin: 14px 0 18px; }
    .meta { margin-bottom: 18px; }
    .sec-title { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: #6e6e73; margin: 22px 0 10px; }
    .kv { margin: 6px 0; font-size: 12.5px; }
    .k { display: inline-block; min-width: 160px; color: #6e6e73; font-weight: 600; }
    .status.ok .k { color: #248a3d; }
    .status.bad .k { color: #d70015; }
    .summary-box { margin-top: 12px; padding: 12px 14px; background: #f5f5f7; border: 1px solid #e0e0e0; border-radius: 11px; font-size: 12.5px; }
    .person-card { margin: 10px 0; padding: 12px 14px; border-radius: 18px; border: 1px solid #e0e0e0; background: #fafafc; }
    .person-card.bad { border-color: #f0c3c8; background: #fff8f8; }
    .person-card.ok { border-color: #b9dfc2; background: #f3fbf5; }
    .person-title { font-weight: 600; margin-bottom: 8px; font-size: 13px; }
    .evidence-wrap { margin-top: 8px; }
    .evidence-img { display: block; width: 100%; height: auto; border-radius: 11px; border: 1px solid #e0e0e0; margin-top: 8px; }
    .caption { font-size: 11px; color: #6e6e73; margin: 8px 0 0; }
    .note { padding: 12px; background: #f5f5f7; border-radius: 11px; border: 1px solid #e0e0e0; color: #424245; font-size: 12px; }
    .note.warn { background: #fffaf0; border-color: #efd39c; color: #9a5b00; }
    .footer { font-size: 10px; color: #6e6e73; line-height: 1.5; margin-top: 8px; }
    .muted { color: #6e6e73; }
  </style>
  ${innerHtml}`
}

/** Rasterize report to PDF (multi-page if content is taller than one A4). */
async function appendHtmlAsPdfPages(pdf: jsPDF, innerHtml: string): Promise<void> {
  const host = document.createElement('div')
  host.style.cssText = 'position:fixed;left:-12000px;top:0;pointer-events:none;z-index:-1'
  document.body.appendChild(host)
  const canvas = await (async () => {
    try {
      injectReportStyles(host as HTMLDivElement, innerHtml)
      const root = host.querySelector('.report-root') as HTMLElement | null
      if (!root) throw new Error('Report template error')

      if (document.fonts?.ready) await document.fonts.ready

      await Promise.all(
        Array.from(root.querySelectorAll('img')).map(
          (img) =>
            new Promise<void>((resolve) => {
              if (img.complete && img.naturalWidth > 0) {
                resolve()
                return
              }
              const done = () => resolve()
              img.addEventListener('load', done, { once: true })
              img.addEventListener('error', done, { once: true })
              setTimeout(done, 10000)
            })
        )
      )

      return await html2canvas(root, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: '#ffffff',
      })
    } finally {
      host.remove()
    }
  })()

  const imgData = canvas.toDataURL('image/png', 1.0)
  const pageW = 210
  const pageH = 297
  const imgW = pageW
  const imgH = (canvas.height * imgW) / canvas.width

  let heightLeft = imgH
  let position = 0

  pdf.addImage(imgData, 'PNG', 0, position, imgW, imgH)
  heightLeft -= pageH

  while (heightLeft > 0.5) {
    position = heightLeft - imgH
    pdf.addPage()
    pdf.addImage(imgData, 'PNG', 0, position, imgW, imgH)
    heightLeft -= pageH
  }
}

export async function saveDetectionPdf(
  detection: Detection,
  loadMediaBlob: () => Promise<Blob>
): Promise<void> {
  let mediaBlob: Blob | null = null
  let mediaMissing = false
  try {
    mediaBlob = await loadMediaBlob()
  } catch {
    mediaMissing = true
  }

  const isVideo = mediaBlob
    ? isVideoMediaBlob(mediaBlob) || (await blobLooksLikeAviVideo(mediaBlob))
    : false
  let evidenceDataUrl: string | null = null
  if (mediaBlob && !isVideo) {
    try {
      evidenceDataUrl = await imageBlobToJpegDataUrl(mediaBlob)
    } catch {
      mediaMissing = true
    }
  }

  const html = buildReportHtml(detection, evidenceDataUrl, isVideo, mediaMissing)

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  await appendHtmlAsPdfPages(pdf, html)

  const refId = `DET-${String(detection.id).padStart(5, '0')}`
  pdf.save(`PPE_Report_${refId}.pdf`)
}
