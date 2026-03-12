import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Layout } from '../components/layout/Layout'
import { detectionService } from '../services/detection'
import type { Detection } from '../types'
import { Upload, AlertTriangle, CheckCircle, Loader2, X, Users, Image as ImageIcon, Camera } from 'lucide-react'
import toast from 'react-hot-toast'

export function DetectionPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [result, setResult] = useState<Detection | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0]
    if (file) {
      setSelectedFile(file)
      setPreview(URL.createObjectURL(file))
      setResult(null)
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 
      'image/*': ['.jpeg', '.jpg', '.png', '.webp'],
      'video/*': ['.mp4', '.avi', '.mov', '.webm']
    },
    maxFiles: 1,
  })

  const isVideoFile = selectedFile?.type.startsWith('video/')

  const handleDetect = async () => {
    if (!selectedFile) return

    setIsLoading(true)
    try {
      const detection = isVideoFile
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

  return (
    <Layout>
      <div className="space-y-6 sm:space-y-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">ตรวจจับ PPE</h1>
          <p className="text-slate-500 mt-1">อัปโหลดรูปภาพเพื่อตรวจจับการสวมใส่อุปกรณ์ความปลอดภัยอัตโนมัติ</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
          {/* Upload Section */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-sm">1</span>
                เตรียมรูปภาพ
              </h2>
            </div>
            
            <div className="p-6 flex-1 flex flex-col">
              <div
                {...getRootProps()}
                className={`relative flex-1 min-h-[300px] border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-200 flex flex-col items-center justify-center overflow-hidden group ${
                  isDragActive
                    ? 'border-blue-500 bg-blue-50/50'
                    : preview
                    ? 'border-slate-200 bg-slate-50/30 hover:border-blue-400'
                    : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50/50'
                }`}
              >
                <input {...getInputProps()} />

                {preview ? (
                  <div className="w-full h-full flex flex-col items-center justify-center">
                    <div className="relative w-full max-w-sm rounded-lg overflow-hidden shadow-sm border border-slate-200 group-hover:shadow-md transition-shadow">
                      {isVideoFile ? (
                        <video src={preview} controls className="w-full h-auto object-cover max-h-[300px] bg-black" />
                      ) : (
                        <img src={preview} alt="Preview" className="w-full h-auto object-cover max-h-[300px]" />
                      )}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm pointer-events-none">
                        <p className="text-white font-medium flex items-center gap-2">
                          <ImageIcon className="w-5 h-5" /> เปลี่ยนไฟล์
                        </p>
                      </div>
                    </div>
                    <p className="text-sm text-slate-500 mt-4 font-medium px-4 py-1.5 bg-white rounded-full border border-slate-200 shadow-sm truncate max-w-full">
                      {selectedFile?.name}
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center transform transition-transform group-hover:scale-105">
                    <div className="w-20 h-20 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mb-4 group-hover:bg-blue-100 transition-colors">
                      <Upload className="w-10 h-10" />
                    </div>
                    <p className="text-slate-700 font-semibold text-lg">
                      {isDragActive ? 'วางไฟล์ที่นี่เลย' : 'ลากไฟล์รูปภาพหรือวิดีโอมาวางที่นี่'}
                    </p>
                    <p className="text-sm text-slate-500 mt-2">หรือคลิกเพื่อเลือกไฟล์จากเครื่องของคุณ</p>
                    <div className="flex items-center gap-2 mt-6 text-xs text-slate-400 font-medium">
                      <span>รองรับ: ภาพ (JPG, PNG) และ วิดีโอ (MP4, WEBM)</span>
                      <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                      <span>สูงสุด 50MB</span>
                    </div>
                  </div>
                )}
              </div>

              {preview && (
                <div className="flex gap-4 mt-6 animate-in slide-in-from-bottom-2 fade-in duration-300">
                  <button
                    onClick={handleDetect}
                    disabled={isLoading}
                    className="flex-1 py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold hover:shadow-lg hover:shadow-blue-500/30 hover:-translate-y-0.5 disabled:opacity-70 disabled:hover:translate-y-0 disabled:hover:shadow-none transition-all flex items-center justify-center gap-2 text-lg"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>กำลังประมวลผล...</span>
                      </>
                    ) : (
                      <>
                        <Camera className="w-5 h-5" />
                        <span>เริ่มการตรวจจับ</span>
                      </>
                    )}
                  </button>
                  <button
                    onClick={handleReset}
                    title="ยกเลิก"
                    className="p-3 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition-colors flex items-center justify-center"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Results Section */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-sm">2</span>
                ผลลัพธ์
              </h2>
            </div>
            
            <div className="p-6 flex-1 flex flex-col">
              {result ? (
                <div className="space-y-6 animate-in fade-in zoom-in-95 duration-400">
                  <div className="relative rounded-xl overflow-hidden border border-slate-200 shadow-sm group">
                    {isVideoFile ? (
                      <video
                        src={detectionService.getResultVideoUrl(result.id)}
                        controls
                        autoPlay
                        muted
                        loop
                        className="w-full h-auto object-contain bg-slate-900 max-h-[500px]"
                      />
                    ) : (
                      <img
                        src={detectionService.getResultImageUrl(result.id)}
                        alt="Result"
                        className="w-full h-auto object-contain bg-slate-900"
                      />
                    )}
                    <div className="absolute inset-0 ring-1 ring-inset ring-black/10 rounded-xl pointer-events-none"></div>
                  </div>

                  <div className={`p-5 rounded-xl border ${result.has_violation ? 'bg-rose-50 border-rose-100' : 'bg-emerald-50 border-emerald-100'}`}>
                    <div className="flex items-start gap-4">
                      <div className={`p-2 rounded-full mt-1 ${result.has_violation ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'}`}>
                        {result.has_violation ? (
                          <AlertTriangle className="w-6 h-6" />
                        ) : (
                          <CheckCircle className="w-6 h-6" />
                        )}
                      </div>
                      <div>
                        <p className={`font-bold text-lg ${result.has_violation ? 'text-rose-700' : 'text-emerald-700'}`}>
                          {result.has_violation ? 'พบการฝ่าฝืนกฎความปลอดภัย!' : 'ปฏิบัติตามกฎถูกต้องครบถ้วน'}
                        </p>
                        <p className={`text-sm mt-1 leading-relaxed ${result.has_violation ? 'text-rose-600/80' : 'text-emerald-600/80'}`}>
                          {result.summary?.message || 'ไม่พบปัญหาในการตรวจสอบ'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-white border border-slate-200 p-4 rounded-xl text-center shadow-sm">
                      <div className="w-8 h-8 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center mx-auto mb-2">
                        <Users className="w-4 h-4" />
                      </div>
                      <p className="text-2xl font-bold text-slate-900 leading-none">{result.person_count}</p>
                      <p className="text-xs font-medium text-slate-500 mt-1 uppercase tracking-wide">จำนวนคน</p>
                    </div>
                    
                    <div className="bg-white border border-slate-200 p-4 rounded-xl text-center shadow-sm">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center mx-auto mb-2 ${result.violation_count > 0 ? 'bg-rose-50 text-rose-600' : 'bg-slate-50 text-slate-400'}`}>
                        <AlertTriangle className="w-4 h-4" />
                      </div>
                      <p className={`text-2xl font-bold leading-none ${result.violation_count > 0 ? 'text-rose-600' : 'text-slate-900'}`}>
                        {result.violation_count}
                      </p>
                      <p className="text-xs font-medium text-slate-500 mt-1 uppercase tracking-wide">จุดฝ่าฝืน</p>
                    </div>
                    
                    <div className="bg-white border border-slate-200 p-4 rounded-xl text-center shadow-sm">
                      <div className="w-8 h-8 bg-slate-50 text-slate-600 rounded-lg flex items-center justify-center mx-auto mb-2">
                        <span className="text-xs font-bold">ms</span>
                      </div>
                      <p className="text-2xl font-bold text-slate-900 leading-none">{result.processing_time_ms}</p>
                      <p className="text-xs font-medium text-slate-500 mt-1 uppercase tracking-wide">เวลาประมวลผล</p>
                    </div>
                  </div>

                  {result.violations && result.violations.length > 0 && (
                    <div className="p-5 bg-white border border-rose-100 rounded-xl shadow-sm relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-1 h-full bg-rose-500"></div>
                      <p className="font-bold text-slate-900 mb-3 text-sm">รายละเอียดการฝ่าฝืนที่พบ:</p>
                      <div className="flex flex-wrap gap-2">
                        {result.violations.map((v, i) => (
                          <span key={i} className="px-3 py-1.5 bg-rose-50 border border-rose-100 text-rose-700 text-xs font-semibold rounded-lg shadow-sm">
                            {v}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center py-12 px-4 border-2 border-dashed border-slate-100 rounded-xl bg-slate-50/50">
                  <div className="w-16 h-16 bg-white shadow-sm rounded-full flex items-center justify-center mb-4">
                    <ImageIcon className="w-8 h-8 text-slate-300" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mb-1">ยังไม่มีผลลัพธ์</h3>
                  <p className="text-sm text-slate-500 max-w-[250px]">
                    เมื่อคุณอัปโหลดและเริ่มต้นการตรวจจับ ผลลัพธ์จะแสดงขึ้นที่นี่
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}

