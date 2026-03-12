import { useEffect, useState } from 'react'
import { Layout } from '../components/layout/Layout'
import { detectionService } from '../services/detection'
import type { Detection } from '../types'
import { AlertTriangle, CheckCircle, Clock, ChevronLeft, ChevronRight, X, Users } from 'lucide-react'

export function HistoryPage() {
  const [detections, setDetections] = useState<Detection[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [selectedDetection, setSelectedDetection] = useState<Detection | null>(null)

  useEffect(() => {
    loadHistory()
  }, [page])

  const loadHistory = async () => {
    setLoading(true)
    try {
      const data = await detectionService.getHistory(page, 12)
      setDetections(data.items || [])
      setTotalPages(data.total_pages || 1)
    } catch (error) {
      console.error('Error loading history:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading && detections.length === 0) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-[calc(100vh-100px)]">
          <div className="flex flex-col items-center gap-4">
            <div className="spinner w-10 h-10 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin"></div>
            <div className="text-slate-500 font-medium animate-pulse">กำลังโหลดประวัติ...</div>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="space-y-6 sm:space-y-8">
        {/* Page Title */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">ประวัติการตรวจจับ</h1>
          <p className="text-slate-500 mt-1">ตรวจสอบผลการตรวจจับ PPE ย้อนหลังทั้งหมดในระบบ</p>
        </div>

        {detections.length === 0 && !loading ? (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-16 text-center flex flex-col items-center justify-center min-h-[400px]">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4">
              <Clock className="w-10 h-10 text-slate-300" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-1">ยังไม่มีประวัติการตรวจจับ</h3>
            <p className="text-slate-500">ผลการตรวจจับของคุณจะแสดงที่นี่หลังจากที่คุณเริ่มใช้งาน</p>
          </div>
        ) : (
          <>
            {/* Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {detections.map((detection) => (
                <div
                  key={detection.id}
                  className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden cursor-pointer hover:shadow-lg hover:-translate-y-1 hover:border-blue-200 transition-all duration-300 group flex flex-col"
                  onClick={() => setSelectedDetection(detection)}
                >
                  <div className="relative h-48 bg-slate-100 overflow-hidden">
                    <img
                      src={detectionService.getResultImageUrl(detection.id)}
                      alt={`Detection ${detection.id}`}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-between p-4">
                      {/* Optional overlay content */}
                    </div>
                    {/* Status Badge Over Image */}
                    <div className="absolute top-3 right-3">
                      {detection.has_violation ? (
                        <span className="px-3 py-1 bg-rose-500/90 backdrop-blur-sm text-white text-xs font-bold rounded-full shadow-sm flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> ฝ่าฝืน
                        </span>
                      ) : (
                        <span className="px-3 py-1 bg-emerald-500/90 backdrop-blur-sm text-white text-xs font-bold rounded-full shadow-sm flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" /> ปกติ
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="p-5 flex-1 flex flex-col">
                    <div className="flex items-center gap-2 text-slate-500 text-sm mb-3 font-medium">
                      <Clock className="w-4 h-4" />
                      {new Date(detection.created_at).toLocaleString('th-TH', { 
                        year: 'numeric', month: 'short', day: 'numeric', 
                        hour: '2-digit', minute: '2-digit' 
                      })}
                    </div>
                    
                    <div className="flex items-center gap-4 mt-auto pt-3 border-t border-slate-50">
                      <div className="flex items-center gap-1.5 text-slate-700">
                        <Users className="w-4 h-4 text-slate-400" />
                        <span className="font-semibold">{detection.person_count}</span>
                        <span className="text-xs text-slate-500">คน</span>
                      </div>
                      <div className="w-1 h-1 rounded-full bg-slate-300"></div>
                      <div className={`flex items-center gap-1.5 ${detection.violation_count > 0 ? 'text-rose-600' : 'text-slate-700'}`}>
                        <AlertTriangle className={`w-4 h-4 ${detection.violation_count > 0 ? 'text-rose-500' : 'text-slate-400'}`} />
                        <span className="font-semibold">{detection.violation_count}</span>
                        <span className="text-xs opacity-80">จุด</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center mt-10 gap-2 mb-8">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="p-2.5 bg-white border border-slate-200 rounded-xl shadow-sm hover:bg-slate-50 text-slate-600 disabled:opacity-50 disabled:hover:bg-white transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div className="px-4 py-2 bg-white border border-slate-200 rounded-xl shadow-sm text-sm font-medium text-slate-700">
                  หน้า {page} จาก {totalPages}
                </div>
                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  className="p-2.5 bg-white border border-slate-200 rounded-xl shadow-sm hover:bg-slate-50 text-slate-600 disabled:opacity-50 disabled:hover:bg-white transition-colors"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            )}
          </>
        )}

        {/* Detail Modal */}
        {selectedDetection && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
            <div 
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
              onClick={() => setSelectedDetection(null)}
            ></div>
            
            <div className="relative bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between p-5 border-b border-slate-100">
                <h2 className="text-xl font-bold text-slate-900">รายละเอียดการตรวจจับ</h2>
                <button
                  onClick={() => setSelectedDetection(null)}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="overflow-y-auto p-5 space-y-6">
                <div className="relative rounded-xl overflow-hidden border border-slate-200 shadow-sm bg-slate-900">
                  <img
                    src={detectionService.getResultImageUrl(selectedDetection.id)}
                    alt="Result"
                    className="w-full h-auto max-h-[50vh] object-contain"
                  />
                  <div className="absolute inset-0 ring-1 ring-inset ring-white/10 rounded-xl pointer-events-none"></div>
                </div>

                <div className={`p-4 rounded-xl border ${selectedDetection.has_violation ? 'bg-rose-50 border-rose-100' : 'bg-emerald-50 border-emerald-100'}`}>
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full ${selectedDetection.has_violation ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'}`}>
                      {selectedDetection.has_violation ? (
                        <AlertTriangle className="w-5 h-5" />
                      ) : (
                        <CheckCircle className="w-5 h-5" />
                      )}
                    </div>
                    <div>
                      <span className={`font-bold text-lg block ${selectedDetection.has_violation ? 'text-rose-700' : 'text-emerald-700'}`}>
                        {selectedDetection.has_violation ? 'พบประเด็นด้านความปลอดภัย' : 'ปกติ - ไม่พบการฝ่าฝืน'}
                      </span>
                      <span className="text-sm text-slate-600">
                        {new Date(selectedDetection.created_at).toLocaleString('th-TH')}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl text-center">
                    <Users className="w-6 h-6 text-blue-500 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-slate-900 leading-none">{selectedDetection.person_count}</p>
                    <p className="text-xs font-medium text-slate-500 mt-1 uppercase">จำนวนคนที่พบ</p>
                  </div>
                  <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl text-center">
                    <AlertTriangle className={`w-6 h-6 mx-auto mb-2 ${selectedDetection.violation_count > 0 ? 'text-rose-500' : 'text-slate-400'}`} />
                    <p className={`text-2xl font-bold leading-none ${selectedDetection.violation_count > 0 ? 'text-rose-600' : 'text-slate-900'}`}>
                      {selectedDetection.violation_count}
                    </p>
                    <p className="text-xs font-medium text-slate-500 mt-1 uppercase">จุดฝ่าฝืน</p>
                  </div>
                  <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl text-center">
                    <Clock className="w-6 h-6 text-indigo-500 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-slate-900 leading-none">{selectedDetection.processing_time_ms}</p>
                    <p className="text-xs font-medium text-slate-500 mt-1 uppercase">เวลาประมวลผล (ms)</p>
                  </div>
                </div>
                
                {selectedDetection.violations && selectedDetection.violations.length > 0 && (
                  <div className="p-4 bg-white border border-rose-100 rounded-xl shadow-sm mt-4 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-rose-500"></div>
                    <p className="font-bold text-slate-900 text-sm mb-3">รายการฝ่าฝืนที่พบ:</p>
                    <div className="flex flex-wrap gap-2">
                      {selectedDetection.violations.map((v, i) => (
                        <span key={i} className="px-3 py-1.5 bg-rose-50 border border-rose-100 text-rose-700 text-xs font-bold rounded-lg">
                          {v}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}

