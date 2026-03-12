import { useState } from 'react'
import { Layout } from '../components/layout/Layout'
import { Save, Sliders, Bell, HardDrive, Cpu, Database, Monitor, Shield } from 'lucide-react'
import toast from 'react-hot-toast'

export function SettingsPage() {
  const [settings, setSettings] = useState({
    confidence_threshold: 50,
    ppe_detection_sensitivity: 60,
    alert_sound: true,
    save_evidence: true,
    hardhat: true,
    vest: true,
    goggles: false,
  })

  const [isSaving, setIsSaving] = useState(false)

  const handleSave = () => {
    setIsSaving(true)
    setTimeout(() => {
      setIsSaving(false)
      toast.success('บันทึกการตั้งค่าเรียบร้อยแล้ว')
    }, 600)
  }

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

  return (
    <Layout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">System Settings</h1>
            <p className="text-base text-slate-400 mt-2">Configure AI detection, camera streams, and organizational access.</p>
          </div>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-6 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-lg font-semibold disabled:opacity-70 transition-colors"
          >
            {isSaving ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Save className="w-5 h-5" />
            )}
            Save All Settings
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar Nav */}
          <div className="lg:col-span-1">
            <nav className="bg-[#111827] border border-[#1e293b] rounded-2xl overflow-hidden">
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
                      ? 'bg-[#06b6d4] text-white'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
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
            <div className="bg-[#111827] border border-[#1e293b] rounded-2xl overflow-hidden">
              <div className="px-8 py-6 border-b border-[#1e293b]">
                <h2 className="text-xl font-semibold text-white">AI & Detection Settings</h2>
              </div>
              <div className="p-8 space-y-8">
                {/* Person Detection Sensitivity */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-sm font-medium text-slate-300">Person Detection Sensitivity</label>
                    <span className="px-3 py-1 bg-[#06b6d4]/20 text-[#06b6d4] font-bold rounded-lg text-sm">
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
                    className="w-full h-2 bg-[#1e293b] rounded-lg appearance-none cursor-pointer accent-[#06b6d4]"
                  />
                </div>

                {/* PPE Detection Sensitivity */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-sm font-medium text-slate-300">PPE Detection Sensitivity</label>
                    <span className="px-3 py-1 bg-[#06b6d4]/20 text-[#06b6d4] font-bold rounded-lg text-sm">
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
                    className="w-full h-2 bg-[#1e293b] rounded-lg appearance-none cursor-pointer accent-[#06b6d4]"
                  />
                </div>

                {/* Active PPE Rules */}
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 block">Active PPE Rules</label>
                  <div className="flex flex-wrap gap-3">
                    {[
                      { key: 'hardhat' as const, label: 'Hard Hat / Helmet' },
                      { key: 'vest' as const, label: 'High-Vis Vest' },
                      { key: 'goggles' as const, label: 'Safety Eyewear' },
                    ].map((rule) => (
                      <button
                        key={rule.key}
                        onClick={() => setSettings({ ...settings, [rule.key]: !settings[rule.key] })}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                          settings[rule.key]
                            ? 'bg-[#06b6d4]/15 border-[#06b6d4]/40 text-[#06b6d4]'
                            : 'bg-[#0a0e17] border-[#1e293b] text-slate-500'
                        }`}
                      >
                        {settings[rule.key] && <span>&#10003;</span>}
                        {rule.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Notification Settings */}
            <div className="bg-[#111827] border border-[#1e293b] rounded-2xl overflow-hidden">
              <div className="px-8 py-6 border-b border-[#1e293b]">
                <h2 className="text-xl font-semibold text-white">Notification Preferences</h2>
              </div>
              <div className="p-8 space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Bell className="w-5 h-5 text-slate-400" />
                    <div>
                      <p className="font-medium text-slate-200">เสียงเตือนแบบเรียลไทม์</p>
                      <p className="text-xs text-slate-500">เปิดเสียงเตือนเมื่อพบการฝ่าฝืน</p>
                    </div>
                  </div>
                  <ToggleSwitch
                    checked={settings.alert_sound}
                    onChange={() => setSettings({ ...settings, alert_sound: !settings.alert_sound })}
                  />
                </div>

                <div className="border-t border-[#1e293b]" />

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <HardDrive className="w-5 h-5 text-slate-400" />
                    <div>
                      <p className="font-medium text-slate-200">บันทึกภาพเป็นหลักฐาน</p>
                      <p className="text-xs text-slate-500">เก็บภาพต้นฉบับและผลตรวจจับ</p>
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
            <div className="bg-[#111827] border border-[#1e293b] rounded-2xl overflow-hidden">
              <div className="px-8 py-6 border-b border-[#1e293b]">
                <h2 className="text-xl font-semibold text-white">System Health</h2>
              </div>
              <div className="p-8">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-[#0a0e17] border border-[#1e293b] rounded-lg p-4">
                    <p className="text-xs text-slate-500 uppercase mb-1">Server Status</p>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-emerald-400 font-semibold">Healthy</span>
                    </div>
                  </div>
                  <div className="bg-[#0a0e17] border border-[#1e293b] rounded-lg p-4">
                    <p className="text-xs text-slate-500 uppercase mb-1">Software Version</p>
                    <p className="text-white font-semibold">v2.0.0</p>
                  </div>
                  <div className="bg-[#0a0e17] border border-[#1e293b] rounded-lg p-4">
                    <p className="text-xs text-slate-500 uppercase mb-1">AI Model</p>
                    <p className="text-[#06b6d4] font-semibold">YOLOv8n</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}
