import { useEffect, useRef, useState } from 'react'
import { isAxiosError } from 'axios'
import { Camera, CircleDot, Clock3, FileText, Play, RefreshCw, ShieldCheck, Square } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Layout } from '../components/layout/Layout'
import { useLanguage } from '../i18n/LanguageContext'
import { detectionService } from '../services/detection'
import type { Detection } from '../types'

function detectionFailure(error: unknown): { message: string; retry: boolean } {
  if (!isAxiosError(error)) return { message: 'ผลตรวจจับไม่สมบูรณ์ กรุณาลองใหม่', retry: false }
  const status = error.response?.status
  if (status === 401) return { message: 'หมดเวลาการเข้าสู่ระบบ กรุณาเข้าสู่ระบบใหม่', retry: false }
  if (status === 403) return { message: 'บัญชีนี้ไม่มีสิทธิ์ตรวจจับ ต้องใช้ Administrator หรือ Safety officer', retry: false }
  if (status === 409) return { message: 'โหมดการเก็บข้อมูลเปลี่ยนแล้ว กรุณารีเฟรชหน้าและอ่านข้อตกลงใหม่', retry: false }
  if (status === 429) return { message: 'เซิร์ฟเวอร์กำลังตรวจภาพของผู้ใช้อื่น จะลองใหม่ใน 5 วินาที', retry: true }
  if (status === 413 || status === 400 || status === 422) return { message: 'เซิร์ฟเวอร์ไม่สามารถรับเฟรมนี้ได้ กรุณาหยุดแล้วเปิดกล้องใหม่', retry: false }
  if (status && status >= 500) return { message: `Backend ไม่พร้อม (HTTP ${status}) อาจกำลังรีสตาร์ตหรือทรัพยากรไม่พอ`, retry: true }
  if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') return { message: 'รอ Backend นานเกินไป อาจกำลังปลุกเซิร์ฟเวอร์หรือประมวลผลบน CPU', retry: true }
  return { message: 'ติดต่อ Backend ไม่ได้ ตรวจอินเทอร์เน็ตและการตั้งค่า API/CORS', retry: true }
}

export function ResearchDemoPage() {
  const { text } = useLanguage()
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const sessionRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const requestRef = useRef<AbortController | null>(null)
  const [accepted, setAccepted] = useState(false)
  const [cloudRecording, setCloudRecording] = useState<boolean | null>(null)
  const [running, setRunning] = useState(false)
  const [cameraReady, setCameraReady] = useState(false)
  const [framesAnalyzed, setFramesAnalyzed] = useState(0)
  const [message, setMessage] = useState('พร้อมทดลองด้วย Webcam หรือกล้อง USB ของเครื่องนี้')
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [deviceId, setDeviceId] = useState('')
  const [result, setResult] = useState<Detection | null>(null)
  const [size, setSize] = useState({ width: 640, height: 480 })

  const stop = () => {
    sessionRef.current += 1
    requestRef.current?.abort()
    requestRef.current = null
    if (timerRef.current) clearTimeout(timerRef.current)
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setRunning(false)
    setCameraReady(false)
    setResult(null)
    setMessage('หยุดกล้องแล้ว')
  }

  useEffect(() => () => {
    sessionRef.current += 1
    requestRef.current?.abort()
    if (timerRef.current) clearTimeout(timerRef.current)
    streamRef.current?.getTracks().forEach((track) => track.stop())
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    void detectionService.getCloudRecordingMode(controller.signal).then((enabled) => {
      if (!controller.signal.aborted) setCloudRecording(enabled)
    }).catch(() => {
      if (!controller.signal.aborted) setMessage('ตรวจโหมดการเก็บข้อมูลไม่ได้ กรุณารีเฟรชหน้าและรอ Backend พร้อม')
    })
    return () => controller.abort()
  }, [])

  const start = async () => {
    if (!accepted || running || cloudRecording === null) return
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setMessage('ต้องเปิดเว็บผ่าน HTTPS และใช้เบราว์เซอร์ที่รองรับกล้อง')
      return
    }
    const session = ++sessionRef.current
    const controller = new AbortController()
    requestRef.current = controller
    setRunning(true)
    setFramesAnalyzed(0)
    setResult(null)
    setMessage('กำลังตรวจความพร้อม Backend… เซิร์ฟเวอร์ฟรีอาจใช้เวลาปลุกประมาณหนึ่งนาที')
    try {
      await detectionService.checkReadiness(controller.signal)
      const currentMode = await detectionService.getCloudRecordingMode(controller.signal)
      if (currentMode !== cloudRecording) {
        if (session !== sessionRef.current) return
        stop()
        setAccepted(false)
        setCloudRecording(currentMode)
        setMessage('โหมดการเก็บข้อมูลเปลี่ยน กรุณาอ่านและยอมรับเงื่อนไขใหม่ก่อนเปิดกล้อง')
        return
      }
    } catch (error) {
      if (session !== sessionRef.current) return
      stop()
      setMessage(detectionFailure(error).message)
      return
    }
    if (session !== sessionRef.current) return
    setMessage('Backend พร้อมแล้ว กำลังขออนุญาตใช้กล้อง…')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { width: { ideal: 640 }, height: { ideal: 480 },
          ...(deviceId ? { deviceId: { exact: deviceId } } : { facingMode: 'environment' }) },
      })
      if (session !== sessionRef.current) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }
      streamRef.current = stream
      const video = videoRef.current
      if (!video) { stop(); return }
      video.srcObject = stream
      await video.play()
      if (session !== sessionRef.current) return
      setCameraReady(true)
      const list = await navigator.mediaDevices.enumerateDevices()
      if (session !== sessionRef.current) return
      setDevices(list.filter((device) => device.kind === 'videoinput'))
      const canvas = document.createElement('canvas')
      let failures = 0
      const capture = async () => {
        if (session !== sessionRef.current) return
        canvas.width = Math.min(video.videoWidth || 640, 640)
        canvas.height = Math.round(canvas.width * (video.videoHeight || 480) / (video.videoWidth || 640))
        setSize({ width: canvas.width, height: canvas.height })
        const context = canvas.getContext('2d')
        if (!context) { stop(); return }
        context.drawImage(video, 0, 0, canvas.width, canvas.height)
        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.7))
        if (!blob || session !== sessionRef.current) return
        setMessage('กำลังตรวจเฟรม… เซิร์ฟเวอร์ฟรีอาจใช้เวลาปลุกหรือประมวลผล')
        let retryDelay = 2000
        try {
          const detection = await detectionService.detectFrame(new File([blob], 'demo-frame.jpg', { type: 'image/jpeg' }), undefined, controller.signal, cloudRecording)
          if (session !== sessionRef.current) return
          failures = 0
          setResult(detection)
          setFramesAnalyzed((count) => count + 1)
          const duration = detection.processing_time_ms == null ? '' : ` · ประมวลผล ${(detection.processing_time_ms / 1000).toFixed(1)} วินาที`
          const saved = detection.id > 0 ? ' · บันทึกผลลง Reports แล้ว' : ''
          setMessage(`พบ ${detection.person_count} คน${duration}${saved} · ผลทดลอง ไม่ใช่การรับรองความปลอดภัย`)
        } catch (error) {
          if (session !== sessionRef.current) return
          failures += 1
          setResult(null)
          const failure = detectionFailure(error)
          if (!failure.retry || failures >= 6) {
            stop()
            setMessage(`${failure.message} · หยุดส่งเฟรมแล้ว กรุณาลองเปิดกล้องใหม่`)
            return
          }
          retryDelay = 5000
          setMessage(`${failure.message} · ลองใหม่ครั้งที่ ${failures}/6 โดยไม่ส่งคำขอซ้อน`)
        }
        if (session === sessionRef.current) timerRef.current = setTimeout(() => { void capture() }, retryDelay)
      }
      void capture()
    } catch {
      if (session === sessionRef.current) { stop(); setMessage('เปิดกล้องไม่สำเร็จ ตรวจสิทธิ์กล้อง สาย USB และแอปที่กำลังใช้กล้อง') }
    }
  }

  return <Layout>
    <section className="flex flex-col gap-5">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="page-heading flex max-w-3xl items-start gap-4">
          <div className="mt-3 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--ink)] text-white" aria-hidden="true"><Camera size={20} strokeWidth={1.8} /></div>
          <div className="min-w-0">
            <h1>{text('กล้องตรวจจับ', 'Site detection cameras')}</h1>
            <p className="max-w-2xl !mt-2 text-[17px] leading-7">{text('เลือกและควบคุมกล้องของเครื่องนี้ พร้อมดูภาพสดและผลตรวจจับบนคลาวด์', 'Control this device’s camera with live preview and cloud detection results.')}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={!running} onClick={stop} className="btn-apple-secondary min-h-11"><Square size={15} aria-hidden="true" />{text('หยุดทั้งหมด', 'Stop all')}</button>
          <button type="button" disabled={running} onClick={() => window.location.reload()} className="btn-apple-secondary min-h-11"><RefreshCw size={16} aria-hidden="true" />{text('รีเฟรช', 'Refresh')}</button>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label={text('สรุปกล้องในรอบการทดสอบนี้', 'Current camera session summary')}>
        {[
          { label: text('กล้องที่เบราว์เซอร์พบ', 'Browser cameras'), value: devices.length || '—' },
          { label: text('กำลังทำงาน', 'Active'), value: cameraReady ? 1 : 0 },
          { label: text('ภาพที่วิเคราะห์ในรอบนี้', 'Session analyzed frames'), value: framesAnalyzed.toLocaleString() },
          { label: text('บุคคลในผลล่าสุด', 'Persons in latest result'), value: result ? result.person_count : '—' },
        ].map((item) => <article key={item.label} className="surface-card p-4 sm:p-5">
          <p className="m-0 text-[13px] font-semibold text-[#6e6e73]">{item.label}</p>
          <p className="mb-0 mt-2 text-[30px] font-semibold tracking-[-0.04em] text-[#1d1d1f]">{item.value}</p>
        </article>)}
      </section>

      <section className="surface-card p-5 sm:p-6" aria-labelledby="cloud-camera-controls">
        <div className="mb-4 flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#f5f5f7] text-[#0066cc]"><Camera size={19} aria-hidden="true" /></span>
          <div><h2 id="cloud-camera-controls" className="m-0 text-[21px] font-semibold">{text('เลือกกล้อง', 'Select camera')}</h2><p className="mb-0 mt-1 text-[14px] text-[var(--muted)]">{text('Webcam หรือ USB ของเครื่องที่เปิดเว็บ · ใช้ภาพที่ได้รับอนุญาตเท่านั้น', 'Webcam or USB on this device · Authorized test footage only')}</p></div>
        </div>
      <p className="rounded-[18px] border border-amber-100 bg-amber-50 p-4 text-[13px] leading-6 text-amber-950">
        โหมดสาธิตโปรเจกต์จบสำหรับผู้ได้รับเชิญเท่านั้น ใช้ภาพทดลองที่ได้รับอนุญาต
        {cloudRecording === null ? ' กำลังตรวจสอบโหมดการเก็บข้อมูล…' : cloudRecording
          ? ' เฟรมส่งไปประมวลผลบนเซิร์ฟเวอร์ ผลตรวจจะบันทึกลงฐานข้อมูลเดโมตามการตั้งค่า หากเปิดบันทึกหลักฐาน ระบบจะเก็บเฉพาะภาพที่เบลอบริเวณศีรษะแล้วใน Storage ส่วนตัว ไม่เก็บวิดีโอต่อเนื่อง การเบลอไม่รับประกันการปกปิดตัวตนทั้งหมด'
          : ' เฟรมจะส่งไปประมวลผลบนเซิร์ฟเวอร์ แต่ไม่บันทึกรูป วิดีโอ หรือประวัติการตรวจ'}
        ไม่รองรับ RTSP ในโหมดนี้ และไม่ใช่ระบบรับรองความปลอดภัย
      </p>
      <label className="flex items-start gap-3 text-[14px] leading-6">
        <input type="checkbox" checked={accepted} disabled={running || cloudRecording === null} onChange={(event) => setAccepted(event.target.checked)} />
        {cloudRecording ? 'ฉันได้รับอนุญาตให้ใช้และเก็บภาพทดลองนี้ และยินยอมประมวลผลและบันทึกผล/ภาพหลักฐานตามการตั้งค่าใน Supabase' : 'ฉันได้รับอนุญาตให้ใช้ภาพทดลองนี้ และยินยอมส่งเฟรมไปประมวลผลบนเซิร์ฟเวอร์'}
      </label>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <select aria-label={text('เลือกกล้อง', 'Select camera')} value={deviceId} disabled={running} onChange={(event) => setDeviceId(event.target.value)} className="min-h-11 w-full rounded-[14px] border border-[var(--line)] bg-white px-4 py-2 text-[14px] sm:w-auto sm:min-w-64">
          <option value="">{text('กล้องเริ่มต้น', 'Default camera')}</option>
          {devices.map((device, index) => <option key={device.deviceId} value={device.deviceId}>{device.label || `กล้อง ${index + 1}`}</option>)}
        </select>
        <button type="button" disabled={!accepted || running || cloudRecording === null} onClick={() => { void start() }} className="btn-apple-primary min-h-11"><Play size={15} aria-hidden="true" />{text('ทดสอบและเริ่ม', 'Test & Start')}</button>
        <button type="button" disabled={!running} onClick={stop} className="btn-apple-secondary min-h-11"><Square size={15} aria-hidden="true" />{text('หยุด', 'Stop')}</button>
      </div>
      </section>

      <div className="grid min-w-0 grid-cols-1 items-start gap-5 lg:grid-cols-2">
        <article className="surface-card min-w-0 p-5 sm:p-6" aria-labelledby="browser-camera-title">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#f5f5f7] text-[#6e6e73]"><Camera size={20} aria-hidden="true" /></span><div className="min-w-0"><h2 id="browser-camera-title" className="m-0 break-words text-[21px] font-semibold">{devices.find((device) => device.deviceId === deviceId)?.label || text('กล้องของเครื่องนี้', 'This device’s camera')}</h2><p className="mb-0 mt-1 text-[13px] text-[var(--muted)]">{text('ภาพสดผ่านเบราว์เซอร์', 'Browser live preview')}</p></div></div>
            <span className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-[12px] font-semibold ${cameraReady ? 'bg-green-50 text-green-700' : 'bg-[#f5f5f7] text-[#6e6e73]'}`}><CircleDot size={12} aria-hidden="true" />{cameraReady ? text('ออนไลน์', 'Online') : running ? text('กำลังเชื่อมต่อ', 'Connecting') : text('ออฟไลน์', 'Offline')}</span>
          </div>
      <div className="relative mt-5 aspect-video overflow-hidden rounded-[18px] border border-[#333336] bg-black">
        <video ref={videoRef} autoPlay muted playsInline className="absolute inset-0 block h-full w-full object-contain" />
        {!cameraReady && <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 px-4 text-center text-[13px] text-white/70"><Camera size={28} aria-hidden="true" />{running ? text('กำลังเตรียมกล้อง…', 'Preparing camera…') : text('ยอมรับเงื่อนไข แล้วกดทดสอบและเริ่ม', 'Accept the terms, then select Test & Start')}</div>}
        <svg className="pointer-events-none absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid meet" viewBox={`0 0 ${size.width} ${size.height}`} aria-hidden="true">
          {result?.persons.map((person) => <g key={person.id}>
            <rect x={person.bbox[0]} y={person.bbox[1]} width={person.bbox[2] - person.bbox[0]} height={person.bbox[3] - person.bbox[1]} fill="none" stroke={person.is_compliant ? '#22c55e' : '#ef4444'} strokeWidth="3" />
            <text x={person.bbox[0]} y={Math.max(16, person.bbox[1] - 5)} fill="white" stroke="black" strokeWidth="0.5" fontSize="14">{person.is_compliant ? 'PPE detected' : `Missing: ${person.not_wearing.join(', ')}`}</text>
          </g>)}
        </svg>
      </div>
          <dl className="mt-5 grid grid-cols-3 gap-2">
            {[
              { label: text('เวลาประมวลผล', 'Processing time'), value: result?.processing_time_ms == null ? '—' : `${(result.processing_time_ms / 1000).toFixed(1)} s` },
              { label: text('ภาพที่วิเคราะห์', 'Frames'), value: framesAnalyzed.toLocaleString() },
              { label: text('โหมด', 'Mode'), value: text('คลาวด์ CPU', 'Cloud CPU') },
            ].map((item) => <div key={item.label} className="min-w-0 rounded-[18px] bg-[#f5f5f7] p-3 sm:p-4"><dt className="text-[11px] font-semibold text-[var(--muted)]">{item.label}</dt><dd className="mb-0 mt-1 text-[17px] font-semibold">{item.value}</dd></div>)}
          </dl>
          <p role="status" aria-live="polite" className="mb-0 mt-4 rounded-[14px] bg-[#f5f5f7] px-4 py-3 text-[13px] leading-6">{message}</p>
          <p className="mb-0 mt-3 text-[12px] leading-5 text-[var(--muted)]">{text('กรอบมาจากเฟรมล่าสุดที่ประมวลผล ไม่ใช่ตำแหน่งปัจจุบันทุกเฟรม · ไม่รับประกันความเร็วบนแพ็กเกจฟรี', 'Boxes belong to the last analyzed frame, not every live frame. Free-plan processing speed is not guaranteed.')}</p>
        </article>

        <article className="surface-card min-w-0 p-5 sm:p-6" aria-labelledby="latest-detection-title">
          <div className="flex items-center gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#f5f5f7] text-[#0066cc]"><ShieldCheck size={20} aria-hidden="true" /></span><div><h2 id="latest-detection-title" className="m-0 text-[21px] font-semibold">{text('ผลตรวจจับล่าสุด', 'Latest detection')}</h2><p className="mb-0 mt-1 text-[13px] text-[var(--muted)]">{text('เฉพาะรอบการเปิดกล้องนี้ ไม่ใช่ยอดรวมในฐานข้อมูล', 'Current camera session only, not database totals')}</p></div></div>
          {result ? <>
            <dl className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-[18px] bg-[#f5f5f7] p-4"><dt className="text-[13px] text-[var(--muted)]">{text('บุคคล', 'Persons')}</dt><dd className="mb-0 mt-2 text-[30px] font-semibold">{result.person_count}</dd></div>
              <div className="rounded-[18px] bg-[#f5f5f7] p-4"><dt className="text-[13px] text-[var(--muted)]">{text('รายการไม่สวม PPE', 'Missing PPE items')}</dt><dd className="mb-0 mt-2 text-[30px] font-semibold text-[#b4232f]">{result.violation_count}</dd></div>
            </dl>
            <ul className="mt-4 max-h-72 space-y-2 overflow-y-auto p-0" aria-label={text('ผล PPE รายบุคคล', 'Per-person PPE results')}>
              {result.persons.map((person) => <li key={person.id} className={`list-none rounded-[14px] border p-3 text-[13px] leading-6 ${person.is_compliant ? 'border-green-100 bg-green-50 text-green-800' : 'border-red-100 bg-red-50 text-red-800'}`}>
                <span className="font-semibold">{text('บุคคล', 'Person')} {person.id}</span><br />{person.is_compliant ? text('พบ PPE ครบตามกฎที่ใช้', 'PPE detected according to active rules') : `${text('ไม่พบ', 'Not detected')}: ${person.not_wearing.join(', ')}`}
              </li>)}
            </ul>
            {result.person_count === 0 && <p className="text-[14px] text-[var(--muted)]">{text('ไม่พบบุคคลในเฟรมล่าสุด', 'No persons detected in the latest frame')}</p>}
            <p className="text-[13px] leading-6 text-[var(--muted)]">{result.id > 0 ? text('บันทึกผลนี้ลง Reports แล้ว', 'This result was saved to Reports') : text('ผลนี้เป็นผลชั่วคราว ยังไม่ได้บันทึกเป็นรายงาน', 'This is a transient result, not a saved report')}</p>
          </> : <div className="my-6 flex min-h-48 flex-col items-center justify-center gap-3 rounded-[18px] bg-[#f5f5f7] px-5 text-center text-[14px] leading-6 text-[var(--muted)]"><Clock3 size={28} aria-hidden="true" /><p className="m-0">{text('ยังไม่มีผลตรวจจับ', 'No detection results yet')}<br />{text('ผลจะแสดงเมื่อ Backend ประมวลผลเฟรมสำเร็จ', 'Results appear after the backend analyzes a frame.')}</p></div>}
          <Link to="/reports" className="btn-apple-secondary min-h-11"><FileText size={16} aria-hidden="true" />{text('ดูรายงานและหลักฐาน', 'View reports & evidence')}</Link>
          <p className="mb-0 mt-4 text-[12px] leading-5 text-[var(--muted)]">{text('ระบบต้นแบบสนับสนุนการตรวจสอบ ไม่ใช่การรับรองความปลอดภัย · กล้อง RTSP ภายในโรงงานต้องใช้ตัวเชื่อมในพื้นที่', 'Research safety-support prototype, not safety certification. Private factory RTSP cameras require an on-site connector.')}</p>
        </article>
      </div>
    </section>
  </Layout>
}
