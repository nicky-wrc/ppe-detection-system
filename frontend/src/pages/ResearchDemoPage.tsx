import { useEffect, useRef, useState } from 'react'
import { isAxiosError } from 'axios'
import { Layout } from '../components/layout/Layout'
import { DetectionPerformance } from '../components/detections/DetectionPerformance'
import { API_ORIGIN } from '../services/api'
import { detectionService } from '../services/detection'
import type { BrowserPerformance, Detection } from '../types'

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
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const sessionRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const requestRef = useRef<AbortController | null>(null)
  const [accepted, setAccepted] = useState(false)
  const [cloudRecording, setCloudRecording] = useState<boolean | null>(null)
  const [running, setRunning] = useState(false)
  const [message, setMessage] = useState('พร้อมทดลองด้วย Webcam หรือกล้อง USB ของเครื่องนี้')
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [deviceId, setDeviceId] = useState('')
  const [result, setResult] = useState<Detection | null>(null)
  const [size, setSize] = useState({ width: 640, height: 480 })
  const samplesRef = useRef({ started: 0, completed: 0, failed: 0, processing: 0, delay: 0, lastResult: 0 })
  const metricsRef = useRef<BrowserPerformance | null>(null)
  const [metrics, setMetrics] = useState<BrowserPerformance | null>(null)
  const [stale, setStale] = useState(false)
  const [performanceError, setPerformanceError] = useState<string>()

  useEffect(() => {
    if (!running) return
    const timer = window.setInterval(() => {
      const samples = samplesRef.current
      if (!samples.completed) return
      const snapshot: BrowserPerformance = {
        api_host: new URL(API_ORIGIN).host,
        elapsed_ms: Math.min(86400000, Math.max(1, performance.now() - samples.started)),
        completed: samples.completed, failed: samples.failed, skipped: 0,
        processing_ms: samples.processing / samples.completed,
        delay_ms: samples.delay / samples.completed, target_interval_ms: 1000,
      }
      metricsRef.current = snapshot
      setMetrics(snapshot)
      setStale(performance.now() - samples.lastResult > Math.max(5000, snapshot.delay_ms * 2))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [running])

  const stop = () => {
    sessionRef.current += 1
    requestRef.current?.abort()
    requestRef.current = null
    if (timerRef.current) clearTimeout(timerRef.current)
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setRunning(false)
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
    samplesRef.current = { started: 0, completed: 0, failed: 0, processing: 0, delay: 0, lastResult: 0 }
    metricsRef.current = null
    setMetrics(null)
    setStale(false)
    setPerformanceError(undefined)
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
        const capturedAt = performance.now()
        if (!samplesRef.current.started) samplesRef.current.started = capturedAt
        context.drawImage(video, 0, 0, canvas.width, canvas.height)
        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.7))
        if (!blob || session !== sessionRef.current) return
        setMessage('กำลังตรวจเฟรม… เซิร์ฟเวอร์ฟรีอาจใช้เวลาปลุกหรือประมวลผล')
        let retryDelay = 2000
        try {
          const detection = await detectionService.detectFrame(new File([blob], 'demo-frame.jpg', { type: 'image/jpeg' }), undefined, controller.signal, cloudRecording, metricsRef.current ?? undefined)
          if (session !== sessionRef.current) return
          failures = 0
          const samples = samplesRef.current
          samples.completed += 1
          samples.processing += detection.processing_time_ms ?? 0
          samples.delay += performance.now() - capturedAt
          samples.lastResult = performance.now()
          setPerformanceError(undefined)
          setResult(detection)
          const duration = detection.processing_time_ms == null ? '' : ` · ประมวลผล ${(detection.processing_time_ms / 1000).toFixed(1)} วินาที`
          const saved = detection.id > 0 ? ' · บันทึกผลลง Reports แล้ว' : ''
          setMessage(`พบ ${detection.person_count} คน${duration}${saved} · ผลทดลอง ไม่ใช่การรับรองความปลอดภัย`)
        } catch (error) {
          if (session !== sessionRef.current) return
          failures += 1
          samplesRef.current.failed += 1
          setResult(null)
          const failure = detectionFailure(error)
          setPerformanceError(failure.message)
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
    <section className="mx-auto max-w-4xl space-y-5 p-6">
      <h1 className="text-2xl font-semibold">ทดลองตรวจ PPE ผ่านกล้อง</h1>
      <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-950">
        โหมดสาธิตโปรเจกต์จบสำหรับผู้ได้รับเชิญเท่านั้น ใช้ภาพทดลองที่ได้รับอนุญาต
        {cloudRecording === null ? ' กำลังตรวจสอบโหมดการเก็บข้อมูล…' : cloudRecording
          ? ' เฟรมส่งไปประมวลผลบนเซิร์ฟเวอร์ ผลตรวจจะบันทึกลงฐานข้อมูลเดโมตามการตั้งค่า หากเปิดบันทึกหลักฐาน ระบบจะเก็บเฉพาะภาพที่เบลอบริเวณศีรษะแล้วใน Storage ส่วนตัว ไม่เก็บวิดีโอต่อเนื่อง การเบลอไม่รับประกันการปกปิดตัวตนทั้งหมด'
          : ' เฟรมจะส่งไปประมวลผลบนเซิร์ฟเวอร์ แต่ไม่บันทึกรูป วิดีโอ หรือประวัติการตรวจ'}
        ไม่รองรับ RTSP ในโหมดนี้ และไม่ใช่ระบบรับรองความปลอดภัย
      </p>
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" checked={accepted} disabled={running || cloudRecording === null} onChange={(event) => setAccepted(event.target.checked)} />
        {cloudRecording ? 'ฉันได้รับอนุญาตให้ใช้และเก็บภาพทดลองนี้ และยินยอมประมวลผลและบันทึกผล/ภาพหลักฐานตามการตั้งค่าใน Supabase' : 'ฉันได้รับอนุญาตให้ใช้ภาพทดลองนี้ และยินยอมส่งเฟรมไปประมวลผลบนเซิร์ฟเวอร์'}
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <select aria-label="เลือกกล้อง" value={deviceId} disabled={running} onChange={(event) => setDeviceId(event.target.value)} className="rounded-lg border p-2">
          <option value="">กล้องเริ่มต้น</option>
          {devices.map((device, index) => <option key={device.deviceId} value={device.deviceId}>{device.label || `กล้อง ${index + 1}`}</option>)}
        </select>
        <button type="button" disabled={!accepted || running || cloudRecording === null} onClick={() => { void start() }} className="rounded-lg bg-blue-600 px-4 py-2 text-white disabled:opacity-40">เปิดกล้อง</button>
        <button type="button" disabled={!running} onClick={stop} className="rounded-lg border px-4 py-2 disabled:opacity-40">หยุดกล้อง</button>
      </div>
      <div className="relative overflow-hidden rounded-xl bg-black" style={{ aspectRatio: `${size.width} / ${size.height}` }}>
        <video ref={videoRef} autoPlay muted playsInline className="block h-full w-full object-contain" />
        {!running && <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-white/70">ยังไม่ได้เปิดกล้อง</div>}
        <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 ${size.width} ${size.height}`} aria-hidden="true">
          {result?.persons.map((person) => <g key={person.id}>
            <rect x={person.bbox[0]} y={person.bbox[1]} width={person.bbox[2] - person.bbox[0]} height={person.bbox[3] - person.bbox[1]} fill="none" stroke={person.is_compliant ? '#22c55e' : '#ef4444'} strokeWidth="3" />
            <text x={person.bbox[0]} y={Math.max(16, person.bbox[1] - 5)} fill="white" stroke="black" strokeWidth="0.5" fontSize="14">{person.is_compliant ? 'PPE detected' : `Missing: ${person.not_wearing.join(', ')}`}</text>
          </g>)}
        </svg>
      </div>
      <p role="status" aria-live="polite">{message}</p>
      {running && <DetectionPerformance detection={result} metrics={metrics} live stale={stale} error={performanceError} />}
      <p className="text-sm text-gray-600">กรอบเป็นผลของเฟรมล่าสุดที่ประมวลผล ไม่ใช่ตำแหน่งปัจจุบันทุกเฟรม · ไม่รับประกันความเร็วบนแพ็กเกจฟรี</p>
    </section>
  </Layout>
}
