import { useCallback, useEffect, useState } from 'react'
import { Activity, Camera, CircleDot, Loader2, Play, Plus, RefreshCw, Square, Trash2 } from 'lucide-react'
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

export function CameraPage() {
  const user = useAuthStore((state) => state.user)
  const isAdmin = user?.role === 'admin'
  const [cameras, setCameras] = useState<EdgeCamera[]>([])
  const [zones, setZones] = useState<Zone[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('Production Camera')
  const [deviceIndex, setDeviceIndex] = useState(0)
  const [zoneId, setZoneId] = useState<number | undefined>(undefined)

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
      toast.error('เพิ่มกล้องไม่สำเร็จ ตรวจสอบหมายเลขอุปกรณ์และสิทธิ์ผู้ดูแล')
    } finally {
      setCreating(false)
    }
  }

  const runAction = async (camera: EdgeCamera, action: 'test' | 'start' | 'stop' | 'delete') => {
    setBusyId(camera.id)
    try {
      if (action === 'test') {
        const result = await camerasService.test(camera.id)
        if (!result.ok) throw new Error(result.error || 'Camera test failed')
        toast.success(`เชื่อมต่อสำเร็จ ${result.width}×${result.height}`)
      } else if (action === 'start') {
        await camerasService.start(camera.id)
        toast.success(`เริ่มวิเคราะห์ ${camera.name}`)
      } else if (action === 'stop') {
        await camerasService.stop(camera.id)
        toast.success(`หยุด ${camera.name}`)
      } else {
        await camerasService.remove(camera.id)
        toast.success('ปิดใช้งานกล้องแล้ว')
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

  return (
    <Layout>
      <div className="flex flex-col gap-5">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-[22px] font-bold text-[#0f172a] m-0">Edge Cameras</h1>
            <p className="text-[13px] text-[#64748b] mt-1">
              จัดการกล้อง USB ที่ประมวลผลบนเครื่อง GPU ภายในโรงงาน
            </p>
          </div>
          <button
            onClick={() => void load()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#dbe3ee] bg-white text-[#475569] cursor-pointer"
          >
            <RefreshCw size={15} /> Refresh
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { label: 'Registered', value: cameras.length, color: '#2563eb' },
            { label: 'Online', value: onlineCount, color: '#16a34a' },
            { label: 'Analyzed frames', value: cameras.reduce((sum, camera) => sum + camera.frames_analyzed, 0), color: '#7c3aed' },
          ].map((item) => (
            <div key={item.label} className="bg-white border border-[#e2e8f0] rounded-2xl p-5 shadow-sm">
              <p className="text-[12px] font-semibold text-[#64748b] m-0">{item.label}</p>
              <p className="text-[30px] font-bold mt-2 mb-0" style={{ color: item.color }}>{item.value.toLocaleString()}</p>
            </div>
          ))}
        </div>

        {isAdmin && (
          <section className="bg-white border border-[#e2e8f0] rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Plus size={17} className="text-[#2563eb]" />
              <h2 className="text-[16px] font-bold text-[#0f172a] m-0">Register USB camera</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-[1fr_160px_1fr_auto] gap-3 items-end">
              <label className="text-[12px] font-semibold text-[#64748b]">
                Camera name
                <input value={name} onChange={(event) => setName(event.target.value)} className="mt-1.5 w-full border border-[#dbe3ee] rounded-lg px-3 py-2.5 text-[14px] box-border" />
              </label>
              <label className="text-[12px] font-semibold text-[#64748b]">
                Device index
                <input type="number" min={0} max={32} value={deviceIndex} onChange={(event) => setDeviceIndex(Number(event.target.value))} className="mt-1.5 w-full border border-[#dbe3ee] rounded-lg px-3 py-2.5 text-[14px] box-border" />
              </label>
              <label className="text-[12px] font-semibold text-[#64748b]">
                Safety zone
                <select value={zoneId ?? ''} onChange={(event) => setZoneId(event.target.value ? Number(event.target.value) : undefined)} className="mt-1.5 w-full border border-[#dbe3ee] rounded-lg px-3 py-2.5 text-[14px] bg-white box-border">
                  <option value="">Default PPE rules</option>
                  {zones.map((zone) => <option key={zone.id} value={zone.id}>{zone.name}</option>)}
                </select>
              </label>
              <button onClick={() => void createCamera()} disabled={creating} className="h-[42px] flex items-center justify-center gap-2 px-5 rounded-lg border-none bg-[#2563eb] text-white font-semibold cursor-pointer disabled:opacity-60">
                {creating ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Add
              </button>
            </div>
          </section>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16 text-[#64748b]"><Loader2 className="animate-spin mr-2" size={18} /> Loading cameras...</div>
        ) : cameras.length === 0 ? (
          <div className="bg-white border border-dashed border-[#cbd5e1] rounded-2xl py-16 text-center text-[#64748b]">
            <Camera size={32} className="mx-auto mb-3 text-[#94a3b8]" />
            ยังไม่มีกล้อง Edge ในระบบ
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {cameras.map((camera) => (
              <article key={camera.id} className="bg-white border border-[#e2e8f0] rounded-2xl p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${camera.is_online ? 'bg-[#dcfce7] text-[#16a34a]' : 'bg-[#f1f5f9] text-[#64748b]'}`}>
                      <Camera size={19} />
                    </div>
                    <div>
                      <h2 className="text-[16px] font-bold text-[#0f172a] m-0">{camera.name}</h2>
                      <p className="text-[12px] text-[#64748b] mt-1 mb-0">USB device {camera.device_index ?? 0} {camera.location ? `• ${camera.location}` : ''}</p>
                    </div>
                  </div>
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${camera.is_online ? 'bg-[#dcfce7] text-[#15803d]' : 'bg-[#f1f5f9] text-[#64748b]'}`}>
                    <CircleDot size={11} /> {camera.is_online ? 'ONLINE' : 'OFFLINE'}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 mt-5">
                  <div className="bg-[#f8fafc] rounded-xl p-3"><p className="text-[10px] uppercase text-[#94a3b8] font-bold m-0">FPS</p><p className="text-[18px] font-bold text-[#0f172a] mt-1 mb-0">{camera.measured_fps.toFixed(1)}</p></div>
                  <div className="bg-[#f8fafc] rounded-xl p-3"><p className="text-[10px] uppercase text-[#94a3b8] font-bold m-0">Frames</p><p className="text-[18px] font-bold text-[#0f172a] mt-1 mb-0">{camera.frames_analyzed}</p></div>
                  <div className="bg-[#f8fafc] rounded-xl p-3"><p className="text-[10px] uppercase text-[#94a3b8] font-bold m-0">Zone</p><p className="text-[14px] font-bold text-[#0f172a] mt-1 mb-0 truncate">{zones.find((zone) => zone.id === camera.zone_id)?.name || 'Default'}</p></div>
                </div>

                {camera.last_error && <p className="text-[12px] text-[#dc2626] bg-[#fff1f2] rounded-lg px-3 py-2 mt-3 mb-0">{camera.last_error}</p>}

                {isAdmin && (
                  <div className="flex items-center gap-2 mt-4 pt-4 border-t border-[#f1f5f9]">
                    <button onClick={() => void runAction(camera, 'test')} disabled={busyId === camera.id || camera.is_online} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#dbe3ee] bg-white text-[#475569] text-[12px] font-semibold cursor-pointer disabled:opacity-50"><Activity size={14} /> Test</button>
                    {camera.is_online ? (
                      <button onClick={() => void runAction(camera, 'stop')} disabled={busyId === camera.id} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border-none bg-[#f59e0b] text-white text-[12px] font-semibold cursor-pointer"><Square size={13} /> Stop</button>
                    ) : (
                      <button onClick={() => void runAction(camera, 'start')} disabled={busyId === camera.id} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border-none bg-[#16a34a] text-white text-[12px] font-semibold cursor-pointer"><Play size={13} /> Start</button>
                    )}
                    <button onClick={() => void runAction(camera, 'delete')} disabled={busyId === camera.id} className="ml-auto flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#fecaca] bg-white text-[#dc2626] text-[12px] font-semibold cursor-pointer"><Trash2 size={13} /> Disable</button>
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
