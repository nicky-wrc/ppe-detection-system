import { useEffect, useState } from 'react'
import { Layout } from '../components/layout/Layout'
import { detectionService } from '../services/detection'
import type { Detection } from '../types'
import { AlertTriangle, CheckCircle, Clock, ChevronLeft, ChevronRight, X, Users, FileText, Download } from 'lucide-react'

export function HistoryPage() {
  const [detections, setDetections] = useState<Detection[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
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
      setTotal(data.total || 0)
    } catch (error) {
      console.error('Error loading history:', error)
    } finally {
      setLoading(false)
    }
  }

  const violationCount = detections.filter(d => d.has_violation).length
  const complianceCount = detections.filter(d => !d.has_violation).length

  if (loading && detections.length === 0) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-[calc(100vh-100px)]">
          <div className="flex flex-col items-center gap-4">
            <div className="w-10 h-10 border-4 border-[#1e293b] border-t-cyan-500 rounded-full animate-spin" />
            <div className="text-slate-400 font-medium">กำลังโหลดข้อมูล...</div>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-4">
            <FileText className="w-9 h-9 text-[#06b6d4]" />
            Safety Reports & Analytics
          </h1>
          <p className="text-base text-slate-400 mt-2">ประวัติการตรวจจับและรายงานความปลอดภัย</p>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="bg-[#111827] border border-[#1e293b] rounded-2xl p-7">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-red-500/20 flex items-center justify-center">
                <AlertTriangle className="w-7 h-7 text-red-400" />
              </div>
              <div>
                <p className="text-3xl font-bold text-white">{violationCount}</p>
                <p className="text-base text-slate-400 mt-1">Total Violations</p>
              </div>
            </div>
          </div>
          <div className="bg-[#111827] border border-[#1e293b] rounded-2xl p-7">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                <CheckCircle className="w-7 h-7 text-emerald-400" />
              </div>
              <div>
                <p className="text-3xl font-bold text-white">{complianceCount}</p>
                <p className="text-base text-slate-400 mt-1">Compliant</p>
              </div>
            </div>
          </div>
          <div className="bg-[#111827] border border-[#1e293b] rounded-2xl p-7">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-blue-500/20 flex items-center justify-center">
                <FileText className="w-7 h-7 text-blue-400" />
              </div>
              <div>
                <p className="text-3xl font-bold text-white">{total}</p>
                <p className="text-base text-slate-400 mt-1">Total Records</p>
              </div>
            </div>
          </div>
        </div>

        {detections.length === 0 && !loading ? (
          <div className="bg-[#111827] border border-[#1e293b] rounded-2xl py-20 text-center">
            <Clock className="w-20 h-20 text-slate-600 mx-auto mb-5" />
            <h3 className="text-xl font-bold text-white mb-2">ยังไม่มีประวัติการตรวจจับ</h3>
            <p className="text-base text-slate-400">ผลการตรวจจับจะแสดงที่นี่หลังจากที่เริ่มใช้งาน</p>
          </div>
        ) : (
          <>
            {/* Detection Table */}
            <div className="bg-[#111827] border border-[#1e293b] rounded-2xl overflow-hidden">
              <div className="px-8 py-6 border-b border-[#1e293b] flex items-center justify-between">
                <h2 className="text-xl font-semibold text-white">Detection Records</h2>
                <span className="text-base text-slate-400">{total} รายการ</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#1e293b]">
                      <th className="text-left py-5 px-8 text-sm font-semibold text-slate-400 uppercase">Thumbnail</th>
                      <th className="text-left py-5 px-8 text-sm font-semibold text-slate-400 uppercase">Date & Time</th>
                      <th className="text-left py-5 px-8 text-sm font-semibold text-slate-400 uppercase">Persons</th>
                      <th className="text-left py-5 px-8 text-sm font-semibold text-slate-400 uppercase">Violations</th>
                      <th className="text-left py-5 px-8 text-sm font-semibold text-slate-400 uppercase">Status</th>
                      <th className="text-left py-5 px-8 text-sm font-semibold text-slate-400 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detections.map((detection) => (
                      <tr
                        key={detection.id}
                        className="border-b border-[#1e293b] hover:bg-[#1e293b]/30 transition-colors cursor-pointer"
                        onClick={() => setSelectedDetection(detection)}
                      >
                        <td className="py-4 px-8">
                          <div className="w-16 h-16 rounded-lg overflow-hidden bg-[#0a0e17] border border-[#1e293b]">
                            <img
                              src={detectionService.getResultImageUrl(detection.id)}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          </div>
                        </td>
                        <td className="py-4 px-8 text-base text-slate-300">
                          {new Date(detection.created_at).toLocaleString('th-TH', {
                            year: 'numeric', month: 'short', day: 'numeric',
                            hour: '2-digit', minute: '2-digit'
                          })}
                        </td>
                        <td className="py-4 px-8">
                          <span className="flex items-center gap-2 text-base text-slate-300">
                            <Users className="w-5 h-5 text-slate-500" />
                            {detection.person_count}
                          </span>
                        </td>
                        <td className="py-4 px-8">
                          {detection.violations && detection.violations.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {detection.violations.slice(0, 2).map((v, i) => (
                                <span key={i} className="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs font-medium rounded-md border border-red-500/30">
                                  {v}
                                </span>
                              ))}
                              {detection.violations.length > 2 && (
                                <span className="px-2 py-0.5 bg-slate-700 text-slate-300 text-xs rounded-md">
                                  +{detection.violations.length - 2}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-sm text-slate-500">-</span>
                          )}
                        </td>
                        <td className="py-4 px-8">
                          {detection.has_violation ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-500/15 text-red-400 text-sm font-semibold rounded-lg border border-red-500/30">
                              <AlertTriangle className="w-4 h-4" /> Violation
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/15 text-emerald-400 text-sm font-semibold rounded-lg border border-emerald-500/30">
                              <CheckCircle className="w-4 h-4" /> Compliant
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-8">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              window.open(detectionService.getResultImageUrl(detection.id), '_blank')
                            }}
                            className="p-2.5 text-slate-500 hover:text-[#06b6d4] hover:bg-[#06b6d4]/10 rounded-lg transition-colors"
                            title="Download"
                          >
                            <Download className="w-5 h-5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pb-4">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="p-2.5 bg-[#111827] border border-[#1e293b] rounded-lg text-slate-400 hover:text-white hover:bg-[#1e293b] disabled:opacity-40 transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div className="px-4 py-2 bg-[#111827] border border-[#1e293b] rounded-lg text-sm font-medium text-slate-300">
                  หน้า {page} จาก {totalPages}
                </div>
                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  className="p-2.5 bg-[#111827] border border-[#1e293b] rounded-lg text-slate-400 hover:text-white hover:bg-[#1e293b] disabled:opacity-40 transition-colors"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            )}
          </>
        )}

        {/* Detail Modal */}
        {selectedDetection && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => setSelectedDetection(null)}
            />
            <div className="relative bg-[#111827] border border-[#1e293b] rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl">
              <div className="flex items-center justify-between p-5 border-b border-[#1e293b]">
                <h2 className="text-xl font-bold text-white">รายละเอียดการตรวจจับ</h2>
                <button
                  onClick={() => setSelectedDetection(null)}
                  className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="overflow-y-auto p-5 space-y-5">
                <div className="rounded-xl overflow-hidden border border-[#1e293b] bg-black">
                  <img
                    src={detectionService.getResultImageUrl(selectedDetection.id)}
                    alt="Result"
                    className="w-full h-auto max-h-[50vh] object-contain"
                  />
                </div>

                <div className={`p-4 rounded-xl border ${selectedDetection.has_violation ? 'bg-red-500/10 border-red-500/30' : 'bg-emerald-500/10 border-emerald-500/30'}`}>
                  <div className="flex items-center gap-3">
                    {selectedDetection.has_violation ? (
                      <AlertTriangle className="w-6 h-6 text-red-400" />
                    ) : (
                      <CheckCircle className="w-6 h-6 text-emerald-400" />
                    )}
                    <div>
                      <span className={`font-bold text-lg block ${selectedDetection.has_violation ? 'text-red-400' : 'text-emerald-400'}`}>
                        {selectedDetection.has_violation ? 'พบประเด็นด้านความปลอดภัย' : 'ปกติ - ไม่พบการฝ่าฝืน'}
                      </span>
                      <span className="text-sm text-slate-400">
                        {new Date(selectedDetection.created_at).toLocaleString('th-TH')}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-[#0a0e17] border border-[#1e293b] p-4 rounded-xl text-center">
                    <Users className="w-5 h-5 text-blue-400 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-white">{selectedDetection.person_count}</p>
                    <p className="text-xs text-slate-400 mt-1">จำนวนคน</p>
                  </div>
                  <div className="bg-[#0a0e17] border border-[#1e293b] p-4 rounded-xl text-center">
                    <AlertTriangle className={`w-5 h-5 mx-auto mb-2 ${selectedDetection.violation_count > 0 ? 'text-red-400' : 'text-slate-500'}`} />
                    <p className={`text-2xl font-bold ${selectedDetection.violation_count > 0 ? 'text-red-400' : 'text-white'}`}>
                      {selectedDetection.violation_count}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">จุดฝ่าฝืน</p>
                  </div>
                  <div className="bg-[#0a0e17] border border-[#1e293b] p-4 rounded-xl text-center">
                    <Clock className="w-5 h-5 text-cyan-400 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-white">{selectedDetection.processing_time_ms}</p>
                    <p className="text-xs text-slate-400 mt-1">ms</p>
                  </div>
                </div>

                {selectedDetection.violations && selectedDetection.violations.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-slate-300">รายการฝ่าฝืนที่พบ:</p>
                    <div className="flex flex-wrap gap-2">
                      {selectedDetection.violations.map((v, i) => (
                        <span key={i} className="px-3 py-1.5 bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-semibold rounded-lg">
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
