import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Activity,
  Camera,
  CircleDot,
  Loader2,
  Play,
  Plus,
  RefreshCw,
  Square,
  Trash2,
} from 'lucide-react'
import toast from 'react-hot-toast'

import { Layout } from '../components/layout/Layout'
import { camerasService } from '../services/cameras'
import type { CameraDeviceOption } from '../services/cameras'
import { zonesService } from '../services/zones'
import { useAuthStore } from '../stores/authStore'
import type { EdgeCamera, Zone } from '../types'

interface CameraSocketMessage {
  type?: string
  data?: Partial<EdgeCamera> & { camera_id?: number }
}

type PreviewStatus = 'offline' | 'waiting' | 'live' | 'stale'
type CameraAction = 'test' | 'start' | 'stop' | 'delete'
type BulkCameraAction = Extract<CameraAction, 'start' | 'stop'>
type CameraDiscoverySource = 'backend' | 'browser' | 'mixed' | 'none'
const PREVIEW_POLL_INTERVAL_MS = 250
const BROWSER_PREVIEW_CONSTRAINTS = {
  width: { ideal: 1280 },
  height: { ideal: 720 },
  frameRate: { ideal: 30 },
}

const getCameraDeviceLabel = (device: CameraDeviceOption) => {
  const resolution = device.width && device.height ? ` · ${device.width}×${device.height}` : ''
  const backend = device.backend_name ? ` · ${device.backend_name}` : ''
  return `${device.label || `Camera ${device.device_index}`}${resolution}${backend}`
}

const mergeCameraDeviceOptions = (
  backendDevices: CameraDeviceOption[],
  browserDevices: CameraDeviceOption[],
) => {
  const merged = new Map<number, CameraDeviceOption>()
  browserDevices.forEach((device) => merged.set(device.device_index, device))
  backendDevices.forEach((device) => {
    const browserDevice = merged.get(device.device_index)
    merged.set(device.device_index, {
      ...device,
      label: browserDevice?.label && browserDevice.label !== `Browser camera ${device.device_index + 1}`
        ? browserDevice.label
        : device.label,
      backend_name: browserDevice
        ? `${device.backend_name || 'backend'} + browser`
        : device.backend_name,
    })
  })
  return [...merged.values()].sort((first, second) => first.device_index - second.device_index)
}

const describeCameraSource = (camera: EdgeCamera) => {
  if (camera.source_type === 'rtsp') return `Network camera${camera.location ? ` · ${camera.location}` : ''}`
  if (camera.source_type === 'file') return `Video source${camera.location ? ` · ${camera.location}` : ''}`
  return `Local camera ${camera.device_index ?? 0}${camera.location ? ` · ${camera.location}` : ''}`
}

const getBrowserCameraDevices = async (): Promise<CameraDeviceOption[]> => {
  if (!navigator.mediaDevices?.enumerateDevices) return []

  let devices = await navigator.mediaDevices.enumerateDevices()
  let videoInputs = devices.filter((device) => device.kind === 'videoinput')

  if (videoInputs.length > 0 && videoInputs.every((device) => !device.label) && navigator.mediaDevices.getUserMedia) {
    const probeStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
    probeStream.getTracks().forEach((track) => track.stop())
    devices = await navigator.mediaDevices.enumerateDevices()
    videoInputs = devices.filter((device) => device.kind === 'videoinput')
  }

  return videoInputs.map((device, index) => ({
    device_index: index,
    label: device.label || `Browser camera ${index + 1}`,
    backend_name: 'browser fallback',
  }))
}

const getBrowserCameraDeviceId = async (deviceIndex: number): Promise<string | undefined> => {
  if (!navigator.mediaDevices?.enumerateDevices) return undefined
  const devices = await navigator.mediaDevices.enumerateDevices()
  return devices.filter((device) => device.kind === 'videoinput')[deviceIndex]?.deviceId
}

function CameraPreview({ camera }: { camera: EdgeCamera }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [useBrowserPreview, setUseBrowserPreview] = useState(false)
  const [preview, setPreview] = useState<{ url: string | null; status: PreviewStatus }>({
    url: null,
    status: camera.is_active ? 'waiting' : 'offline',
  })

  useEffect(() => {
    let mounted = true
    let stream: MediaStream | null = null
    const video = videoRef.current

    setUseBrowserPreview(false)
    if (!camera.is_active || camera.source_type !== 'usb' || !navigator.mediaDevices?.getUserMedia) {
      return () => undefined
    }

    setPreview({ url: null, status: 'waiting' })
    const openBrowserPreview = async () => {
      try {
        const deviceId = await getBrowserCameraDeviceId(camera.device_index ?? 0)
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            ...BROWSER_PREVIEW_CONSTRAINTS,
            ...(deviceId ? { deviceId: { exact: deviceId } } : { facingMode: 'environment' }),
          },
          audio: false,
        })
        if (!mounted) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }
        if (video) {
          video.srcObject = stream
          await video.play()
        }
        if (!mounted) return
        setUseBrowserPreview(true)
        setPreview({ url: null, status: 'live' })
      } catch (error) {
        console.warn('Browser camera preview unavailable; falling back to backend preview.', error)
        if (mounted) setUseBrowserPreview(false)
      }
    }

    void openBrowserPreview()

    return () => {
      mounted = false
      if (video) video.srcObject = null
      if (stream) stream.getTracks().forEach((track) => track.stop())
    }
  }, [camera.device_index, camera.id, camera.is_active, camera.source_type])

  useEffect(() => {
    let mounted = true
    let timer: number | undefined
    let objectUrl: string | null = null

    if (!camera.is_active) {
      setPreview({ url: null, status: 'offline' })
      return () => undefined
    }
    if (useBrowserPreview) return () => undefined

    setPreview({ url: null, status: 'waiting' })
    const poll = async () => {
      try {
        const blob = await camerasService.getPreview(camera.id)
        if (!mounted) return
        if (!blob) {
          setPreview((current) => ({
            url: current.url,
            status: current.url ? 'stale' : 'waiting',
          }))
          return
        }
        const nextUrl = URL.createObjectURL(blob)
        const previousUrl = objectUrl
        objectUrl = nextUrl
        setPreview({ url: nextUrl, status: 'live' })
        if (previousUrl) URL.revokeObjectURL(previousUrl)
      } catch {
        if (mounted) {
          setPreview((current) => ({
            url: current.url,
            status: current.url ? 'stale' : 'waiting',
          }))
        }
      } finally {
        if (mounted) timer = window.setTimeout(() => void poll(), PREVIEW_POLL_INTERVAL_MS)
      }
    }
    void poll()

    return () => {
      mounted = false
      if (timer !== undefined) window.clearTimeout(timer)
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [camera.id, camera.is_active, useBrowserPreview])

  const statusLabel = preview.status === 'live'
    ? 'LIVE'
    : preview.status === 'stale'
      ? 'RECONNECTING'
      : preview.status.toUpperCase()

  return (
    <div className="relative mt-5 aspect-video overflow-hidden rounded-[18px] border border-[#333336] bg-black">
      <video
        ref={videoRef}
        className={`h-full w-full object-contain ${useBrowserPreview ? 'block' : 'hidden'}`}
        playsInline
        muted
      />
      {!useBrowserPreview && preview.url ? (
        <img src={preview.url} alt={`Live preview from ${camera.name}`} className="h-full w-full object-contain" />
      ) : null}
      {!useBrowserPreview && !preview.url ? (
        <div className="flex h-full flex-col items-center justify-center gap-3 px-4 text-center text-[#cccccc]">
          {preview.status === 'waiting' ? <Loader2 size={26} className="animate-spin" aria-hidden="true" /> : <Camera size={28} aria-hidden="true" />}
          <p className="m-0 text-[14px] font-semibold">
            {preview.status === 'waiting' ? 'กำลังเชื่อมต่อกล้องและรอเฟรมแรก…' : 'กด Start เพื่อเปิดกล้อง'}
          </p>
        </div>
      ) : null}
      <div className="absolute left-3 top-3 flex min-h-8 items-center gap-2 rounded-full bg-black/70 px-3 text-[11px] font-semibold text-white backdrop-blur-sm" role="status" aria-live="polite">
        <span className={`h-2 w-2 rounded-full ${preview.status === 'live' ? 'animate-pulse bg-[#34c759]' : preview.status === 'stale' ? 'bg-[#ff9f0a]' : 'bg-[#86868b]'}`} aria-hidden="true" />
        {statusLabel}
      </div>
      <div className="absolute bottom-3 right-3 rounded-full bg-black/70 px-3 py-1.5 text-[10px] font-normal text-white backdrop-blur-sm">
        {useBrowserPreview ? 'Browser live view · memory only' : 'Authorized live view · memory only'}
      </div>
    </div>
  )
}

export function CameraPage() {
  const user = useAuthStore((state) => state.user)
  const isAdmin = user?.role === 'admin'
  const canViewPreview = user?.role === 'admin' || user?.role === 'safety_officer'
  const [cameras, setCameras] = useState<EdgeCamera[]>([])
  const [zones, setZones] = useState<Zone[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [busyActions, setBusyActions] = useState<Partial<Record<number, CameraAction>>>({})
  const [bulkAction, setBulkAction] = useState<BulkCameraAction | null>(null)
  const [creating, setCreating] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [name, setName] = useState('Production Camera')
  const [deviceIndex, setDeviceIndex] = useState(0)
  const [availableCameraDevices, setAvailableCameraDevices] = useState<CameraDeviceOption[]>([])
  const [isRefreshingDevices, setIsRefreshingDevices] = useState(false)
  const [cameraDiscoverySource, setCameraDiscoverySource] = useState<CameraDiscoverySource>('none')
  const [cameraPermissionError, setCameraPermissionError] = useState<string | null>(null)
  const [zoneId, setZoneId] = useState<number | undefined>()
  const loadRequestRef = useRef(0)

  const applyCameraDevices = useCallback((devices: CameraDeviceOption[], source: CameraDiscoverySource) => {
    setAvailableCameraDevices(devices)
    setCameraDiscoverySource(source)
    setDeviceIndex((current) => (
      devices.some((device) => device.device_index === current)
        ? current
        : devices[0]?.device_index ?? 0
    ))
  }, [])

  const refreshAvailableCameraDevices = useCallback(async () => {
    setIsRefreshingDevices(true)
    try {
      setCameraPermissionError(null)
      const [backendDevices, browserDevices] = await Promise.all([
        camerasService.devices().catch((error) => {
          console.error('Backend camera device discovery failed:', error)
          return [] as CameraDeviceOption[]
        }),
        getBrowserCameraDevices().catch((error) => {
          console.error('Browser camera device discovery failed:', error)
          return [] as CameraDeviceOption[]
        }),
      ])
      const devices = mergeCameraDeviceOptions(backendDevices, browserDevices)

      if (devices.length > 0) {
        applyCameraDevices(
          devices,
          backendDevices.length > 0 && browserDevices.length > 0
            ? 'mixed'
            : backendDevices.length > 0
              ? 'backend'
              : 'browser',
        )
        if (backendDevices.length === 0 && browserDevices.length > 0) {
          setCameraPermissionError('browser มองเห็นกล้องแล้ว แต่ backend/OpenCV ยังเปิดอ่านไม่ได้ หากกด Start แล้วไม่ขึ้นภาพ ให้แก้ Camera permission ของ backend ก่อน')
        }
        return
      }

      applyCameraDevices([], 'none')
    } catch (error) {
      console.error('Camera device discovery failed:', error)
      applyCameraDevices([], 'none')
      setCameraPermissionError('ไม่พบกล้องจากทั้ง backend และ browser กรุณาตรวจสิทธิ์ Camera, สาย USB, hub และแอปอื่นที่กำลังใช้กล้อง')
    } finally {
      setIsRefreshingDevices(false)
    }
  }, [applyCameraDevices])

  const load = useCallback(async (silent = false) => {
    const requestId = loadRequestRef.current + 1
    loadRequestRef.current = requestId
    if (!silent) setLoading(true)
    try {
      const [cameraData, zoneData] = await Promise.all([
        camerasService.list(),
        zonesService.list().catch(() => [] as Zone[]),
      ])
      if (loadRequestRef.current !== requestId) return
      setCameras(cameraData)
      setZones(zoneData)
      setLoadError(null)
    } catch (error) {
      if (loadRequestRef.current !== requestId) return
      console.error(error)
      setLoadError('เชื่อมต่อข้อมูลกล้องไม่ได้ ข้อมูลที่แสดงอาจไม่เป็นปัจจุบัน')
      if (!silent) toast.error('โหลดข้อมูลกล้องไม่สำเร็จ')
    } finally {
      if (loadRequestRef.current === requestId) setLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    let timer: number | undefined
    const schedulePoll = () => {
      timer = window.setTimeout(async () => {
        await load(true)
        if (!cancelled) schedulePoll()
      }, 5000)
    }
    void load().finally(() => {
      if (!cancelled) schedulePoll()
    })
    const socket = camerasService.connect('cameras', (raw) => {
      const message = raw as CameraSocketMessage
      if (message.type !== 'camera' || !message.data?.camera_id) return
      setCameras((current) => current.map((camera) => (
        camera.id === message.data?.camera_id ? { ...camera, ...message.data } : camera
      )))
    })
    return () => {
      cancelled = true
      loadRequestRef.current += 1
      if (timer !== undefined) window.clearTimeout(timer)
      socket?.close()
    }
  }, [load])

  useEffect(() => {
    void refreshAvailableCameraDevices()
    navigator.mediaDevices?.addEventListener?.('devicechange', refreshAvailableCameraDevices)
    return () => {
      navigator.mediaDevices?.removeEventListener?.('devicechange', refreshAvailableCameraDevices)
    }
  }, [refreshAvailableCameraDevices])

  useEffect(() => {
    if (availableCameraDevices.length === 0) return
    const usedIndices = new Set(
      cameras
        .filter((camera) => camera.source_type === 'usb' && camera.device_index !== null)
        .map((camera) => camera.device_index),
    )
    if (!usedIndices.has(deviceIndex)) return
    const firstUnused = availableCameraDevices.find((device) => !usedIndices.has(device.device_index))
    if (firstUnused) setDeviceIndex(firstUnused.device_index)
  }, [availableCameraDevices, cameras, deviceIndex])

  const duplicateDeviceIndex = cameras.some((camera) => (
    camera.source_type === 'usb' && camera.device_index === deviceIndex
  ))
  const isDeviceIndexValid = availableCameraDevices.some((device) => device.device_index === deviceIndex)

  const trimmedName = name.trim()
  const isNameValid = trimmedName.length >= 2 && trimmedName.length <= 100

  const createCamera = async () => {
    if (!isNameValid) {
      setFormError('ชื่อกล้องต้องมีความยาว 2–100 ตัวอักษร')
      return
    }
    if (!isDeviceIndexValid) {
      setFormError('กรุณาเลือกกล้องที่พร้อมใช้งาน')
      return
    }
    if (duplicateDeviceIndex) {
      setFormError(`Device index ${deviceIndex} ถูกเพิ่มไว้แล้ว กรุณาเลือกหมายเลขอื่น`)
      return
    }

    setFormError(null)
    setCreating(true)
    try {
      const createdCamera = await camerasService.create({
        name: trimmedName,
        source_type: 'usb',
        device_index: deviceIndex,
        zone_id: zoneId,
        config: {},
      })
      try {
        await camerasService.start(createdCamera.id)
        toast.success('เพิ่มกล้องและเริ่มวิเคราะห์แล้ว')
      } catch (startError) {
        console.error(startError)
        await camerasService.stop(createdCamera.id).catch(() => undefined)
        toast.error('เพิ่มกล้องแล้ว แต่ยังเปิดอุปกรณ์ไม่ได้ กรุณาตรวจสายและกด Start อีกครั้ง')
      }
      setName(`Production Camera ${cameras.length + 2}`)
      await load(true)
    } catch (error) {
      console.error(error)
      setFormError('เพิ่มกล้องไม่สำเร็จ โปรดตรวจ device index และสิทธิ์ของผู้ดูแล')
      toast.error('เพิ่มกล้องไม่สำเร็จ โปรดตรวจ device index และสิทธิ์ของผู้ดูแล')
    } finally {
      setCreating(false)
    }
  }

  const markCamerasBusy = (cameraIds: number[], action: CameraAction) => {
    setBusyActions((current) => {
      const next = { ...current }
      cameraIds.forEach((cameraId) => { next[cameraId] = action })
      return next
    })
  }

  const clearCamerasBusy = (cameraIds: number[]) => {
    setBusyActions((current) => {
      const next = { ...current }
      cameraIds.forEach((cameraId) => { delete next[cameraId] })
      return next
    })
  }

  const runAction = async (camera: EdgeCamera, action: CameraAction) => {
    markCamerasBusy([camera.id], action)
    try {
      if (action === 'test') {
        const result = await camerasService.test(camera.id)
        if (!result.ok) throw new Error(result.error || 'Camera test failed')
        toast.success(`เชื่อมต่อสำเร็จ ${result.width}×${result.height}`)
      } else if (action === 'start') {
        const updated = await camerasService.start(camera.id)
        setCameras((current) => current.map((item) => item.id === camera.id ? updated : item))
        toast.success(`เริ่มวิเคราะห์ ${camera.name}`)
      } else if (action === 'stop') {
        const updated = await camerasService.stop(camera.id)
        setCameras((current) => current.map((item) => item.id === camera.id ? updated : item))
        toast.success(`หยุด ${camera.name}`)
      } else if (action === 'delete') {
        await camerasService.remove(camera.id)
        setCameras((current) => current.filter((item) => item.id !== camera.id))
        toast.success(`ลบ ${camera.name} แล้ว`)
      }
      await load(true)
    } catch (error) {
      console.error(error)
      toast.error(error instanceof Error ? error.message : 'ดำเนินการไม่สำเร็จ')
    } finally {
      clearCamerasBusy([camera.id])
    }
  }

  const deleteCamera = async (camera: EdgeCamera) => {
    const confirmed = window.confirm(`ลบกล้อง "${camera.name}" ออกจากระบบใช่ไหม?`)
    if (!confirmed) return
    await runAction(camera, 'delete')
  }

  const runBulkAction = async (action: BulkCameraAction) => {
    const targets = cameras.filter((camera) => action === 'start' ? !camera.is_active : camera.is_active)
    if (targets.length === 0) return

    const cameraIds = targets.map((camera) => camera.id)
    setBulkAction(action)
    markCamerasBusy(cameraIds, action)
    try {
      const outcomes = await Promise.allSettled(targets.map((camera) => (
        action === 'start' ? camerasService.start(camera.id) : camerasService.stop(camera.id)
      )))
      const succeeded = outcomes.filter((outcome) => outcome.status === 'fulfilled').length
      const failed = outcomes.length - succeeded
      await load(true)
      if (succeeded > 0) {
        toast.success(`${action === 'start' ? 'เริ่ม' : 'หยุด'}กล้องสำเร็จ ${succeeded} ตัว`)
      }
      if (failed > 0) {
        toast.error(`ดำเนินการไม่สำเร็จ ${failed} ตัว กรุณาลองใหม่ทีละกล้อง`)
      }
    } finally {
      clearCamerasBusy(cameraIds)
      setBulkAction(null)
    }
  }

  const onlineCount = cameras.filter((camera) => camera.is_online).length
  const activeCount = cameras.filter((camera) => camera.is_active).length
  const analyzedFrames = cameras.reduce((sum, camera) => sum + camera.frames_analyzed, 0)
  const hasBusyCamera = Object.keys(busyActions).length > 0
  const validationMessage = formError
    || (!isNameValid ? 'ชื่อกล้องต้องมีความยาว 2–100 ตัวอักษร' : null)
    || (duplicateDeviceIndex ? `Device index ${deviceIndex} ถูกเพิ่มไว้แล้ว` : null)
    || (!isDeviceIndexValid ? 'กรุณาเลือกกล้องที่พร้อมใช้งาน' : null)

  return (
    <Layout>
      <div className="flex flex-col gap-8">
        <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="page-heading max-w-3xl">
            <h1>กล้องตรวจจับหน้างาน</h1>
            <p className="max-w-2xl text-[17px] leading-7">จัดการกล้องหน้างานที่เชื่อมต่อกับอุปกรณ์ backend พร้อม live preview ที่ยืนยันตัวตนและเก็บภาพไว้ในหน่วยความจำเท่านั้น</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {isAdmin && cameras.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={() => void runBulkAction('start')}
                  disabled={bulkAction !== null || hasBusyCamera || activeCount === cameras.length}
                  className="btn-apple-primary min-h-11"
                >
                  {bulkAction === 'start' ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
                  Start all
                </button>
                <button
                  type="button"
                  onClick={() => void runBulkAction('stop')}
                  disabled={bulkAction !== null || hasBusyCamera || activeCount === 0}
                  className="btn-apple-secondary min-h-11"
                >
                  {bulkAction === 'stop' ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Square size={15} aria-hidden="true" />}
                  Stop all
                </button>
              </>
            )}
            <button type="button" onClick={() => void load()} disabled={loading} className="btn-apple-secondary min-h-11">
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} aria-hidden="true" /> Refresh
            </button>
          </div>
        </header>

        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Camera fleet summary">
          {[
            { label: 'Registered', value: cameras.length, valueClass: 'text-[#1d1d1f]' },
            { label: 'Active', value: activeCount, valueClass: 'text-[#1d1d1f]' },
            { label: 'Online', value: onlineCount, valueClass: onlineCount > 0 ? 'text-[#15803d]' : 'text-[#1d1d1f]' },
            { label: 'Analyzed frames', value: analyzedFrames, valueClass: 'text-[#1d1d1f]' },
          ].map((item) => (
            <article key={item.label} className="surface-card p-5 sm:p-6">
              <p className="m-0 text-[13px] font-semibold text-[#6e6e73]">{item.label}</p>
              <p className={`mb-0 mt-3 text-[34px] font-semibold tracking-[-0.04em] ${item.valueClass}`}>{item.value.toLocaleString()}</p>
            </article>
          ))}
        </section>

        {isAdmin && (
          <section className="surface-card p-5 sm:p-8" aria-labelledby="register-camera-title">
            <div className="mb-6 flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#f5f5f7] text-[#0066cc]">
                <Plus size={19} aria-hidden="true" />
              </div>
              <div>
                <h2 id="register-camera-title" className="m-0 text-[21px] font-semibold tracking-[-0.01em] text-[#1d1d1f]">Register camera</h2>
                <p className="mb-0 mt-1 text-[14px] leading-5 text-[#6e6e73]">เลือกจากกล้องที่ backend ตรวจพบและเปิดอ่านเฟรมได้จริง</p>
              </div>
            </div>
            <form
              className="grid grid-cols-1 items-end gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,1fr)_minmax(0,1fr)_auto]"
              onSubmit={(event) => { event.preventDefault(); void createCamera() }}
              aria-describedby={validationMessage ? 'camera-form-error' : 'camera-device-help'}
            >
              <label className="text-[13px] font-semibold text-[#424245]">
                Camera name
                  <input
                  value={name}
                  onChange={(event) => { setName(event.target.value); setFormError(null) }}
                  placeholder="e.g. Assembly line 1"
                  minLength={2}
                  maxLength={100}
                  required
                  disabled={loading || Boolean(loadError)}
                  className="mt-2 min-h-12 w-full rounded-full border border-[#d2d2d7] bg-white px-4 text-[15px] text-[#1d1d1f]"
                  aria-invalid={!isNameValid}
                />
              </label>
              <label className="text-[13px] font-semibold text-[#424245]">
                Choose camera
                <select
                  value={deviceIndex}
                  onChange={(event) => { setDeviceIndex(Number(event.target.value)); setFormError(null) }}
                  className="mt-2 min-h-12 w-full rounded-full border border-[#d2d2d7] bg-white px-4 text-[15px] text-[#1d1d1f]"
                  aria-invalid={!isDeviceIndexValid || duplicateDeviceIndex}
                  aria-describedby="camera-device-help"
                  disabled={loading || Boolean(loadError) || availableCameraDevices.length === 0 || isRefreshingDevices}
                >
                  {availableCameraDevices.length === 0 ? (
                    <option value={0}>ไม่พบกล้องที่พร้อมใช้งาน</option>
                  ) : availableCameraDevices.map((device) => {
                    const isRegistered = cameras.some((camera) => (
                      camera.source_type === 'usb' && camera.device_index === device.device_index
                    ))
                    return (
                      <option key={device.device_index} value={device.device_index} disabled={isRegistered}>
                        {getCameraDeviceLabel(device)}{isRegistered ? ' — ลงทะเบียนแล้ว' : ''}
                      </option>
                    )
                  })}
                </select>
              </label>
              <label className="text-[13px] font-semibold text-[#424245]">
                Safety zone
                <select value={zoneId ?? ''} onChange={(event) => setZoneId(event.target.value ? Number(event.target.value) : undefined)} disabled={loading || Boolean(loadError)} className="mt-2 min-h-12 w-full rounded-full border border-[#d2d2d7] bg-white px-4 text-[15px] text-[#1d1d1f]">
                  <option value="">Default PPE rules</option>
                  {zones.map((zone) => <option key={zone.id} value={zone.id}>{zone.name}</option>)}
                </select>
              </label>
              <button type="submit" disabled={loading || Boolean(loadError) || creating || !isNameValid || !isDeviceIndexValid || duplicateDeviceIndex || isRefreshingDevices} className="btn-apple-primary min-h-12 px-6">
                {creating ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />} Add camera
              </button>
            </form>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p id="camera-device-help" className="m-0 text-[13px] leading-5 text-[#6e6e73]">
                {cameraDiscoverySource === 'backend'
                  ? 'แสดงเฉพาะกล้องที่ backend/OpenCV เปิดและอ่านเฟรมได้ หากเสียบกล้องใหม่ให้กด Refresh devices'
                  : cameraDiscoverySource === 'browser'
                    ? 'รายการนี้มาจาก browser แบบเดียวกับหน้า Detect เพราะ backend ยังเปิดกล้องไม่ได้ ลำดับ Camera 0, 1, 2 อาจต้องกด Test เพื่อยืนยันกับ OpenCV'
                    : cameraDiscoverySource === 'mixed'
                      ? 'รวมรายการจาก backend/OpenCV และ browser เพื่อให้เห็นอุปกรณ์ USB ที่เสียบอยู่ครบขึ้น หากลงทะเบียนแล้วจะเลือกซ้ำไม่ได้'
                    : 'ยังไม่พบกล้อง หากเสียบกล้องใหม่ให้กด Refresh devices'}
              </p>
              <button
                type="button"
                onClick={() => void refreshAvailableCameraDevices()}
                className="btn-apple-secondary min-h-11 shrink-0 px-4"
                disabled={loading || isRefreshingDevices}
              >
                <RefreshCw size={16} className={isRefreshingDevices ? 'animate-spin' : ''} aria-hidden="true" /> Refresh devices
              </button>
            </div>
            {cameraPermissionError && (
              <p className="mb-0 mt-3 text-[13px] leading-5 text-[#9a5b00]" role="status">{cameraPermissionError}</p>
            )}
            {!cameraPermissionError && !isRefreshingDevices && availableCameraDevices.length === 0 && (
              <p className="mb-0 mt-3 text-[13px] leading-5 text-[#9a5b00]" role="status">
                backend ยังเปิดกล้องไม่ได้ บน macOS ให้เปิด Camera permission ให้แอปที่ใช้รัน backend เช่น Terminal, iTerm, VS Code หรือ Python แล้วปิด-เปิด backend ใหม่ หากเคยกดไม่อนุญาต ให้รัน tccutil reset Camera ก่อน
              </p>
            )}
            {validationMessage && (
              <p id="camera-form-error" className="mb-0 mt-4 text-[13px] text-[#b4232f]" role="alert">{validationMessage}</p>
            )}
          </section>
        )}

        {loadError && (
          <div className="flex items-start gap-3 rounded-[18px] border border-[#f0c3c8] bg-[#fff8f8] px-4 py-3 text-[14px] leading-5 text-[#b4232f]" role="alert">
            <CircleDot size={17} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>{loadError}</span>
            <button type="button" onClick={() => void load()} className="ml-auto inline-flex min-h-11 shrink-0 items-center rounded-full border-0 bg-transparent px-3 font-semibold text-[#0066cc]">ลองอีกครั้ง</button>
          </div>
        )}

        {loading ? (
          <div className="surface-card flex min-h-64 flex-col items-center justify-center gap-4 px-6 text-center text-[#6e6e73]" role="status" aria-live="polite">
            <Loader2 className="animate-spin text-[#0066cc]" size={28} aria-hidden="true" />
            <div><p className="m-0 text-[17px] font-semibold text-[#1d1d1f]">Loading cameras…</p><p className="mb-0 mt-2 text-[14px]">กำลังเชื่อมต่อสถานะกล้องล่าสุด</p></div>
          </div>
        ) : cameras.length === 0 ? (
          <div className="surface-card flex min-h-64 flex-col items-center justify-center border-dashed px-6 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#f5f5f7] text-[#86868b]"><Camera size={28} aria-hidden="true" /></div>
            <p className="m-0 text-[17px] font-semibold text-[#1d1d1f]">ยังไม่มีกล้อง Edge ในระบบ</p>
            <p className="mb-0 mt-2 max-w-md text-[14px] leading-6 text-[#6e6e73]">{isAdmin ? 'ลงทะเบียนกล้องด้านบน แล้วทดสอบการเชื่อมต่อก่อนเริ่มวิเคราะห์' : 'โปรดติดต่อผู้ดูแลระบบเพื่อเพิ่มกล้อง'}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            {cameras.map((camera) => {
              const busyAction = busyActions[camera.id]
              const isBusy = busyAction !== undefined
              return (
                <article key={camera.id} className="surface-card p-5 sm:p-6" aria-busy={isBusy}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${camera.is_online ? 'bg-[#edf8ef] text-[#15803d]' : camera.is_active ? 'bg-[#fff7e8] text-[#9a5b00]' : 'bg-[#f0f0f2] text-[#6e6e73]'}`}>
                        <Camera size={20} aria-hidden="true" />
                      </div>
                      <div className="min-w-0">
                        <h2 className="m-0 truncate text-[21px] font-semibold tracking-[-0.01em] text-[#1d1d1f]">{camera.name}</h2>
                        <p className="mb-0 mt-1 text-[13px] text-[#6e6e73]">{describeCameraSource(camera)}</p>
                      </div>
                    </div>
                    <span className={`inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-[11px] font-semibold ${camera.is_online ? 'bg-[#edf8ef] text-[#15803d]' : camera.is_active ? 'bg-[#fff7e8] text-[#9a5b00]' : 'bg-[#f0f0f2] text-[#6e6e73]'}`}>
                      {isBusy ? <Loader2 size={12} className="animate-spin" aria-hidden="true" /> : <CircleDot size={12} aria-hidden="true" />}
                      {isBusy ? 'UPDATING' : camera.is_online ? 'ONLINE' : camera.is_active && camera.last_error ? 'RECONNECTING' : camera.is_active ? 'STARTING' : 'OFFLINE'}
                    </span>
                  </div>

                  {canViewPreview ? (
                    <CameraPreview camera={camera} />
                  ) : (
                    <div className="mt-5 rounded-[18px] bg-[#f5f5f7] px-4 py-5 text-center text-[13px] leading-5 text-[#6e6e73]">Live preview is available to admins and safety officers.</div>
                  )}

                  <dl className="mt-5 grid grid-cols-3 gap-2">
                    <div className="rounded-[18px] bg-[#f5f5f7] p-3 sm:p-4"><dt className="text-[11px] font-semibold text-[var(--muted)]">AI FPS</dt><dd className="mb-0 mt-1 text-[20px] font-semibold text-[#1d1d1f]">{camera.measured_fps.toFixed(1)}</dd></div>
                    <div className="rounded-[18px] bg-[#f5f5f7] p-3 sm:p-4"><dt className="text-[11px] font-semibold text-[var(--muted)]">Frames</dt><dd className="mb-0 mt-1 text-[20px] font-semibold text-[#1d1d1f]">{camera.frames_analyzed.toLocaleString()}</dd></div>
                    <div className="min-w-0 rounded-[18px] bg-[#f5f5f7] p-3 sm:p-4"><dt className="text-[11px] font-semibold text-[var(--muted)]">Zone</dt><dd className="mb-0 mt-1 truncate text-[15px] font-semibold text-[#1d1d1f]">{zones.find((zone) => zone.id === camera.zone_id)?.name || 'Default'}</dd></div>
                  </dl>

                  {camera.last_error && <p className="mb-0 mt-4 rounded-[18px] border border-[#f0c3c8] bg-[#fff8f8] px-4 py-3 text-[13px] leading-5 text-[#b4232f]" role="alert">{camera.last_error}</p>}

                  {isAdmin && (
                    <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-[#e0e0e0] pt-5">
                      <button type="button" title="ทดสอบว่าระบบเปิดอุปกรณ์และอ่านเฟรมได้" onClick={() => void runAction(camera, 'test')} disabled={isBusy || camera.is_active || bulkAction !== null} className="btn-apple-secondary min-h-11 px-4">
                        {busyAction === 'test' ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Activity size={15} aria-hidden="true" />} Test
                      </button>
                      {camera.is_active ? (
                        <button type="button" title="หยุดวิเคราะห์ชั่วคราว กล้องยังอยู่ในรายการ" onClick={() => void runAction(camera, 'stop')} disabled={isBusy || bulkAction !== null} className="btn-apple-secondary min-h-11 px-4">
                          {busyAction === 'stop' ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Square size={14} aria-hidden="true" />} Stop
                        </button>
                      ) : (
                        <button type="button" title="เปิดกล้องและเริ่มวิเคราะห์แบบเรียลไทม์" onClick={() => void runAction(camera, 'start')} disabled={isBusy || bulkAction !== null} className="btn-apple-primary min-h-11 px-4">
                          {busyAction === 'start' ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Play size={15} aria-hidden="true" />} Start
                        </button>
                      )}
                      <button
                        type="button"
                        title="ลบกล้องนี้ออกจากระบบ"
                        onClick={() => void deleteCamera(camera)}
                        disabled={isBusy || bulkAction !== null}
                        className="ml-auto inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full border border-[#f0c3c8] bg-white px-4 text-[14px] font-semibold text-[#b4232f] transition hover:bg-[#fff8f8] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {busyAction === 'delete' ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Trash2 size={15} aria-hidden="true" />} Delete
                      </button>
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        )}
      </div>
    </Layout>
  )
}
