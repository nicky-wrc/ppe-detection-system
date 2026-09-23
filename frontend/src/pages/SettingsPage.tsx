import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Bell, CheckCircle, Cpu, Database, HardDrive, Loader2, Save, Shield, SlidersHorizontal, X, XCircle } from 'lucide-react'
import toast from 'react-hot-toast'

import { Layout } from '../components/layout/Layout'
import { settingsService } from '../services/settings'
import { modelsService } from '../services/models'
import { useAuthStore } from '../stores/authStore'
import { zonesService } from '../services/zones'
import type { ActiveModelInfo, UserSettings, Zone } from '../types'

const PPE_RULES = [
  { key: 'helmet', label: 'หมวกนิรภัย' },
  { key: 'safety-vest', label: 'เสื้อสะท้อนแสง' },
]

const PERSON_CONFIDENCE_PRESETS = [
  { key: 'strict', label: 'ตรวจเฉพาะที่ชัดเจน', value: 60, displayLevel: 40, effect: 'นับเฉพาะคนที่เห็นชัด', useCase: 'ใช้เมื่อระบบมักจะตรวจจับวัตถุอื่นเป็นคนบ่อย' },
  { key: 'balanced', label: 'ตรวจแบบปกติ', value: 45, displayLevel: 55, effect: 'เหมาะกับการใช้งานทั่วไป', useCase: 'ใช้กับกล้องและแสงปกติ' },
  { key: 'lenient', label: 'ตรวจเพิ่มแม้ภาพไม่ชัด', value: 30, displayLevel: 70, effect: 'พยายามนับคนในภาพที่ตรวจจับยากมากขึ้น', useCase: 'ใช้เมื่อคนอยู่ไกล ตัวเล็ก หรือภาพไม่คม' },
]

const PPE_SENSITIVITY_PRESETS = [
  { key: 'strict', label: 'ตรวจเฉพาะที่ชัดเจน', value: 35, displayLevel: 35, effect: 'นับเฉพาะ PPE ที่เห็นชัด', useCase: 'ใช้เมื่อระบบมักจะตรวจจับวัตถุอื่นเป็น PPE บ่อย' },
  { key: 'balanced', label: 'ตรวจแบบปกติ', value: 60, displayLevel: 60, effect: 'เหมาะกับการใช้งานทั่วไป', useCase: 'ใช้กับกล้องและแสงปกติ' },
  { key: 'lenient', label: 'ตรวจเพิ่มแม้ภาพไม่ชัด', value: 75, displayLevel: 75, effect: 'พยายามหา PPE ในภาพที่ตรวจจับยากมากขึ้น', useCase: 'ใช้เมื่อหมวกหรือเสื้อเล็ก มืด หรืออยู่ไกล' },
]

const SETTINGS_SECTION_NAV_ITEMS = [
  { href: '#ai-detection', icon: Cpu, label: 'AI & Detection' },
  { href: '#zones', icon: Shield, label: 'Zone rules' },
  { href: '#notifications', icon: Bell, label: 'Notifications' },
  { href: '#system-health', icon: Database, label: 'System health' },
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
  const location = useLocation()
  const navigate = useNavigate()
  const isAdmin = useAuthStore((state) => state.user?.role === 'admin')
  const [settings, setSettings] = useState<UserSettings | null>(null)
  const [savedSettings, setSavedSettings] = useState<UserSettings | null>(null)
  const [model, setModel] = useState<ActiveModelInfo | null>(null)
  const [modelLoading, setModelLoading] = useState(true)
  const [modelError, setModelError] = useState(false)
  const [zonesError, setZonesError] = useState(false)
  const [zones, setZones] = useState<Zone[]>([])
  const [selectedZoneId, setSelectedZoneId] = useState<number | 'all'>('all')
  const [isSaving, setIsSaving] = useState(false)
  const [savingZoneId, setSavingZoneId] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null)
  const [showFloatingSectionNav, setShowFloatingSectionNav] = useState(false)
  const sectionNavRef = useRef<HTMLElement>(null)
  const isDirty = settings !== null && JSON.stringify(settings) !== JSON.stringify(savedSettings)

  const loadModel = useCallback(async () => {
    setModelLoading(true)
    setModelError(false)
    try {
      setModel(await modelsService.getActive())
    } catch {
      setModelError(true)
    } finally {
      setModelLoading(false)
    }
  }, [])

  useEffect(() => { void loadModel() }, [loadModel])

  useEffect(() => {
    if (!isDirty) return
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warnBeforeLeaving)
    return () => window.removeEventListener('beforeunload', warnBeforeLeaving)
  }, [isDirty])

  useEffect(() => {
    if (!isDirty) return
    const interceptInternalLink = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const target = event.target as HTMLElement | null
      const anchor = target?.closest('a[href]') as HTMLAnchorElement | null
      if (!anchor || anchor.target || anchor.hasAttribute('download')) return

      const nextUrl = new URL(anchor.href)
      if (nextUrl.origin !== window.location.origin) return
      const nextPath = `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`
      const currentPath = `${location.pathname}${location.search}${location.hash}`
      if (nextPath === currentPath || nextUrl.pathname === location.pathname) return

      event.preventDefault()
      setPendingNavigation(nextPath)
    }
    document.addEventListener('click', interceptInternalLink, true)
    return () => document.removeEventListener('click', interceptInternalLink, true)
  }, [isDirty, location.hash, location.pathname, location.search])

  useEffect(() => {
    if (isLoading || loadError) {
      setShowFloatingSectionNav(false)
      return
    }

    const updateFloatingSectionNav = () => {
      const rect = sectionNavRef.current?.getBoundingClientRect()
      setShowFloatingSectionNav(Boolean(rect && rect.bottom < 108))
    }

    updateFloatingSectionNav()
    window.addEventListener('scroll', updateFloatingSectionNav, { passive: true })
    window.addEventListener('resize', updateFloatingSectionNav)
    return () => {
      window.removeEventListener('scroll', updateFloatingSectionNav)
      window.removeEventListener('resize', updateFloatingSectionNav)
    }
  }, [isLoading, loadError])

  const loadZones = useCallback(async () => {
    setZonesError(false)
    try {
      const loaded = await zonesService.list()
      setZones(loaded)
      setSelectedZoneId((current) => loaded.some((zone) => zone.id === current) ? current : loaded[0]?.id ?? 'all')
    } catch {
      setZonesError(true)
    }
  }, [])

  const selectedZone = useMemo(
    () => zones.find((zone) => zone.id === selectedZoneId) || null,
    [zones, selectedZoneId],
  )

  const loadAll = useCallback(async () => {
    setIsLoading(true)
    setLoadError(false)
    try {
      const [loadedSettings] = await Promise.all([
        settingsService.getMe(),
        loadZones(),
      ])
      setSettings(loadedSettings)
      setSavedSettings(loadedSettings)
    } catch (error) {
      console.error(error)
      setLoadError(true)
      toast.error('โหลดการตั้งค่าไม่สำเร็จ')
    } finally {
      setIsLoading(false)
    }
  }, [loadZones])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  const handleSave = async () => {
    if (!settings || !isDirty || isSaving) return false
    setIsSaving(true)
    try {
      const updatedSettings = await settingsService.updateMe({
        alert_sound: settings.alert_sound,
        save_evidence: settings.save_evidence,
        confidence_threshold: settings.confidence_threshold,
        ppe_detection_sensitivity: settings.ppe_detection_sensitivity,
        active_ppe_rules: settings.active_ppe_rules,
      })
      setSettings(updatedSettings)
      setSavedSettings(updatedSettings)
      toast.success('บันทึกแล้ว การตรวจจับครั้งถัดไปจะใช้ค่าใหม่ตามบัญชีและโซน')
      return true
    } catch (error) {
      console.error(error)
      toast.error('บันทึกไม่สำเร็จ')
      return false
    } finally {
      setIsSaving(false)
    }
  }

  const saveAndLeave = async () => {
    if (!pendingNavigation) return
    const saved = await handleSave()
    if (saved) {
      const nextPath = pendingNavigation
      setPendingNavigation(null)
      navigate(nextPath)
    }
  }

  const discardAndLeave = () => {
    if (!pendingNavigation) return
    const nextPath = pendingNavigation
    setSettings(savedSettings)
    setPendingNavigation(null)
    navigate(nextPath)
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
            <h1>Settings</h1>
            <p className="max-w-3xl !mt-3 !text-[17px] !leading-[1.47]">
              ตั้งค่าการตรวจจับและการแจ้งเตือนของบัญชีคุณ ปรับค่าแล้วกดบันทึกเพื่อนำไปใช้
            </p>
          </div>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={isSaving || isLoading || !settings || !isDirty}
            className="btn-apple-primary !min-h-11 min-w-44 px-6 active:scale-95"
          >
            {isSaving ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <Save size={18} aria-hidden="true" />}
            {isSaving ? 'กำลังบันทึก…' : 'บันทึกการเปลี่ยนแปลง'}
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
            <div className="rounded-[18px] border border-[var(--line)] bg-[#f5f5f7] p-6 text-[14px] leading-relaxed text-[var(--muted)]">
              <p className="font-semibold text-[var(--ink)]">ค่าใหม่มีผลกับการตรวจจับถัดไป ไม่ต้องเปิดกล้องใหม่</p>
              <p className="mt-2">กล้องฝั่ง Backend ใช้ค่าของ <strong>เจ้าของกล้อง</strong> ส่วนกล้องผ่านเบราว์เซอร์และการอัปโหลดใช้ค่าของบัญชีที่กำลังใช้งาน หากเลือกโซน ระบบใช้กฎ PPE ของโซนนั้นก่อนกฎรายบุคคล</p>
              <p className="mt-2">การปรับค่าจะไม่เปลี่ยนผลตรวจย้อนหลัง และไม่ลบข้อมูลหรือหลักฐานที่บันทึกไว้แล้ว</p>
            </div>
            <nav ref={sectionNavRef} className="flex gap-2 overflow-x-auto pb-1" aria-label="Settings sections">
              {SETTINGS_SECTION_NAV_ITEMS.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border border-[var(--line)] bg-white px-4 text-[14px] font-semibold text-[var(--blue)] no-underline hover:bg-[#f5f5f7]"
                >
                  <item.icon size={16} aria-hidden="true" />
                  {item.label}
                </a>
              ))}
            </nav>

            <section id="ai-detection" className="surface-card scroll-mt-28 overflow-hidden" aria-labelledby="ai-detection-title">
              <div className="border-b border-[var(--line)] px-6 py-6 sm:px-8">
                <h2 id="ai-detection-title" className="text-[24px] font-semibold tracking-[-0.02em] text-[var(--ink)]">AI &amp; Detection</h2>
                <p className="mt-2 text-[15px] leading-relaxed text-[var(--muted)]">ปรับเกณฑ์การตรวจพบ ไม่ใช่การเทรนโมเดลใหม่ ค่าที่เลื่อนยังไม่มีผลจนกดบันทึก</p>
              </div>
              <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-2">
                <div className="rounded-[18px] border border-[var(--line)] bg-[#f5f5f7] p-6">
                  <div className="mb-5">
                    <p className="text-[17px] font-semibold text-[var(--ink)]">การตรวจพบบุคคล</p>
                    <p className="mt-2 text-[14px] leading-relaxed text-[var(--muted)]">เลือกตามสภาพกล้องและความผิดพลาดที่เจอ ตัวเลขสูงขึ้นหมายถึงระบบพยายามจับคนในภาพยากมากขึ้น</p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {PERSON_CONFIDENCE_PRESETS.map((preset) => {
                      const isSelected = settings.confidence_threshold === preset.value
                      return (
                        <button
                          key={preset.key}
                          type="button"
                          onClick={() => setSettings({ ...settings, confidence_threshold: preset.value })}
                          disabled={isSaving}
                          aria-pressed={isSelected}
                          className={`group min-h-[156px] rounded-[14px] border px-4 py-3 text-left transition-colors active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 ${
                            isSelected
                              ? 'border-[var(--blue)] bg-white text-[var(--ink)] shadow-sm'
                              : 'border-[var(--line)] bg-white/70 text-[var(--ink)] hover:bg-white'
                          }`}
                        >
                          <span className="block text-[30px] font-semibold leading-none tracking-[-0.03em] text-[var(--blue)]">
                            {preset.displayLevel}%
                          </span>
                          <span className="mt-3 block whitespace-nowrap text-[13px] font-semibold text-[var(--ink)] sm:text-[14px]">{preset.label}</span>
                          <span className="mt-3 block">
                            <span className="block text-[12px] leading-snug text-[var(--muted)]">
                              <span className="font-semibold text-[var(--ink)]">ผลลัพธ์:</span> {preset.effect}
                            </span>
                            <span className="mt-1 block text-[12px] leading-snug text-[var(--muted)]">
                              <span className="font-semibold text-[var(--ink)]">เหมาะเมื่อ:</span> {preset.useCase}
                            </span>
                          </span>
                          {isSelected && <span className="mt-3 inline-flex rounded-full bg-[#e8f2ff] px-2.5 py-1 text-[11px] font-semibold text-[var(--blue)]">กำลังใช้งาน</span>}
                        </button>
                      )
                    })}
                  </div>
                  <p className="mt-4 text-[14px] leading-relaxed text-[var(--muted)]">ถ้าไม่แน่ใจให้ใช้ “สมดุล” ก่อน แล้วค่อยเปลี่ยนเมื่อเห็นปัญหาจากภาพจริง</p>
                </div>

                <div className="rounded-[18px] border border-[var(--line)] bg-[#f5f5f7] p-6">
                  <div className="mb-5">
                    <p className="text-[17px] font-semibold text-[var(--ink)]">การตรวจพบหมวกและเสื้อ</p>
                    <p className="mt-2 text-[14px] leading-relaxed text-[var(--muted)]">เลือกตามความชัดของหมวกและเสื้อในภาพ ตัวเลขสูงขึ้นหมายถึงระบบพยายามจับ PPE ในภาพยากมากขึ้น</p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {PPE_SENSITIVITY_PRESETS.map((preset) => {
                      const isSelected = settings.ppe_detection_sensitivity === preset.value
                      return (
                        <button
                          key={preset.key}
                          type="button"
                          onClick={() => setSettings({ ...settings, ppe_detection_sensitivity: preset.value })}
                          disabled={isSaving}
                          aria-pressed={isSelected}
                          className={`group min-h-[156px] rounded-[14px] border px-4 py-3 text-left transition-colors active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 ${
                            isSelected
                              ? 'border-[var(--blue)] bg-white text-[var(--ink)] shadow-sm'
                              : 'border-[var(--line)] bg-white/70 text-[var(--ink)] hover:bg-white'
                          }`}
                        >
                          <span className="block text-[30px] font-semibold leading-none tracking-[-0.03em] text-[var(--blue)]">
                            {preset.displayLevel}%
                          </span>
                          <span className="mt-3 block whitespace-nowrap text-[13px] font-semibold text-[var(--ink)] sm:text-[14px]">{preset.label}</span>
                          <span className="mt-3 block">
                            <span className="block text-[12px] leading-snug text-[var(--muted)]">
                              <span className="font-semibold text-[var(--ink)]">ผลลัพธ์:</span> {preset.effect}
                            </span>
                            <span className="mt-1 block text-[12px] leading-snug text-[var(--muted)]">
                              <span className="font-semibold text-[var(--ink)]">เหมาะเมื่อ:</span> {preset.useCase}
                            </span>
                          </span>
                          {isSelected && <span className="mt-3 inline-flex rounded-full bg-[#e8f2ff] px-2.5 py-1 text-[11px] font-semibold text-[var(--blue)]">กำลังใช้งาน</span>}
                        </button>
                      )
                    })}
                  </div>
                  <p className="mt-4 text-[14px] leading-relaxed text-[var(--muted)]">ถ้าไม่แน่ใจให้ใช้ “สมดุล” ก่อน แล้วค่อยเปลี่ยนเมื่อเห็นปัญหาจากภาพจริง</p>
                </div>

                <div className="lg:col-span-2">
                  <p className="mb-2 text-[14px] font-semibold text-[var(--ink)]">กฎ PPE ส่วนบุคคล (เมื่อไม่ได้ใช้กฎโซน)</p>
                  <p className="mb-4 text-[14px] text-[var(--muted)]">ปิดรายการใดจะไม่แจ้งการขาด PPE ชนิดนั้น การปิดทั้งสองรายการยังนับคน แต่ไม่ตรวจการฝ่าฝืน PPE</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {PPE_RULES.map((rule) => {
                      const isActive = Boolean((settings.active_ppe_rules || {})[rule.key])
                      return (
                        <button
                          key={rule.key}
                          type="button"
                          onClick={() => toggleRule(rule.key)}
                          disabled={isSaving}
                          aria-pressed={isActive}
                          className={`flex min-h-[104px] items-center justify-between gap-4 rounded-[16px] border p-4 text-left transition-colors active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 ${
                            isActive
                              ? 'border-[#b9dfc2] bg-[#f3fbf5] text-[var(--ink)]'
                              : 'border-[#f0c3c8] bg-[#fff8f8] text-[var(--ink)]'
                          }`}
                        >
                          <span className="min-w-0">
                            <span className="flex items-center gap-2 text-[17px] font-semibold">
                              {isActive
                                ? <CheckCircle size={18} className="shrink-0 text-[#15803d]" strokeWidth={1.8} aria-hidden="true" />
                                : <XCircle size={18} className="shrink-0 text-[#d70015]" strokeWidth={1.8} aria-hidden="true" />
                              }
                              {rule.label}
                            </span>
                            <span className={`mt-2 block text-[13px] font-semibold ${isActive ? 'text-[#15803d]' : 'text-[#d70015]'}`}>
                              {isActive ? 'เปิดการตรวจจับรายการนี้' : 'ปิดการตรวจจับรายการนี้'}
                            </span>
                          </span>
                          <span className={`relative h-8 w-[54px] shrink-0 rounded-full transition-colors ${isActive ? 'bg-[#34c759]' : 'bg-[#d1d1d6]'}`} aria-hidden="true">
                            <span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow-sm transition-transform ${isActive ? 'left-7' : 'left-1'}`} />
                          </span>
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
                    {isAdmin ? 'กฎร่วมของกล้องทุกตัวในโซนนี้ กดแล้วบันทึกทันที แยกจากปุ่มบันทึกค่าบัญชี' : 'ข้อกำหนดของโซนนี้จัดการโดยผู้ดูแลระบบ และใช้แทนกฎ PPE ส่วนบุคคล'}
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
                {zonesError ? (
                  <div role="alert" className="text-center text-[var(--muted)]">
                    <p>โหลดโซนไม่สำเร็จ ยังไม่สามารถยืนยันกฎของโซนได้</p>
                    <button type="button" className="btn-apple-secondary mt-4" onClick={() => void loadZones()}>ลองโหลดโซนอีกครั้ง</button>
                  </div>
                ) : !selectedZone ? (
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
                      {selectedZone.required_ppe.length === 0 && <p className="mb-4 text-[14px] text-amber-700">โซนนี้ไม่ตรวจการฝ่าฝืน PPE เพราะปิดกฎทั้งสองรายการ</p>}
                      {savingZoneId !== null && <p role="status" className="mb-3 text-[14px] text-[var(--blue)]">กำลังบันทึกกฎโซน…</p>}
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
                      <p className="mt-1 max-w-xl text-[14px] leading-relaxed text-[var(--muted)]">เสียงเตือนของบัญชีนี้บนเว็บ ปิดเสียงแล้วยังแสดงข้อความแจ้งเตือน หลังบันทึกจะซิงก์กับแท็บอื่นในเบราว์เซอร์เดียวกัน เบราว์เซอร์อาจต้องให้คุณคลิกหน้าเว็บก่อนจึงเล่นเสียงได้</p>
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
                      <p className="text-[17px] font-semibold text-[var(--ink)]">บันทึกหลักฐานจากกล้องฝั่ง Backend</p>
                      <p className="mt-1 max-w-xl text-[14px] leading-relaxed text-[var(--muted)]">ภาพและคลิปเหตุการณ์จากกล้องที่คุณเป็นเจ้าของ ปิดแล้วระบบยังเก็บรายการเหตุการณ์และสถิติ แต่ไม่เก็บภาพหรือคลิปใหม่ หลักฐานเดิมไม่ถูกลบ</p>
                      <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-amber-700">ไม่ครอบคลุมการอัปโหลดภาพ/วิดีโอและโหมดกล้องผ่านเบราว์เซอร์ ซึ่งใช้ช่องทางอัปโหลดในการบันทึกผล</p>
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
                <h2 id="system-health-title" className="text-[24px] font-semibold tracking-[-0.02em]">ข้อมูลโมเดลจาก Backend</h2>
                <p className="mt-2 text-[15px] leading-relaxed text-[#cccccc]">แสดงการตั้งค่าโมเดลและสถานะไฟล์ ไม่ใช่การยืนยันว่าโหลดโมเดลหรือทดสอบกล้องสำเร็จแล้ว</p>
                <button type="button" onClick={() => void loadModel()} disabled={modelLoading} className="mt-4 min-h-11 rounded-full border border-white/30 px-4 text-[14px] disabled:opacity-50">{modelLoading ? 'กำลังตรวจสอบ…' : 'ตรวจสอบอีกครั้ง'}</button>
              </div>
              <div className="grid gap-px bg-white/10 sm:grid-cols-3">
                <div className="bg-[#272729] p-6 sm:p-8">
                  <p className="text-[13px] text-[#cccccc]">การเชื่อมต่อ API ล่าสุด</p>
                  <div className="mt-3 flex items-center gap-2 text-[21px] font-semibold">
                    {modelLoading ? 'กำลังตรวจสอบ…' : modelError ? 'ตรวจสอบไม่สำเร็จ' : 'เชื่อมต่อได้'}
                  </div>
                </div>
                <div className="bg-[#272729] p-6 sm:p-8">
                  <p className="text-[13px] text-[#cccccc]">Model version</p>
                  <p className="mt-3 break-all text-[17px] font-semibold">{modelLoading || modelError ? '—' : model?.version || 'ไม่ระบุ'}</p>
                </div>
                <div className="bg-[#272729] p-6 sm:p-8">
                  <p className="text-[13px] text-[#cccccc]">AI model</p>
                  <p className="mt-3 break-all text-[17px] font-semibold leading-tight">{modelLoading || modelError ? '—' : `${model?.models.ppe.filename} + ${model?.models.person.filename}`}</p>
                  {!modelLoading && !modelError && model && <p className="mt-3 text-[13px] text-[#cccccc]">{model.models.ppe.available && model.models.person.available ? 'พบไฟล์โมเดลทั้งสองตัว' : 'พบไฟล์โมเดลไม่ครบ กรุณาตรวจสอบ Backend'}</p>}
                </div>
              </div>
            </section>
            <div className="sticky bottom-4 z-20 flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-[var(--line)] bg-white/95 p-4 shadow-lg backdrop-blur">
              <p role="status" className="text-[14px] font-semibold text-[var(--ink)]">{isSaving ? 'กำลังบันทึก…' : isDirty ? 'มีการเปลี่ยนแปลงที่ยังไม่บันทึก' : 'ค่าบัญชีตรงกับข้อมูลที่บันทึกแล้ว'}</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn-apple-secondary" disabled={!isDirty || isSaving} onClick={() => setSettings(savedSettings)}>ยกเลิกการแก้ไข</button>
                <button type="button" className="btn-apple-primary" disabled={!isDirty || isSaving} onClick={() => void handleSave()}>{isSaving ? 'กำลังบันทึก…' : 'บันทึกค่าบัญชี'}</button>
              </div>
            </div>
          </div>
        )}
      </div>
      {showFloatingSectionNav && (
        <nav
          aria-label="Settings sections floating"
          className="fixed left-1/2 top-[108px] z-30 flex w-fit max-w-[calc(100vw-32px)] -translate-x-1/2 justify-center gap-2 overflow-x-auto rounded-full border border-[var(--line)] bg-white/95 p-2 shadow-[0_14px_40px_rgba(0,0,0,0.14)] backdrop-blur"
        >
          {SETTINGS_SECTION_NAV_ITEMS.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full px-4 text-[13px] font-semibold text-[var(--blue)] no-underline transition-colors hover:bg-[#f5f5f7]"
            >
              <item.icon size={15} aria-hidden="true" />
              {item.label}
            </a>
          ))}
        </nav>
      )}
      {pendingNavigation && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="กลับไปแก้ไขการตั้งค่า"
            className="absolute inset-0 h-full w-full cursor-default border-0 bg-black/55 backdrop-blur-[2px]"
            onClick={() => setPendingNavigation(null)}
          />
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="unsaved-settings-title"
            className="relative w-full max-w-[480px] rounded-[20px] border border-[var(--line)] bg-white p-6 shadow-[0_24px_80px_rgba(0,0,0,0.24)] sm:p-7"
          >
            <button
              type="button"
              aria-label="ปิดหน้าต่างและกลับไปแก้ไข"
              className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#f5f5f7] text-[var(--ink)] transition-colors hover:text-[var(--blue)] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => setPendingNavigation(null)}
              disabled={isSaving}
            >
              <X size={18} aria-hidden="true" />
            </button>
            <div className="flex items-start gap-4">
              <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#fff8e6] text-[#b45309]" aria-hidden="true">
                <Shield size={19} strokeWidth={1.8} />
              </span>
              <div className="min-w-0">
                <h2 id="unsaved-settings-title" className="m-0 text-[22px] font-semibold tracking-[-0.02em] text-[var(--ink)]">ยังไม่ได้บันทึกการตั้งค่า</h2>
                <p className="mt-2 text-[15px] leading-relaxed text-[var(--muted)]">
                  คุณมีการเปลี่ยนแปลงที่ยังไม่ได้บันทึก ต้องการบันทึกก่อนออกจากหน้านี้หรือไม่
                </p>
              </div>
            </div>
            <div className="mt-7 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                className="btn-apple-secondary !min-h-11 text-[#d70015]"
                onClick={discardAndLeave}
                disabled={isSaving}
              >
                ออกโดยไม่บันทึก
              </button>
              <button
                type="button"
                className="btn-apple-primary !min-h-11"
                onClick={() => void saveAndLeave()}
                disabled={isSaving}
              >
                {isSaving ? <Loader2 size={17} className="animate-spin" aria-hidden="true" /> : <Save size={17} aria-hidden="true" />}
                {isSaving ? 'กำลังบันทึก…' : 'บันทึกแล้วออก'}
              </button>
            </div>
          </section>
        </div>
      )}
    </Layout>
  )
}
