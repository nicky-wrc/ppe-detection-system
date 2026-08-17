import { useCallback, useEffect, useMemo, useState } from 'react'
import { Bell, Cpu, Database, HardDrive, Loader2, Save, Shield, SlidersHorizontal } from 'lucide-react'
import toast from 'react-hot-toast'

import { Layout } from '../components/layout/Layout'
import { settingsService } from '../services/settings'
import { useAuthStore } from '../stores/authStore'
import { zonesService } from '../services/zones'
import type { UserSettings, Zone } from '../types'

const PPE_RULES = [
  { key: 'helmet', label: 'Hard Hat / Helmet' },
  { key: 'safety-vest', label: 'High-Vis Vest' },
]

interface ToggleSwitchProps {
  checked: boolean
  label: string
  onChange: () => void
  disabled?: boolean
}

const ToggleSwitch = ({ checked, label, onChange, disabled = false }: ToggleSwitchProps) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    onClick={onChange}
    disabled={disabled}
    className="relative inline-flex h-11 w-[58px] shrink-0 cursor-pointer items-center rounded-full border-0 bg-transparent active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
  >
    <span className={`absolute left-[3px] h-8 w-[52px] rounded-full transition-colors ${checked ? 'bg-[var(--blue)]' : 'bg-[#d2d2d7]'}`} />
    <span className={`absolute left-[7px] h-6 w-6 rounded-full bg-white transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
  </button>
)

export function SettingsPage() {
  const isAdmin = useAuthStore((state) => state.user?.role === 'admin')
  const [settings, setSettings] = useState<UserSettings | null>(null)
  const [zones, setZones] = useState<Zone[]>([])
  const [selectedZoneId, setSelectedZoneId] = useState<number | 'all'>('all')
  const [isSaving, setIsSaving] = useState(false)
  const [savingZoneId, setSavingZoneId] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  const selectedZone = useMemo(
    () => zones.find((zone) => zone.id === selectedZoneId) || null,
    [zones, selectedZoneId],
  )

  const loadAll = useCallback(async () => {
    setIsLoading(true)
    setLoadError(false)
    try {
      const [loadedSettings, loadedZones] = await Promise.all([
        settingsService.getMe(),
        zonesService.list().catch(() => [] as Zone[]),
      ])
      setSettings(loadedSettings)
      setZones(loadedZones)
      if (loadedZones.length > 0) setSelectedZoneId(loadedZones[0].id)
    } catch (error) {
      console.error(error)
      setLoadError(true)
      toast.error('โหลดการตั้งค่าไม่สำเร็จ')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

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
      .then((updatedSettings) => {
        setSettings(updatedSettings)
        window.dispatchEvent(new CustomEvent('ppe:settings-updated', {
          detail: { alertSound: updatedSettings.alert_sound },
        }))
        toast.success('บันทึกการตั้งค่าเรียบร้อยแล้ว')
      })
      .catch((error) => {
        console.error(error)
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
    if (!isAdmin || savingZoneId !== null) return
    const zone = zones.find((item) => item.id === zoneId)
    if (!zone) return

    const current = new Set(zone.required_ppe || [])
    if (current.has(ppeKey)) current.delete(ppeKey)
    else current.add(ppeKey)

    setSavingZoneId(zoneId)
    try {
      const updated = await zonesService.update(zoneId, { required_ppe: Array.from(current) })
      setZones((previous) => previous.map((item) => (item.id === zoneId ? updated : item)))
      toast.success('อัปเดตโซนเรียบร้อย')
    } catch (error) {
      console.error(error)
      toast.error('อัปเดตโซนไม่สำเร็จ')
    } finally {
      setSavingZoneId(null)
    }
  }

  return (
    <Layout>
      <div className="mx-auto flex max-w-[1240px] flex-col gap-8 sm:gap-10">
        <header className="page-heading flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-full bg-[var(--ink)] text-white" aria-hidden="true">
              <SlidersHorizontal size={20} strokeWidth={1.8} />
            </div>
            <h1>System Settings</h1>
            <p className="max-w-3xl !mt-3 !text-[17px] !leading-[1.47]">
              Configure AI detection, notification preferences, and zone PPE requirements.
            </p>
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || isLoading || !settings}
            className="btn-apple-primary !min-h-11 min-w-44 px-6 active:scale-95"
          >
            {isSaving ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <Save size={18} aria-hidden="true" />}
            {isSaving ? 'Saving…' : 'Save changes'}
          </button>
        </header>

        {isLoading ? (
          <div className="surface-card flex min-h-64 items-center justify-center gap-3 text-[15px] text-[var(--muted)]" role="status">
            <Loader2 size={21} className="animate-spin text-[var(--blue)]" aria-hidden="true" />
            Loading settings…
          </div>
        ) : loadError || !settings ? (
          <div className="surface-card flex min-h-64 flex-col items-center justify-center gap-4 px-6 text-center" role="alert">
            <p className="text-[21px] font-semibold tracking-[-0.01em] text-[var(--ink)]">Unable to load settings</p>
            <p className="max-w-md text-[15px] leading-relaxed text-[var(--muted)]">Check the backend connection, then try again.</p>
            <button type="button" onClick={() => void loadAll()} className="btn-apple-secondary !min-h-11 text-[var(--blue)]">Try again</button>
          </div>
        ) : (
          <div className="space-y-8">
            <nav className="flex gap-2 overflow-x-auto pb-1" aria-label="Settings sections">
              {[
                { href: '#ai-detection', icon: Cpu, label: 'AI & Detection' },
                { href: '#zones', icon: Shield, label: 'Zone rules' },
                { href: '#notifications', icon: Bell, label: 'Notifications' },
                { href: '#system-health', icon: Database, label: 'System health' },
              ].map((item, index) => (
                <a
                  key={item.href}
                  href={item.href}
                  className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-[14px] font-semibold no-underline transition-colors ${
                    index === 0
                      ? 'border-[var(--blue)] bg-[var(--blue)] text-white'
                      : 'border-[var(--line)] bg-white text-[var(--blue)] hover:bg-[#f5f5f7]'
                  }`}
                >
                  <item.icon size={16} aria-hidden="true" />
                  {item.label}
                </a>
              ))}
            </nav>

            <section id="ai-detection" className="surface-card scroll-mt-28 overflow-hidden" aria-labelledby="ai-detection-title">
              <div className="border-b border-[var(--line)] px-6 py-6 sm:px-8">
                <h2 id="ai-detection-title" className="text-[24px] font-semibold tracking-[-0.02em] text-[var(--ink)]">AI &amp; Detection</h2>
                <p className="mt-2 text-[15px] leading-relaxed text-[var(--muted)]">Tune model confidence and choose which PPE rules are active.</p>
              </div>
              <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-2">
                <div className="rounded-[18px] border border-[var(--line)] bg-[#f5f5f7] p-6">
                  <div className="mb-5 flex items-center justify-between gap-4">
                    <label htmlFor="person-confidence" className="text-[17px] font-semibold text-[var(--ink)]">Person confidence</label>
                    <output htmlFor="person-confidence" className="rounded-full bg-white px-3 py-1.5 text-[14px] font-semibold text-[var(--blue)]">
                      {settings.confidence_threshold}%
                    </output>
                  </div>
                  <input
                    id="person-confidence"
                    type="range"
                    min="10"
                    max="90"
                    step="5"
                    value={settings.confidence_threshold}
                    onChange={(event) => setSettings({ ...settings, confidence_threshold: parseInt(event.target.value) })}
                    disabled={isSaving}
                    className="h-11 w-full cursor-pointer accent-[var(--blue)]"
                  />
                  <p className="mt-4 text-[14px] leading-relaxed text-[var(--muted)]">Lower values detect more difficult angles but can increase false positives.</p>
                </div>

                <div className="rounded-[18px] border border-[var(--line)] bg-[#f5f5f7] p-6">
                  <div className="mb-5 flex items-center justify-between gap-4">
                    <label htmlFor="ppe-sensitivity" className="text-[17px] font-semibold text-[var(--ink)]">PPE sensitivity</label>
                    <output htmlFor="ppe-sensitivity" className="rounded-full bg-white px-3 py-1.5 text-[14px] font-semibold text-[var(--blue)]">
                      {settings.ppe_detection_sensitivity}%
                    </output>
                  </div>
                  <input
                    id="ppe-sensitivity"
                    type="range"
                    min="10"
                    max="90"
                    step="5"
                    value={settings.ppe_detection_sensitivity}
                    onChange={(event) => setSettings({ ...settings, ppe_detection_sensitivity: parseInt(event.target.value) })}
                    disabled={isSaving}
                    className="h-11 w-full cursor-pointer accent-[var(--blue)]"
                  />
                  <p className="mt-4 text-[14px] leading-relaxed text-[var(--muted)]">Temporal confirmation continues to filter one-frame noise before creating an alert.</p>
                </div>

                <div className="lg:col-span-2">
                  <p className="mb-4 text-[14px] font-semibold text-[var(--ink)]">Active PPE rules</p>
                  <div className="flex flex-wrap gap-3">
                    {PPE_RULES.map((rule) => {
                      const isActive = Boolean((settings.active_ppe_rules || {})[rule.key])
                      return (
                        <button
                          key={rule.key}
                          type="button"
                          onClick={() => toggleRule(rule.key)}
                          disabled={isSaving}
                          aria-pressed={isActive}
                          className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-5 text-[14px] font-semibold transition-colors active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 ${
                            isActive
                              ? 'border-[var(--blue)] bg-[var(--blue)] text-white'
                              : 'border-[var(--line)] bg-white text-[var(--blue)] hover:bg-[#f5f5f7]'
                          }`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${isActive ? 'bg-white' : 'bg-[var(--blue)]'}`} aria-hidden="true" />
                          {rule.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            </section>

            <section id="zones" className="surface-card scroll-mt-28 overflow-hidden" aria-labelledby="zones-title">
              <div className="flex flex-col gap-5 border-b border-[var(--line)] px-6 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-8">
                <div>
                  <h2 id="zones-title" className="text-[24px] font-semibold tracking-[-0.02em] text-[var(--ink)]">Zone PPE requirements</h2>
                  <p className="mt-2 text-[15px] leading-relaxed text-[var(--muted)]">
                    {isAdmin ? 'Define the PPE expected for each monitored area.' : 'ข้อกำหนดของโซนนี้จัดการโดยผู้ดูแลระบบ'}
                  </p>
                </div>
                <label className="text-[13px] font-semibold text-[var(--muted)]">
                  <span className="sr-only">Select zone</span>
                  <select
                    value={selectedZoneId}
                    onChange={(event) => setSelectedZoneId(event.target.value === 'all' ? 'all' : parseInt(event.target.value))}
                    className="min-h-11 min-w-44 appearance-none rounded-full border border-[var(--line)] bg-white px-5 text-[14px] font-semibold text-[var(--ink)] outline-none focus:border-[var(--blue)]"
                  >
                    {zones.length === 0 ? (
                      <option value="all">ไม่มีโซน</option>
                    ) : (
                      zones.map((zone) => <option key={zone.id} value={zone.id}>{zone.name}</option>)
                    )}
                  </select>
                </label>
              </div>

              <div className="p-6 sm:p-8">
                {!selectedZone ? (
                  <div className="rounded-[18px] border border-[var(--line)] bg-[#f5f5f7] p-10 text-center">
                    <Shield size={26} className="mx-auto text-[var(--muted)]" strokeWidth={1.5} aria-hidden="true" />
                    <p className="mt-4 text-[17px] font-semibold text-[var(--ink)]">No zones found</p>
                    <p className="mt-2 text-[14px] leading-relaxed text-[var(--muted)]">Create a zone before assigning PPE requirements.</p>
                  </div>
                ) : (
                  <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.7fr)]">
                    <div className="rounded-[18px] border border-[var(--line)] bg-[#f5f5f7] p-6">
                      <p className="text-[21px] font-semibold tracking-[-0.01em] text-[var(--ink)]">{selectedZone.name}</p>
                      <p className="mt-2 text-[15px] leading-relaxed text-[var(--muted)]">{selectedZone.description || 'No description assigned'}</p>
                      <p className="mt-6 text-[13px] font-semibold text-[var(--muted)]">
                        {(selectedZone.required_ppe || []).length || 'No'} active requirement{(selectedZone.required_ppe || []).length === 1 ? '' : 's'}
                      </p>
                    </div>
                    <div>
                      <p className="mb-4 text-[14px] font-semibold text-[var(--ink)]">Required PPE</p>
                      <div className="flex flex-wrap gap-3">
                        {PPE_RULES.map((rule) => {
                          const enabled = (selectedZone.required_ppe || []).includes(rule.key)
                          return isAdmin ? (
                            <button
                              key={rule.key}
                              type="button"
                              onClick={() => void toggleZoneRequired(selectedZone.id, rule.key)}
                              disabled={savingZoneId !== null}
                              aria-pressed={enabled}
                              className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-5 text-[14px] font-semibold transition-colors active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 ${
                                enabled
                                  ? 'border-[var(--blue)] bg-[var(--blue)] text-white'
                                  : 'border-[var(--line)] bg-white text-[var(--blue)] hover:bg-[#f5f5f7]'
                              }`}
                            >
                              <span className={`h-1.5 w-1.5 rounded-full ${enabled ? 'bg-white' : 'bg-[var(--blue)]'}`} aria-hidden="true" />
                              {rule.label}
                            </button>
                          ) : (
                            <span
                              key={rule.key}
                              className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-5 text-[14px] font-semibold ${
                                enabled
                                  ? 'border-[#b9dfc2] bg-[#f3fbf5] text-[#15803d]'
                                  : 'border-[var(--line)] bg-white text-[var(--muted)]'
                              }`}
                            >
                              <span className={`h-1.5 w-1.5 rounded-full ${enabled ? 'bg-[#34c759]' : 'bg-[var(--muted)]'}`} aria-hidden="true" />
                              {rule.label}
                            </span>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </section>

            <section id="notifications" className="surface-card scroll-mt-28 overflow-hidden" aria-labelledby="notifications-title">
              <div className="border-b border-[var(--line)] px-6 py-6 sm:px-8">
                <h2 id="notifications-title" className="text-[24px] font-semibold tracking-[-0.02em] text-[var(--ink)]">Notification preferences</h2>
              </div>
              <div className="divide-y divide-[var(--line)] px-6 sm:px-8">
                <div className="flex min-h-28 items-center justify-between gap-5 py-6">
                  <div className="flex items-start gap-4">
                    <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#f5f5f7] text-[var(--ink)]" aria-hidden="true">
                      <Bell size={19} strokeWidth={1.8} />
                    </span>
                    <div>
                      <p className="text-[17px] font-semibold text-[var(--ink)]">เสียงเตือนแบบเรียลไทม์</p>
                      <p className="mt-1 max-w-xl text-[14px] leading-relaxed text-[var(--muted)]">เปิดเสียงเตือนเมื่อตรวจพบการฝ่าฝืนหน้ากล้อง</p>
                    </div>
                  </div>
                  <ToggleSwitch
                    checked={settings.alert_sound}
                    label="เสียงเตือนแบบเรียลไทม์"
                    onChange={() => setSettings({ ...settings, alert_sound: !settings.alert_sound })}
                    disabled={isSaving}
                  />
                </div>

                <div className="flex min-h-28 items-center justify-between gap-5 py-6">
                  <div className="flex items-start gap-4">
                    <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#f5f5f7] text-[var(--ink)]" aria-hidden="true">
                      <HardDrive size={19} strokeWidth={1.8} />
                    </span>
                    <div>
                      <p className="text-[17px] font-semibold text-[var(--ink)]">บันทึกภาพเป็นหลักฐาน</p>
                      <p className="mt-1 max-w-xl text-[14px] leading-relaxed text-[var(--muted)]">บันทึกรูปภาพเหตุการณ์ลงพื้นที่จัดเก็บของเซิร์ฟเวอร์</p>
                    </div>
                  </div>
                  <ToggleSwitch
                    checked={settings.save_evidence}
                    label="บันทึกภาพเป็นหลักฐาน"
                    onChange={() => setSettings({ ...settings, save_evidence: !settings.save_evidence })}
                    disabled={isSaving}
                  />
                </div>
              </div>
            </section>

            <section id="system-health" className="scroll-mt-28 overflow-hidden rounded-[18px] bg-[#272729] text-white" aria-labelledby="system-health-title">
              <div className="border-b border-white/10 px-6 py-6 sm:px-8">
                <h2 id="system-health-title" className="text-[24px] font-semibold tracking-[-0.02em]">System health</h2>
                <p className="mt-2 text-[15px] leading-relaxed text-[#cccccc]">Current pilot runtime and model information.</p>
              </div>
              <div className="grid gap-px bg-white/10 sm:grid-cols-3">
                <div className="bg-[#272729] p-6 sm:p-8">
                  <p className="text-[13px] text-[#cccccc]">Server status</p>
                  <div className="mt-3 flex items-center gap-2 text-[21px] font-semibold">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#34c759]" aria-hidden="true" />
                    Healthy
                  </div>
                </div>
                <div className="bg-[#272729] p-6 sm:p-8">
                  <p className="text-[13px] text-[#cccccc]">Software version</p>
                  <p className="mt-3 text-[21px] font-semibold">v2.0.0 pilot</p>
                </div>
                <div className="bg-[#272729] p-6 sm:p-8">
                  <p className="text-[13px] text-[#cccccc]">AI model</p>
                  <p className="mt-3 text-[21px] font-semibold leading-tight">YOLOv8m + YOLO11n</p>
                  <span className="mt-3 inline-flex rounded-full border border-white/15 px-3 py-1 text-[12px] text-[#cccccc]">Hybrid</span>
                </div>
              </div>
            </section>
          </div>
        )}
      </div>
    </Layout>
  )
}
