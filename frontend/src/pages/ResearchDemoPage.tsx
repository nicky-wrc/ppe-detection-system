import { useEffect, useRef, useState } from 'react'
import { Layout } from '../components/layout/Layout'
import { detectionService } from '../services/detection'
import type { Detection } from '../types'

export function ResearchDemoPage() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const sessionRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [accepted, setAccepted] = useState(false)
  const [running, setRunning] = useState(false)
  const [message, setMessage] = useState('พร้อมทดลองด้วย Webcam หรือกล้อง USB ของเครื่องนี้')
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [deviceId, setDeviceId] = useState('')
  const [result, setResult] = useState<Detection | null>(null)
  const [size, setSize] = useState({ width: 640, height: 480 })

  const stop = () => {
    sessionRef.current += 1
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
    if (timerRef.current) clearTimeout(timerRef.current)
    streamRef.current?.getTracks().forEach((track) => track.stop())
  }, [])

  const start = async () => {
    if (!accepted || running) return
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setMessage('ต้องเปิดเว็บผ่าน HTTPS และใช้เบราว์เซอร์ที่รองรับกล้อง')
      return
    }
    const session = ++sessionRef.current
    setRunning(true)
    setResult(null)
    setMessage('กำลังขออนุญาตใช้กล้อง…')
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
        context.drawImage(video, 0, 0, canvas.width, canvas.height)
        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.7))
        if (!blob || session !== sessionRef.current) return
        setMessage('กำลังตรวจเฟรม… เซิร์ฟเวอร์ฟรีอาจใช้เวลาปลุกหรือประมวลผล')
        try {
          const detection = await detectionService.detectFrame(new File([blob], 'demo-frame.jpg', { type: 'image/jpeg' }))
          if (session !== sessionRef.current) return
          failures = 0
          setResult(detection)
          setMessage(`พบ ${detection.person_count} คน · ผลตรวจ PPE เป็นผลทดลอง ไม่ใช่การรับรองความปลอดภัย`)
        } catch {
          if (session !== sessionRef.current) return
          failures += 1
          setResult(null)
          if (failures >= 3) { stop(); setMessage('ตรวจจับไม่สำเร็จ กรุณาตรวจว่า Backend พร้อมแล้วและลองใหม่'); return }
          setMessage('Backend ไม่พร้อมหรือมีผู้ใช้อื่นกำลังตรวจ จะลองใหม่โดยไม่ส่งคำขอซ้อน')
        }
        if (session === sessionRef.current) timerRef.current = setTimeout(() => { void capture() }, 2000)
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
        เฟรมจะส่งไปประมวลผลบนเซิร์ฟเวอร์ แต่ไม่บันทึกรูป วิดีโอ หรือประวัติการตรวจ
        ไม่รองรับ RTSP ในโหมดนี้ และไม่ใช่ระบบรับรองความปลอดภัย
      </p>
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" checked={accepted} disabled={running} onChange={(event) => setAccepted(event.target.checked)} />
        ฉันได้รับอนุญาตให้ใช้ภาพทดลองนี้ และยินยอมส่งเฟรมไปประมวลผลบนเซิร์ฟเวอร์
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <select aria-label="เลือกกล้อง" value={deviceId} disabled={running} onChange={(event) => setDeviceId(event.target.value)} className="rounded-lg border p-2">
          <option value="">กล้องเริ่มต้น</option>
          {devices.map((device, index) => <option key={device.deviceId} value={device.deviceId}>{device.label || `กล้อง ${index + 1}`}</option>)}
        </select>
        <button type="button" disabled={!accepted || running} onClick={() => { void start() }} className="rounded-lg bg-blue-600 px-4 py-2 text-white disabled:opacity-40">เปิดกล้อง</button>
        <button type="button" disabled={!running} onClick={stop} className="rounded-lg border px-4 py-2 disabled:opacity-40">หยุดกล้อง</button>
      </div>
      <div className="relative overflow-hidden rounded-xl bg-black">
        <video ref={videoRef} autoPlay muted playsInline className="block w-full" />
        <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 ${size.width} ${size.height}`} aria-hidden="true">
          {result?.persons.map((person) => <g key={person.id}>
            <rect x={person.bbox[0]} y={person.bbox[1]} width={person.bbox[2] - person.bbox[0]} height={person.bbox[3] - person.bbox[1]} fill="none" stroke={person.is_compliant ? '#22c55e' : '#ef4444'} strokeWidth="3" />
            <text x={person.bbox[0]} y={Math.max(16, person.bbox[1] - 5)} fill="white" stroke="black" strokeWidth="0.5" fontSize="14">{person.is_compliant ? 'PPE detected' : `Missing: ${person.not_wearing.join(', ')}`}</text>
          </g>)}
        </svg>
      </div>
      <p role="status" aria-live="polite">{message}</p>
      <p className="text-sm text-gray-600">กรอบเป็นผลของเฟรมล่าสุดที่ประมวลผล ไม่ใช่ตำแหน่งปัจจุบันทุกเฟรม · ไม่รับประกันความเร็วบนแพ็กเกจฟรี</p>
    </section>
  </Layout>
}
