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
    className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out shadow-[inset_0_1px_2px_rgba(0,0,0,0.1)] ${
      checked ? 'bg-[#2563eb]' : 'bg-[#cbd5e1]'
    }`}
  >
    <span
      className={`pointer-events-none inline-block h-[24px] w-[24px] transform rounded-full bg-white shadow-sm transition duration-200 ease-in-out border border-[#e2e8f0] ${
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          <div>
            <h1 className="text-[24px] font-bold text-[#0f172a] m-0 flex items-center gap-[12px]">
              <Shield size={28} className="text-[#2563eb]" />
              System Settings
            </h1>
            <p className="text-[14px] text-[#64748b] mt-2 m-0">
              Configure AI detection, notification preferences, and zone PPE requirements.
            </p>
          </div>
          <button
            onClick={handleSave}
            disabled={isSaving || isLoading || !settings}
            className="flex items-center justify-center gap-[9px] min-w-[190px] px-8 py-[14px] bg-[#2563eb] hover:bg-[#1d4ed8] text-white rounded-[14px] text-[16px] font-bold border-none cursor-pointer disabled:opacity-70 transition-colors shadow-[0_3px_8px_rgba(37,99,235,0.25)]"
          >
            {isSaving ? (
              <div className="w-5 h-5 border-[2.5px] border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Save size={19} />
            )}
            Save Changes
          </button>
        </div>

        {isLoading && (
          <div className="bg-white border border-[#e5eaf0] rounded-2xl p-6 text-[#64748b] shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
            Loading settings...
          </div>
        )}

        {!isLoading && settings && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-[32px]">
          {/* Sidebar Nav */}
          <div className="lg:col-span-1">
            <nav className="bg-white border border-[#e5eaf0] rounded-[20px] overflow-hidden shadow-[0_1px_4px_rgba(0,0,0,0.06)] p-3 flex flex-col gap-1">
              {[
                { icon: Cpu, label: 'AI & Detection', active: true },
                { icon: Monitor, label: 'Cameras', active: false },
                { icon: Bell, label: 'Notifications', active: false },
                { icon: Shield, label: 'User Management', active: false },
                { icon: Database, label: 'System Health', active: false },
              ].map((item, i) => (
                <button
                  key={i}
                  className={`w-full flex items-center gap-[12px] px-4 py-3 text-[14px] font-semibold transition-colors text-left rounded-xl border-none cursor-pointer ${
                    item.active
                      ? 'bg-[#eff6ff] text-[#2563eb]'
                      : 'bg-transparent text-[#64748b] hover:text-[#0f172a] hover:bg-[#f8fafc]'
                  }`}
                >
                  <item.icon size={20} />
                  {item.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Main Settings */}
          <div className="lg:col-span-3 space-y-[32px]">
            {/* AI Settings */}
            <div className="bg-white border border-[#e5eaf0] rounded-[20px] overflow-hidden shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
              <div className="px-[32px] py-[24px] border-b border-[#f1f5f9]">
                <h2 className="text-[16px] font-bold text-[#0f172a] m-0">AI & Detection Settings</h2>
              </div>
              <div className="px-[32px] py-[32px] space-y-[40px]">
                {/* Person Detection Sensitivity */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <label className="text-[14px] font-semibold text-[#0f172a] m-0">Person Detection Sensitivity</label>
                    <span className="px-[12px] py-[4px] bg-[#eff6ff] text-[#2563eb] font-bold rounded-lg text-[13px] border border-[#dbeafe]">
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
                    className="w-full h-[8px] bg-[#e2e8f0] rounded-full appearance-none cursor-pointer accent-[#2563eb]"
                  />
                  <p className="text-[12px] text-[#94a3b8] m-0 mt-3">Determines how strict the AI is when detecting people in the frame.</p>
                </div>

                {/* PPE Detection Sensitivity */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <label className="text-[14px] font-semibold text-[#0f172a] m-0">PPE Detection Sensitivity</label>
                    <span className="px-[12px] py-[4px] bg-[#eff6ff] text-[#2563eb] font-bold rounded-lg text-[13px] border border-[#dbeafe]">
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
                    className="w-full h-[8px] bg-[#e2e8f0] rounded-full appearance-none cursor-pointer accent-[#2563eb]"
                  />
                  <p className="text-[12px] text-[#94a3b8] m-0 mt-3">Determines how strict the AI is when classifying PPE equipment like hard hats or vests.</p>
                </div>

                {/* Active PPE Rules */}
                <div className="pt-2">
                  <label className="text-[12px] font-bold text-[#94a3b8] uppercase tracking-[0.06em] mb-4 block m-0">
                    Active PPE Rules
                  </label>
                  <div className="flex flex-wrap gap-3">
                    {PPE_RULES.map((rule) => {
                      const isActive = (settings.active_ppe_rules || {})[rule.key]
                      return (
                        <button
                          key={rule.key}
                          onClick={() => toggleRule(rule.key)}
                          className={`flex items-center gap-[8px] px-[16px] py-[10px] rounded-full text-[13px] font-semibold border transition-all cursor-pointer shadow-sm ${
                            isActive
                              ? 'bg-[#eff6ff] border-[#bfdbfe] text-[#2563eb]'
                              : 'bg-white border-[#e2e8f0] text-[#64748b] hover:bg-[#f8fafc] hover:border-[#cbd5e1]'
                          }`}
                        >
                          {isActive && <div className="w-[6px] h-[6px] rounded-full bg-[#2563eb]" />}
                          {rule.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Zone PPE Requirements */}
            <div className="bg-white border border-[#e5eaf0] rounded-[20px] overflow-hidden shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
              <div className="px-[32px] py-[24px] border-b border-[#f1f5f9] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-[16px] font-bold text-[#0f172a] m-0">Zone PPE Requirements</h2>
                  <p className="text-[13px] text-[#64748b] mt-1 m-0">
                    Define required PPE per zone (affects violation detection when selecting a zone).
                  </p>
                </div>
                <div className="relative shrink-0">
                  <select
                    value={selectedZoneId}
                    onChange={(e) => setSelectedZoneId(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
                    className="appearance-none pl-[16px] pr-[36px] py-[10px] rounded-xl bg-white border border-[#e2e8f0] text-[#0f172a] text-[13px] font-semibold outline-none cursor-pointer focus:border-[#2563eb] focus:ring-1 focus:ring-[#2563eb] min-w-[160px] shadow-sm"
                  >
                    {zones.length === 0 ? (
                      <option value="all">ไม่มีโซน</option>
                    ) : (
                      zones.map((z) => (
                        <option key={z.id} value={z.id}>{z.name}</option>
                      ))
                    )}
                  </select>
                  <div className="absolute right-[12px] top-1/2 -translate-y-1/2 pointer-events-none text-[#64748b]">
                    ▼
                  </div>
                </div>
              </div>

              <div className="px-[32px] py-[32px]">
                {!selectedZone ? (
                  <div className="text-[#64748b] text-[13px] bg-[#f8fafc] rounded-xl p-6 text-center border border-[#e5eaf0] border-dashed">
                    No zones found. Create one via API `POST /api/v1/zones/` then refresh.
                  </div>
                ) : (
                  <div className="flex flex-col gap-6">
                    <div className="flex items-center justify-between bg-[#f8fafc] p-[20px] rounded-2xl border border-[#f1f5f9]">
                      <div>
                        <p className="text-[15px] text-[#0f172a] font-bold m-0">{selectedZone.name}</p>
                        <p className="text-[#64748b] text-[13px] mt-1 m-0">{selectedZone.description || 'No description assigned'}</p>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="text-[12px] font-bold text-[#94a3b8] uppercase tracking-[0.05em] mb-1 m-0">Required Items</span>
                        <span className="text-[13px] font-semibold text-[#0f172a] m-0">
                          {(selectedZone.required_ppe || []).length ? selectedZone.required_ppe.length + ' Rules' : 'None'}
                        </span>
                      </div>
                    </div>

                    <div className="pt-2">
                      <label className="text-[12px] font-bold text-[#94a3b8] uppercase tracking-[0.06em] mb-4 block m-0">
                        Select Required PPE
                      </label>
                      <div className="flex flex-wrap gap-3">
                        {PPE_RULES.map((rule) => {
                          const enabled = (selectedZone.required_ppe || []).includes(rule.key)
                          return (
                            <button
                              key={rule.key}
                              onClick={() => toggleZoneRequired(selectedZone.id, rule.key)}
                              className={`flex items-center gap-[8px] px-[16px] py-[10px] rounded-full text-[13px] font-semibold border transition-all cursor-pointer shadow-sm ${
                                enabled
                                  ? 'bg-[#ecfdf5] border-[#a7f3d0] text-[#059669]'
                                  : 'bg-white border-[#e2e8f0] text-[#64748b] hover:bg-[#f8fafc] hover:border-[#cbd5e1]'
                              }`}
                            >
                              {enabled && <div className="w-[6px] h-[6px] rounded-full bg-[#059669]" />}
                              {rule.label}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Notification Settings */}
            <div className="bg-white border border-[#e5eaf0] rounded-[20px] overflow-hidden shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
              <div className="px-[32px] py-[24px] border-b border-[#f1f5f9]">
                <h2 className="text-[16px] font-bold text-[#0f172a] m-0">Notification Preferences</h2>
              </div>
              <div className="px-[32px] py-[32px] flex flex-col gap-6">
                <div className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-[16px]">
                    <div className="w-11 h-11 rounded-xl bg-[#f8fafc] border border-[#e2e8f0] flex items-center justify-center shrink-0">
                      <Bell size={20} className="text-[#64748b]" />
                    </div>
                    <div>
                      <p className="font-semibold text-[14px] text-[#0f172a] m-0 mb-1">เสียงเตือนแบบเรียลไทม์</p>
                      <p className="text-[13px] text-[#64748b] m-0">เปิดเสียงเตือนตี้ดๆ เมื่อตรวจพบการฝ่าฝืนหน้ากล้อง</p>
                    </div>
                  </div>
                  <ToggleSwitch
                    checked={settings.alert_sound}
                    onChange={() => setSettings({ ...settings, alert_sound: !settings.alert_sound })}
                  />
                </div>

                <div className="border-t border-[#f1f5f9]" />

                <div className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-[16px]">
                    <div className="w-11 h-11 rounded-xl bg-[#f8fafc] border border-[#e2e8f0] flex items-center justify-center shrink-0">
                      <HardDrive size={20} className="text-[#64748b]" />
                    </div>
                    <div>
                      <p className="font-semibold text-[14px] text-[#0f172a] m-0 mb-1">บันทึกภาพเป็นหลักฐาน</p>
                      <p className="text-[13px] text-[#64748b] m-0">บันทึกรูปภาพเหตุการณ์ลงพื้นที่จัดเก็บของเซิร์ฟเวอร์</p>
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
            <div className="bg-white border border-[#e5eaf0] rounded-[20px] overflow-hidden shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
              <div className="px-[32px] py-[24px] border-b border-[#f1f5f9]">
                <h2 className="text-[16px] font-bold text-[#0f172a] m-0">System Health</h2>
              </div>
              <div className="px-[32px] py-[32px]">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-[20px]">
                  <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-2xl p-[24px]">
                    <p className="text-[12px] font-bold text-[#64748b] uppercase tracking-[0.05em] m-0 mb-3">Server Status</p>
                    <div className="flex items-center gap-[8px]">
                      <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-[12px] w-[12px] rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-[12px] w-[12px] bg-emerald-500"></span>
                      </span>
                      <span className="text-[16px] text-[#0f172a] font-bold m-0">Healthy</span>
                    </div>
                  </div>
                  <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-2xl p-[24px]">
                    <p className="text-[12px] font-bold text-[#64748b] uppercase tracking-[0.05em] m-0 mb-3">Software Version</p>
                    <p className="text-[16px] text-[#0f172a] font-bold m-0">v2.0.0 pilot</p>
                  </div>
                  <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-2xl p-[24px]">
                    <p className="text-[12px] font-bold text-[#64748b] uppercase tracking-[0.05em] m-0 mb-3">AI Model</p>
                    <p className="text-[16px] text-[#2563eb] font-bold m-0 flex items-center gap-[6px]">SH17 baseline <span className="px-[8px] py-[2px] bg-[#dbeafe] text-[#1d4ed8] text-[11px] font-bold rounded-full border border-[#bfdbfe]">Active</span></p>
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
