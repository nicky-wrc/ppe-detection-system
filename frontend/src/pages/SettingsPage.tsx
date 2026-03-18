import { useEffect, useMemo, useState } from 'react'
import { Layout } from '../components/layout/Layout'
import { Save, Bell, HardDrive, Cpu, Database, Monitor, Shield } from 'lucide-react'
import toast from 'react-hot-toast'
import { settingsService } from '../services/settings'
import { zonesService } from '../services/zones'
import type { Zone, UserSettings } from '../types'

const ToggleSwitch = ({ checked, onChange }: { checked: boolean; onChange: () => void }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    onClick={onChange}
    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
      checked ? 'bg-[#06b6d4]' : 'bg-slate-600'
    }`}
  >
    <span
      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ease-in-out ${
        checked ? 'translate-x-5' : 'translate-x-0'
      }`}
    />
  </button>
)

export function SettingsPage() {
  const [settings, setSettings] = useState<UserSettings | null>(null)
  const [zones, setZones] = useState<Zone[]>([])
  const [selectedZoneId, setSelectedZoneId] = useState<number | 'all'>('all')
  const selectedZone = useMemo(
    () => zones.find((z) => z.id === selectedZoneId) || null,
    [zones, selectedZoneId]
  )

  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  const PPE_RULES = useMemo(() => ([
    { key: 'helmet', label: 'Hard Hat / Helmet' },
    { key: 'safety-vest', label: 'High-Vis Vest' },
    { key: 'glasses', label: 'Safety Eyewear' },
    { key: 'gloves', label: 'Safety Gloves' },
    { key: 'shoes', label: 'Safety Shoes' },
    { key: 'face-mask', label: 'Face Mask' },
    { key: 'ear-mufs', label: 'Ear Protection' },
  ]), [])

  const loadAll = async () => {
    setIsLoading(true)
    try {
      const [s, z] = await Promise.all([
        settingsService.getMe(),
        zonesService.list().catch(() => [] as Zone[]),
      ])
      setSettings(s)
      setZones(z)
      if (z.length > 0) setSelectedZoneId(z[0].id)
    } catch (e) {
      console.error(e)
      toast.error('โหลดการตั้งค่าไม่สำเร็จ')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadAll()
  }, [])

  const handleSave = () => {
    if (!settings) return
    setIsSaving(true)
    settingsService
      .updateMe({
        alert_sound: settings.alert_sound,
        save_evidence: settings.save_evidence,
        confidence_threshold: settings.confidence_threshold,
        ppe_detection_sensitivity: settings.ppe_detection_sensitivity,
        active_ppe_rules: settings.active_ppe_rules,
      })
      .then((s) => {
        setSettings(s)
        toast.success('บันทึกการตั้งค่าเรียบร้อยแล้ว')
      })
      .catch((e) => {
        console.error(e)
        toast.error('บันทึกไม่สำเร็จ')
      })
      .finally(() => setIsSaving(false))
  }

  const toggleRule = (key: string) => {
    if (!settings) return
    setSettings({
      ...settings,
      active_ppe_rules: {
        ...(settings.active_ppe_rules || {}),
        [key]: !(settings.active_ppe_rules || {})[key],
      },
    })
  }

  const toggleZoneRequired = async (zoneId: number, ppeKey: string) => {
    const zone = zones.find((z) => z.id === zoneId)
    if (!zone) return
    const current = new Set(zone.required_ppe || [])
    if (current.has(ppeKey)) current.delete(ppeKey)
    else current.add(ppeKey)
    const next = Array.from(current)
    try {
      const updated = await zonesService.update(zoneId, { required_ppe: next })
      setZones((prev) => prev.map((z) => (z.id === zoneId ? updated : z)))
      toast.success('อัปเดตโซนเรียบร้อย')
    } catch (e) {
      console.error(e)
      toast.error('อัปเดตโซนไม่สำเร็จ')
    }
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-[22px] font-bold text-[#0f172a] m-0">System Settings</h1>
            <p className="text-[13px] text-[#64748b] mt-1">
              Configure AI detection, notification preferences, and zone PPE requirements.
            </p>
          </div>
          <button
            onClick={handleSave}
            disabled={isSaving || isLoading || !settings}
            className="flex items-center gap-2 px-5 py-[10px] bg-[#2563eb] hover:bg-[#1d4ed8] text-white rounded-[10px] text-[13px] font-semibold disabled:opacity-70 transition-colors shadow-sm"
          >
            {isSaving ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Save className="w-5 h-5" />
            )}
            Save All Settings
          </button>
        </div>

        {isLoading && (
          <div className="bg-white border border-[#e5eaf0] rounded-2xl p-6 text-[#64748b] shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
            Loading settings...
          </div>
        )}

        {!isLoading && settings && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar Nav */}
          <div className="lg:col-span-1">
            <nav className="bg-white border border-[#e5eaf0] rounded-2xl overflow-hidden shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
              {[
                { icon: Cpu, label: 'AI & Detection', active: true },
                { icon: Monitor, label: 'Cameras', active: false },
                { icon: Bell, label: 'Notifications', active: false },
                { icon: Shield, label: 'User Management', active: false },
                { icon: Database, label: 'System Health', active: false },
              ].map((item, i) => (
                <button
                  key={i}
                  className={`w-full flex items-center gap-3.5 px-5 py-4 text-base font-medium transition-colors text-left ${
                    item.active
                      ? 'bg-[#eff6ff] text-[#2563eb]'
                      : 'text-[#64748b] hover:text-[#0f172a] hover:bg-[#f8fafc]'
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  {item.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Main Settings */}
          <div className="lg:col-span-3 space-y-8">
            {/* AI Settings */}
            <div className="bg-white border border-[#e5eaf0] rounded-2xl overflow-hidden shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
              <div className="px-8 py-6 border-b border-[#f1f5f9]">
                <h2 className="text-[15px] font-semibold text-[#0f172a] m-0">AI & Detection Settings</h2>
              </div>
              <div className="p-8 space-y-8">
                {/* Person Detection Sensitivity */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-[13px] font-semibold text-[#334155]">Person Detection Sensitivity</label>
                    <span className="px-3 py-1 bg-[#eff6ff] text-[#2563eb] font-bold rounded-lg text-[12px] border border-[#dbeafe]">
                      {settings.confidence_threshold}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="90"
                    step="5"
                    value={settings.confidence_threshold}
                    onChange={(e) => setSettings({ ...settings, confidence_threshold: parseInt(e.target.value) })}
                    className="w-full h-2 bg-[#e2e8f0] rounded-lg appearance-none cursor-pointer accent-[#2563eb]"
                  />
                </div>

                {/* PPE Detection Sensitivity */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-[13px] font-semibold text-[#334155]">PPE Detection Sensitivity</label>
                    <span className="px-3 py-1 bg-[#eff6ff] text-[#2563eb] font-bold rounded-lg text-[12px] border border-[#dbeafe]">
                      {settings.ppe_detection_sensitivity}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="90"
                    step="5"
                    value={settings.ppe_detection_sensitivity}
                    onChange={(e) => setSettings({ ...settings, ppe_detection_sensitivity: parseInt(e.target.value) })}
                    className="w-full h-2 bg-[#e2e8f0] rounded-lg appearance-none cursor-pointer accent-[#2563eb]"
                  />
                </div>

                {/* Active PPE Rules */}
                <div>
                  <label className="text-[11px] font-semibold text-[#94a3b8] uppercase tracking-[0.06em] mb-3 block">
                    Active PPE Rules
                  </label>
                  <div className="flex flex-wrap gap-3">
                    {PPE_RULES.map((rule) => (
                      <button
                        key={rule.key}
                        onClick={() => toggleRule(rule.key)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                          (settings.active_ppe_rules || {})[rule.key]
                            ? 'bg-[#eff6ff] border-[#dbeafe] text-[#2563eb]'
                            : 'bg-white border-[#e5eaf0] text-[#64748b] hover:bg-[#f8fafc]'
                        }`}
                      >
                        {(settings.active_ppe_rules || {})[rule.key] && <span>&#10003;</span>}
                        {rule.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Zone PPE Requirements */}
            <div className="bg-white border border-[#e5eaf0] rounded-2xl overflow-hidden shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
              <div className="px-8 py-6 border-b border-[#f1f5f9] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-[15px] font-semibold text-[#0f172a] m-0">Zone PPE Requirements</h2>
                  <p className="text-[13px] text-[#64748b] mt-1">
                    Define required PPE per zone (affects violation detection when selecting a zone).
                  </p>
                </div>
                <select
                  value={selectedZoneId}
                  onChange={(e) => setSelectedZoneId(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
                  className="px-3 py-2 rounded-lg bg-white border border-[#e2e8f0] text-[#334155] text-sm outline-none"
                >
                  {zones.length === 0 ? (
                    <option value="all">ไม่มีโซน</option>
                  ) : (
                    zones.map((z) => (
                      <option key={z.id} value={z.id}>{z.name}</option>
                    ))
                  )}
                </select>
              </div>

              <div className="p-8">
                {!selectedZone ? (
                  <div className="text-[#64748b] text-sm">
                    No zones found. Create one via API `POST /api/v1/zones/` then refresh.
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[#0f172a] font-semibold m-0">{selectedZone.name}</p>
                        <p className="text-[#94a3b8] text-xs mt-1">{selectedZone.description || '—'}</p>
                      </div>
                      <div className="text-xs text-[#94a3b8]">
                        Required: {(selectedZone.required_ppe || []).length ? selectedZone.required_ppe.join(', ') : '—'}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-3">
                      {PPE_RULES.map((rule) => {
                        const enabled = (selectedZone.required_ppe || []).includes(rule.key)
                        return (
                          <button
                            key={rule.key}
                            onClick={() => toggleZoneRequired(selectedZone.id, rule.key)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                              enabled
                                ? 'bg-[#f0fdf4] border-[#bbf7d0] text-[#16a34a]'
                                : 'bg-white border-[#e5eaf0] text-[#64748b] hover:bg-[#f8fafc]'
                            }`}
                          >
                            {enabled && <span>&#10003;</span>}
                            {rule.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Notification Settings */}
            <div className="bg-white border border-[#e5eaf0] rounded-2xl overflow-hidden shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
              <div className="px-8 py-6 border-b border-[#f1f5f9]">
                <h2 className="text-[15px] font-semibold text-[#0f172a] m-0">Notification Preferences</h2>
              </div>
              <div className="p-8 space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Bell className="w-5 h-5 text-[#94a3b8]" />
                    <div>
                      <p className="font-medium text-[#0f172a] m-0">เสียงเตือนแบบเรียลไทม์</p>
                      <p className="text-xs text-[#94a3b8] mt-1 m-0">เปิดเสียงเตือนเมื่อพบการฝ่าฝืน</p>
                    </div>
                  </div>
                  <ToggleSwitch
                    checked={settings.alert_sound}
                    onChange={() => setSettings({ ...settings, alert_sound: !settings.alert_sound })}
                  />
                </div>

                <div className="border-t border-[#f1f5f9]" />

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <HardDrive className="w-5 h-5 text-[#94a3b8]" />
                    <div>
                      <p className="font-medium text-[#0f172a] m-0">บันทึกภาพเป็นหลักฐาน</p>
                      <p className="text-xs text-[#94a3b8] mt-1 m-0">เก็บภาพต้นฉบับและผลตรวจจับ</p>
                    </div>
                  </div>
                  <ToggleSwitch
                    checked={settings.save_evidence}
                    onChange={() => setSettings({ ...settings, save_evidence: !settings.save_evidence })}
                  />
                </div>
              </div>
            </div>

            {/* System Health */}
            <div className="bg-white border border-[#e5eaf0] rounded-2xl overflow-hidden shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
              <div className="px-8 py-6 border-b border-[#f1f5f9]">
                <h2 className="text-[15px] font-semibold text-[#0f172a] m-0">System Health</h2>
              </div>
              <div className="p-8">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-[#f8fafc] border border-[#e5eaf0] rounded-lg p-4">
                    <p className="text-xs text-[#94a3b8] uppercase mb-1">Server Status</p>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-emerald-400 font-semibold">Healthy</span>
                    </div>
                  </div>
                  <div className="bg-[#f8fafc] border border-[#e5eaf0] rounded-lg p-4">
                    <p className="text-xs text-[#94a3b8] uppercase mb-1">Software Version</p>
                    <p className="text-[#0f172a] font-semibold m-0">v2.0.0</p>
                  </div>
                  <div className="bg-[#f8fafc] border border-[#e5eaf0] rounded-lg p-4">
                    <p className="text-xs text-[#94a3b8] uppercase mb-1">AI Model</p>
                    <p className="text-[#2563eb] font-semibold m-0">YOLO (SH17)</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        )}
      </div>
    </Layout>
  )
}
