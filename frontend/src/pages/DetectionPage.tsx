import { useState, useCallback, useRef, useEffect } from 'react'
import { useDropzone } from 'react-dropzone'
import { Layout } from '../components/layout/Layout'
import { detectionService } from '../services/detection'
import type { Detection } from '../types'
import {
  Upload,
  AlertTriangle,
  CheckCircle,
  Loader2,
  X,
  Users,
  Clock,
  Image as ImageIcon,
  ShieldCheck,
  Video,
  Camera,
  RefreshCw,
} from 'lucide-react'
import toast from 'react-hot-toast'

type TabType = 'image' | 'video' | 'camera'

const LIVE_DETECT_INTERVAL_MS = 1000
const LIVE_CONFIRM_FRAMES = 2
const LIVE_CLEAR_FRAMES = 2
const LIVE_EVENT_COOLDOWN_MS = 60_000
const LIVE_PERSIST_RETRY_MS = 10_000

const getCameraDeviceLabel = (device: MediaDeviceInfo, index: number) => (
  device.label || `Camera ${index + 1}`
)

const getViolationSignature = (detection: Detection): string => {
  const violations = [...(detection.violations || [])].filter(Boolean).sort()
  return violations.length > 0
    ? violations.join('|')
    : `violation:${detection.violation_count}`
}

const drawDetectionOverlay = (
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  naturalWidth: number,
  naturalHeight: number,
  det: Detection | null
) => {
  if (!det?.persons || det.persons.length === 0) return

  const scaleX = canvasWidth / naturalWidth
  const scaleY = canvasHeight / naturalHeight

  det.persons.forEach((person) => {
    if (!person.bbox) return
    const [x1, y1, x2, y2] = person.bbox.map((v: number, i: number) =>
      i % 2 === 0 ? v * scaleX : v * scaleY
    )
    const color = person.is_compliant ? '#22c55e' : '#ef4444'
    const lineW = Math.max(2, canvasWidth / 300)
    ctx.strokeStyle = color
    ctx.lineWidth = lineW
    ctx.strokeRect(x1, y1, x2 - x1, y2 - y1)

    const cl = Math.min(20, (x2 - x1) / 5, (y2 - y1) / 5)
    const corners: [number, number, number, number][] = [
      [x1, y1, 1, 1], [x2, y1, -1, 1], [x1, y2, 1, -1], [x2, y2, -1, -1]
    ]
    ctx.lineWidth = lineW * 2.5
    corners.forEach(([cx, cy, dx, dy]) => {
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + cl * dx, cy); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx, cy + cl * dy); ctx.stroke()
    })

    const label = `Person ${person.id} · ${person.is_compliant ? '✓ Safe' : '✗ Violation'}`
    const fontSize = Math.max(11, canvasWidth / 60)
    ctx.font = `600 ${fontSize}px system-ui, -apple-system, sans-serif`
    const tw = ctx.measureText(label).width
    const lh = fontSize + 8
    
    ctx.fillStyle = color
    ctx.fillRect(x1, y1 - lh - 2, tw + 12, lh + 2)
    ctx.fillStyle = '#fff'
    ctx.fillText(label, x1 + 6, y1 - 6)

    let ty = y1 + 4 + fontSize
    const drawPpe = (text: string, ok: boolean) => {
      const fs2 = Math.max(9, fontSize - 3)
      ctx.font = `600 ${fs2}px system-ui, -apple-system, sans-serif`
      const tw2 = ctx.measureText(text).width
      ctx.fillStyle = ok ? 'rgba(34,197,94,0.85)' : 'rgba(239,68,68,0.85)'
      ctx.fillRect(x1 + 5, ty - fs2, tw2 + 10, fs2 + 6)
      ctx.fillStyle = '#fff'
      ctx.fillText(text, x1 + 10, ty)
      ty += fs2 + 10
    }

    const toThai = (key: string) => {
      const k = (key || '').toLowerCase()
      if (k === 'helmet') return 'หมวกนิรภัย'
      if (k === 'safety-vest' || k === 'vest') return 'เสื้อสะท้อนแสง'
      if (k === 'glasses') return 'แว่นตานิรภัย'
      if (k === 'gloves') return 'ถุงมือ'
      if (k === 'shoes') return 'รองเท้านิรภัย'
      if (k === 'face-mask') return 'หน้ากาก'
      if (k === 'ear-mufs') return 'ที่ครอบหู'
      if (k === 'face-guard') return 'กระบังหน้า'
      return key
    }

    person.wearing?.forEach((item: string) => drawPpe(`✓ ${toThai(item)}`, true))
    person.not_wearing?.forEach((item: string) => drawPpe(`✗ ${toThai(item)}`, false))
  })

  // Top banner
  const msg = det.summary?.message || ''
  const bannerH = Math.max(28, canvasWidth / 25)
  const isViolation = det.has_violation
  ctx.fillStyle = isViolation ? 'rgba(200,30,30,0.82)' : 'rgba(22,163,74,0.82)'
  ctx.fillRect(0, 0, canvasWidth, bannerH)
  ctx.fillStyle = '#fff'
  ctx.font = `600 ${Math.max(11, bannerH * 0.5)}px system-ui, -apple-system, sans-serif`
  ctx.fillText(msg, 12, bannerH * 0.72)
}

export function DetectionPage() {
  const [activeTab, setActiveTab] = useState<TabType>('image')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [processedVideoUrl, setProcessedVideoUrl] = useState<string | null>(null)
  const [videoPlaybackNotice, setVideoPlaybackNotice] = useState<string | null>(null)
  const [result, setResult] = useState<Detection | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [operationError, setOperationError] = useState<string | null>(null)

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview)
  }, [preview])

  useEffect(() => () => {
    if (processedVideoUrl) URL.revokeObjectURL(processedVideoUrl)
  }, [processedVideoUrl])

  // ── Image detection overlay ──────────────────────────
  const imageCanvasRef = useRef<HTMLCanvasElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)

  useEffect(() => {
    if (activeTab === 'image' && preview) {
      const img = imageRef.current
      const canvas = imageCanvasRef.current
      if (!img || !canvas) return

      const draw = () => {
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        
        // Match canvas dimensions to actual image dimensions
        const natW = img.naturalWidth || img.width
        const natH = img.naturalHeight || img.height
        canvas.width = natW
        canvas.height = natH

        // Draw original image
        ctx.drawImage(img, 0, 0, natW, natH)

        // Draw the AI overlays on top if we have results
        if (result) {
          drawDetectionOverlay(ctx, natW, natH, natW, natH, result)
        }
      }

      if (img.complete) {
        draw()
      } else {
        img.onload = draw
      }
    }
  }, [activeTab, preview, result])

  // ── Real-time video detection with canvas overlay ──────────────────────────
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const captureCanvasRef = useRef<HTMLCanvasElement>(null)
  const cameraStreamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastDetectionRef = useRef<Detection | null>(null)
  const isFrameBusyRef = useRef(false)
  const liveSessionRef = useRef(0)
  const cameraRequestRef = useRef(0)
  const detectionRequestRef = useRef(0)
  const activeViolationSignatureRef = useRef<string | null>(null)
  const violationStreakRef = useRef(0)
  const clearStreakRef = useRef(0)
  const recordedViolationSignatureRef = useRef<string | null>(null)
  const persistedAtBySignatureRef = useRef<Record<string, number>>({})
  const persistAttemptAtBySignatureRef = useRef<Record<string, number>>({})
  const isPersistingViolationRef = useRef(false)
  const [isLiveDetecting, setIsLiveDetecting] = useState(false)
  const [isCameraOn, setIsCameraOn] = useState(false)
  const [isCameraStarting, setIsCameraStarting] = useState(false)
  const [liveFrameCount, setLiveFrameCount] = useState(0)
  const [availableCameraDevices, setAvailableCameraDevices] = useState<MediaDeviceInfo[]>([])
  const [selectedCameraDeviceId, setSelectedCameraDeviceId] = useState('')

  const refreshAvailableCameraDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) {
      setAvailableCameraDevices([])
      return
    }

    try {
      let devices = await navigator.mediaDevices.enumerateDevices()
      let videoInputs = devices.filter((device) => device.kind === 'videoinput')

      if (videoInputs.length > 0 && videoInputs.every((device) => !device.label) && navigator.mediaDevices.getUserMedia) {
        const probeStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        probeStream.getTracks().forEach((track) => track.stop())
        devices = await navigator.mediaDevices.enumerateDevices()
        videoInputs = devices.filter((device) => device.kind === 'videoinput')
      }

      setAvailableCameraDevices(videoInputs)
      setSelectedCameraDeviceId((current) => (
        current && videoInputs.some((device) => device.deviceId === current)
          ? current
          : videoInputs[0]?.deviceId || ''
      ))
    } catch (error) {
      console.error('Camera device enumeration failed:', error)
      setAvailableCameraDevices([])
      setSelectedCameraDeviceId('')
    }
  }, [])

  const renderLoop = useCallback(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    canvas.width = video.videoWidth || canvas.width
    canvas.height = video.videoHeight || canvas.height
    
    // Draw raw video frame
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    
    // Draw overlays
    const det = lastDetectionRef.current
    drawDetectionOverlay(
      ctx,
      canvas.width,
      canvas.height,
      video.videoWidth || canvas.width,
      video.videoHeight || canvas.height,
      det
    )

    // Draw "LIVE DETECT" badge
    if (!video.paused && !video.ended) {
      const badgeH = 22; const bx = 10; const by = (det?.persons?.length ? 38 : 10)
      const badgeW = 110; const r = 11
      ctx.fillStyle = 'rgba(220,38,38,0.88)'
      ctx.beginPath()
      ctx.moveTo(bx + r, by); ctx.lineTo(bx + badgeW - r, by)
      ctx.quadraticCurveTo(bx + badgeW, by, bx + badgeW, by + r)
      ctx.lineTo(bx + badgeW, by + badgeH - r)
      ctx.quadraticCurveTo(bx + badgeW, by + badgeH, bx + badgeW - r, by + badgeH)
      ctx.lineTo(bx + r, by + badgeH)
      ctx.quadraticCurveTo(bx, by + badgeH, bx, by + badgeH - r)
      ctx.lineTo(bx, by + r)
      ctx.quadraticCurveTo(bx, by, bx + r, by)
      ctx.closePath(); ctx.fill()
      ctx.fillStyle = '#fff'
      ctx.beginPath(); ctx.arc(bx + 18, by + badgeH / 2, 5, 0, Math.PI * 2); ctx.fill()
      ctx.font = '600 11px system-ui, -apple-system, sans-serif'
      ctx.fillText('LIVE DETECT', bx + 28, by + 15)
    }

    if (!video.paused && !video.ended) {
      rafRef.current = requestAnimationFrame(renderLoop)
    }
  }, [])

  const updateLiveViolationEpisode = useCallback(async (
    detection: Detection,
    frameFile: File,
    sessionId: number,
  ) => {
    if (!detection.has_violation) {
      clearStreakRef.current += 1
      if (clearStreakRef.current >= LIVE_CLEAR_FRAMES) {
        activeViolationSignatureRef.current = null
        recordedViolationSignatureRef.current = null
        violationStreakRef.current = 0
      }
      return
    }

    clearStreakRef.current = 0
    const signature = getViolationSignature(detection)
    if (activeViolationSignatureRef.current === signature) {
      violationStreakRef.current += 1
    } else {
      activeViolationSignatureRef.current = signature
      recordedViolationSignatureRef.current = null
      violationStreakRef.current = 1
    }

    const now = Date.now()
    const lastPersistedAt = persistedAtBySignatureRef.current[signature] || 0
    const lastAttemptAt = persistAttemptAtBySignatureRef.current[signature] || 0
    if (
      violationStreakRef.current < LIVE_CONFIRM_FRAMES
      || recordedViolationSignatureRef.current === signature
      || now - lastPersistedAt < LIVE_EVENT_COOLDOWN_MS
      || now - lastAttemptAt < LIVE_PERSIST_RETRY_MS
      || isPersistingViolationRef.current
      || sessionId !== liveSessionRef.current
    ) {
      return
    }

    isPersistingViolationRef.current = true
    persistAttemptAtBySignatureRef.current[signature] = now
    try {
      // Reuse the authenticated image flow so the confirmed frame, Detection and
      // Alert are committed together instead of creating a second API contract.
      const persisted = await detectionService.uploadImage(frameFile)
      if (sessionId !== liveSessionRef.current) return
      if (persisted.has_violation) {
        recordedViolationSignatureRef.current = signature
        persistedAtBySignatureRef.current[signature] = Date.now()
        toast.success('บันทึกเหตุการณ์ฝ่าฝืนแล้ว')
      }
    } catch (error) {
      if (sessionId !== liveSessionRef.current) return
      console.error('Live violation persist error:', error)
      toast.error('บันทึกเหตุการณ์ฝ่าฝืนไม่สำเร็จ')
    } finally {
      if (sessionId === liveSessionRef.current) isPersistingViolationRef.current = false
    }
  }, [])

  const captureAndDetect = useCallback(async () => {
    const video = videoRef.current
    const cap = captureCanvasRef.current
    if (!video || !cap || video.paused || video.ended || isFrameBusyRef.current) return
    if (!video.videoWidth || !video.videoHeight) return
    cap.width = video.videoWidth; cap.height = video.videoHeight
    const ctx = cap.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0, cap.width, cap.height)
    const sessionId = liveSessionRef.current
    isFrameBusyRef.current = true
    cap.toBlob(async (blob) => {
      if (sessionId !== liveSessionRef.current) return
      if (!blob) {
        if (sessionId === liveSessionRef.current) isFrameBusyRef.current = false
        return
      }
      try {
        if (sessionId !== liveSessionRef.current) return
        const frameFile = new File([blob], 'frame.jpg', { type: 'image/jpeg' })
        const detection = await detectionService.detectFrame(frameFile)
        if (sessionId !== liveSessionRef.current) return
        lastDetectionRef.current = detection
        
        // Setting state here triggers the overall right-panel updates for video as well
        setResult(detection)
        setLiveFrameCount(prev => prev + 1)
        await updateLiveViolationEpisode(detection, frameFile, sessionId)
      } catch (err) {
        if (sessionId === liveSessionRef.current) console.error('Frame detect error:', err)
      } finally {
        if (sessionId === liveSessionRef.current) isFrameBusyRef.current = false
      }
    }, 'image/jpeg', 0.8)
  }, [updateLiveViolationEpisode])

  const stopLiveDetection = useCallback(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null }
    liveSessionRef.current += 1
    activeViolationSignatureRef.current = null
    recordedViolationSignatureRef.current = null
    violationStreakRef.current = 0
    clearStreakRef.current = 0
    isFrameBusyRef.current = false
    isPersistingViolationRef.current = false
    setIsLiveDetecting(false)
  }, [])

  const startLiveDetection = useCallback(() => {
    if (!videoRef.current) return
    setIsLiveDetecting(true)
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(renderLoop)
    if (intervalRef.current) clearInterval(intervalRef.current)
    void captureAndDetect()
    intervalRef.current = setInterval(captureAndDetect, LIVE_DETECT_INTERVAL_MS)
  }, [renderLoop, captureAndDetect])

  const stopCamera = useCallback(() => {
    cameraRequestRef.current += 1
    stopLiveDetection()
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((track) => track.stop())
      cameraStreamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setIsCameraOn(false)
    setIsCameraStarting(false)
  }, [stopLiveDetection])

  const startCamera = useCallback(async (preferredDeviceId?: string) => {
    if (!navigator.mediaDevices?.getUserMedia) {
      const message = 'เบราว์เซอร์นี้ไม่รองรับการเปิดกล้อง'
      setOperationError(message)
      toast.error(message)
      return
    }

    const requestId = cameraRequestRef.current + 1
    cameraRequestRef.current = requestId
    setOperationError(null)
    setIsCameraStarting(true)
    try {
      if (availableCameraDevices.length === 0) {
        await refreshAvailableCameraDevices()
      }
      const deviceId = preferredDeviceId || selectedCameraDeviceId || availableCameraDevices[0]?.deviceId
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          ...(deviceId ? { deviceId: { exact: deviceId } } : { facingMode: 'environment' }),
        },
        audio: false,
      })

      if (cameraRequestRef.current !== requestId) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }

      cameraStreamRef.current = stream
      const video = videoRef.current
      if (!video) {
        stream.getTracks().forEach((track) => track.stop())
        cameraStreamRef.current = null
        return
      }
      video.srcObject = stream
      await video.play()

      if (cameraRequestRef.current !== requestId) {
        stream.getTracks().forEach((track) => track.stop())
        if (video.srcObject === stream) video.srcObject = null
        if (cameraStreamRef.current === stream) cameraStreamRef.current = null
        return
      }

      setIsCameraOn(true)
      setResult(null)
      setLiveFrameCount(0)
      startLiveDetection()
      const trackLabel = stream.getVideoTracks()[0]?.label
      toast.success(`เปิดกล้อง${trackLabel ? ` ${trackLabel}` : ''}และเริ่มตรวจจับแล้ว`)
    } catch (error) {
      if (cameraRequestRef.current !== requestId) return
      console.error(error)
      stopCamera()
      const message = 'ไม่สามารถเปิดกล้องได้ กรุณากด Allow หรือเชื่อมต่ออุปกรณ์กล้อง'
      setOperationError(message)
      toast.error(message)
    } finally {
      if (cameraRequestRef.current === requestId) setIsCameraStarting(false)
    }
  }, [availableCameraDevices, refreshAvailableCameraDevices, selectedCameraDeviceId, startLiveDetection, stopCamera])

  useEffect(() => {
    if (activeTab !== 'camera') return
    void refreshAvailableCameraDevices()
    navigator.mediaDevices?.addEventListener?.('devicechange', refreshAvailableCameraDevices)
    return () => {
      navigator.mediaDevices?.removeEventListener?.('devicechange', refreshAvailableCameraDevices)
    }
  }, [activeTab, refreshAvailableCameraDevices])

  useEffect(() => () => stopCamera(), [stopCamera])

  const invalidateDetectionRequest = useCallback(() => {
    detectionRequestRef.current += 1
    setIsLoading(false)
  }, [])

  useEffect(() => () => {
    detectionRequestRef.current += 1
  }, [])

  // ── Drag n Drop Handlers ──────────────────────────
  const imageDropzone = useDropzone({
    onDrop: useCallback((files: File[]) => {
      const f = files[0]
      if (f) {
        invalidateDetectionRequest()
        setSelectedFile(f)
        setPreview(URL.createObjectURL(f))
        setProcessedVideoUrl(null)
        setVideoPlaybackNotice(null)
        setResult(null)
        setOperationError(null)
      }
    }, [invalidateDetectionRequest]),
    onDropRejected: () => {
      const message = 'ไฟล์ไม่รองรับ กรุณาเลือก JPG, PNG หรือ WebP เพียงหนึ่งไฟล์'
      setOperationError(message)
      toast.error(message)
    },
    accept: { 'image/*': ['.jpeg', '.jpg', '.png', '.webp'] },
    maxFiles: 1,
    disabled: activeTab !== 'image',
  })

  const videoDropzone = useDropzone({
    onDrop: useCallback((files: File[]) => {
      const f = files[0]
      if (f) {
        invalidateDetectionRequest()
        setSelectedFile(f)
        setPreview(URL.createObjectURL(f))
        setProcessedVideoUrl(null)
        setVideoPlaybackNotice(null)
        setResult(null)
        setOperationError(null)
        stopLiveDetection()
      }
    }, [invalidateDetectionRequest, stopLiveDetection]),
    onDropRejected: () => {
      const message = 'ไฟล์ไม่รองรับ กรุณาเลือก MP4, AVI หรือ MOV เพียงหนึ่งไฟล์'
      setOperationError(message)
      toast.error(message)
    },
    accept: { 'video/mp4': ['.mp4'], 'video/x-msvideo': ['.avi'], 'video/quicktime': ['.mov'] },
    maxFiles: 1,
    disabled: activeTab !== 'video',
  })

  const isCameraTab = activeTab === 'camera'
  const getRootProps = activeTab === 'image' ? imageDropzone.getRootProps : videoDropzone.getRootProps
  const getInputProps = activeTab === 'image' ? imageDropzone.getInputProps : videoDropzone.getInputProps
  const isDragActive = activeTab === 'image' ? imageDropzone.isDragActive : videoDropzone.isDragActive

  const handleTabChange = (tab: TabType) => {
    invalidateDetectionRequest()
    stopCamera()
    setActiveTab(tab)
    setSelectedFile(null)
    setPreview(null)
    setProcessedVideoUrl(null)
    setVideoPlaybackNotice(null)
    setResult(null)
    setLiveFrameCount(0)
    setOperationError(null)
  }

  const handleDetect = async () => {
    if (!selectedFile) return
    const requestId = detectionRequestRef.current + 1
    detectionRequestRef.current = requestId
    const sourceTab = activeTab
    const sourceFile = selectedFile
    stopLiveDetection()
    setOperationError(null)
    setIsLoading(true)
    if (sourceTab === 'video') {
      setProcessedVideoUrl(null)
      setVideoPlaybackNotice(null)
    }
    try {
      const detection = sourceTab === 'video'
        ? await detectionService.uploadVideo(sourceFile)
        : await detectionService.uploadImage(sourceFile)

      if (detectionRequestRef.current !== requestId) return
      
      setResult(detection)
      if (sourceTab === 'video') {
        try {
          const videoBlob = await detectionService.getResultVideoBlob(detection.id)
          if (detectionRequestRef.current !== requestId) return
          if (videoBlob.type.startsWith('video/')) {
            setProcessedVideoUrl(URL.createObjectURL(videoBlob))
          } else {
            setVideoPlaybackNotice('ได้ผลตรวจแบบภาพนิ่ง จึงกำลังแสดงวิดีโอต้นฉบับ')
          }
        } catch (mediaError) {
          if (detectionRequestRef.current !== requestId) return
          console.error('Result video load error:', mediaError)
          setVideoPlaybackNotice('โหลดวิดีโอผลลัพธ์ไม่สำเร็จ กำลังแสดงวิดีโอต้นฉบับ')
        }
      }
      toast.success('ตรวจจับสำเร็จ')
    } catch (error) {
      if (detectionRequestRef.current !== requestId) return
      console.error(error)
      const message = 'การวิเคราะห์ไม่สำเร็จ กรุณาตรวจสอบไฟล์และลองใหม่อีกครั้ง'
      setOperationError(message)
      toast.error(message)
    } finally {
      if (detectionRequestRef.current === requestId) setIsLoading(false)
    }
  }

  const handleReset = () => {
    invalidateDetectionRequest()
    stopCamera()
    setSelectedFile(null)
    setPreview(null)
    setProcessedVideoUrl(null)
    setVideoPlaybackNotice(null)
    setResult(null)
    setLiveFrameCount(0)
    setOperationError(null)
  }

  const hasValidFile = activeTab === 'image'
    ? selectedFile?.type.startsWith('image/')
    : activeTab === 'video'
      ? selectedFile?.type.startsWith('video/')
      : isCameraOn

  return (
    <Layout>
      <div className="flex flex-col gap-8">
        <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="page-heading max-w-3xl">
            <h1>ตรวจจับอุปกรณ์ PPE</h1>
            <p className="max-w-2xl text-[17px] leading-7">
              วิเคราะห์หมวกนิรภัยและเสื้อสะท้อนแสงจากภาพ วิดีโอ หรือกล้องแบบเรียลไทม์
            </p>
          </div>
          <div
            className="inline-flex w-full items-center gap-1 self-start rounded-full border border-[#e0e0e0] bg-white p-1 sm:w-auto"
            role="group"
            aria-label="Detection source"
          >
            <button
              type="button"
              aria-pressed={activeTab === 'image'}
              onClick={() => handleTabChange('image')}
              className={
                activeTab === 'image'
                  ? 'flex min-h-11 min-w-0 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-full border-0 bg-[#0066cc] px-3 text-[14px] font-semibold text-white sm:flex-none sm:px-5'
                  : 'flex min-h-11 min-w-0 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-full border-0 bg-transparent px-3 text-[14px] font-semibold text-[#424245] hover:bg-[#f5f5f7] sm:flex-none sm:px-5'
              }
            >
              <ImageIcon size={16} aria-hidden="true" /> Image
            </button>
            <button
              type="button"
              aria-pressed={activeTab === 'video'}
              onClick={() => handleTabChange('video')}
              className={
                activeTab === 'video'
                  ? 'flex min-h-11 min-w-0 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-full border-0 bg-[#0066cc] px-3 text-[14px] font-semibold text-white sm:flex-none sm:px-5'
                  : 'flex min-h-11 min-w-0 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-full border-0 bg-transparent px-3 text-[14px] font-semibold text-[#424245] hover:bg-[#f5f5f7] sm:flex-none sm:px-5'
              }
            >
              <Video size={16} aria-hidden="true" /> Video
            </button>
            <button
              type="button"
              aria-pressed={activeTab === 'camera'}
              onClick={() => handleTabChange('camera')}
              className={
                activeTab === 'camera'
                  ? 'flex min-h-11 min-w-0 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-full border-0 bg-[#0066cc] px-3 text-[14px] font-semibold text-white sm:flex-none sm:px-5'
                  : 'flex min-h-11 min-w-0 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-full border-0 bg-transparent px-3 text-[14px] font-semibold text-[#424245] hover:bg-[#f5f5f7] sm:flex-none sm:px-5'
              }
            >
              <Camera size={16} aria-hidden="true" /> Camera
            </button>
          </div>
        </header>

        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">

          {/* ── LEFT: Upload area + Live Canvas ── */}
          <div className="flex flex-col gap-4">

            <section className="surface-card overflow-hidden" aria-labelledby="detection-input-title">
              <div className="flex min-h-20 items-center justify-between gap-4 border-b border-[#e0e0e0] px-5 py-4 sm:px-8">
                <div>
                  <h2 id="detection-input-title" className="m-0 text-[21px] font-semibold tracking-[-0.01em] text-[#1d1d1f]">
                   {activeTab === 'image' ? 'Upload Image' : activeTab === 'video' ? 'Upload Video' : 'Live Camera'}
                  </h2>
                  <p className="mb-0 mt-1 text-[14px] leading-5 text-[#6e6e73]">
                    {activeTab === 'camera' ? 'กล้องทำงานในหน่วยความจำของเบราว์เซอร์ระหว่างเซสชันนี้' : 'เลือกไฟล์หนึ่งรายการเพื่อเริ่มวิเคราะห์ด้วย AI'}
                  </p>
                </div>
                {(selectedFile || isCameraOn) && (
                  <button type="button" onClick={handleReset} className="btn-apple-secondary h-11 w-11 shrink-0 p-0" aria-label="Clear selected source">
                    <X size={17} aria-hidden="true" />
                  </button>
                )}
              </div>
              <div className="p-5 sm:p-8">
                {/* Dropzone */}
                <div
                  {...(isCameraTab ? {} : getRootProps())}
                  className={`flex min-h-[360px] flex-col items-center justify-center rounded-[18px] border p-4 text-center transition-colors sm:p-6 ${
                    isCameraTab
                      ? `cursor-default bg-[#f5f5f7] ${isCameraOn ? 'border-[#0066cc]' : 'border-[#e0e0e0]'}`
                      : `border-dashed ${isDragActive ? 'border-[#0066cc] bg-[#f2f7fc]' : preview ? 'border-[#e0e0e0] bg-[#f5f5f7]' : 'cursor-pointer border-[#d2d2d7] bg-[#fafafc] hover:border-[#0066cc] hover:bg-[#f5f9fd]'}`
                  }`}
                  aria-busy={isLoading || isCameraStarting}
                >
                  {!isCameraTab && <input {...getInputProps()} />}
                  {isCameraTab ? (
                    <div className="w-full">
                      <div className="relative flex min-h-[320px] w-full items-center justify-center overflow-hidden rounded-[18px] bg-black">
                        <video
                          ref={videoRef}
                          className="hidden"
                          playsInline
                          muted
                        />
                        <canvas
                          ref={canvasRef}
                          className="block w-full rounded-[18px]"
                          style={{ maxHeight: '460px', objectFit: 'contain' }}
                          role="img"
                          aria-label="Live PPE detection camera view"
                        />
                        <canvas ref={captureCanvasRef} className="hidden" />
                        {!isCameraOn && (
                          <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 bg-black px-6 text-white">
                            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/10">
                              <Camera size={28} aria-hidden="true" />
                            </div>
                            <div>
                              <p className="m-0 text-[21px] font-semibold tracking-[-0.01em]">Connect a camera device</p>
                              <p className="mx-auto mb-0 mt-2 max-w-md text-[15px] leading-6 text-[#cccccc]">
                                Browser permission will appear after opening the camera.
                              </p>
                            </div>
                          </div>
                        )}
                      </div>

                      <p className="mb-0 mt-4 inline-flex min-h-8 items-center rounded-full border border-[#e0e0e0] bg-white px-4 text-[13px] font-semibold text-[#6e6e73]">
                        {isCameraOn ? 'Camera: live device connected' : 'Camera: waiting for permission'}
                      </p>
                      <div className="mx-auto mt-4 flex max-w-xl flex-col gap-3 rounded-[18px] border border-[#e0e0e0] bg-white p-4 text-left sm:flex-row sm:items-end">
                        <label className="min-w-0 flex-1 text-[13px] font-semibold text-[#424245]">
                          เลือกอุปกรณ์กล้อง
                          <select
                            value={selectedCameraDeviceId}
                            onChange={(event) => {
                              const nextDeviceId = event.target.value
                              setSelectedCameraDeviceId(nextDeviceId)
                              if (isCameraOn) {
                                stopCamera()
                                window.setTimeout(() => void startCamera(nextDeviceId), 0)
                              }
                            }}
                            disabled={isCameraStarting || availableCameraDevices.length === 0}
                            className="mt-2 min-h-11 w-full rounded-full border border-[#d2d2d7] bg-white px-4 text-[14px] text-[#1d1d1f]"
                          >
                            {availableCameraDevices.length === 0 ? (
                              <option value="">ไม่พบกล้องที่พร้อมใช้งาน</option>
                            ) : availableCameraDevices.map((device, index) => (
                              <option key={device.deviceId || index} value={device.deviceId}>
                                {getCameraDeviceLabel(device, index)}
                              </option>
                            ))}
                          </select>
                        </label>
                        <button
                          type="button"
                          onClick={() => void refreshAvailableCameraDevices()}
                          disabled={isCameraStarting}
                          className="btn-apple-secondary min-h-11 shrink-0 px-4"
                        >
                          <RefreshCw size={16} aria-hidden="true" /> Refresh devices
                        </button>
                      </div>
                    </div>
                  ) : preview ? (
                    <div className="w-full">
                      {activeTab === 'video' ? (
                        <div
                          className="relative flex min-h-[320px] w-full items-center justify-center overflow-hidden rounded-[18px] bg-black"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <video
                            key={processedVideoUrl || preview}
                            src={processedVideoUrl || preview}
                            className="block w-full rounded-[18px] bg-black"
                            style={{ maxHeight: '460px' }}
                            controls
                            playsInline
                            preload="auto"
                            onLoadedData={() => {
                              if (processedVideoUrl) setVideoPlaybackNotice(null)
                            }}
                            onError={() => {
                              if (processedVideoUrl) {
                                setProcessedVideoUrl(null)
                                setVideoPlaybackNotice('เบราว์เซอร์เล่นวิดีโอผลลัพธ์ไม่ได้ จึงเปลี่ยนเป็นวิดีโอต้นฉบับ')
                              } else {
                                setVideoPlaybackNotice('เบราว์เซอร์ไม่รองรับ codec ของไฟล์นี้ แนะนำใช้ MP4 (H.264)')
                              }
                            }}
                          />
                          {isLoading && (
                            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70 text-white" role="status" aria-live="polite">
                              <Loader2 size={26} className="animate-spin" aria-hidden="true" />
                              <span className="text-[15px] font-semibold">Processing video…</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="relative flex min-h-[320px] w-full items-center justify-center overflow-hidden rounded-[18px] bg-[#f5f5f7]">
                          {/* Hidden pure image element for measuring and drawing */}
                          <img
                            ref={imageRef}
                            src={preview}
                            alt="Hidden original measure"
                            className="hidden"
                          />
                          
                          {/* The visible Canvas that receives both Image and Overlays */}
                          <canvas
                            ref={imageCanvasRef}
                            className="block h-auto w-full rounded-[18px] transition-opacity duration-300"
                            style={{ maxHeight: '460px', objectFit: 'contain' }}
                            role="img"
                            aria-label="PPE detection image preview"
                          />
                        </div>
                      )}

                      <p className="mb-0 mt-4 inline-flex max-w-full items-center truncate rounded-full border border-[#e0e0e0] bg-white px-4 py-2 text-[13px] font-semibold text-[#6e6e73]">
                        {activeTab === 'video' && processedVideoUrl ? 'Detection result' : `File: ${selectedFile?.name}`}
                      </p>
                      {activeTab === 'video' && videoPlaybackNotice && (
                        <p className="mb-0 mt-3 text-center text-[14px] leading-5 text-[#9a5b00]" role="status">
                          {videoPlaybackNotice}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="flex max-w-lg flex-col items-center gap-4 px-4 py-8">
                      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#f0f0f2] text-[#0066cc]">
                        <Upload size={28} aria-hidden="true" />
                      </div>
                      <div>
                        <p className="m-0 text-[21px] font-semibold tracking-[-0.01em] text-[#1d1d1f]">
                          {isDragActive ? 'Drop your file here' : 'Drag & drop your file here'}
                        </p>
                        <p className="mb-0 mt-2 text-[17px] leading-6 text-[#6e6e73]">or click to browse</p>
                      </div>
                      <p className="mt-1 text-[14px] text-[var(--muted)]">
                        {activeTab === 'image' ? 'Supported: JPG, PNG, WebP' : 'Supported: MP4, AVI, MOV'}
                      </p>
                    </div>
                  )}
                </div>

                {/* Actions / Detect / Reset buttons */}
                {(preview || isCameraTab) && (hasValidFile || isCameraTab) && (
                  <div className="mt-5 flex flex-wrap gap-3">
                    {activeTab === 'image' ? (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleDetect() }}
                        disabled={isLoading}
                        className="btn-apple-primary min-h-12 flex-1 px-6 text-[15px]"
                      >
                        {isLoading ? (
                          <><Loader2 size={17} className="animate-spin" aria-hidden="true" /> Processing detection…</>
                        ) : (
                          <><ShieldCheck size={17} aria-hidden="true" /> Start Detection</>
                        )}
                      </button>
                    ) : activeTab === 'video' ? (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); void handleDetect() }}
                        disabled={isLoading}
                        className="btn-apple-primary min-h-12 flex-1 px-6 text-[15px]"
                      >
                        {isLoading ? <><Loader2 size={17} className="animate-spin" aria-hidden="true" /> Processing video…</> : <><ShieldCheck size={17} aria-hidden="true" /> Process &amp; save video</>}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          if (isCameraOn) stopCamera()
                          else void startCamera()
                        }}
                        disabled={isCameraStarting}
                        className={`${isCameraOn ? 'btn-apple-secondary' : 'btn-apple-primary'} min-h-12 flex-1 px-6 text-[15px]`}
                      >
                        {isCameraStarting ? (
                          <><Loader2 size={17} className="animate-spin" aria-hidden="true" /> Waiting for permission…</>
                        ) : isCameraOn ? (
                          <><X size={17} aria-hidden="true" /> Stop Camera</>
                        ) : (
                          <><Camera size={17} aria-hidden="true" /> Open Camera &amp; Detect</>
                        )}
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleReset() }}
                      className="btn-apple-secondary min-h-12 px-5 text-[15px]"
                      aria-label="Clear source and results"
                    >
                      <X size={17} aria-hidden="true" /> Clear
                    </button>
                  </div>
                )}

                {operationError && (
                  <div className="mt-4 flex items-start gap-3 rounded-[18px] border border-[#f0c3c8] bg-[#fff8f8] px-4 py-3 text-left text-[14px] leading-5 text-[#b4232f]" role="alert">
                    <AlertTriangle size={17} className="mt-0.5 shrink-0" aria-hidden="true" />
                    <span>{operationError}</span>
                  </div>
                )}

                {activeTab === 'camera' && isLiveDetecting && (
                  <p className="mb-0 mt-4 flex items-center justify-center gap-2 text-center text-[14px] font-semibold text-[#15803d]" role="status" aria-live="polite">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-[#15803d]" aria-hidden="true" />
                    Live Detection Active · {liveFrameCount.toLocaleString()} frames analyzed
                  </p>
                )}

                {/* Progress bar */}
                {isLoading && (
                  <div className="mx-auto mt-4 h-1.5 max-w-[240px] overflow-hidden rounded-full bg-[#e0e0e0]" role="progressbar" aria-label="Analyzing media">
                    <div className="progress-bar-animation h-full rounded-full bg-[#0066cc]" />
                  </div>
                )}
              </div>
            </section>

          </div>

          <aside className="surface-card overflow-hidden xl:sticky xl:top-6" aria-labelledby="detection-status-title" aria-live="polite">
            <div className="flex min-h-20 items-center justify-between border-b border-[#e0e0e0] px-6 py-4">
              <h2 id="detection-status-title" className="m-0 text-[21px] font-semibold tracking-[-0.01em] text-[#1d1d1f]">Detection Status</h2>
              {result && (
                <span className={`rounded-full px-3 py-1 text-[12px] font-semibold ${result.has_violation ? 'bg-[#fff1f2] text-[#b4232f]' : 'bg-[#edf8ef] text-[#15803d]'}`}>
                  {result.has_violation ? 'Action needed' : 'Compliant'}
                </span>
              )}
            </div>
            <div className="overflow-y-auto p-5 sm:p-6 xl:max-h-[calc(100vh-180px)]">
              {(isLoading || isCameraStarting) && !result ? (
                <div className="flex min-h-64 flex-col items-center justify-center gap-4 px-6 text-center" role="status">
                  <Loader2 size={28} className="animate-spin text-[#0066cc]" aria-hidden="true" />
                  <div>
                    <p className="m-0 text-[17px] font-semibold text-[#1d1d1f]">กำลังเตรียมการวิเคราะห์</p>
                    <p className="mb-0 mt-2 text-[14px] leading-5 text-[#6e6e73]">โปรดรอสักครู่ ระบบกำลังประมวลผลข้อมูลของคุณ</p>
                  </div>
                </div>
              ) : result ? (
                <>
                  <div className={`mb-5 flex items-start gap-3 rounded-[18px] border p-4 ${result.has_violation ? 'border-[#f0c3c8] bg-[#fff8f8]' : 'border-[#c8e5cf] bg-[#f5fbf6]'}`}>
                    {result.has_violation
                      ? <AlertTriangle size={21} className="mt-0.5 shrink-0 text-[#d70015]" aria-hidden="true" />
                      : <CheckCircle size={21} className="mt-0.5 shrink-0 text-[#15803d]" aria-hidden="true" />
                    }
                    <div>
                      <p className={`m-0 text-[17px] font-semibold ${result.has_violation ? 'text-[#b4232f]' : 'text-[#12652f]'}`}>
                        {result.has_violation ? 'Violation Detected' : 'Fully Compliant'}
                      </p>
                      <p className="mb-0 mt-1 text-[14px] leading-5 text-[#6e6e73]">
                        {result.summary?.message || (result.has_violation ? `${result.violation_count} violation(s) found` : 'All persons wearing PPE correctly')}
                      </p>
                    </div>
                  </div>

                  <div className="mb-6 grid grid-cols-2 gap-3">
                    <div className="rounded-[18px] bg-[#f5f5f7] p-4">
                      <p className="m-0 flex items-center gap-1.5 text-[12px] font-semibold text-[#6e6e73]">
                        <Users size={14} aria-hidden="true" /> Persons
                      </p>
                      <p className="mb-0 mt-2 text-[32px] font-semibold tracking-[-0.03em] text-[#1d1d1f]">{result.person_count ?? 0}</p>
                    </div>
                    <div className="rounded-[18px] bg-[#f5f5f7] p-4">
                      <p className="m-0 flex items-center gap-1.5 text-[12px] font-semibold text-[#6e6e73]">
                        <AlertTriangle size={14} aria-hidden="true" /> Violations
                      </p>
                      <p className={`mb-0 mt-2 text-[32px] font-semibold tracking-[-0.03em] ${(result.violation_count ?? 0) > 0 ? 'text-[#d70015]' : 'text-[#1d1d1f]'}`}>
                        {result.violation_count ?? 0}
                      </p>
                    </div>
                    <div className="col-span-2 rounded-[18px] bg-[#f5f5f7] p-4">
                      <p className="m-0 flex items-center gap-1.5 text-[12px] font-semibold text-[#6e6e73]">
                        <Clock size={14} aria-hidden="true" /> Processing Time
                      </p>
                      <p className="mb-0 mt-2 text-[32px] font-semibold tracking-[-0.03em] text-[#1d1d1f]">
                        {result.processing_time_ms ?? '—'} <span className="text-[14px] font-normal tracking-normal text-[var(--muted)]">ms</span>
                      </p>
                    </div>
                  </div>

                  {result.persons && result.persons.length > 0 && (
                    <section aria-labelledby="person-details-title">
                      <h3 id="person-details-title" className="mb-3 mt-0 text-[14px] font-semibold text-[#1d1d1f]">Per-person PPE details</h3>
                      <div className="flex flex-col gap-3">
                        {result.persons.map((person) => (
                          <div key={person.id} className="rounded-[18px] border border-[#e0e0e0] bg-white p-4">
                            <div className="mb-3 flex items-center justify-between gap-3">
                              <span className="text-[15px] font-semibold text-[#1d1d1f]">Person {person.id}</span>
                              <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${person.is_compliant ? 'bg-[#edf8ef] text-[#15803d]' : 'bg-[#fff1f2] text-[#b4232f]'}`}>
                                {person.is_compliant ? 'Compliant' : 'Violation'}
                              </span>
                            </div>
                            {person.wearing?.map((item, index) => (
                              <div key={`w${index}`} className="mb-2 flex items-center gap-2 text-[13px] text-[#15803d]">
                                <CheckCircle size={14} className="shrink-0" aria-hidden="true" />
                                <span>{item}</span>
                                <span className="ml-auto text-[11px] text-[#527a5d]">Wearing</span>
                              </div>
                            ))}
                            {person.not_wearing?.map((item, index) => (
                              <div key={`nw${index}`} className="mb-2 flex items-center gap-2 text-[13px] text-[#b4232f]">
                                <X size={14} className="shrink-0" aria-hidden="true" />
                                <span>{item}</span>
                                <span className="ml-auto text-[11px] text-[#9e5a61]">Not wearing</span>
                              </div>
                            ))}
                            <p className="mb-0 mt-3 border-t border-[#e0e0e0] pt-3 text-[12px] text-[var(--muted)]">Confidence: {Math.round(person.confidence * 100)}%</p>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {result.violations && result.violations.length > 0 && (
                    <section className="mt-6" aria-labelledby="violations-summary-title">
                      <h3 id="violations-summary-title" className="mb-3 mt-0 text-[14px] font-semibold text-[#1d1d1f]">Violations summary</h3>
                      <div className="flex flex-col gap-2">
                        {result.violations.map((violation, index) => (
                          <div key={index} className="flex items-center gap-2 rounded-[18px] border border-[#f0c3c8] bg-[#fff8f8] px-4 py-3 text-[13px] text-[#b4232f]">
                            <AlertTriangle size={15} className="shrink-0" aria-hidden="true" />
                            {violation}
                          </div>
                        ))}
                      </div>
                    </section>
                  )}
                </>
              ) : (
                <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center">
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#f5f5f7] text-[#86868b]">
                    <ImageIcon size={27} aria-hidden="true" />
                  </div>
                  <p className="m-0 text-[17px] font-semibold text-[#1d1d1f]">No results yet</p>
                  <p className="mb-0 mt-2 max-w-xs text-[14px] leading-6 text-[#6e6e73]">
                    Choose a source and start detection. The result will appear here.
                  </p>
                </div>
              )}
            </div>
          </aside>

        </div>
      </div>

      <style>{`
        @keyframes progress-bar {
          0% { width: 0%; transform: translateX(-10%); }
          50% { width: 40%; transform: translateX(50%); }
          100% { width: 100%; transform: translateX(110%); }
        }
        .progress-bar-animation {
          animation: progress-bar 1.5s infinite ease-in-out;
        }
        @media (prefers-reduced-motion: reduce) {
          .progress-bar-animation {
            width: 100%;
            animation: none;
          }
        }
      `}</style>
    </Layout>
  )
}
