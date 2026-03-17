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
  Image as ImageIcon,
  ShieldCheck,
  ShieldAlert,
  Video,
} from 'lucide-react'
import toast from 'react-hot-toast'

type TabType = 'image' | 'video'

// ─── Inline style constants ───────────────────────────────────────────────────
const c = {
  // page wrapper
  page: { display: 'flex', flexDirection: 'column' as const, gap: '20px' },

  // top header row
  headerRow: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap' as const, gap: '12px' },
  pageTitle: { fontSize: '22px', fontWeight: 700, color: '#0f172a', margin: 0 },
  pageSubtitle: { fontSize: '13px', color: '#64748b', marginTop: '4px' },

  // tab switcher (top-right)
  tabs: { display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: '#f1f5f9', padding: '4px', borderRadius: '10px' },
  tabActive: { display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 18px', borderRadius: '7px', fontSize: '13px', fontWeight: 600, color: '#0f172a', backgroundColor: '#ffffff', border: 'none', cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' },
  tabInactive: { display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 18px', borderRadius: '7px', fontSize: '13px', fontWeight: 500, color: '#64748b', backgroundColor: 'transparent', border: 'none', cursor: 'pointer' },

  // two-column layout
  columns: { display: 'grid', gridTemplateColumns: '1fr 360px', gap: '20px', alignItems: 'start' },

  // card container
  card: { backgroundColor: '#ffffff', border: '1px solid #e5eaf0', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  cardHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid #f1f5f9' },
  cardTitle: { fontSize: '14px', fontWeight: 600, color: '#0f172a', margin: 0 },
  cardBody: { padding: '20px' },

  // dropzone
  dropzone: (active: boolean, hasFile: boolean) => ({
    minHeight: '280px',
    border: `2px dashed ${active ? '#2563eb' : hasFile ? '#cbd5e1' : '#d1d8e4'}`,
    borderRadius: '12px',
    display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center',
    textAlign: 'center' as const,
    cursor: 'pointer',
    backgroundColor: active ? '#eff6ff' : hasFile ? '#f8fafc' : '#fafbfc',
    transition: 'all 0.2s',
    padding: '24px',
  }),

  // detect button row
  detectRow: { display: 'flex', gap: '10px', marginTop: '16px' },
  detectBtn: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '11px 20px', backgroundColor: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' },
  detectBtnDisabled: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '11px 20px', backgroundColor: '#93c5fd', color: '#ffffff', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: 600, cursor: 'not-allowed' },
  resetBtn: { display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '11px 14px', backgroundColor: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: '10px', cursor: 'pointer' },

  // progress bar
  progressBar: { height: '4px', backgroundColor: '#e2e8f0', borderRadius: '2px', overflow: 'hidden', marginTop: '12px' },
  progressFill: { height: '100%', backgroundColor: '#2563eb', borderRadius: '2px', animation: 'progressPulse 1.5s ease-in-out infinite' },

  // result banner
  bannerSafe: { display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 14px', backgroundColor: '#dcfce7', color: '#16a34a', borderRadius: '8px', fontSize: '13px', fontWeight: 600, border: '1px solid #bbf7d0' },
  bannerViolation: { display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 14px', backgroundColor: '#fee2e2', color: '#dc2626', borderRadius: '8px', fontSize: '13px', fontWeight: 600, border: '1px solid #fecaca' },

  // right panel: status alert
  alertRed: { display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '14px', backgroundColor: '#fff1f2', border: '1px solid #fecaca', borderRadius: '12px', marginBottom: '16px' },
  alertGreen: { display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '14px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px', marginBottom: '16px' },

  // stats grid
  statsGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' },
  statBox: { backgroundColor: '#f8fafc', border: '1px solid #e5eaf0', borderRadius: '10px', padding: '14px 16px' },
  statLabel: { fontSize: '11px', color: '#94a3b8', fontWeight: 500, textTransform: 'uppercase' as const, letterSpacing: '0.05em', margin: '0 0 6px' },
  statValue: { fontSize: '28px', fontWeight: 700, color: '#0f172a', margin: 0 },
  statValueRed: { fontSize: '28px', fontWeight: 700, color: '#dc2626', margin: 0 },
  statBoxFull: { backgroundColor: '#f8fafc', border: '1px solid #e5eaf0', borderRadius: '10px', padding: '14px 16px', gridColumn: '1 / -1' as const },

  // per-person
  sectionTitle: { fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' as const, letterSpacing: '0.06em', margin: '16px 0 10px', display: 'flex', alignItems: 'center', gap: '6px' },
  personCard: (compliant: boolean) => ({
    border: `1px solid ${compliant ? '#bbf7d0' : '#fecaca'}`,
    borderRadius: '10px',
    padding: '12px 14px',
    backgroundColor: compliant ? '#f0fdf4' : '#fff1f2',
    marginBottom: '8px',
  }),
  personHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' },
  personName: { fontSize: '13px', fontWeight: 600, color: '#0f172a' },
  badgeSafe: { fontSize: '11px', fontWeight: 600, color: '#16a34a', backgroundColor: '#dcfce7', padding: '2px 8px', borderRadius: '20px' },
  badgeViolation: { fontSize: '11px', fontWeight: 600, color: '#dc2626', backgroundColor: '#fee2e2', padding: '2px 8px', borderRadius: '20px' },
  ppeRow: { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', marginBottom: '4px' },
  ppeOk: { color: '#16a34a' },
  ppeNo: { color: '#dc2626' },
  confidence: { fontSize: '11px', color: '#94a3b8', marginTop: '6px' },

  // violations summary
  violationItem: { display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', backgroundColor: '#fff1f2', border: '1px solid #fecaca', borderRadius: '8px', fontSize: '13px', color: '#dc2626', marginBottom: '6px' },

  // empty state
  emptyPanel: { display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center', padding: '40px 20px', textAlign: 'center' as const },
}

export function DetectionPage() {
  const [activeTab, setActiveTab] = useState<TabType>('image')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [result, setResult] = useState<Detection | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const imageDropzone = useDropzone({
    onDrop: useCallback((files: File[]) => {
      const f = files[0]
      if (f) { setSelectedFile(f); setPreview(URL.createObjectURL(f)); setResult(null) }
    }, []),
    accept: { 'image/*': ['.jpeg', '.jpg', '.png', '.webp'] },
    maxFiles: 1,
    disabled: activeTab !== 'image',
  })

  const videoDropzone = useDropzone({
    onDrop: useCallback((files: File[]) => {
      const f = files[0]
      if (f) { setSelectedFile(f); setPreview(URL.createObjectURL(f)); setResult(null) }
    }, []),
    accept: { 'video/mp4': ['.mp4'], 'video/x-msvideo': ['.avi'], 'video/quicktime': ['.mov'] },
    maxFiles: 1,
    disabled: activeTab !== 'video',
  })

  const getRootProps = activeTab === 'image' ? imageDropzone.getRootProps : videoDropzone.getRootProps
  const getInputProps = activeTab === 'image' ? imageDropzone.getInputProps : videoDropzone.getInputProps
  const isDragActive = activeTab === 'image' ? imageDropzone.isDragActive : videoDropzone.isDragActive

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab); setSelectedFile(null); setPreview(null); setResult(null)
  }

  const handleDetect = async () => {
    if (!selectedFile) return
    setIsLoading(true)
    try {
      const detection = activeTab === 'video'
        ? await detectionService.uploadVideo(selectedFile)
        : await detectionService.uploadImage(selectedFile)
      setResult(detection)
      toast.success('ตรวจจับสำเร็จ')
    } catch (error) {
      console.error(error)
      toast.error('เกิดข้อผิดพลาด กรุณาลองใหม่')
    } finally {
      setIsLoading(false)
    }
  }

  const handleReset = () => { setSelectedFile(null); setPreview(null); setResult(null) }

  const hasValidFile = activeTab === 'image'
    ? selectedFile?.type.startsWith('image/')
    : selectedFile?.type.startsWith('video/')

  return (
    <Layout>
      <div style={c.page}>

        {/* ── Page Header ── */}
        <div style={c.headerRow}>
          <div>
            <h1 style={c.pageTitle}>PPE Detection</h1>
            <p style={c.pageSubtitle}>Upload an image or video to automatically detect PPE compliance (helmet &amp; reflective vest).</p>
          </div>
          {/* Image / Video switcher */}
          <div style={c.tabs}>
            <button style={activeTab === 'image' ? c.tabActive : c.tabInactive} onClick={() => handleTabChange('image')}>
              <ImageIcon size={14} /> Image
            </button>
            <button style={activeTab === 'video' ? c.tabActive : c.tabInactive} onClick={() => handleTabChange('video')}>
              <Video size={14} /> Video
            </button>
          </div>
        </div>

        {/* ── Two column layout ── */}
        <div style={c.columns}>

          {/* ── LEFT: Upload + Result image ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* Upload card */}
            <div style={c.card}>
              <div style={c.cardHead}>
                <p style={c.cardTitle}>{activeTab === 'image' ? 'Upload Image' : 'Upload Video'}</p>
                {selectedFile && (
                  <button onClick={handleReset} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '2px' }}>
                    <X size={16} />
                  </button>
                )}
              </div>
              <div style={c.cardBody}>
                <div {...getRootProps()} style={c.dropzone(isDragActive, !!preview)}>
                  <input {...getInputProps()} />
                  {preview ? (
                    <div style={{ width: '100%' }}>
                      {activeTab === 'video' ? (
                        <video src={preview} controls style={{ width: '100%', borderRadius: '8px', maxHeight: '340px', backgroundColor: '#000' }} />
                      ) : (
                        <img src={preview} alt="Preview" style={{ width: '100%', borderRadius: '8px', maxHeight: '340px', objectFit: 'contain' }} />
                      )}
                      <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '8px', textAlign: 'center' }}>{selectedFile?.name}</p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', padding: '20px 0' }}>
                      <div style={{ width: '56px', height: '56px', borderRadius: '14px', backgroundColor: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Upload size={26} color="#2563eb" />
                      </div>
                      <div>
                        <p style={{ fontSize: '15px', fontWeight: 600, color: '#0f172a', margin: '0 0 4px' }}>
                          {isDragActive ? 'Drop your file here' : 'Drag & drop your file here'}
                        </p>
                        <p style={{ fontSize: '13px', color: '#94a3b8', margin: 0 }}>or click to browse</p>
                      </div>
                      <p style={{ fontSize: '11px', color: '#cbd5e1', marginTop: '4px' }}>
                        {activeTab === 'image' ? 'Supported: JPG, PNG, WebP' : 'Supported: MP4, AVI, MOV'}
                      </p>
                    </div>
                  )}
                </div>

                {/* Detect / Reset buttons */}
                {preview && hasValidFile && (
                  <div style={c.detectRow}>
                    <button
                      onClick={handleDetect}
                      disabled={isLoading}
                      style={isLoading ? c.detectBtnDisabled : c.detectBtn}
                    >
                      {isLoading ? (
                        <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Processing...</>
                      ) : (
                        <><ShieldCheck size={16} /> Start Detection</>
                      )}
                    </button>
                    <button onClick={handleReset} style={c.resetBtn}>
                      <X size={16} />
                    </button>
                  </div>
                )}

                {/* Progress bar */}
                {isLoading && (
                  <div style={c.progressBar}>
                    <div style={{ ...c.progressFill, width: '60%' }} />
                  </div>
                )}
              </div>
            </div>

            {/* Result image card */}
            {result && (
              <div style={c.card}>
                <div style={c.cardHead}>
                  <p style={c.cardTitle}>Detection Result</p>
                  <div style={result.has_violation ? c.bannerViolation : c.bannerSafe}>
                    {result.has_violation
                      ? <><ShieldAlert size={14} /> Violation Detected</>
                      : <><ShieldCheck size={14} /> Compliant</>
                    }
                  </div>
                </div>
                <div style={c.cardBody}>
                  <img
                    src={activeTab === 'video'
                      ? detectionService.getResultVideoUrl(result.id)
                      : detectionService.getResultImageUrl(result.id)
                    }
                    alt="Detection Result"
                    style={{ width: '100%', borderRadius: '10px', border: '1px solid #e5eaf0', maxHeight: '500px', objectFit: 'contain' }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* ── RIGHT: Status panel ── */}
          <div style={{ ...c.card, position: 'sticky' as const, top: '20px' }}>
            <div style={c.cardHead}>
              <p style={c.cardTitle}>Detection Status</p>
            </div>
            <div style={{ padding: '16px 18px', maxHeight: 'calc(100vh - 180px)', overflowY: 'auto' as const }}>
              {result ? (
                <>
                  {/* Status alert */}
                  <div style={result.has_violation ? c.alertRed : c.alertGreen}>
                    {result.has_violation
                      ? <AlertTriangle size={20} color="#dc2626" style={{ flexShrink: 0, marginTop: '1px' }} />
                      : <CheckCircle size={20} color="#16a34a" style={{ flexShrink: 0, marginTop: '1px' }} />
                    }
                    <div>
                      <p style={{ fontSize: '14px', fontWeight: 700, color: result.has_violation ? '#dc2626' : '#16a34a', margin: '0 0 2px' }}>
                        {result.has_violation ? 'Violation Detected' : 'Fully Compliant'}
                      </p>
                      <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>
                        {result.summary?.message || (result.has_violation ? `${result.violation_count} violation(s) found` : 'All persons wearing PPE correctly')}
                      </p>
                    </div>
                  </div>

                  {/* Stats */}
                  <div style={c.statsGrid}>
                    <div style={c.statBox}>
                      <p style={c.statLabel}><Users size={11} style={{ display: 'inline', marginRight: '3px' }} />Persons</p>
                      <p style={c.statValue}>{result.person_count ?? 0}</p>
                    </div>
                    <div style={c.statBox}>
                      <p style={c.statLabel}><AlertTriangle size={11} style={{ display: 'inline', marginRight: '3px' }} />Violations</p>
                      <p style={(result.violation_count ?? 0) > 0 ? c.statValueRed : c.statValue}>{result.violation_count ?? 0}</p>
                    </div>
                    <div style={c.statBoxFull}>
                      <p style={c.statLabel}><Clock size={11} style={{ display: 'inline', marginRight: '3px' }} />Processing Time</p>
                      <p style={c.statValue}>{result.processing_time_ms ?? '—'} <span style={{ fontSize: '14px', color: '#94a3b8', fontWeight: 500 }}>ms</span></p>
                    </div>
                  </div>

                  {/* Per-person PPE details */}
                  {result.persons && result.persons.length > 0 && (
                    <>
                      <p style={c.sectionTitle}>Per-Person PPE Details</p>
                      {result.persons.map((person) => (
                        <div key={person.id} style={c.personCard(person.is_compliant)}>
                          <div style={c.personHead}>
                            <span style={c.personName}>Person {person.id}</span>
                            <span style={person.is_compliant ? c.badgeSafe : c.badgeViolation}>
                              {person.is_compliant ? 'Compliant' : 'Violation'}
                            </span>
                          </div>
                          {person.wearing?.map((item, i) => (
                            <div key={`w${i}`} style={c.ppeRow}>
                              <CheckCircle size={13} color="#16a34a" />
                              <span style={c.ppeOk}>{item}</span>
                              <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#86efac' }}>Wearing</span>
                            </div>
                          ))}
                          {person.not_wearing?.map((item, i) => (
                            <div key={`nw${i}`} style={c.ppeRow}>
                              <X size={13} color="#dc2626" />
                              <span style={c.ppeNo}>{item}</span>
                              <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#fca5a5' }}>Not Wearing</span>
                            </div>
                          ))}
                          <p style={c.confidence}>Confidence: {Math.round(person.confidence * 100)}%</p>
                        </div>
                      ))}
                    </>
                  )}

                  {/* Violations summary */}
                  {result.violations && result.violations.length > 0 && (
                    <>
                      <p style={c.sectionTitle}>Violations Summary</p>
                      {result.violations.map((v, i) => (
                        <div key={i} style={c.violationItem}>
                          <AlertTriangle size={14} color="#dc2626" style={{ flexShrink: 0 }} />
                          {v}
                        </div>
                      ))}
                    </>
                  )}
                </>
              ) : (
                /* Empty state */
                <div style={c.emptyPanel}>
                  <div style={{ width: '56px', height: '56px', borderRadius: '14px', backgroundColor: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
                    <ImageIcon size={26} color="#cbd5e1" />
                  </div>
                  <p style={{ fontSize: '14px', fontWeight: 600, color: '#475569', margin: '0 0 6px' }}>No results yet</p>
                  <p style={{ fontSize: '13px', color: '#94a3b8', margin: 0, maxWidth: '180px', lineHeight: 1.5 }}>
                    Upload a file and click Start Detection to see results.
                  </p>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Spin animation for loader */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes progressPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </Layout>
  )
}
