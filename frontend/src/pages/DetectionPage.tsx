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
  ShieldAlert,
  Video,
} from 'lucide-react'
import toast from 'react-hot-toast'

type TabType = 'image' | 'video'

export function DetectionPage() {
  const [activeTab, setActiveTab] = useState<TabType>('image')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [result, setResult] = useState<Detection | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // ── Real-time video detection with canvas overlay ──────────────────────────
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const captureCanvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastDetectionRef = useRef<Detection | null>(null)
  const [isLiveDetecting, setIsLiveDetecting] = useState(false)
  const [liveFrameCount, setLiveFrameCount] = useState(0)
  const DETECT_INTERVAL_MS = 2000

  const renderLoop = useCallback(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    canvas.width = video.videoWidth || canvas.width
    canvas.height = video.videoHeight || canvas.height
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    const det = lastDetectionRef.current
    if (det?.persons && det.persons.length > 0) {
      const scaleX = canvas.width / (video.videoWidth || canvas.width)
      const scaleY = canvas.height / (video.videoHeight || canvas.height)
      det.persons.forEach((person) => {
        if (!person.bbox) return
        const [x1, y1, x2, y2] = person.bbox.map((v: number, i: number) =>
          i % 2 === 0 ? v * scaleX : v * scaleY
        )
        const color = person.is_compliant ? '#22c55e' : '#ef4444'
        const lineW = Math.max(2, canvas.width / 300)
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
        const fontSize = Math.max(11, canvas.width / 60)
        ctx.font = `bold ${fontSize}px Inter, sans-serif`
        const tw = ctx.measureText(label).width
        const lh = fontSize + 8
        ctx.fillStyle = color
        ctx.fillRect(x1, y1 - lh - 2, tw + 12, lh + 2)
        ctx.fillStyle = '#fff'
        ctx.fillText(label, x1 + 6, y1 - 6)
        let ty = y1 + 4 + fontSize
        const drawPpe = (text: string, ok: boolean) => {
          const fs2 = Math.max(9, fontSize - 3)
          ctx.font = `600 ${fs2}px Inter, sans-serif`
          const tw2 = ctx.measureText(text).width
          ctx.fillStyle = ok ? 'rgba(34,197,94,0.85)' : 'rgba(239,68,68,0.85)'
          ctx.fillRect(x1 + 5, ty - fs2, tw2 + 10, fs2 + 6)
          ctx.fillStyle = '#fff'
          ctx.fillText(text, x1 + 10, ty)
          ty += fs2 + 10
        }
        person.wearing?.forEach((item: string) => drawPpe(`✓ ${item}`, true))
        person.not_wearing?.forEach((item: string) => drawPpe(`✗ ${item}`, false))
      })
      const msg = det.summary?.message || ''
      const bannerH = Math.max(28, canvas.width / 25)
      const isViolation = det.has_violation
      ctx.fillStyle = isViolation ? 'rgba(200,30,30,0.82)' : 'rgba(22,163,74,0.82)'
      ctx.fillRect(0, 0, canvas.width, bannerH)
      ctx.fillStyle = '#fff'
      ctx.font = `bold ${Math.max(11, bannerH * 0.5)}px Inter, sans-serif`
      ctx.fillText(msg, 12, bannerH * 0.72)
    }
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
      ctx.font = `bold 11px Inter, sans-serif`
      ctx.fillText('LIVE DETECT', bx + 28, by + 15)
    }
    if (!video.paused && !video.ended) {
      rafRef.current = requestAnimationFrame(renderLoop)
    }
  }, [])

  const captureAndDetect = useCallback(async () => {
    const video = videoRef.current
    const cap = captureCanvasRef.current
    if (!video || !cap || video.paused || video.ended) return
    cap.width = video.videoWidth; cap.height = video.videoHeight
    const ctx = cap.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0, cap.width, cap.height)
    cap.toBlob(async (blob) => {
      if (!blob) return
      try {
        const frameFile = new File([blob], 'frame.jpg', { type: 'image/jpeg' })
        const detection = await detectionService.uploadImage(frameFile)
        lastDetectionRef.current = detection
        setResult(detection)
        setLiveFrameCount(prev => prev + 1)
      } catch (err) { console.error('Frame detect error:', err) }
    }, 'image/jpeg', 0.8)
  }, [])

  const stopLiveDetection = useCallback(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null }
    setIsLiveDetecting(false)
  }, [])

  const startLiveDetection = useCallback(() => {
    if (!videoRef.current) return
    setIsLiveDetecting(true)
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(renderLoop)
    if (intervalRef.current) clearInterval(intervalRef.current)
    intervalRef.current = setInterval(captureAndDetect, DETECT_INTERVAL_MS)
  }, [renderLoop, captureAndDetect])

  useEffect(() => () => stopLiveDetection(), [stopLiveDetection])

  const imageDropzone = useDropzone({
    onDrop: useCallback((files: File[]) => {
      const f = files[0]
      if (f) { setSelectedFile(f); setPreview(URL.createObjectURL(f)); setResult(null) }
    }, []),
    accept: { 'image/*': ['.jpeg', '.jpg', '.png', '.webp'] },
    maxFiles: 1,
    disabled: activeTab !== 'image',
  })

  const videoDropzone = useDropzone({
    onDrop: useCallback((files: File[]) => {
      const f = files[0]
      if (f) { setSelectedFile(f); setPreview(URL.createObjectURL(f)); setResult(null); stopLiveDetection() }
    }, [stopLiveDetection]),
    accept: { 'video/mp4': ['.mp4'], 'video/x-msvideo': ['.avi'], 'video/quicktime': ['.mov'] },
    maxFiles: 1,
    disabled: activeTab !== 'video',
  })

  const getRootProps = activeTab === 'image' ? imageDropzone.getRootProps : videoDropzone.getRootProps
  const getInputProps = activeTab === 'image' ? imageDropzone.getInputProps : videoDropzone.getInputProps
  const isDragActive = activeTab === 'image' ? imageDropzone.isDragActive : videoDropzone.isDragActive

  const handleTabChange = (tab: TabType) => {
    stopLiveDetection()
    setActiveTab(tab); setSelectedFile(null); setPreview(null); setResult(null)
  }

  const handleDetect = async () => {
    if (!selectedFile) return
    setIsLoading(true)
    try {
      const detection = activeTab === 'video'
        ? await detectionService.uploadVideo(selectedFile)
        : await detectionService.uploadImage(selectedFile)
      setResult(detection)
      toast.success('ตรวจจับสำเร็จ')
    } catch (error) {
      console.error(error)
      toast.error('เกิดข้อผิดพลาด กรุณาลองใหม่')
    } finally {
      setIsLoading(false)
    }
  }

  const handleReset = () => {
    stopLiveDetection()
    setSelectedFile(null); setPreview(null); setResult(null)
    setLiveFrameCount(0)
  }

  const hasValidFile = activeTab === 'image'
    ? selectedFile?.type.startsWith('image/')
    : selectedFile?.type.startsWith('video/')

  return (
    <Layout>
      <div className="flex flex-col gap-5">

        {/* ── Page Header ── */}
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-[22px] font-bold text-[#0f172a] m-0">Detection</h1>
            <p className="text-[13px] text-[#64748b] mt-1">
              Upload an image or video to automatically detect PPE compliance (helmet &amp; reflective vest).
            </p>
          </div>
          {/* Image / Video tab switcher */}
          <div className="flex items-center gap-1 bg-[#f1f5f9] p-1 rounded-[10px]">
            <button
              onClick={() => handleTabChange('image')}
              className={
                activeTab === 'image'
                  ? 'flex items-center gap-[6px] px-[18px] py-[7px] rounded-[7px] text-[13px] font-semibold text-[#0f172a] bg-white border-none cursor-pointer shadow-[0_1px_3px_rgba(0,0,0,0.1)]'
                  : 'flex items-center gap-[6px] px-[18px] py-[7px] rounded-[7px] text-[13px] font-medium text-[#64748b] bg-transparent border-none cursor-pointer'
              }
            >
              <ImageIcon size={14} /> Image
            </button>
            <button
              onClick={() => handleTabChange('video')}
              className={
                activeTab === 'video'
                  ? 'flex items-center gap-[6px] px-[18px] py-[7px] rounded-[7px] text-[13px] font-semibold text-[#0f172a] bg-white border-none cursor-pointer shadow-[0_1px_3px_rgba(0,0,0,0.1)]'
                  : 'flex items-center gap-[6px] px-[18px] py-[7px] rounded-[7px] text-[13px] font-medium text-[#64748b] bg-transparent border-none cursor-pointer'
              }
            >
              <Video size={14} /> Video
            </button>
          </div>
        </div>

        {/* ── Two column layout ── */}
        <div className="grid gap-5 items-start" style={{ gridTemplateColumns: '1fr 360px' }}>

          {/* ── LEFT: Upload + Result image ── */}
          <div className="flex flex-col gap-4">

            {/* Upload card */}
            <div className="bg-white border border-[#e5eaf0] rounded-2xl overflow-hidden shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
              <div className="flex items-center justify-between px-5 py-[14px] border-b border-[#f1f5f9]">
                <p className="text-[14px] font-semibold text-[#0f172a] m-0">
                  {activeTab === 'image' ? 'Upload Image' : 'Upload Video'}
                </p>
                {selectedFile && (
                  <button onClick={handleReset} className="bg-transparent border-none cursor-pointer text-[#94a3b8] p-[2px]">
                    <X size={16} />
                  </button>
                )}
              </div>
              <div className="p-5">
                {/* Dropzone */}
                <div
                  {...getRootProps()}
                  className="flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200 rounded-xl p-6"
                  style={{
                    minHeight: '280px',
                    border: `2px dashed ${isDragActive ? '#2563eb' : preview ? '#cbd5e1' : '#d1d8e4'}`,
                    backgroundColor: isDragActive ? '#eff6ff' : preview ? '#f8fafc' : '#fafbfc',
                  }}
                >
                  <input {...getInputProps()} />
                  {preview ? (
                    <div className="w-full">
                      {activeTab === 'video' ? (
                        <div className="relative w-full bg-black rounded-lg overflow-hidden">
                          {/* Hidden video source */}
                          <video
                            ref={videoRef}
                            src={preview}
                            className="hidden"
                            onPlay={startLiveDetection}
                            onPause={stopLiveDetection}
                            onEnded={stopLiveDetection}
                          />
                          {/* Visible canvas with detection overlays */}
                          <canvas
                            ref={canvasRef}
                            className="w-full block rounded-lg"
                            style={{ maxHeight: '380px' }}
                          />
                          {/* Hidden capture canvas */}
                          <canvas ref={captureCanvasRef} className="hidden" />
                          {/* Custom video controls */}
                          <div className="flex items-center gap-2 px-3 py-2 bg-black/60 rounded-b-lg absolute bottom-0 left-0 right-0">
                            <button
                              onClick={() => { videoRef.current?.paused ? videoRef.current?.play() : videoRef.current?.pause() }}
                              className="bg-white/15 border-none text-white rounded-md px-3 py-1 cursor-pointer text-[13px] font-semibold"
                            >
                              {isLiveDetecting ? '⏸ Pause' : '▶ Play'}
                            </button>
                            <span className="text-[11px] text-[#94a3b8] ml-auto">
                              {isLiveDetecting ? `🔴 LIVE · ${liveFrameCount} frames detected` : 'Press Play to start live detection'}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="relative w-full">
                          <img
                            src={result && activeTab === 'image' ? detectionService.getResultImageUrl(result.id) : preview}
                            alt={result ? "Detection Result" : "Preview"}
                            className="w-full rounded-lg object-contain"
                            style={{ maxHeight: '340px' }}
                          />
                          {result && activeTab === 'image' && (
                            <div className="absolute top-3 left-3 flex gap-2">
                              <div className={
                                result.has_violation
                                  ? 'flex items-center gap-2 px-3 py-1.5 bg-[#fee2e2]/90 backdrop-blur-sm text-[#dc2626] rounded-lg text-xs font-semibold border border-[#fecaca]'
                                  : 'flex items-center gap-2 px-3 py-1.5 bg-[#dcfce7]/90 backdrop-blur-sm text-[#16a34a] rounded-lg text-xs font-semibold border border-[#bbf7d0]'
                              }>
                                {result.has_violation
                                  ? <><ShieldAlert size={14} /> Violation Detected</>
                                  : <><ShieldCheck size={14} /> Compliant</>
                                }
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                      <p className="text-[12px] text-[#94a3b8] mt-2 text-center">{selectedFile?.name}</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-[10px] py-5">
                      <div className="w-14 h-14 rounded-[14px] bg-[#eff6ff] flex items-center justify-center">
                        <Upload size={26} color="#2563eb" />
                      </div>
                      <div>
                        <p className="text-[15px] font-semibold text-[#0f172a] m-0 mb-1">
                          {isDragActive ? 'Drop your file here' : 'Drag & drop your file here'}
                        </p>
                        <p className="text-[13px] text-[#94a3b8] m-0">or click to browse</p>
                      </div>
                      <p className="text-[11px] text-[#cbd5e1] mt-1">
                        {activeTab === 'image' ? 'Supported: JPG, PNG, WebP' : 'Supported: MP4, AVI, MOV'}
                      </p>
                    </div>
                  )}
                </div>

                {/* Detect / Reset buttons */}
                {preview && hasValidFile && (
                  <div className="flex gap-[10px] mt-4">
                    <button
                      onClick={handleDetect}
                      disabled={isLoading}
                      className={
                        isLoading
                          ? 'flex-1 flex items-center justify-center gap-2 py-[11px] px-5 bg-[#93c5fd] text-white border-none rounded-[10px] text-[14px] font-semibold cursor-not-allowed'
                          : 'flex-1 flex items-center justify-center gap-2 py-[11px] px-5 bg-[#2563eb] text-white border-none rounded-[10px] text-[14px] font-semibold cursor-pointer'
                      }
                    >
                      {isLoading ? (
                        <><Loader2 size={16} className="animate-spin" /> Processing...</>
                      ) : (
                        <><ShieldCheck size={16} /> Start Detection</>
                      )}
                    </button>
                    <button
                      onClick={handleReset}
                      className="flex items-center justify-center px-[14px] py-[11px] bg-[#f1f5f9] text-[#64748b] border-none rounded-[10px] cursor-pointer"
                    >
                      <X size={16} />
                    </button>
                  </div>
                )}

                {/* Progress bar */}
                {isLoading && (
                  <div className="h-1 bg-[#e2e8f0] rounded-sm overflow-hidden mt-3">
                    <div className="h-full w-[60%] bg-[#2563eb] rounded-sm animate-pulse" />
                  </div>
                )}
              </div>
            </div>


          </div>

          {/* ── RIGHT: Status panel ── */}
          <div className="bg-white border border-[#e5eaf0] rounded-2xl overflow-hidden shadow-[0_1px_4px_rgba(0,0,0,0.06)] sticky top-5">
            <div className="flex items-center justify-between px-5 py-[14px] border-b border-[#f1f5f9]">
              <p className="text-[14px] font-semibold text-[#0f172a] m-0">Detection Status</p>
            </div>
            <div className="px-[18px] py-4 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 180px)' }}>
              {result ? (
                <>
                  {/* Status alert */}
                  <div className={
                    result.has_violation
                      ? 'flex items-start gap-[10px] p-[14px] bg-[#fff1f2] border border-[#fecaca] rounded-xl mb-4'
                      : 'flex items-start gap-[10px] p-[14px] bg-[#f0fdf4] border border-[#bbf7d0] rounded-xl mb-4'
                  }>
                    {result.has_violation
                      ? <AlertTriangle size={20} color="#dc2626" className="shrink-0 mt-[1px]" />
                      : <CheckCircle size={20} color="#16a34a" className="shrink-0 mt-[1px]" />
                    }
                    <div>
                      <p className={`text-[14px] font-bold m-0 mb-[2px] ${result.has_violation ? 'text-[#dc2626]' : 'text-[#16a34a]'}`}>
                        {result.has_violation ? 'Violation Detected' : 'Fully Compliant'}
                      </p>
                      <p className="text-[12px] text-[#64748b] m-0">
                        {result.summary?.message || (result.has_violation ? `${result.violation_count} violation(s) found` : 'All persons wearing PPE correctly')}
                      </p>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-[10px] mb-4">
                    <div className="bg-[#f8fafc] border border-[#e5eaf0] rounded-[10px] px-4 py-[14px]">
                      <p className="text-[11px] text-[#94a3b8] font-medium uppercase tracking-[0.05em] m-0 mb-[6px]">
                        <Users size={11} className="inline mr-[3px]" />Persons
                      </p>
                      <p className="text-[28px] font-bold text-[#0f172a] m-0">{result.person_count ?? 0}</p>
                    </div>
                    <div className="bg-[#f8fafc] border border-[#e5eaf0] rounded-[10px] px-4 py-[14px]">
                      <p className="text-[11px] text-[#94a3b8] font-medium uppercase tracking-[0.05em] m-0 mb-[6px]">
                        <AlertTriangle size={11} className="inline mr-[3px]" />Violations
                      </p>
                      <p className={`text-[28px] font-bold m-0 ${(result.violation_count ?? 0) > 0 ? 'text-[#dc2626]' : 'text-[#0f172a]'}`}>
                        {result.violation_count ?? 0}
                      </p>
                    </div>
                    <div className="bg-[#f8fafc] border border-[#e5eaf0] rounded-[10px] px-4 py-[14px] col-span-2">
                      <p className="text-[11px] text-[#94a3b8] font-medium uppercase tracking-[0.05em] m-0 mb-[6px]">
                        <Clock size={11} className="inline mr-[3px]" />Processing Time
                      </p>
                      <p className="text-[28px] font-bold text-[#0f172a] m-0">
                        {result.processing_time_ms ?? '—'} <span className="text-[14px] text-[#94a3b8] font-medium">ms</span>
                      </p>
                    </div>
                  </div>

                  {/* Per-person PPE details */}
                  {result.persons && result.persons.length > 0 && (
                    <>
                      <p className="text-[12px] font-semibold text-[#64748b] uppercase tracking-[0.06em] mt-4 mb-[10px] flex items-center gap-[6px]">
                        Per-Person PPE Details
                      </p>
                      {result.persons.map((person) => (
                        <div
                          key={person.id}
                          className={`rounded-[10px] px-[14px] py-3 mb-2 border ${person.is_compliant ? 'border-[#bbf7d0] bg-[#f0fdf4]' : 'border-[#fecaca] bg-[#fff1f2]'}`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[13px] font-semibold text-[#0f172a]">Person {person.id}</span>
                            <span className={`text-[11px] font-semibold px-2 py-[2px] rounded-full ${person.is_compliant ? 'text-[#16a34a] bg-[#dcfce7]' : 'text-[#dc2626] bg-[#fee2e2]'}`}>
                              {person.is_compliant ? 'Compliant' : 'Violation'}
                            </span>
                          </div>
                          {person.wearing?.map((item, i) => (
                            <div key={`w${i}`} className="flex items-center gap-[6px] text-[12px] mb-1">
                              <CheckCircle size={13} color="#16a34a" />
                              <span className="text-[#16a34a]">{item}</span>
                              <span className="ml-auto text-[11px] text-[#86efac]">Wearing</span>
                            </div>
                          ))}
                          {person.not_wearing?.map((item, i) => (
                            <div key={`nw${i}`} className="flex items-center gap-[6px] text-[12px] mb-1">
                              <X size={13} color="#dc2626" />
                              <span className="text-[#dc2626]">{item}</span>
                              <span className="ml-auto text-[11px] text-[#fca5a5]">Not Wearing</span>
                            </div>
                          ))}
                          <p className="text-[11px] text-[#94a3b8] mt-[6px]">Confidence: {Math.round(person.confidence * 100)}%</p>
                        </div>
                      ))}
                    </>
                  )}

                  {/* Violations summary */}
                  {result.violations && result.violations.length > 0 && (
                    <>
                      <p className="text-[12px] font-semibold text-[#64748b] uppercase tracking-[0.06em] mt-4 mb-[10px] flex items-center gap-[6px]">
                        Violations Summary
                      </p>
                      {result.violations.map((v, i) => (
                        <div key={i} className="flex items-center gap-2 px-3 py-[10px] bg-[#fff1f2] border border-[#fecaca] rounded-lg text-[13px] text-[#dc2626] mb-[6px]">
                          <AlertTriangle size={14} color="#dc2626" className="shrink-0" />
                          {v}
                        </div>
                      ))}
                    </>
                  )}
                </>
              ) : (
                /* Empty state */
                <div className="flex flex-col items-center justify-center py-10 px-5 text-center">
                  <div className="w-14 h-14 rounded-[14px] bg-[#f1f5f9] flex items-center justify-center mb-3">
                    <ImageIcon size={26} color="#cbd5e1" />
                  </div>
                  <p className="text-[14px] font-semibold text-[#475569] m-0 mb-[6px]">No results yet</p>
                  <p className="text-[13px] text-[#94a3b8] m-0 leading-relaxed" style={{ maxWidth: '180px' }}>
                    Upload a file and click Start Detection to see results.
                  </p>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Keyframe animations */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes progressPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @keyframes livePulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.75); }
        }
      `}</style>
    </Layout>
  )
}
