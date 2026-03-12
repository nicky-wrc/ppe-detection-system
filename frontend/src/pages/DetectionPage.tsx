import { useState, useCallback } from 'react'
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
  Video,
  Image as ImageIcon,
  ShieldCheck,
  ShieldAlert,
} from 'lucide-react'
import toast from 'react-hot-toast'

type TabType = 'image' | 'video'

export function DetectionPage() {
  const [activeTab, setActiveTab] = useState<TabType>('image')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [result, setResult] = useState<Detection | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const imageDropzone = useDropzone({
    onDrop: useCallback((acceptedFiles: File[]) => {
      const file = acceptedFiles[0]
      if (file) {
        setSelectedFile(file)
        setPreview(URL.createObjectURL(file))
        setResult(null)
      }
    }, []),
    accept: { 'image/*': ['.jpeg', '.jpg', '.png', '.webp'] },
    maxFiles: 1,
    disabled: activeTab !== 'image',
  })

  const videoDropzone = useDropzone({
    onDrop: useCallback((acceptedFiles: File[]) => {
      const file = acceptedFiles[0]
      if (file) {
        setSelectedFile(file)
        setPreview(URL.createObjectURL(file))
        setResult(null)
      }
    }, []),
    accept: {
      'video/mp4': ['.mp4'],
      'video/x-msvideo': ['.avi'],
      'video/quicktime': ['.mov'],
    },
    maxFiles: 1,
    disabled: activeTab !== 'video',
  })

  const getRootProps = activeTab === 'image' ? imageDropzone.getRootProps : videoDropzone.getRootProps
  const getInputProps = activeTab === 'image' ? imageDropzone.getInputProps : videoDropzone.getInputProps
  const isDragActive = activeTab === 'image' ? imageDropzone.isDragActive : videoDropzone.isDragActive

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab)
    setSelectedFile(null)
    setPreview(null)
    setResult(null)
  }

  const handleDetect = async () => {
    if (!selectedFile) return
    setIsLoading(true)
    try {
      const detection =
        activeTab === 'video'
          ? await detectionService.uploadVideo(selectedFile)
          : await detectionService.uploadImage(selectedFile)
      setResult(detection)
      toast.success('ตรวจจับสำเร็จ')
    } catch (error) {
      console.error('Detection error:', error)
      toast.error('เกิดข้อผิดพลาด กรุณาลองใหม่')
    } finally {
      setIsLoading(false)
    }
  }

  const handleReset = () => {
    setSelectedFile(null)
    setPreview(null)
    setResult(null)
  }

  const hasValidFile =
    activeTab === 'image'
      ? selectedFile && selectedFile.type.startsWith('image/')
      : selectedFile && selectedFile.type.startsWith('video/')

  return (
    <Layout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">
              PPE Detection
            </h1>
            <p className="text-base text-slate-400 mt-2">
              อัปโหลดรูปภาพหรือวิดีโอเพื่อตรวจจับการสวมใส่อุปกรณ์ความปลอดภัยอัตโนมัติ
            </p>
          </div>

          {/* Tabs */}
          <div className="flex gap-1.5 p-1.5 rounded-xl bg-[#111827] border border-[#1e293b]">
            <button
              onClick={() => handleTabChange('image')}
              className={`flex items-center gap-2.5 px-6 py-3 rounded-lg text-base font-medium transition-colors ${
                activeTab === 'image'
                  ? 'bg-[#06b6d4] text-white shadow-lg shadow-[#06b6d4]/20'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <ImageIcon className="w-5 h-5" />
              รูปภาพ
            </button>
            <button
              onClick={() => handleTabChange('video')}
              className={`flex items-center gap-2.5 px-6 py-3 rounded-lg text-base font-medium transition-colors ${
                activeTab === 'video'
                  ? 'bg-[#06b6d4] text-white shadow-lg shadow-[#06b6d4]/20'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Video className="w-5 h-5" />
              วิดีโอ
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="xl:col-span-2 space-y-8">
            {/* Upload Card */}
            <div className="bg-[#111827] rounded-2xl border border-[#1e293b] overflow-hidden">
              <div className="px-8 py-5 border-b border-[#1e293b]">
                <h2 className="text-xl font-semibold text-white">
                  {activeTab === 'image' ? 'อัปโหลดรูปภาพ' : 'อัปโหลดวิดีโอ'}
                </h2>
              </div>
              <div className="p-8">
                <div
                  {...getRootProps()}
                  className={`relative min-h-[350px] border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-200 flex flex-col items-center justify-center ${
                    isDragActive
                      ? 'border-[#06b6d4] bg-[#06b6d4]/10'
                      : preview
                        ? 'border-[#1e293b] bg-[#0a0e17]/50 hover:border-[#06b6d4]/50'
                        : 'border-[#1e293b] hover:border-[#06b6d4]/50 hover:bg-[#0a0e17]/30'
                  }`}
                >
                  <input {...getInputProps()} />

                  {preview ? (
                    <div className="w-full flex flex-col items-center justify-center">
                      <div className="relative w-full rounded-xl overflow-hidden border border-[#1e293b]">
                        {activeTab === 'video' ? (
                          <video
                            src={preview}
                            controls
                            className="w-full h-auto object-contain max-h-[320px] bg-black rounded-xl"
                          />
                        ) : (
                          <img
                            src={preview}
                            alt="Preview"
                            className="w-full h-auto object-contain max-h-[320px] rounded-xl"
                          />
                        )}
                      </div>
                      <p className="text-base text-slate-400 mt-4 truncate max-w-full">
                        {selectedFile?.name}
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center py-8">
                      <div className="w-20 h-20 bg-[#06b6d4]/15 text-[#06b6d4] rounded-2xl flex items-center justify-center mb-6">
                        <Upload className="w-10 h-10" />
                      </div>
                      <p className="text-xl text-slate-200 font-semibold">
                        {isDragActive ? 'วางไฟล์ที่นี่เลย' : 'ลากไฟล์มาวางที่นี่'}
                      </p>
                      <p className="text-base text-slate-500 mt-2">
                        หรือคลิกเพื่อเลือกไฟล์
                      </p>
                      <p className="text-sm text-slate-600 mt-6">
                        {activeTab === 'image'
                          ? 'รองรับ: JPG, PNG, WebP'
                          : 'รองรับ: MP4, AVI, MOV'}
                      </p>
                    </div>
                  )}
                </div>

                {preview && hasValidFile && (
                  <div className="flex gap-4 mt-6">
                    <button
                      onClick={handleDetect}
                      disabled={isLoading}
                      className="flex-1 py-4 px-6 bg-[#06b6d4] hover:bg-[#22d3ee] text-white rounded-xl text-lg font-bold disabled:opacity-70 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-3"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="w-6 h-6 animate-spin" />
                          <span>กำลังประมวลผล...</span>
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="w-6 h-6" />
                          <span>เริ่มตรวจจับ</span>
                        </>
                      )}
                    </button>
                    <button
                      onClick={handleReset}
                      className="p-4 border border-[#1e293b] text-slate-400 rounded-xl hover:bg-white/5 hover:text-white transition-colors"
                    >
                      <X className="w-6 h-6" />
                    </button>
                  </div>
                )}

                {isLoading && (
                  <div className="mt-6">
                    <div className="h-2 bg-[#1e293b] rounded-full overflow-hidden">
                      <div className="h-full bg-[#06b6d4] rounded-full animate-pulse" style={{ width: '40%' }} />
                    </div>
                    <p className="text-sm text-slate-500 mt-3">
                      กำลังประมวลผล... กรุณารอสักครู่
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Result */}
            {result && (
              <div className="bg-[#111827] rounded-2xl border border-[#1e293b] overflow-hidden">
                <div className="px-8 py-5 border-b border-[#1e293b] flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-white">ผลลัพธ์การตรวจจับ</h2>
                  {result.has_violation ? (
                    <span className="flex items-center gap-2 px-4 py-2 bg-red-500/15 text-red-400 rounded-lg text-sm font-semibold border border-red-500/30">
                      <ShieldAlert className="w-4 h-4" /> พบการฝ่าฝืน
                    </span>
                  ) : (
                    <span className="flex items-center gap-2 px-4 py-2 bg-emerald-500/15 text-emerald-400 rounded-lg text-sm font-semibold border border-emerald-500/30">
                      <ShieldCheck className="w-4 h-4" /> ปลอดภัย
                    </span>
                  )}
                </div>
                <div className="p-8">
                  <div className="rounded-xl overflow-hidden border border-[#1e293b] bg-black">
                    <img
                      src={activeTab === 'video'
                        ? detectionService.getResultVideoUrl(result.id)
                        : detectionService.getResultImageUrl(result.id)
                      }
                      alt="Detection Result"
                      className="w-full h-auto object-contain max-h-[500px]"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Panel */}
          <div className="xl:col-span-1">
            <div className="bg-[#111827] rounded-2xl border border-[#1e293b] overflow-hidden sticky top-8">
              <div className="px-6 py-5 border-b border-[#1e293b]">
                <h2 className="text-xl font-semibold text-white">สถานะการตรวจจับ</h2>
              </div>
              <div className="p-6 space-y-5">
                {result ? (
                  <>
                    {/* Status */}
                    <div
                      className={`p-5 rounded-xl border ${
                        result.has_violation
                          ? 'bg-red-500/10 border-red-500/30'
                          : 'bg-emerald-500/10 border-emerald-500/30'
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        {result.has_violation ? (
                          <AlertTriangle className="w-8 h-8 text-red-400 flex-shrink-0 mt-0.5" />
                        ) : (
                          <CheckCircle className="w-8 h-8 text-emerald-400 flex-shrink-0 mt-0.5" />
                        )}
                        <div>
                          <p className={`text-lg font-bold ${result.has_violation ? 'text-red-400' : 'text-emerald-400'}`}>
                            {result.has_violation ? 'พบการฝ่าฝืน' : 'ปฏิบัติตามครบถ้วน'}
                          </p>
                          <p className="text-base text-slate-400 mt-1">
                            {result.summary?.message || 'ไม่พบปัญหา'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-5 rounded-xl bg-[#0a0e17] border border-[#1e293b]">
                        <div className="flex items-center gap-2 text-slate-400 mb-2">
                          <Users className="w-5 h-5" />
                          <span className="text-sm font-medium">จำนวนคน</span>
                        </div>
                        <p className="text-3xl font-bold text-white">{result.person_count}</p>
                      </div>
                      <div className="p-5 rounded-xl bg-[#0a0e17] border border-[#1e293b]">
                        <div className="flex items-center gap-2 text-slate-400 mb-2">
                          <AlertTriangle className="w-5 h-5" />
                          <span className="text-sm font-medium">การฝ่าฝืน</span>
                        </div>
                        <p className={`text-3xl font-bold ${result.violation_count > 0 ? 'text-red-400' : 'text-white'}`}>
                          {result.violation_count}
                        </p>
                      </div>
                      <div className="p-5 rounded-xl bg-[#0a0e17] border border-[#1e293b] col-span-2">
                        <div className="flex items-center gap-2 text-slate-400 mb-2">
                          <Clock className="w-5 h-5" />
                          <span className="text-sm font-medium">เวลาประมวลผล</span>
                        </div>
                        <p className="text-3xl font-bold text-white">
                          {result.processing_time_ms ?? '-'} <span className="text-lg text-slate-400">ms</span>
                        </p>
                      </div>
                    </div>

                    {/* Per-Person PPE Details */}
                    {result.persons && result.persons.length > 0 && (
                      <div>
                        <h3 className="text-base font-semibold text-slate-300 mb-3">
                          รายละเอียด PPE แต่ละคน
                        </h3>
                        <div className="space-y-3">
                          {result.persons.map((person) => (
                            <div
                              key={person.id}
                              className={`p-4 rounded-xl border ${
                                person.is_compliant
                                  ? 'bg-emerald-500/5 border-emerald-500/20'
                                  : 'bg-red-500/5 border-red-500/20'
                              }`}
                            >
                              <div className="flex items-center justify-between mb-3">
                                <span className="text-sm font-bold text-white">
                                  คนที่ {person.id}
                                </span>
                                <span
                                  className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                                    person.is_compliant
                                      ? 'bg-emerald-500/20 text-emerald-400'
                                      : 'bg-red-500/20 text-red-400'
                                  }`}
                                >
                                  {person.is_compliant ? 'ปลอดภัย' : 'ฝ่าฝืน'}
                                </span>
                              </div>
                              <div className="space-y-1.5">
                                {person.wearing.map((item, i) => (
                                  <div key={`w-${i}`} className="flex items-center gap-2 text-sm">
                                    <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                                    <span className="text-emerald-300">{item}</span>
                                    <span className="text-emerald-500/60 text-xs ml-auto">สวมใส่</span>
                                  </div>
                                ))}
                                {person.not_wearing.map((item, i) => (
                                  <div key={`nw-${i}`} className="flex items-center gap-2 text-sm">
                                    <X className="w-4 h-4 text-red-400 flex-shrink-0" />
                                    <span className="text-red-300">{item}</span>
                                    <span className="text-red-500/60 text-xs ml-auto">ไม่สวมใส่</span>
                                  </div>
                                ))}
                              </div>
                              <div className="mt-2 text-xs text-slate-500">
                                ความมั่นใจ: {Math.round(person.confidence * 100)}%
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* General Violations Summary */}
                    {result.violations && result.violations.length > 0 && (
                      <div>
                        <h3 className="text-base font-semibold text-slate-300 mb-3">สรุปการฝ่าฝืน</h3>
                        <ul className="space-y-2.5">
                          {result.violations.map((v, i) => (
                            <li
                              key={i}
                              className="flex items-center gap-3 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-base"
                            >
                              <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                              {v}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="w-20 h-20 bg-[#1e293b] rounded-2xl flex items-center justify-center mb-5">
                      <ImageIcon className="w-10 h-10 text-slate-500" />
                    </div>
                    <p className="text-lg text-slate-400 font-medium">ยังไม่มีผลลัพธ์</p>
                    <p className="text-base text-slate-500 mt-2 max-w-[220px]">
                      อัปโหลดและกดตรวจจับเพื่อดูผลลัพธ์
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}
