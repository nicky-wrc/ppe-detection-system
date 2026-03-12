import { useState } from 'react'
import { Layout } from '../components/layout/Layout'
import { Save, Sliders, Bell, HardDrive, Cpu, Database, Monitor } from 'lucide-react'
import toast from 'react-hot-toast'

export function SettingsPage() {
  const [settings, setSettings] = useState({
    confidence_threshold: 50,
    alert_sound: true,
    save_evidence: true
  })

  const [isSaving, setIsSaving] = useState(false)

  const handleSave = () => {
    setIsSaving(true)
    setTimeout(() => {
      setIsSaving(false)
      toast.success('บันทึกการตั้งค่าเรียบร้อยแล้ว', { icon: '💾' })
    }, 600)
  }

  // Helper for Custom Toggle Switch
  const ToggleSwitch = ({ checked, onChange }: { checked: boolean, onChange: () => void }) => (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 ${
        checked ? 'bg-blue-600' : 'bg-slate-200'
      }`}
    >
      <span
        aria-hidden="true"
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  )

  return (
    <Layout>
      <div className="space-y-6 sm:space-y-8 max-w-4xl">
        {/* Page Title */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
              <Sliders className="w-8 h-8 text-blue-600" />
              การตั้งค่าระบบ
            </h1>
            <p className="text-slate-500 mt-1">ปรับแต่งการทำงานและประสิทธิภาพของระบบ AI Detection</p>
          </div>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="hidden sm:flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold hover:shadow-lg hover:shadow-blue-500/30 hover:-translate-y-0.5 disabled:opacity-70 disabled:hover:translate-y-0 transition-all"
          >
            {isSaving ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            ) : (
              <Save className="w-5 h-5" />
            )}
            <span>บันทึกการเปลี่ยนแปลง</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          {/* Main Settings Area */}
          <div className="md:col-span-2 space-y-6">
            
            {/* AI Settings */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="p-5 sm:p-6 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center">
                  <Cpu className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">ตั้งค่าความแม่นยำ (AI Model)</h2>
                  <p className="text-sm text-slate-500">ปรับแต่งความอ่อนไหวในการตรวจจับ</p>
                </div>
              </div>

              <div className="p-5 sm:p-6">
                <div className="mb-4 flex items-end justify-between">
                  <label className="block text-sm font-semibold text-slate-700">
                    Confidence Threshold (เกณฑ์ความมั่นใจ)
                  </label>
                  <span className="inline-block px-3 py-1 bg-indigo-50 text-indigo-700 font-bold rounded-lg text-lg">
                    {settings.confidence_threshold}%
                  </span>
                </div>
                
                <div className="relative pt-1">
                  <input
                    type="range"
                    min="10"
                    max="90"
                    step="5"
                    value={settings.confidence_threshold}
                    onChange={(e) => setSettings({ ...settings, confidence_threshold: parseInt(e.target.value) })}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                  />
                  <div className="flex justify-between text-xs font-medium text-slate-400 mt-2 px-1">
                    <span>10% (ตรวจจับได้มาก/แม่นยำน้อย)</span>
                    <span>90% (ตรวจจับได้น้อย/แม่นยำสูง)</span>
                  </div>
                </div>
                
                <div className="mt-6 p-4 bg-amber-50 rounded-xl border border-amber-100 flex gap-3">
                  <Sliders className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-sm text-amber-800 leading-relaxed">
                    <strong>คำแนะนำ:</strong> ค่าเริ่มต้นที่เหมาะสมคือ 50% หากระบบแจ้งเตือนผิดพลาดบ่อย (False Positive) แนะนำให้ปรับค่านี้ <strong>สูงขึ้น</strong>
                  </p>
                </div>
              </div>
            </div>

            {/* Notification & Storage Settings */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="p-5 sm:p-6 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-lg flex items-center justify-center">
                  <Bell className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">การแจ้งเตือนและการจัดเก็บ</h2>
                  <p className="text-sm text-slate-500">จัดการวิธีการแจ้งเตือนเมื่อพบเหตุการณ์</p>
                </div>
              </div>

              <div className="p-5 sm:p-6 space-y-6">
                <div className="flex items-start justify-between">
                  <div className="flex gap-4">
                    <div className="w-10 h-10 bg-slate-50 rounded-full flex items-center justify-center shrink-0">
                      <Bell className="w-5 h-5 text-slate-500" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 leading-none mb-1">เสียงเตือนแบบเรียลไทม์</p>
                      <p className="text-sm text-slate-500">ส่งเสียงเตือนผ่านเบราว์เซอร์ทันทีเมื่อพบการฝ่าฝืน</p>
                    </div>
                  </div>
                  <div className="pt-1">
                    <ToggleSwitch 
                      checked={settings.alert_sound} 
                      onChange={() => setSettings({ ...settings, alert_sound: !settings.alert_sound })} 
                    />
                  </div>
                </div>

                <div className="w-full h-px bg-slate-100"></div>

                <div className="flex items-start justify-between">
                  <div className="flex gap-4">
                    <div className="w-10 h-10 bg-slate-50 rounded-full flex items-center justify-center shrink-0">
                      <HardDrive className="w-5 h-5 text-slate-500" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 leading-none mb-1">บันทึกภาพเป็นหลักฐาน</p>
                      <p className="text-sm text-slate-500">เก็บภาพต้นฉบับและภาพที่ตีกรอบการฝ่าฝืนลงฐานข้อมูลทันที</p>
                    </div>
                  </div>
                  <div className="pt-1">
                    <ToggleSwitch 
                      checked={settings.save_evidence} 
                      onChange={() => setSettings({ ...settings, save_evidence: !settings.save_evidence })} 
                    />
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* Sidebar Area */}
          <div className="space-y-6">
            {/* System Info */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden sticky top-24">
              <div className="p-5 border-b border-slate-100 bg-slate-50/50">
                <h2 className="font-bold text-slate-900">ข้อมูลระบบ (System Info)</h2>
              </div>

              <div className="p-5 flex flex-col gap-4 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 flex items-center gap-2">
                    <Monitor className="w-4 h-4" />
                    เวอร์ชัน UI
                  </span>
                  <span className="font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md">v2.0.0</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 flex items-center gap-2">
                    <Cpu className="w-4 h-4" />
                    โมเดล AI
                  </span>
                  <span className="font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md">YOLOv8n</span>
                </div>
                
                <div className="flex items-center justify-between mt-2 pt-4 border-t border-slate-100">
                  <span className="text-slate-500 flex items-center gap-2">
                    <Database className="w-4 h-4" />
                    สถานะฐานข้อมูล
                  </span>
                  <span className="flex items-center gap-1.5 font-bold text-emerald-700">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                    เชื่อมต่ออยู่
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 flex items-center gap-2">
                    <Database className="w-4 h-4" />
                    สถานะ API Server
                  </span>
                  <span className="flex items-center gap-1.5 font-bold text-emerald-700">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                    ออนไลน์
                  </span>
                </div>
              </div>
            </div>

            {/* Mobile Save Button */}
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="w-full sm:hidden flex items-center justify-center gap-2 px-6 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold hover:shadow-lg disabled:opacity-70 transition-all shadow-sm"
            >
              {isSaving ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <Save className="w-5 h-5" />
              )}
              <span>บันทึกการเปลี่ยนแปลงทั้งหมด</span>
            </button>
          </div>
        </div>
      </div>
    </Layout>
  )
}

