import { useCallback, useEffect, useState } from 'react'
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
import { zonesService } from '../services/zones'
import { useAuthStore } from '../stores/authStore'
import type { EdgeCamera, Zone } from '../types'

interface CameraSocketMessage {
  type?: string
  data?: Partial<EdgeCamera> & { camera_id?: number }
}

type PreviewStatus = 'offline' | 'waiting' | 'live' | 'stale'
const PREVIEW_POLL_INTERVAL_MS = 70

function CameraPreview({ camera }: { camera: EdgeCamera }) {
  const [preview, setPreview] = useState<{ url: string | null; status: PreviewStatus }>({
    url: null,
    status: camera.is_active ? 'waiting' : 'offline',
  })

  useEffect(() => {
    let mounted = true
    let timer: number | undefined
    let objectUrl: string | null = null

    if (!camera.is_active) {
      setPreview({ url: null, status: 'offline' })
      return () => undefined
    }

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
  }, [camera.id, camera.is_active])

  const statusLabel = preview.status === 'live'
    ? 'LIVE'
    : preview.status === 'stale'
      ? 'RECONNECTING'
      : preview.status.toUpperCase()

  return (
    <div className="relative mt-4 aspect-video overflow-hidden rounded-[18px] border border-[#252e37] bg-[#0d161f]">
      {preview.url ? (
        <img src={preview.url} alt={`Live preview from ${camera.name}`} className="h-full w-full object-contain" />
      ) : (
        <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center text-[#cbd5e1]">
          {preview.status === 'waiting' ? <Loader2 size={24} className="animate-spin" /> : <Camera size={26} />}
          <p className="m-0 text-[12px] font-semibold">
            {preview.status === 'waiting' ? 'กำลังเปิดกล้องและโหลดโมเดล AI…' : 'กด Start เพื่อเปิดกล้อง'}
          </p>
        </div>
      )}
      <div className="absolute left-2.5 top-2.5 flex items-center gap-1.5 rounded-full bg-black/65 px-2.5 py-1 text-[10px] font-bold text-white backdrop-blur-sm">
        <span className={`h-2 w-2 rounded-full ${preview.status === 'live' ? 'animate-pulse bg-emerald-400' : preview.status === 'stale' ? 'bg-amber-400' : 'bg-slate-400'}`} />
        {statusLabel}
      </div>
      <div className="absolute bottom-2.5 right-2.5 rounded-full bg-black/65 px-2.5 py-1 text-[9px] font-medium text-white backdrop-blur-sm">
        Authorized live view · memory only
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
  const [busyId, setBusyId] = useState<number | null>(null)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('Production Camera')
  const [deviceIndex, setDeviceIndex] = useState(0)
  const [zoneId, setZoneId] = useState<number | undefined>()

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const [cameraData, zoneData] = await Promise.all([
        camerasService.list(),
        zonesService.list().catch(() => [] as Zone[]),
      ])
      setCameras(cameraData)
      setZones(zoneData)
    } catch (error) {
      console.error(error)
      if (!silent) toast.error('โหลดข้อมูลกล้องไม่สำเร็จ')
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
    const timer = window.setInterval(() => void load(true), 5000)
    const socket = camerasService.connect('cameras', (raw) => {
      const message = raw as CameraSocketMessage
      if (message.type !== 'camera' || !message.data?.camera_id) return
      setCameras((current) => current.map((camera) => (
        camera.id === message.data?.camera_id ? { ...camera, ...message.data } : camera
      )))
    })
    return () => {
      window.clearInterval(timer)
      socket?.close()
    }
  }, [load])

  const createCamera = async () => {
    if (!name.trim()) return
    setCreating(true)
    try {
      await camerasService.create({
        name: name.trim(),
        source_type: 'usb',
        device_index: deviceIndex,
        zone_id: zoneId,
        config: {},
      })
      toast.success('เพิ่มกล้อง Edge แล้ว')
      setName(`Production Camera ${cameras.length + 2}`)
      setDeviceIndex((value) => value + 1)
      await load(true)
    } catch (error) {
      console.error(error)
      toast.error('เพิ่มกล้องไม่สำเร็จ โปรดตรวจ device index และสิทธิ์ของผู้ดูแล')
    } finally {
      setCreating(false)
    }
  }

  const runAction = async (camera: EdgeCamera, action: 'test' | 'start' | 'stop' | 'delete') => {
    if (action === 'delete' && !window.confirm(
      `นำ ${camera.name} ออกจากรายการกล้อง? ระบบจะหยุดกล้องก่อน แต่จะไม่ลบประวัติเหตุการณ์หรือหลักฐาน`,
    )) return
    setBusyId(camera.id)
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
      } else {
        await camerasService.remove(camera.id)
        toast.success('นำกล้องออกจากรายการแล้ว')
      }
      await load(true)
    } catch (error) {
      console.error(error)
      toast.error(error instanceof Error ? error.message : 'ดำเนินการไม่สำเร็จ')
    } finally {
      setBusyId(null)
    }
  }

  const onlineCount = cameras.filter((camera) => camera.is_online).length
  const analyzedFrames = cameras.reduce((sum, camera) => sum + camera.frames_analyzed, 0)

  return (
    <Layout>
      <div className="flex flex-col gap-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="page-heading">
            <h1>กล้องตรวจจับหน้างาน</h1>
            <p>Hybrid YOLOv8m + YOLO11n บน GPU พร้อม authorized live preview</p>
          </div>
          <button type="button" onClick={() => void load()} className="btn-apple-secondary">
            <RefreshCw size={15} /> Refresh
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            { label: 'Registered', value: cameras.length, color: '#0066cc' },
            { label: 'Online', value: onlineCount, color: '#15803d' },
            { label: 'Analyzed frames', value: analyzedFrames, color: '#b21d61' },
          ].map((item) => (
            <div key={item.label} className="surface-card p-5">
              <p className="m-0 text-[12px] font-semibold text-[#6e6e73]">{item.label}</p>
              <p className="mb-0 mt-2 text-[30px] font-bold" style={{ color: item.color }}>{item.value.toLocaleString()}</p>
            </div>
          ))}
        </div>

        {isAdmin && (
          <section className="surface-card p-5">
            <div className="mb-4 flex items-center gap-2">
              <Plus size={17} className="text-[#0066cc]" />
              <h2 className="m-0 text-[16px] font-bold text-[#1d1d1f]">Register USB camera</h2>
            </div>
            <div className="grid grid-cols-1 items-end gap-3 md:grid-cols-[1fr_150px_1fr_auto]">
              <label className="text-[12px] font-semibold text-[#6e6e73]">
                Camera name
                <input value={name} onChange={(event) => setName(event.target.value)} className="mt-1.5 w-full rounded-xl border border-[#d2d2d7] px-3 py-2.5 text-[14px]" />
              </label>
              <label className="text-[12px] font-semibold text-[#6e6e73]">
                Device index
                <input type="number" min={0} max={32} value={deviceIndex} onChange={(event) => setDeviceIndex(Number(event.target.value))} className="mt-1.5 w-full rounded-xl border border-[#d2d2d7] px-3 py-2.5 text-[14px]" />
              </label>
              <label className="text-[12px] font-semibold text-[#6e6e73]">
                Safety zone
                <select value={zoneId ?? ''} onChange={(event) => setZoneId(event.target.value ? Number(event.target.value) : undefined)} className="mt-1.5 w-full rounded-xl border border-[#d2d2d7] bg-white px-3 py-2.5 text-[14px]">
                  <option value="">Default PPE rules</option>
                  {zones.map((zone) => <option key={zone.id} value={zone.id}>{zone.name}</option>)}
                </select>
              </label>
              <button type="button" onClick={() => void createCamera()} disabled={creating} className="btn-apple-primary">
                {creating ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Add
              </button>
            </div>
          </section>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16 text-[#6e6e73]"><Loader2 className="mr-2 animate-spin" size={18} /> Loading cameras…</div>
        ) : cameras.length === 0 ? (
          <div className="surface-card border-dashed py-16 text-center text-[#6e6e73]">
            <Camera size={32} className="mx-auto mb-3 text-[#a1a1a6]" />
            ยังไม่มีกล้อง Edge ในระบบ
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {cameras.map((camera) => (
              <article key={camera.id} className="surface-card p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${camera.is_online ? 'bg-[#e8f7ec] text-[#15803d]' : camera.is_active ? 'bg-[#fff4df] text-[#b45309]' : 'bg-[#f0f0f2] text-[#6e6e73]'}`}>
                      <Camera size={19} />
                    </div>
                    <div>
                      <h2 className="m-0 text-[16px] font-bold text-[#1d1d1f]">{camera.name}</h2>
                      <p className="mb-0 mt-1 text-[12px] text-[#6e6e73]">USB device {camera.device_index ?? 0}{camera.location ? ` · ${camera.location}` : ''}</p>
                    </div>
                  </div>
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${camera.is_online ? 'bg-[#e8f7ec] text-[#15803d]' : camera.is_active ? 'bg-[#fff4df] text-[#b45309]' : 'bg-[#f0f0f2] text-[#6e6e73]'}`}>
                    <CircleDot size={11} /> {camera.is_online ? 'ONLINE' : camera.is_active ? 'STARTING' : 'OFFLINE'}
                  </span>
                </div>

                {canViewPreview && <CameraPreview camera={camera} />}

                <div className="mt-5 grid grid-cols-3 gap-2">
                  <div className="rounded-xl bg-[#f5f5f7] p-3"><p className="m-0 text-[10px] font-bold uppercase text-[#86868b]">AI FPS</p><p className="mb-0 mt-1 text-[18px] font-bold text-[#1d1d1f]">{camera.measured_fps.toFixed(1)}</p></div>
                  <div className="rounded-xl bg-[#f5f5f7] p-3"><p className="m-0 text-[10px] font-bold uppercase text-[#86868b]">Frames</p><p className="mb-0 mt-1 text-[18px] font-bold text-[#1d1d1f]">{camera.frames_analyzed}</p></div>
                  <div className="rounded-xl bg-[#f5f5f7] p-3"><p className="m-0 text-[10px] font-bold uppercase text-[#86868b]">Zone</p><p className="mb-0 mt-1 truncate text-[14px] font-bold text-[#1d1d1f]">{zones.find((zone) => zone.id === camera.zone_id)?.name || 'Default'}</p></div>
                </div>

                {camera.last_error && <p className="mb-0 mt-3 rounded-lg bg-[#fff1f2] px-3 py-2 text-[12px] text-[#d70015]">{camera.last_error}</p>}

                {isAdmin && (
                  <div className="mt-4 flex items-center gap-2 border-t border-[#ececf0] pt-4">
                    <button type="button" title="ทดสอบว่าระบบเปิดอุปกรณ์และอ่านเฟรมได้" onClick={() => void runAction(camera, 'test')} disabled={busyId === camera.id || camera.is_active} className="btn-apple-secondary min-h-9 px-3"><Activity size={14} /> Test</button>
                    {camera.is_active ? (
                      <button type="button" title="หยุดวิเคราะห์ชั่วคราว กล้องยังอยู่ในรายการ" onClick={() => void runAction(camera, 'stop')} disabled={busyId === camera.id} className="btn-apple-secondary min-h-9 px-3"><Square size={13} /> Stop</button>
                    ) : (
                      <button type="button" title="เปิดกล้องและเริ่มวิเคราะห์แบบเรียลไทม์" onClick={() => void runAction(camera, 'start')} disabled={busyId === camera.id} className="btn-apple-primary min-h-9 px-3"><Play size={13} /> Start</button>
                    )}
                    <button type="button" title="หยุดและนำกล้องออกจากรายการ โดยไม่ลบประวัติเหตุการณ์" onClick={() => void runAction(camera, 'delete')} disabled={busyId === camera.id} className="btn-apple-danger ml-auto min-h-9 px-3"><Trash2 size={13} /> Remove</button>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}
