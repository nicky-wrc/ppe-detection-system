import { useCallback, useEffect, useRef, useState } from 'react'
import { Layout } from '../components/layout/Layout'
import { detectionService } from '../services/detection'
import type { Detection } from '../types'
import { Camera, Play, Square, Loader2, ShieldCheck, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'

export function CameraPage() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const captureCanvasRef = useRef<HTMLCanvasElement>(null)
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const rafRef = useRef<number | null>(null)

  const [isCameraOn, setIsCameraOn] = useState(false)
  const [isDetecting, setIsDetecting] = useState(false)
  const [isBusy, setIsBusy] = useState(false)
  const [lastResult, setLastResult] = useState<Detection | null>(null)
  const [framesAnalyzed, setFramesAnalyzed] = useState(0)

  const drawOverlay = useCallback(() => {
    const video = videoRef.current
    const canvas = overlayCanvasRef.current
    if (!video || !canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const rect = video.getBoundingClientRect()
    canvas.width = Math.max(1, Math.round(rect.width))
    canvas.height = Math.max(1, Math.round(rect.height))
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    if (!isDetecting || !lastResult) return

    const sourceW = video.videoWidth || canvas.width
    const sourceH = video.videoHeight || canvas.height
    const scaleX = canvas.width / sourceW
    const scaleY = canvas.height / sourceH

    // Use detected objects for clearer overlay on all findings.
    for (const obj of lastResult.detected_objects || []) {
      if (!obj?.bbox || obj.bbox.length < 4) continue
      const [x1, y1, x2, y2] = obj.bbox
      const x = x1 * scaleX
      const y = y1 * scaleY
      const w = (x2 - x1) * scaleX
      const h = (y2 - y1) * scaleY

      const isViolation = obj.is_violation
      const color = isViolation ? '#ef4444' : '#22c55e'
      ctx.lineWidth = isViolation ? 3 : 2.5
      ctx.strokeStyle = color
      ctx.fillStyle = color
      ctx.strokeRect(x, y, w, h)

      const label = `${obj.class_name}${isViolation ? ' (violation)' : ''}`
      ctx.font = 'bold 12px Arial'
      const textW = ctx.measureText(label).width
      const padX = 6
      const boxH = 18
      const labelY = Math.max(0, y - boxH)
      ctx.fillRect(x, labelY, textW + padX * 2, boxH)
      ctx.fillStyle = '#ffffff'
      ctx.fillText(label, x + padX, labelY + 13)
    }
  }, [isDetecting, lastResult])

  const startOverlayLoop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    const loop = () => {
      drawOverlay()
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
  }, [drawOverlay])

  const stopDetection = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    setIsDetecting(false)
  }, [])

  const stopCamera = useCallback(() => {
    stopDetection()
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    if (overlayCanvasRef.current) {
      const ctx = overlayCanvasRef.current.getContext('2d')
      ctx?.clearRect(0, 0, overlayCanvasRef.current.width, overlayCanvasRef.current.height)
    }
    setIsCameraOn(false)
  }, [stopDetection])

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'environment' },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setIsCameraOn(true)
      toast.success('เปิดกล้องแล้ว')
    } catch (error) {
      console.error(error)
      toast.error('ไม่สามารถเปิดกล้องได้ กรุณาอนุญาตการเข้าถึงกล้อง')
    }
  }, [])

  const detectFrame = useCallback(async () => {
    if (!videoRef.current || !captureCanvasRef.current || isBusy) return
    const video = videoRef.current
    if (!video.videoWidth || !video.videoHeight) return

    const canvas = captureCanvasRef.current
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

    setIsBusy(true)
    canvas.toBlob(async (blob) => {
      if (!blob) {
        setIsBusy(false)
        return
      }
      try {
        const frame = new File([blob], 'camera-frame.jpg', { type: 'image/jpeg' })
        const result = await detectionService.detectFrame(frame)
        setLastResult(result)
        setFramesAnalyzed((prev) => prev + 1)
      } catch (error) {
        console.error(error)
      } finally {
        setIsBusy(false)
      }
    }, 'image/jpeg', 0.85)
  }, [isBusy])

  const startDetection = useCallback(() => {
    if (!isCameraOn) return
    if (intervalRef.current) clearInterval(intervalRef.current)
    intervalRef.current = setInterval(() => {
      void detectFrame()
    }, 2000)
    setIsDetecting(true)
    startOverlayLoop()
    toast.success('เริ่มตรวจจับจากกล้องแล้ว')
  }, [detectFrame, isCameraOn, startOverlayLoop])

  useEffect(() => {
    return () => {
      stopCamera()
    }
  }, [stopCamera])

  useEffect(() => {
    if (!isDetecting && overlayCanvasRef.current) {
      const ctx = overlayCanvasRef.current.getContext('2d')
      ctx?.clearRect(0, 0, overlayCanvasRef.current.width, overlayCanvasRef.current.height)
    }
  }, [isDetecting])

  return (
    <Layout>
      <div className="flex flex-col gap-6">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-[22px] font-bold text-[#0f172a] m-0">Camera Detection</h1>
            <p className="text-[13px] text-[#64748b] mt-1">
              เปิดกล้องสดและตรวจจับ PPE แบบต่อเนื่องทุก 2 วินาที
            </p>
          </div>
          <div className="flex items-center gap-3">
            {!isCameraOn ? (
              <button
                onClick={() => void startCamera()}
                className="flex items-center gap-2 px-5 py-3 bg-[#2563eb] text-white border-none rounded-[12px] text-[15px] font-semibold cursor-pointer shadow-sm"
              >
                <Camera size={16} />
                เปิดกล้อง
              </button>
            ) : (
              <button
                onClick={stopCamera}
                className="flex items-center gap-2 px-5 py-3 bg-[#ef4444] text-white border-none rounded-[12px] text-[15px] font-semibold cursor-pointer shadow-sm"
              >
                <Square size={16} />
                ปิดกล้อง
              </button>
            )}

            {isCameraOn && !isDetecting && (
              <button
                onClick={startDetection}
                className="flex items-center gap-2 px-5 py-3 bg-[#16a34a] text-white border-none rounded-[12px] text-[15px] font-semibold cursor-pointer shadow-sm"
              >
                <Play size={16} />
                เริ่มตรวจจับ
              </button>
            )}
            {isCameraOn && isDetecting && (
              <button
                onClick={stopDetection}
                className="flex items-center gap-2 px-5 py-3 bg-[#f59e0b] text-white border-none rounded-[12px] text-[15px] font-semibold cursor-pointer shadow-sm"
              >
                <Square size={16} />
                หยุดตรวจจับ
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-[1fr_360px] gap-5 items-start">
          <div className="bg-white border border-[#e2e8f0] rounded-2xl overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-[#f1f5f9] text-[15px] font-semibold text-[#0f172a]">
              Live Camera
            </div>
            <div className="p-5">
              <div className="relative bg-black rounded-xl overflow-hidden min-h-[480px] flex items-center justify-center">
                <video ref={videoRef} className="w-full h-full object-contain" playsInline muted />
                <canvas ref={overlayCanvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />
              </div>
              <canvas ref={captureCanvasRef} className="hidden" />
            </div>
          </div>

          <div className="bg-white border border-[#e2e8f0] rounded-2xl overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-[#f1f5f9] text-[15px] font-semibold text-[#0f172a]">
              Detection Status
            </div>
            <div className="p-5">
              <div className="text-[14px] text-[#64748b] mb-3">Frames analyzed: {framesAnalyzed}</div>
              {isBusy && (
                <div className="flex items-center gap-2 text-[14px] text-[#64748b] mb-3">
                  <Loader2 size={16} className="animate-spin" />
                  Processing latest frame...
                </div>
              )}
              {lastResult ? (
                <div
                  className={`rounded-xl border px-3 py-3 ${
                    lastResult.has_violation ? 'bg-[#fff1f2] border-[#fecaca]' : 'bg-[#f0fdf4] border-[#bbf7d0]'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    {lastResult.has_violation ? (
                      <AlertTriangle size={15} className="text-[#dc2626]" />
                    ) : (
                      <ShieldCheck size={15} className="text-[#16a34a]" />
                    )}
                    <span className={`text-[14px] font-semibold ${lastResult.has_violation ? 'text-[#dc2626]' : 'text-[#16a34a]'}`}>
                      {lastResult.has_violation ? 'Violation Detected' : 'Compliant'}
                    </span>
                  </div>
                  <p className="text-[14px] text-[#475569] m-0 mb-1">Persons: {lastResult.person_count}</p>
                  <p className="text-[14px] text-[#475569] m-0">Violations: {lastResult.violation_count}</p>
                </div>
              ) : (
                <p className="text-[14px] text-[#94a3b8] m-0">ยังไม่มีผลลัพธ์จากกล้อง</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}
